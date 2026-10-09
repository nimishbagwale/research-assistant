// NEW FILE: all answer rendering lives here (parser + layouts). App.jsx only calls <AnswerView />.
import { useState } from 'react';
import { Sparkles, ListOrdered, Trophy, BookOpen, Code2, Scale, AlertTriangle, Copy, Check, ExternalLink, WrapText } from 'lucide-react';

/* ───────────── helpers ───────────── */
const BAD_SRC = ['source.com', 'example.com', 'bing.com/aclick'];
const isUsefulSource = (u) => !BAD_SRC.some((b) => u.includes(b));
const domainOf = (u) => { try { return new URL(u).hostname.replace('www.', ''); } catch { return u.slice(0, 28); } };
const CITE = String.raw`\[https?:\/\/[^\]\s]+\]|[【\[]\s*\d{1,2}(?:\s*[,，]\s*\d{1,2})*\s*[】\]]`; // [url] | [1] | [1,2] | 【1】
const bullet = (l) => l.replace(/^\s*(?:\d+[.)]\s+|[-*•]\s+)/, '').trim();

/* ───────────── parser ───────────── */
export function parseAnswer(raw) {
  const out = { format: 'research', summary: '', findings: [], table: [], code: [], sources: [], confidence: 'Medium' };
  if (!raw) return out;

  out.code = [...raw.matchAll(/```([\w+#.-]*)\n?([\s\S]*?)```/g)].map((m) => ({ lang: m[1] || 'code', code: m[2].trim() }));
  let declared = '';
  let srcSection = [];
  const sections = raw.split(/^##\s+/m).slice(raw.trimStart().startsWith('##') ? 0 : 1);
  for (const sec of sections) {
    const lines = sec.trim().split('\n');
    const h = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();
    const noCode = body.replace(/```[\s\S]*?```/g, '');
    if (h === 'format') declared = body.toLowerCase().trim();
    else if (h.includes('summary') || h.includes('answer') || h.includes('explanation')) out.summary = noCode.replace(/^\s*(summary|answer|explanation)\s*:?\s*/i, '').trim();
    else if (h.includes('key finding') || h.includes('step') || h.includes('point')) {
      out.findings = noCode.split('\n').map(bullet).filter((l) => l.length > 4 && !l.startsWith('(') && !(l.endsWith(':') && l.length < 40));
    } else if (h.includes('source')) srcSection = body.split('\n').map((l) => l.replace(/^\s*[-*•\d.]\s*/, '').trim()).filter((l) => /^https?:\/\//.test(l));
    else if (h.includes('confidence')) { const c = body.toLowerCase(); out.confidence = c.includes('high') ? 'High' : c.includes('low') ? 'Low' : 'Medium'; }
  }

  // sources: "## Sources" first (so [1] maps to the 1st), then any URL cited inline
  const inline = [...raw.matchAll(/\[(https?:\/\/[^\]\s]+)\]/g)].map((m) => m[1]);
  out.sources = [...new Set([...srcSection, ...inline])].filter(isUsefulSource).slice(0, 8);

  // table
  const tl = raw.split('\n').filter((l) => l.trim().startsWith('|'));
  if (tl.length >= 3) {
    const row = (r) => r.split('|').map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
    const head = row(tl[0]);
    for (let i = 2; i < tl.length; i++) {
      const c = row(tl[i]);
      if (c.length === head.length) out.table.push(Object.fromEntries(head.map((k, j) => [k, c[j]])));
    }
  }

  if (!out.summary) {
    out.summary = raw.replace(/```[\s\S]*?```/g, '').split('\n')
      .filter((l) => l.trim() && !/^\s*(#|\||[-*•]|\d+[.)])/.test(l)).slice(0, 3).join(' ').trim();
  }

  // format: backend declaration wins; otherwise structure-only fallback (never prose keywords)
  const known = ['code', 'comparison', 'howto', 'list', 'definition', 'research'];
  if (known.includes(declared)) {
    out.format = declared;
    if (out.format === 'comparison' && !out.table.length) out.format = 'research';
    if (out.format === 'code' && !out.code.length) out.format = 'research';
  } else {
    const stepLike = out.findings.filter((f) => /^step\s*\d+/i.test(f)).length;
    if (out.code.length) out.format = 'code';
    else if (out.table.length) out.format = 'comparison';
    else if (out.findings.length >= 2 && stepLike >= out.findings.length / 2) out.format = 'howto';
    else if (!raw.includes('##') && raw.split('\n').length < 6 && !out.findings.length) out.format = 'chat';
  }
  if (out.format === 'howto') out.findings = out.findings.map((f) => f.replace(/^step\s*\d+\s*[:.\-–]\s*/i, ''));
  return out;
}

/* ───────────── inline rendering: citations → superscripts, **bold**, `code` ───────────── */
function Rich({ text, sources }) {
  if (!text) return null;
  const re = new RegExp(`(${CITE})|(\\*\\*[^*]+\\*\\*)|(\`[^\`]+\`)`, 'g');
  const parts = []; let last = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1]) {
      const raw = m[1];
      const url = raw.startsWith('[http') ? raw.slice(1, -1) : null;
      const idx = url ? sources.indexOf(url) : -1;
      const nums = url ? (idx >= 0 ? [idx + 1] : []) : raw.match(/\d+/g).map(Number).filter((n) => n <= sources.length);
      parts.push({ t: 'cite', v: nums });
    } else if (m[2]) parts.push({ t: 'b', v: m[2].slice(2, -2) });
    else parts.push({ t: 'c', v: m[3].slice(1, -1) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: 'text', v: text.slice(last) });

  // tidy spaces around removed/rendered citations
  parts.forEach((p, i) => {
    if (p.t !== 'text') return;
    if (parts[i + 1]?.t === 'cite') p.v = p.v.replace(/\s+$/, '');
    if (parts[i - 1]?.t === 'cite') p.v = p.v.replace(/^\s+([.,;:!?])/, '$1');
  });

  return parts.map((p, i) => {
    if (p.t === 'text') return <span key={i}>{p.v}</span>;
    if (p.t === 'b') return <strong key={i}>{p.v}</strong>;
    if (p.t === 'c') return <code key={i} className="rv-inline-code">{p.v}</code>;
    return p.v.map((n) => (
      <sup key={`${i}-${n}`} className="rv-cite"><a href={sources[n - 1]} target="_blank" rel="noreferrer" title={domainOf(sources[n - 1])}>{n}</a></sup>
    ));
  });
}

/* ───────────── shared pieces ───────────── */
const META = {
  research: { label: 'Research brief', icon: Sparkles },
  comparison: { label: 'Comparison', icon: Scale },
  howto: { label: 'Guide', icon: ListOrdered },
  list: { label: 'Top picks', icon: Trophy },
  definition: { label: 'Explainer', icon: BookOpen },
  code: { label: 'Code', icon: Code2 },
};

function useCopy() {
  const [done, setDone] = useState(false);
  const copy = (txt) => { navigator.clipboard?.writeText(txt); setDone(true); setTimeout(() => setDone(false), 1800); };
  return [done, copy];
}

function Frame({ a, raw, children }) {
  const { label, icon: Icon } = META[a.format];
  const [done, copy] = useCopy();
  const plain = raw.replace(/\n*##\s*Format[\s\S]*$/i, '').trim();
  return (
    <article className="rv-card">
      <header className="rv-head">
        <span className="rv-chip"><Icon size={14} /> {label}</span>
        <span className={`rv-conf ${a.confidence.toLowerCase()}`}><i />{a.confidence} confidence</span>
        <button className="rv-ghost" onClick={() => copy(plain)} aria-label="Copy answer">{done ? <Check size={14} /> : <Copy size={14} />}{done ? 'Copied' : 'Copy'}</button>
      </header>
      {a.confidence === 'Low' && <div className="rv-warn"><AlertTriangle size={14} /> Limited sources found. Verify important details.</div>}
      <div className="rv-body">{children}</div>
      {a.sources.length > 0 && (
        <footer className="rv-foot">
          <span className="rv-label">Sources</span>
          <div className="rv-srcs">
            {a.sources.slice(0, 6).map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="rv-src">
                <b>{i + 1}</b>
                <img src={`https://www.google.com/s2/favicons?domain=${domainOf(u)}&sz=32`} alt="" width="14" height="14" loading="lazy" />
                {domainOf(u)} <ExternalLink size={10} />
              </a>
            ))}
            {a.sources.length > 6 && <span className="rv-more">+{a.sources.length - 6} more</span>}
          </div>
        </footer>
      )}
    </article>
  );
}

const Lead = ({ a }) => a.summary ? <p className="rv-lead"><Rich text={a.summary} sources={a.sources} /></p> : null;

/* ───────────── layouts ───────────── */
function Research({ a }) {
  return (<>
    <Lead a={a} />
    {a.findings.length > 0 && <ol className="rv-points">{a.findings.map((f, i) => <li key={i}><span className="rv-num">{i + 1}</span><p><Rich text={f} sources={a.sources} /></p></li>)}</ol>}
  </>);
}

function HowTo({ a }) {
  return (<>
    <Lead a={a} />
    <ol className="rv-steps">{a.findings.map((f, i) => {
      const cut = f.search(/[.:–-]\s/); // first sentence becomes the step title
      const title = cut > 12 && cut < 90 ? f.slice(0, cut) : '';
      const rest = title ? f.slice(cut + 1).trim() : f;
      return (<li key={i}><span className="rv-dot">{i + 1}</span><div>{title && <h4><Rich text={title} sources={a.sources} /></h4>}<p><Rich text={rest} sources={a.sources} /></p></div></li>);
    })}</ol>
  </>);
}

function Ranked({ a }) {
  return (<>
    <Lead a={a} />
    <ol className="rv-rank">{a.findings.map((f, i) => <li key={i} className={i === 0 ? 'top' : ''}><span>{String(i + 1).padStart(2, '0')}</span><p><Rich text={f} sources={a.sources} /></p></li>)}</ol>
  </>);
}

function Definition({ a }) {
  return (<>
    <div className="rv-callout"><span className="rv-label">In simple terms</span><p><Rich text={a.summary} sources={a.sources} /></p></div>
    {a.findings.length > 0 && <div className="rv-worth"><span className="rv-label">Worth knowing</span><ul>{a.findings.slice(0, 4).map((f, i) => <li key={i}><Rich text={f} sources={a.sources} /></li>)}</ul></div>}
  </>);
}

function Cell({ v, sources }) {
  if (/^[★☆\s]+$/.test(v) && /★/.test(v)) return <span className="rv-stars" aria-label={`${(v.match(/★/g) || []).length} of 5`}>{v}</span>;
  if (/^[$₹€£]\s?[\d,]+/.test(v)) return <span className="rv-price">{v}</span>;
  return <Rich text={v} sources={sources} />;
}

function Compare({ a }) {
  const cols = Object.keys(a.table[0]);
  return (<>
    <Lead a={a} />
    <div className="rv-table-wrap">
      <table className="rv-table">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{a.table.map((r, i) => (
          <tr key={i}>{cols.map((c, j) => <td key={c} data-label={c} className={j === 0 ? 'first' : ''}><Cell v={r[c]} sources={a.sources} /></td>)}</tr>
        ))}</tbody>
      </table>
    </div>
    {a.findings.length > 0 && <div className="rv-callout"><span className="rv-label">Takeaways</span><ul>{a.findings.slice(0, 4).map((f, i) => <li key={i}><Rich text={f} sources={a.sources} /></li>)}</ul></div>}
  </>);
}

function CodeBlock({ lang, code }) {
  const [done, copy] = useCopy();
  const [wrap, setWrap] = useState(false);
  return (
    <div className="rv-code">
      <div className="rv-code-bar">
        <span>{lang}</span>
        <div>
          <button className="rv-ghost" onClick={() => setWrap((w) => !w)} aria-pressed={wrap}><WrapText size={14} />Wrap</button>
          <button className="rv-ghost" onClick={() => copy(code)}>{done ? <Check size={14} /> : <Copy size={14} />}{done ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
      <pre style={{ whiteSpace: wrap ? 'pre-wrap' : 'pre' }}><code>{code}</code></pre>
    </div>
  );
}

function CodeView({ a }) {
  return (<>
    <Lead a={a} />
    {a.code.map((b, i) => <CodeBlock key={i} {...b} />)}
    {a.findings.length > 0 && <div className="rv-worth"><span className="rv-label">How it works</span><ul>{a.findings.slice(0, 4).map((f, i) => <li key={i}><Rich text={f} sources={a.sources} /></li>)}</ul></div>}
  </>);
}

/* ───────────── entry point ───────────── */
export default function AnswerView({ text, isStreaming }) {
  if (isStreaming) {
    return (<div className="rv-card rv-skel" aria-busy="true"><i /><i /><i style={{ width: '70%' }} /><i style={{ width: '85%' }} /></div>);
  }
  const a = parseAnswer(text);
  if (a.format === 'chat') return <div className="message-text">{a.summary || text}</div>;
  const Body = { research: Research, comparison: Compare, howto: HowTo, list: Ranked, definition: Definition, code: CodeView }[a.format];
  return <Frame a={a} raw={text}><Body a={a} /></Frame>;
}