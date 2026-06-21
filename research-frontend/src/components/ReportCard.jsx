import { ExternalLink, AlertTriangle } from 'lucide-react';
import { parseResponse, getDomain } from '../api/parser.js';

// Renders star/emoji ratings and price cells
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
                {getDomain(url)} <ExternalLink />
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

// ── Layout variants ──────────────────────────────────────────────

// Default research layout: Summary → Findings → Sources
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

// Comparison layout: Summary → Table → Findings (compact) → Sources
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

// List layout: Summary → numbered list cards (bigger, spaced) → Sources
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

// Chat layout: just the text, no sections
function ChatLayout({ summary }) {
  return (
    <div className="report-card report-card-chat">
      <p className="chat-response-text">{summary}</p>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────
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
  if (queryType === 'comparison') return <ComparisonLayout summary={summary} table={table} findings={findings} sources={sources} confidence={confidence} />;
  if (queryType === 'list') return <ListLayout summary={summary} findings={findings} sources={sources} confidence={confidence} />;
  return <ResearchLayout summary={summary} findings={findings} sources={sources} confidence={confidence} />;
}