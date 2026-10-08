import { useState, useEffect, useRef } from 'react';
import { Sparkles, Plus, History, Trash2, Settings, Sun, Moon, X, Globe2, ChevronDown, ArrowUp, Activity, Check, Circle, ChevronRight, Clock3, Cpu, AlertCircle, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://research-assistant-api-1cvk.onrender.com';

const STEP_ORDER = ['planning', 'researching', 'analyzing', 'tools', 'summarizing', 'critiquing'];

const STEP_META = [
  { id: 'planning', label: 'Planning', description: 'Breaking down your question' },
  { id: 'researching', label: 'Researching', description: 'Searching the web & extracting sources' },
  { id: 'analyzing', label: 'Analyzing', description: 'Reasoning over the evidence' },
  { id: 'tools', label: 'Using Tools', description: 'Calculator, code, currency, date/time' },
  { id: 'summarizing', label: 'Generating Response', description: 'Compiling the answer' },
  { id: 'critiquing', label: 'Reviewing', description: 'Checking quality — may send back for revision' },
];

function getUserId() {
  const key = 'ara_user_id';
  let uid = localStorage.getItem(key);
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, uid);
  }
  return uid;
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function apiRequest(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  return response;
}

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState('none');
  const [light, setLight] = useState(false);
  const [sources, setSources] = useState([]);
  const [stepsState, setStepsState] = useState(STEP_ORDER.reduce((acc, id) => ({ ...acc, [id]: 'pending' }), {}));
  const [historySearch, setHistorySearch] = useState('');

  const lastDoneRef = useRef(-1);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  }, [light]);

  useEffect(() => { void loadHistory(); }, []);

  function resetSteps() {
    lastDoneRef.current = -1;
    setStepsState(STEP_ORDER.reduce((acc, id) => ({ ...acc, [id]: 'pending' }), {}));
  }

  function markDone(stepId) {
    const idx = STEP_ORDER.indexOf(stepId);
    if (idx === -1) return;
    setStepsState(prev => {
      const next = { ...prev };
      for (let i = lastDoneRef.current + 1; i < idx; i++) {
        if (next[STEP_ORDER[i]] !== 'done') next[STEP_ORDER[i]] = 'skipped';
      }
      next[stepId] = 'done';
      const after = STEP_ORDER[idx + 1];
      if (after && next[after] !== 'done') next[after] = 'active';
      return next;
    });
    lastDoneRef.current = idx;
  }

  function finishSteps() {
    setStepsState(prev => {
      const next = { ...prev };
      STEP_ORDER.forEach(id => { if (next[id] !== 'done') next[id] = 'skipped'; });
      return next;
    });
  }

  async function loadHistory() {
    try {
      const response = await apiRequest(`/history?user_id=${encodeURIComponent(getUserId())}`);
      if (!response.ok) throw new Error('Could not load history');
      const data = await response.json();
      const loaded = (data.sessions ?? []).map((session, index) => {
        const id = session.id ?? session.session_id ?? `history-${index}`;
        const history = session.messages ?? session.history ?? session.chat_history ?? [];
        return {
          id,
          title: session.title ?? session.name ?? `Research session ${index + 1}`,
          date: session.date ?? '',
          status: 'Completed',
          messages: history.flatMap((message, messageIndex) => [
            { id: `${id}-u-${messageIndex}`, sender: 'user', text: message.user_query ?? message.query ?? message.question ?? '', time: '' },
            { id: `${id}-a-${messageIndex}`, sender: 'agent', text: message.assistant_response ?? message.response ?? message.answer ?? '', time: '', isReport: true },
          ]),
        };
      });
      setSessions(loaded);
    } catch {
      setError('The research server is currently unavailable.');
    }
  }

  function selectSession(session) {
    setActiveId(session.id);
    setMessages(session.messages);
    resetSteps();
    setPanel('none');
  }

  async function newSession() {
    let sid;
    try {
      const response = await apiRequest('/session/new', { method: 'POST', body: JSON.stringify({ user_id: getUserId() }) });
      const data = await response.json();
      sid = data.session_id;
    } catch {
      sid = `local-${Date.now()}`;
    }
    const session = { id: sid, title: 'New Research', date: new Date().toLocaleDateString(), status: 'In Progress', messages: [] };
    setSessions(prev => [session, ...prev]);
    setActiveId(sid);
    setMessages([]);
    setSources([]);
    resetSteps();
    setPanel('none');
  }

  async function deleteSession(event, id) {
    event.stopPropagation();
    try { await apiRequest(`/session/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* ignore */ }
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (activeId === id) {
      setActiveId(updated[0]?.id ?? null);
      setMessages(updated[0]?.messages ?? []);
    }
  }

  async function clearHistory() {
    try {
      await apiRequest('/clear', { method: 'POST' });
    } catch { /* ignore */ }
    setSessions([]);
    setActiveId(null);
    setMessages([]);
    setPanel('none');
  }

  async function submit(event) {
    event.preventDefault();
    if (!input.trim() || running) return;
    const query = input.trim();
    setInput('');
    setRunning(true);
    setError(null);
    setSources([]);
    resetSteps();

    let sessionId = activeId;
    const userMessage = { id: `u-${Date.now()}`, sender: 'user', text: query, time: timeLabel() };

    if (!sessionId) {
      try {
        const response = await apiRequest('/session/new', { method: 'POST', body: JSON.stringify({ user_id: getUserId() }) });
        sessionId = (await response.json()).session_id;
      } catch { sessionId = `local-${Date.now()}`; }
      const session = { id: sessionId, title: query.slice(0, 44), date: new Date().toLocaleDateString(), status: 'In Progress', messages: [userMessage] };
      setSessions(prev => [session, ...prev]);
      setActiveId(sessionId);
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'In Progress', title: s.title === 'New Research' ? query.slice(0, 44) : s.title, messages: [...s.messages, userMessage] } : s));
    }

    const agentId = `a-${Date.now()}`;
    const placeholder = { id: agentId, sender: 'agent', text: '', time: timeLabel(), isReport: true, isStreaming: true };
    setMessages(prev => [...prev, userMessage, placeholder]);

    try {
      const payload = { query, session_id: sessionId, mode: 'deep', user_id: getUserId() };
      const response = await apiRequest('/chat/stream', { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok || !response.body) throw new Error('Streaming unavailable');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalText = '';

      while (true) {
        const result = await reader.read();
        buffer += decoder.decode(result.value ?? new Uint8Array(), { stream: !result.done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let eventData;
          try { eventData = JSON.parse(line); } catch { continue; }
          if (eventData.event === 'done' && eventData.step) markDone(eventData.step);
          if (eventData.event === 'revert') { /* critic is reviewing */ }
          if (eventData.event === 'final') {
            finalText = eventData.text ?? '';
            finishSteps();
            setMessages(prev => prev.map(m => m.id === agentId ? { ...m, text: finalText, isStreaming: false } : m));
            const parsedSources = extractSources(finalText);
            if (parsedSources.length) setSources(parsedSources);
          }
          if (eventData.event === 'error') throw new Error(eventData.message ?? 'Research failed');
        }
        if (result.done) break;
      }

      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: s.title === 'New Research' ? query.slice(0, 44) : s.title, status: 'Completed', messages: [...s.messages, userMessage, { ...placeholder, text: finalText, isStreaming: false }] } : s));
    } catch {
      try {
        const response = await apiRequest('/chat', { method: 'POST', body: JSON.stringify({ query, session_id: sessionId, mode: 'deep', user_id: getUserId() }) });
        if (!response.ok) throw new Error('Research failed');
        const data = await response.json();
        const finalText = data.response ?? '';
        finishSteps();
        setMessages(prev => prev.map(m => m.id === agentId ? { ...m, text: finalText, isStreaming: false } : m));
        const parsedSources = extractSources(finalText);
        if (parsedSources.length) setSources(parsedSources);
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: s.title === 'New Research' ? query.slice(0, 44) : s.title, status: 'Completed', messages: [...s.messages, userMessage, { ...placeholder, text: finalText, isStreaming: false }] } : s));
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : 'Research could not be completed';
        setError(message);
        setMessages(prev => prev.map(m => m.id === agentId ? { ...m, text: 'I could not reach the research service. Please try again in a moment.', isError: true, isStreaming: false } : m));
      }
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(event); }
  }

  function togglePanel(next) {
    setPanel(current => (current === next ? 'none' : next));
  }

  const currentSession = sessions.find(s => s.id === activeId);
  const filteredSessions = sessions.filter(s => s.title.toLowerCase().includes(historySearch.toLowerCase()));

  return (
    <div className="app-shell">
      <main className="main-content">
        <header className="topbar">
          <div className="header-brand">
            <div className="brand-mark"><Sparkles size={18} /></div>
            <div><strong>Research Assistant</strong><span>Search smarter. Get real answers.</span></div>
          </div>
          <div className="topbar-actions">
            <button className="topbar-new" onClick={() => void newSession()}><Plus size={15} /> New Chat</button>
            <span className="topbar-divider" />
            <button className={`icon-button ${panel === 'history' ? 'icon-active' : ''}`} title="History" onClick={() => togglePanel('history')}><History size={17} /></button>
            <button className="icon-button" title="Toggle theme" onClick={() => setLight(value => !value)}>{light ? <Moon size={17} /> : <Sun size={17} />}</button>
            <button className={`icon-button ${panel === 'settings' ? 'icon-active' : ''}`} title="Settings" onClick={() => togglePanel('settings')}><Settings size={17} /></button>
          </div>
        </header>

        <div className="workspace">
          <section className="conversation-area">
            <div className="welcome-block">
              <div className="eyebrow"><span className="eyebrow-line" /> Agentic research workspace</div>
              <h1>{messages.length ? currentSession?.title ?? 'Your research' : <>Good evening, <em>Nimish.</em></>}</h1>
              <p>{messages.length ? 'Ask a follow-up question to keep building your research.' : 'Ask me anything — from the latest news to in-depth research, comparisons, analysis, or just general questions.'}</p>
            </div>
            <div className="messages-scroll">
              <div className="messages">
                {messages.map((message) => (
                  <article className={`message ${message.sender}`} key={message.id}>
                    <div className="message-avatar">{message.sender === 'user' ? 'N' : <Sparkles size={15} />}</div>
                    <div className="message-body">
                      <div className="message-meta">{message.sender === 'user' ? 'You' : 'Research Desk'} <span>{message.time}</span></div>
                      {message.isError ? (
                        <div className="message-error">{message.text}</div>
                      ) : message.sender === 'agent' && message.isReport ? (
                        <ReportContent text={message.text} isStreaming={message.isStreaming} />
                      ) : (
                        <div className="message-text">{message.text || (running ? <span className="typing"><i /><i /><i /></span> : '')}</div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="composer-wrap">
              <form className="composer" onSubmit={(event) => void submit(event)}>
                <div className="composer-toolbar">
                  <button type="button" className="mode-picker"><Globe2 size={16} /> Web research <ChevronDown size={14} /></button>
                </div>
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="What would you like to understand?" rows={1} />
                <button className="send-button" disabled={!input.trim() || running} type="submit">{running ? <Activity size={19} /> : <ArrowUp size={20} />}</button>
              </form>
              <div className="composer-hint">Press Enter to research <span>•</span> Shift + Enter for a new line</div>
            </div>
          </section>

          <aside className={`insight-panel ${panel !== 'none' ? 'panel-hidden' : ''}`}>
            <div className="panel-header">
              <div><span className="panel-kicker"><Activity size={14} /> Live system</span><h2>Research pipeline</h2></div>
              <span className={`running-pill ${running ? 'is-running' : ''}`}><span /> {running ? 'Working' : 'Standby'}</span>
            </div>
            <div className="pipeline">
              {STEP_META.map((step, index) => {
                const state = stepsState[step.id];
                return (
                  <div className={`pipeline-step ${state}`} key={step.id}>
                    <div className="step-marker">{state === 'done' ? <Check size={14} /> : state === 'active' ? <span className="pulse" /> : state === 'skipped' ? <span className="dash" /> : <Circle size={13} />}</div>
                    {index < STEP_META.length - 1 && <div className="step-line" />}
                    <div className="step-copy"><strong>{step.label}</strong><span>{step.description}</span></div>
                    <time>{state === 'done' ? 'Done' : state === 'active' ? 'Now' : ''}</time>
                  </div>
                );
              })}
            </div>
            <div className="panel-divider" />
            <div className="sources-header">
              <strong>Sources{sources.length ? ` (${sources.length})` : ''}</strong>
              {sources.length > 4 && <button>View all <ChevronRight size={14} /></button>}
            </div>
            <div className="source-list">
              {sources.length === 0 && <p className="no-sources">Sources from your research will appear here.</p>}
              {sources.slice(0, 4).map((source) => (
                <a className="source-item" key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  <span className="source-logo">{source.domain.charAt(0).toUpperCase()}</span>
                  <span><strong>{source.domain}</strong><small>{source.url.length > 48 ? `${source.url.slice(0, 48)}…` : source.url}</small></span>
                  <ChevronRight size={14} />
                </a>
              ))}
            </div>
          </aside>

          {panel === 'history' && (
            <aside className="overlay-panel">
              <div className="overlay-panel-header">
                <div className="history-heading"><h2><History size={17} /> History</h2><button className="clear-history" onClick={() => void clearHistory()}>Clear all</button></div>
                <button className="icon-button" onClick={() => setPanel('none')}><X size={16} /></button>
              </div>
              <div className="history-search-bar">
                <input type="text" placeholder="Search sessions..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
              </div>
              <div className="overlay-panel-body">
                {filteredSessions.length === 0 && <p className="empty-history">Your research history will appear here once you start a session.</p>}
                {filteredSessions.map((session) => (
                  <button className={`history-item ${session.id === activeId ? 'selected' : ''}`} key={session.id} onClick={() => selectSession(session)}>
                    <Cpu size={15} />
                    <span className="history-copy">
                      <strong>{session.title}</strong>
                      <small>{session.status}{session.date ? ` · ${session.date}` : ''}</small>
                    </span>
                    <Trash2 className="delete-session" size={14} onClick={(event) => void deleteSession(event, session.id)} />
                  </button>
                ))}
              </div>
            </aside>
          )}

          {panel === 'settings' && (
            <aside className="overlay-panel">
              <div className="overlay-panel-header">
                <h2><Settings size={17} /> Settings</h2>
                <button className="icon-button" onClick={() => setPanel('none')}><X size={16} /></button>
              </div>
              <div className="overlay-panel-body">
                <div className="settings-group">
                  <label className="settings-label">Appearance</label>
                  <button className="settings-row" onClick={() => setLight((value) => !value)}>
                    <span>{light ? <Sun size={16} /> : <Moon size={16} />} {light ? 'Light mode' : 'Dark mode'}</span>
                    <span className="settings-toggle">{light ? 'On' : 'Off'}</span>
                  </button>
                </div>
                <div className="settings-group">
                  <label className="settings-label">Research</label>
                  <div className="settings-row static"><span><Globe2 size={16} /> Web research mode</span><span className="settings-value">Deep</span></div>
                  <div className="settings-row static"><span><Clock3 size={16} /> Stream responses</span><span className="settings-value">Enabled</span></div>
                </div>
                <div className="settings-group">
                  <label className="settings-label">Account</label>
                  <div className="settings-row static"><span><Sparkles size={16} /> Signed in as</span><span className="settings-value">Guest</span></div>
                </div>
              </div>
            </aside>
          )}
        </div>

        {error && <div className="error-toast"><AlertCircle size={16} /><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
      </main>
    </div>
  );
}

function extractSources(text) {
  if (!text) return [];
  const inlineMatches = [...text.matchAll(/\[https?:\/\/([^\]\s]+)\]/g)];
  const inlineUrls = inlineMatches.map(m => 'https://' + m[1]);
  const plainUrls = text.match(/(?<!\[)https?:\/\/[^\s),\]"'<>]+/g) || [];
  const all = [...new Set([...inlineUrls, ...plainUrls])]
    .filter(u => !u.includes('source.com') && !u.includes('example.com') && !u.includes('bing.com/aclick'));
  return all.slice(0, 8).map(url => {
    try { return { url, domain: new URL(url).hostname.replace('www.', '') }; }
    catch { return { url, domain: url.slice(0, 28) }; }
  });
}

function ReportContent({ text, isStreaming }) {
  if (isStreaming && !text) {
    return (
      <div className="report-streaming">
        <div className="streaming-dots"><span /><span /><span /></div>
      </div>
    );
  }
  if (isStreaming) {
    return <div className="message-text raw-stream">{text}</div>;
  }

  const parsed = parseReport(text);
  if (parsed.queryType === 'chat') {
    return <div className="message-text">{parsed.summary || text}</div>;
  }

  return (
    <div className="report-card">
      {parsed.summary && (
        <div className="report-section">
          <div className="report-section-label">Summary</div>
          <p className="report-summary">{parsed.summary}</p>
        </div>
      )}
      {parsed.findings.length > 0 && (
        <div className="report-section">
          <div className="report-section-label">Key Findings</div>
          <div className="findings-list">
            {parsed.findings.map((f, i) => (
              <div className="finding-item" key={i}>
                <span className="finding-index">{i + 1}</span>
                <span className="finding-text">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {parsed.table.length > 0 && (
        <div className="report-section">
          <div className="report-section-label">Comparison</div>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>{Object.keys(parsed.table[0]).map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {parsed.table.map((row, i) => (
                  <tr key={i}>
                    {Object.entries(row).map(([, v], j) => (
                      <td key={j} className={j === 0 ? 'td-primary' : ''}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {(parsed.sources.length > 0 || parsed.confidence) && (
        <div className="confidence-row">
          <div className="sources-block">
            <div className="report-section-label">Sources</div>
            {parsed.sources.length > 0 ? (
              <div className="sources-row">
                {parsed.sources.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="source-chip">
                    {getDomain(url)} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            ) : <span className="no-sources">No sources extracted.</span>}
          </div>
          {parsed.confidence && (
            <div className="confidence-block">
              <div className="report-section-label" style={{ textAlign: 'right' }}>Confidence</div>
              <span className={`confidence-badge ${parsed.confidence.toLowerCase()}`}>{parsed.confidence.toUpperCase()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const headers = ['advantages', 'disadvantages', 'strengths', 'weaknesses', 'pros', 'cons', 'here are', 'key insight', 'the following', 'note:', 'summary:', 'comparison:'];
  if (lower.endsWith(':') && lower.length < 40) return true;
  return headers.some(h => lower.startsWith(h) && lower.length < 35);
}

function parseReport(raw) {
  if (!raw) return { summary: '', findings: [], sources: [], confidence: 'Medium', table: [], queryType: 'research' };
  let summary = '';
  let findings = [];
  let sources = [];
  let confidence = 'Medium';
  let table = [];
  let queryType = 'research';

  if (!raw.includes('##') && raw.split('\n').length < 6) queryType = 'chat';

  const sections = raw.split(/^##\s+/m);
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const heading = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (heading.includes('summary')) {
      summary = body.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s*\[https?:\/\/[^\]]+\]/g, '').trim();
    } else if (heading.includes('key finding')) {
      const cleanBody = body.replace(/```[\s\S]*?```/g, '').trim();
      findings = cleanBody.split('\n').map(l => l.replace(/^\s*(?:\d+[.)* ]|[-*•])\s*/, '').trim()).map(stripInlineCitations).filter(l => l.length > 4 && !isSectionHeader(l) && !l.startsWith('(') && !l.startsWith('`'));
    } else if (heading.includes('source')) {
      sources = body.split('\n').map(l => l.replace(/^\s*[-*•\d.]\s*/, '').trim()).filter(l => /^https?:\/\//.test(l)).filter(l => !l.includes('source.com') && !l.includes('example.com') && !l.includes('bing.com/aclick'));
    } else if (heading.includes('confidence')) {
      const c = body.trim().toLowerCase();
      confidence = c.includes('high') ? 'High' : c.includes('low') ? 'Low' : 'Medium';
    }
  }

  if (sources.length === 0) {
    const inlineMatches = [...raw.matchAll(/\[https?:\/\/([^\]\s]+)\]/g)];
    const inlineUrls = inlineMatches.map(m => 'https://' + m[1]);
    const plainUrls = raw.match(/(?<!\[)https?:\/\/[^\s),\]"'<>]+/g) || [];
    sources = [...new Set([...inlineUrls, ...plainUrls])].filter(u => !u.includes('source.com') && !u.includes('example.com') && !u.includes('bing.com/aclick')).slice(0, 8);
  }

  const tableLines = raw.split('\n').filter(l => l.trim().startsWith('|'));
  if (tableLines.length >= 3) {
    const parseRow = r => r.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
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

  if (!summary) {
    const prosLines = raw.replace(/```[\s\S]*?```/g, '').split('\n').filter(l => !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('-') && !l.startsWith('*') && l.trim());
    summary = stripInlineCitations(prosLines.slice(0, 3).join(' '));
  }

  if (table.length > 0) queryType = 'comparison';
  else if (findings.length >= 5) queryType = 'list';

  return { summary, findings, sources, confidence, table, queryType };
}

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url.slice(0, 28); }
}
