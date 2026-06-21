import { useEffect, useRef } from 'react';
import { Send, Cpu, Globe, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import ReportCard from './ReportCard.jsx';

export default function ChatPanel({
  session, messages, input, onInput, onSubmit,
  running, apiError, onDismissError,
}) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <main className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-session-label">Active Session</span>
          <div className="chat-session-title">
            {session ? session.title : 'No session selected'}
          </div>
        </div>
      </div>

      {/* API error banner */}
      {apiError && (
        <div className="api-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle style={{ width: 14, height: 14 }} />
            {apiError}
          </div>
          <button onClick={onDismissError}>Dismiss</button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <Sparkles className="chat-empty-icon" />
            <h3>Start your research</h3>
            <p>Type a question below to begin a multi-agent research session.</p>
          </div>
        )}

        {messages.map(msg => {
          if (msg.sender === 'user') {
            return (
              <div key={msg.id} className="msg-user">
                <div className="msg-user-inner">
                  <span className="msg-time">{msg.time}</span>
                  <div className="msg-bubble">{msg.text}</div>
                </div>
              </div>
            );
          }

          if (msg.isError) {
            return (
              <div key={msg.id} className="msg-error">
                <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
                {msg.text}
              </div>
            );
          }

          return (
            <div key={msg.id} className="msg-agent">
              <div className="agent-icon"><Cpu /></div>
              <div className="agent-body">
                <div className="agent-label">
                  <span className="agent-label-tag">Research Agent</span>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{msg.time}</span>
                  {msg.isStreaming && (
                    <span className="streaming-badge">
                      <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
                      Streaming
                    </span>
                  )}
                </div>
                <ReportCard text={msg.text} isStreaming={msg.isStreaming} />
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="input-bar">
        <form onSubmit={onSubmit} style={{ maxWidth: 860, margin: '0 auto' }}>
          <div className="input-wrap">
            <textarea
              rows={3}
              value={input}
              onChange={e => onInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything — your agents will research, analyze and summarize..."
              disabled={running}
            />
            <div className="input-footer">
              <div className="input-hints">
                <span className="input-hint-item active">
                  <Globe /> Web Search Active
                </span>
              </div>
              <div className="input-actions">
                {running && (
                  <span className="agent-busy">
                    <Loader2 style={{ animation: 'spin 1s linear infinite' }} />
                    Agent working...
                  </span>
                )}
                <button
                  type="submit"
                  className="send-btn"
                  disabled={!input.trim() || running}
                >
                  Analyze <Send />
                </button>
              </div>
            </div>
          </div>
          <div className="input-tip">
            <Sparkles />
            Press Enter to send · Shift+Enter for new line
          </div>
        </form>
      </div>
    </main>
  );
}
