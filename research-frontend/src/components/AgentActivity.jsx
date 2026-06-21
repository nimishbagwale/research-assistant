import { useEffect, useRef } from 'react';
import { Check, Loader2, Terminal, Cpu, Minus } from 'lucide-react';

// These map 1:1 to backend LangGraph nodes (see api/client.js STEP_ORDER) —
// a step only ticks when the backend actually reports that node finished.
export const STEPS = [
  { id: 'planning',    label: 'Planning',     desc: 'Breaking query into subtasks' },
  { id: 'researching', label: 'Researching',  desc: 'Searching the web & extracting sources' },
  { id: 'analyzing',   label: 'Analyzing',     desc: 'Reasoning over findings' },
  { id: 'tools',       label: 'Using Tools',   desc: 'Calculator, code, currency, date/time' },
  { id: 'summarizing', label: 'Summarizing',   desc: 'Compiling the answer' },
  { id: 'critiquing',  label: 'Critiquing',    desc: 'Checking quality — may send back for revision' },
];

export default function AgentActivity({ stepStatus, logs, running }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <section className="agent-panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <Cpu />
          Agent Pipeline
        </div>
        <span className={`status-pill ${running ? 'running' : 'idle'}`}>
          {running ? 'RUNNING' : 'IDLE'}
        </span>
      </div>

      {/* Stepper — status comes straight from real backend events, never a timer */}
      <div className="stepper">
        {STEPS.map((step, idx) => {
          const status = stepStatus?.[step.id] || 'pending'; // 'done' | 'active' | 'pending' | 'skipped'
          const done = status === 'done';
          const current = status === 'active';
          const skipped = status === 'skipped';

          return (
            <div key={step.id} className="step-row">
              {idx < STEPS.length - 1 && (
                <div className={`step-line ${done ? 'done' : ''}`} />
              )}
              <div className={`step-node ${done ? 'done' : current ? 'current' : skipped ? 'skipped' : 'pending'}`}>
                {done
                  ? <Check />
                  : current
                  ? <Loader2 className="spin" />
                  : skipped
                  ? <Minus />
                  : <span>{idx + 1}</span>
                }
              </div>
              <div className="step-info">
                <div className={`step-label ${done ? 'done' : current ? 'current' : skipped ? 'skipped' : 'pending'}`}>
                  {step.label}
                </div>
                <div className="step-desc">{skipped ? 'Not needed for this query' : step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal */}
      <div className="terminal">
        <div className="terminal-header">
          <Terminal /> Console
        </div>
        <div className="terminal-body">
          {logs.map((log, i) => (
            <div key={i} className="log-row">
              <span className="log-time">{log.time}</span>
              <span className="log-arrow">›</span>
              <span className={`log-text ${log.type === 'success' ? 'success' : log.type === 'error' ? 'error' : ''}`}>
                {log.text}
              </span>
            </div>
          ))}
          {running && (
            <div className="log-pulse animate-pulse-text">
              <span>›</span><span>Processing...</span>
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </section>
  );
}
