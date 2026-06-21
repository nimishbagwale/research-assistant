// Strip inline citation patterns like [1], [https://...], [text](url)
function stripInlineCitations(text) {
  return text
    .replace(/\s*\[https?:\/\/[^\]]+\]/g, '')   // [https://example.com]
    .replace(/\s*\[\d+\]/g, '')                   // [1], [2], [3]
    .replace(/\*\*(.*?)\*\*/g, '$1')              // **bold**
    .replace(/\*(.*?)\*/g, '$1')                  // *italic*
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')           // [text](url)
    .trim();
}

// Detect if a line is a section header leaking into findings
function isSectionHeader(line) {
  const lower = line.toLowerCase().trim();
  const headers = [
    'advantages', 'disadvantages', 'strengths', 'weaknesses',
    'pros', 'cons', 'here are', 'key insight', 'the following',
    'note:', 'summary:', 'comparison:'
  ];
  // Short lines ending with colon are usually headers
  if (lower.endsWith(':') && lower.length < 40) return true;
  return headers.some(h => lower.startsWith(h) && lower.length < 35);
}

export function parseResponse(raw) {
  if (!raw) return { summary: '', findings: [], sources: [], confidence: 'Medium', table: [], queryType: 'research' };

  let summary = '';
  let findings = [];
  let sources = [];
  let confidence = 'Medium';
  let table = [];

  // Detect query type for UI variation
  const rawLower = raw.toLowerCase();
  let queryType = 'research';
  if (!raw.includes('##') && raw.split('\n').length < 6) queryType = 'chat';
  else if (rawLower.includes('| item') || rawLower.includes('| gpu') || rawLower.includes('| library') || rawLower.includes('| framework')) queryType = 'comparison';
  else if (findings.length > 4) queryType = 'list';

  // Split by ## headings
  const sections = raw.split(/^##\s+/m);
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const heading = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (heading.includes('summary')) {
      summary = stripInlineCitations(body);

    } else if (heading.includes('key finding')) {
      findings = body.split('\n')
        .map(l => l.replace(/^\s*(?:\d+[.)* ]|[-*•])\s*/, '').trim())
        .map(stripInlineCitations)
        .filter(l => l.length > 4 && !isSectionHeader(l) && !l.startsWith('('));

    } else if (heading.includes('source')) {
      sources = body.split('\n')
        .map(l => l.replace(/^\s*[-*•\d.]\s*/, '').trim())
        .filter(l => /^https?:\/\//.test(l))
        // Filter out fake/ad URLs
        .filter(l => !l.includes('source.com') && !l.includes('example.com') && !l.includes('bing.com/aclick'));

    } else if (heading.includes('confidence')) {
      const c = body.trim().toLowerCase();
      confidence = c.includes('high') ? 'High' : c.includes('low') ? 'Low' : 'Medium';
    }
  }

  // Fallback URLs — filter fakes
  if (sources.length === 0) {
    const inlineMatches = [...raw.matchAll(/\[https?:\/\/([^\]\s]+)\]/g)];
    const inlineUrls = inlineMatches.map(m => 'https://' + m[1]);
    const plainUrls = (raw.match(/(?<!\[)https?:\/\/[^\s),\]"'<>]+/g) || []);
    const all = [...inlineUrls, ...plainUrls];
    sources = [...new Set(all)]
      .filter(u => !u.includes('source.com') && !u.includes('example.com') && !u.includes('bing.com/aclick'))
      .slice(0, 8);
  }

  // Parse markdown table
  const tableLines = raw.split('\n').filter(l => l.trim().startsWith('|'));
  if (tableLines.length >= 3) {
    const parseRow = r =>
      r.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
    const headerCols = parseRow(tableLines[0]);
    for (let i = 2; i < tableLines.length; i++) {
      const cols = parseRow(tableLines[i]);
      if (cols.length === headerCols.length) {
        const row = {};
        headerCols.forEach((h, idx) => { row[h] = cols[idx]; });
        table.push(row);
      }
    }
    if (table.length > 0) queryType = 'comparison';
  }

  // Fallback summary
  if (!summary) {
    const prosLines = raw.split('\n').filter(l =>
      !l.startsWith('#') && !l.startsWith('|') &&
      !l.startsWith('-') && !l.startsWith('*') && l.trim()
    );
    summary = stripInlineCitations(prosLines.slice(0, 3).join(' '));
  }

  // Detect list queries
  if (findings.length >= 5 && table.length === 0) queryType = 'list';

  return { summary, findings, sources, confidence, table, queryType };
}

export function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url.slice(0, 28); }
}