function stripInlineCitations(text) {
  return text
    .replace(/\s*\[https?:\/\/[^\]]+\]/g, '')
    .replace(/\s*\[\d+\]/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();
}

function isSectionHeader(line) {
  const lower = line.toLowerCase().trim();
  const headers = [
    'advantages', 'disadvantages', 'strengths', 'weaknesses',
    'pros', 'cons', 'here are', 'key insight', 'the following',
    'note:', 'summary:', 'comparison:'
  ];
  if (lower.endsWith(':') && lower.length < 40) return true;
  return headers.some(h => lower.startsWith(h) && lower.length < 35);
}

// Extract code blocks from raw text — returns array of {lang, code}
export function extractCodeBlocks(raw) {
  const blocks = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    blocks.push({ lang: match[1] || 'text', code: match[2].trimEnd() });
  }
  return blocks;
}

// Remove code blocks from text so they don't bleed into findings
function stripCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, '').trim();
}

export function parseResponse(raw) {
  if (!raw) return { summary: '', findings: [], sources: [], confidence: 'Medium', table: [], queryType: 'research', codeBlocks: [] };

  // Extract code blocks globally before any parsing
  const codeBlocks = extractCodeBlocks(raw);

  let summary = '';
  let findings = [];
  let sources = [];
  let confidence = 'Medium';
  let table = [];

  const rawLower = raw.toLowerCase();
  let queryType = 'research';
  if (!raw.includes('##') && raw.split('\n').length < 6) queryType = 'chat';

  const sections = raw.split(/^##\s+/m);
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const heading = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (heading.includes('summary')) {
      // Keep code blocks inside summary for rendering
      summary = body
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/\s*\[https?:\/\/[^\]]+\]/g, '')
        .trim();

    } else if (heading.includes('key finding')) {
      // Strip code blocks FIRST before splitting into findings
      const cleanBody = stripCodeBlocks(body);
      findings = cleanBody.split('\n')
        .map(l => l.replace(/^\s*(?:\d+[.)* ]|[-*•])\s*/, '').trim())
        .map(stripInlineCitations)
        .filter(l => l.length > 4 && !isSectionHeader(l) && !l.startsWith('(') && !l.startsWith('`'));

    } else if (heading.includes('source')) {
      sources = body.split('\n')
        .map(l => l.replace(/^\s*[-*•\d.]\s*/, '').trim())
        .filter(l => /^https?:\/\//.test(l))
        .filter(l => !l.includes('source.com') && !l.includes('example.com') && !l.includes('bing.com/aclick'));

    } else if (heading.includes('confidence')) {
      const c = body.trim().toLowerCase();
      confidence = c.includes('high') ? 'High' : c.includes('low') ? 'Low' : 'Medium';
    }
  }

  // Fallback URLs
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
    const prosLines = stripCodeBlocks(raw).split('\n').filter(l =>
      !l.startsWith('#') && !l.startsWith('|') &&
      !l.startsWith('-') && !l.startsWith('*') && l.trim()
    );
    summary = stripInlineCitations(prosLines.slice(0, 3).join(' '));
  }

  // queryType logic — code takes priority
  if (codeBlocks.length > 0) queryType = 'code';
  else if (table.length > 0) queryType = 'comparison';
  else if (findings.length >= 5) queryType = 'list';

  return { summary, findings, sources, confidence, table, queryType, codeBlocks };
}

export function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url.slice(0, 28); }
}