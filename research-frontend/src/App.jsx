import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import AgentActivity from './components/AgentActivity.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import { fetchHistory, postChatStream, newSessionApi, deleteSessionApi, STEP_ORDER, getUserId } from './api/client.js';

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function nowFull() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function freshStepStatus() {
  return STEP_ORDER.reduce((acc, id) => ({ ...acc, [id]: 'pending' }), {});
}

export default function App() {
  const [sessions, setSessions]       = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [logs, setLogs]               = useState([]);
  const [stepStatus, setStepStatus]   = useState(freshStepStatus());
  const [input, setInput]             = useState('');
  const [running, setRunning]         = useState(false);
  const [apiError, setApiError]       = useState(null);
  const [light, setLight]             = useState(false);

  const lastDoneIdxRef = useRef(-1);

  // Initialize user ID on first load
  useEffect(() => { getUserId(); }, []);

  // FIX 4: Apply theme to document root so CSS variables cascade globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  }, [light]);

  useEffect(() => { loadHistory(); }, []);

  const addLog = (text, type = 'info') =>
    setLogs(prev => [...prev, { time: nowFull(), text, type }]);

  async function loadHistory() {
    try {
      const data = await fetchHistory();
      if (!data?.sessions?.length) return;
      const mapped = data.sessions.map(s => ({
        id: s.id,
        title: s.title,
        date: s.date,
        status: 'Completed',
        messages: s.messages.flatMap((m, i) => [
          { id: `u-${s.id}-${i}`, sender: 'user',  text: m.user_query,        time: '' },
          { id: `a-${s.id}-${i}`, sender: 'agent', text: m.assistant_response, time: '', isReport: true },
        ]),
      }));
      setSessions(mapped);
    } catch {
      setApiError('Backend unreachable at localhost:8000. Start your FastAPI server.');
    }
  }

  function resetStepper() {
    lastDoneIdxRef.current = -1;
    setStepStatus(freshStepStatus());
  }

  function applyDone(stepId) {
    const idx = STEP_ORDER.indexOf(stepId);
    if (idx === -1) return;
    setStepStatus(prev => {
      const next = { ...prev };
      // Mark any skipped-over steps between last done and this one
      for (let i = lastDoneIdxRef.current + 1; i < idx; i++) {
        if (next[STEP_ORDER[i]] !== 'done') next[STEP_ORDER[i]] = 'skipped';
      }
      next[stepId] = 'done';
      // Activate the next step
      const after = STEP_ORDER[idx + 1];
      if (after && next[after] !== 'done') next[after] = 'active';
      return next;
    });
    lastDoneIdxRef.current = idx;
  }

  // FIX 1: applyFinal marks ALL non-done steps as skipped,
  // not just ones after lastDoneIdxRef — prevents any step from staying 'active'
  function applyFinal() {
    setStepStatus(prev => {
      const next = { ...prev };
      STEP_ORDER.forEach(stepId => {
        if (next[stepId] !== 'done') next[stepId] = 'skipped';
      });
      return next;
    });
  }

  function selectSession(id) {
    setActiveId(id);
    const s = sessions.find(x => x.id === id);
    if (s) {
      setMessages(s.messages);
      setLogs([{ time: nowFull(), text: `Loaded: ${s.title}`, type: 'info' }]);
      resetStepper();
    }
  }

  // FIX 3: deleteSession now calls the backend API to persist the deletion
  async function deleteSession(e, id) {
    e.stopPropagation();
    try { await deleteSessionApi(id); } catch { /* silently ignore if backend is down */ }
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (activeId === id) {
      setActiveId(updated[0]?.id ?? null);
      setMessages(updated[0]?.messages ?? []);
    }
  }

  async function newSession() {
    try {
      const data = await newSessionApi();
      const sid = data.session_id;
      const newS = {
        id: sid,
        title: 'New Research',
        date: new Date().toLocaleDateString(),
        status: 'In Progress',
        messages: [],
      };
      setSessions(prev => [newS, ...prev]);
      setActiveId(sid);
      setMessages([]);
      resetStepper();
      setLogs([{ time: nowFull(), text: 'New session ready.', type: 'info' }]);
    } catch {
      const sid = `session-${Date.now()}`;
      const newS = {
        id: sid,
        title: 'New Research',
        date: new Date().toLocaleDateString(),
        status: 'In Progress',
        messages: [],
      };
      setSessions(prev => [newS, ...prev]);
      setActiveId(sid);
      setMessages([]);
      resetStepper();
      setLogs([{ time: nowFull(), text: 'New session ready (offline).', type: 'info' }]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || running) return;

    const query = input.trim();
    setInput('');
    setRunning(true);
    setApiError(null);
    resetStepper();

    const time = now();
    const userMsg = { id: `u-${Date.now()}`, sender: 'user', text: query, time };

    let sid = activeId;
    if (!sid) {
      try {
        const data = await newSessionApi();
        sid = data.session_id;
      } catch {
        sid = `session-${Date.now()}`;
      }
      const newS = {
        id: sid,
        title: query.slice(0, 48),
        date: new Date().toLocaleDateString(),
        status: 'In Progress',
        messages: [userMsg],
      };
      setSessions(prev => [newS, ...prev]);
      setActiveId(sid);
    } else {
      setSessions(prev => prev.map(s =>
        s.id === sid
          ? { ...s, status: 'In Progress', title: s.title === 'New Research' ? query.slice(0, 48) : s.title, messages: [...s.messages, userMsg] }
          : s
      ));
    }
    setMessages(prev => [...prev, userMsg]);

    const agentId = `a-${Date.now()}`;
    const agentPlaceholder = {
      id: agentId, sender: 'agent', text: '', time: now(),
      isReport: true, isStreaming: true,
    };
    setMessages(prev => [...prev, agentPlaceholder]);
    addLog('Request sent to backend...');

    try {
      let finalText = '';

      await postChatStream(query, sid, (evt) => {
        if (evt.event === 'done') {
          addLog(`${evt.step} — done`, 'success');
          applyDone(evt.step);
        } else if (evt.event === 'revert') {
          // FIX 1: Do NOT reset any step statuses on revert.
          // The 'critiquing' step was already set to 'active' by applyDone('summarizing').
          // It stays active/spinning until the full critic→summarize→critic loop finishes
          // and the final 'done' for critiquing arrives.
          addLog(`Critic reviewing — refining the answer…`, 'info');
        } else if (evt.event === 'final') {
          finalText = evt.text;
          applyFinal();
          setMessages(prev => prev.map(m =>
            m.id === agentId ? { ...m, text: evt.text } : m
          ));
        }
      });

      setMessages(prev => prev.map(m =>
        m.id === agentId ? { ...m, isStreaming: false } : m
      ));

      addLog('Research complete.', 'success');

      setSessions(prev => prev.map(s =>
        s.id === sid ? {
          ...s, status: 'Completed',
          messages: [...s.messages, { ...agentPlaceholder, text: finalText, isStreaming: false }]
        } : s
      ));

    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
      setMessages(prev => prev.map(m =>
        m.id === agentId
          ? { ...m, text: `Error: ${err.message}`, isError: true, isStreaming: false }
          : m
      ));
      setApiError('Could not reach backend. Is FastAPI running at localhost:8000?');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={selectSession}
        onDelete={deleteSession}
        onNew={newSession}
        onRefresh={loadHistory}
        onToggleTheme={() => setLight(l => !l)}
        light={light}
      />
      <AgentActivity
        stepStatus={stepStatus}
        logs={logs}
        running={running}
      />
      <ChatPanel
        session={sessions.find(s => s.id === activeId)}
        messages={messages}
        input={input}
        onInput={setInput}
        onSubmit={handleSubmit}
        running={running}
        apiError={apiError}
        onDismissError={() => setApiError(null)}
      />
    </div>
  );
}