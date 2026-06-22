import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { parseResponse, getDomain } from '../api/parser.js';

function CellValue({ value }) {
  if (/^[★☆⭐️\s]+$/.test(value) && /[★☆⭐]/.test(value)) {
    return (
      <span className="star-rating">
        {value.split('').map((c, i) =>
          c === '★' || c === '⭐' ? <span key={i} className="star filled">★</span>
          : c === '☆' ? <span key={i} className="star empty">☆</span>
          : null
        )}
      </span>
    );
  }
  if (/^\$[\d,]+/.test(value)) return <span className="cell-price">{value}</span>;
  const qualityMap = { excellent: 'badge-excellent', 'very good': 'badge-verygood', good: 'badge-good', fair: 'badge-fair', poor: 'badge-poor' };
  const lower = value.toLowerCase();
  for (const [word, cls] of Object.entries(qualityMap)) {
    if (lower === word) return <span className={`quality-badge ${cls}`}>{value}</span>;
  }
  return <span>{value}</span>;
}

function SourcesAndConfidence({ sources, confidence }) {
  const confClass = confidence.toLowerCase().includes('high') ? 'high'
                  : confidence.toLowerCase().includes('low') ? 'low' : 'medium';
  return (
    <div className="confidence-row">
      <div className="sources-block">
        <div className="report-section-label">Sources</div>
        {sources.length > 0 ? (
          <div className="sources-row">
            {sources.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="source-chip">
                {getDomain(url)} <ExternalLink size={10} />
              </a>
            ))}
          </div>
        ) : (
          <span className="no-sources">No sources extracted.</span>
        )}
      </div>
      <div className="confidence-block">
        <div className="report-section-label" style={{ textAlign: 'right' }}>Confidence</div>
        <span className={`confidence-badge ${confClass}`}>{confidence.toUpperCase()}</span>
      </div>
    </div>
  );
}

// Renders summary text — if it contains a code block, render it properly
function SummaryWithCode({ text }) {
  const parts = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: text.slice(last, match.index) });
    parts.push({ type: 'code', lang: match[1] || 'text', content: match[2].trimEnd() });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });

  return (
    <>
      {parts.map((p, i) =>
        p.type === 'text'
          ? <p key={i} className="report-summary">{p.content.trim()}</p>
          : <CodeBlock key={i} lang={p.lang} code={p.content} />
      )}
    </>
  );
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="code-block-wrap">
      <div className="code-block-header">
        <span className="code-lang">{lang}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-block"><code>{code}</code></pre>
    </div>
  );
}

function ResearchLayout({ summary, findings, sources, confidence }) {
  return (
    <div className="report-card">
      {summary && (
        <div className="report-section">
          <div className="report-section-label">Summary</div>
          <p className="report-summary">{summary}</p>
        </div>
      )}
      {findings.length > 0 && (
        <div className="report-section">
          <div className="report-section-label">Key Findings</div>
          <div className="findings-list">
            {findings.map((f, i) => (
              <div key={i} className="finding-item">
                <span className="finding-index">{i + 1}</span>
                <span className="finding-text">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <SourcesAndConfidence sources={sources} confidence={confidence} />
    </div>
  );
}

function ComparisonLayout({ summary, table, findings, sources, confidence }) {
  return (
    <div className="report-card report-card-comparison">
      {summary && (
        <div className="report-section">
          <div className="report-section-label">Summary</div>
          <p className="report-summary">{summary}</p>
        </div>
      )}
      {table.length > 0 && (
        <div className="report-section">
          <div className="report-section-label">Comparison</div>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>{Object.keys(table[0]).map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr key={i}>
                    {Object.entries(row).map(([, v], j) => (
                      <td key={j} className={j === 0 ? 'td-primary' : ''}>
                        <CellValue value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {findings.length > 0 && (
        <div className="report-section">
          <div className="report-section-label">Key Findings</div>
          <div className="findings-list findings-compact">
            {findings.map((f, i) => (
              <div key={i} className="finding-item finding-item-compact">
                <span className="finding-dot" />
                <span className="finding-text">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <SourcesAndConfidence sources={sources} confidence={confidence} />
    </div>
  );
}

function ListLayout({ summary, findings, sources, confidence }) {
  return (
    <div className="report-card report-card-list">
      {summary && (
        <div className="report-section">
          <div className="report-section-label">Overview</div>
          <p className="report-summary">{summary}</p>
        </div>
      )}
      {findings.length > 0 && (
        <div className="report-section">
          <div className="report-section-label">Results</div>
          <div className="list-grid">
            {findings.map((f, i) => (
              <div key={i} className="list-card">
                <span className="list-card-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="list-card-text">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <SourcesAndConfidence sources={sources} confidence={confidence} />
    </div>
  );
}

// Code layout — summary with inline code block + explanation findings
function CodeLayout({ summary, findings, sources, confidence }) {
  return (
    <div className="report-card report-card-code">
      {summary && (
        <div className="report-section">
          <div className="report-section-label">Solution</div>
          <SummaryWithCode text={summary} />
        </div>
      )}
      {findings.length > 0 && (
        <div className="report-section">
          <div className="report-section-label">How it works</div>
          <div className="findings-list">
            {findings.map((f, i) => (
              <div key={i} className="finding-item">
                <span className="finding-index">{i + 1}</span>
                <span className="finding-text">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <SourcesAndConfidence sources={sources} confidence={confidence} />
    </div>
  );
}

function ChatLayout({ summary }) {
  return (
    <div className="report-card report-card-chat">
      <p className="chat-response-text">{summary}</p>
    </div>
  );
}

export default function ReportCard({ text, isStreaming }) {
  if (isStreaming) {
    return (
      <div className="report-card">
        <div className="streaming-dots"><span /><span /><span /></div>
        <p className="raw-stream">{text || ''}</p>
      </div>
    );
  }

  const { summary, findings, sources, confidence, table, queryType } = parseResponse(text);

  if (queryType === 'chat') return <ChatLayout summary={summary || text} />;
  if (queryType === 'code') return <CodeLayout summary={summary} findings={findings} sources={sources} confidence={confidence} />;
  if (queryType === 'comparison') return <ComparisonLayout summary={summary} table={table} findings={findings} sources={sources} confidence={confidence} />;
  if (queryType === 'list') return <ListLayout summary={summary} findings={findings} sources={sources} confidence={confidence} />;
  return <ResearchLayout summary={summary} findings={findings} sources={sources} confidence={confidence} />;
}