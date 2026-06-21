const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const STEP_ORDER = ['planning', 'researching', 'analyzing', 'tools', 'summarizing', 'critiquing'];

// Unique user ID — persisted in localStorage so same browser = same history
export function getUserId() {
  let uid = localStorage.getItem('ara_user_id');
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('ara_user_id', uid);
  }
  return uid;
}

export async function fetchHistory() {
  const res = await fetch(`${BASE}/history?user_id=${getUserId()}`);
  if (!res.ok) throw new Error('History fetch failed');
  return res.json();
}

export async function newSessionApi() {
  const res = await fetch(`${BASE}/session/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: getUserId() }),
  });
  if (!res.ok) throw new Error('Session creation failed');
  return res.json();
}

export async function deleteSessionApi(sessionId) {
  const res = await fetch(`${BASE}/session/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete session failed');
  return res.json();
}

export async function postChat(query, sessionId) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId, user_id: getUserId() }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json();
}

export async function postChatStream(query, sessionId, onEvent) {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId, user_id: getUserId() }),
  });
  if (!res.ok) throw new Error('Stream request failed');
  if (!res.body) throw new Error('Streaming not supported by this response');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;

      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }

      if (evt.event === 'error') throw new Error(evt.message || 'Backend pipeline error');
      if (evt.event === 'final') finalText = evt.text || '';
      onEvent(evt);
    }
  }
  return finalText;
}