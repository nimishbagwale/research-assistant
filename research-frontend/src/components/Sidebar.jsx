import { useState } from 'react';
import { Plus, Search, Trash2, Check, Loader2, Sun, Moon, RefreshCw, Sparkles } from 'lucide-react';

export default function Sidebar({ sessions, activeId, onSelect, onDelete, onNew, onRefresh, onToggleTheme, light }) {
  const [filter, setFilter] = useState('');

  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Sparkles />
        </div>
        <div>
          <div className="brand-title">Agentic Research</div>
          <div className="brand-sub">Assistant v1.0</div>
        </div>
      </div>

      {/* New */}
      <button className="sidebar-new" onClick={onNew}>
        <Plus /> New Research
      </button>

      {/* Search */}
      <div className="sidebar-search">
        <Search />
        <input
          type="text"
          placeholder="Search history..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="sidebar-label">Sessions ({filtered.length})</div>

      {/* List */}
      <div className="session-list">
        {filtered.length === 0 && (
          <div className="empty-sessions">No sessions yet.<br />Start a new research above.</div>
        )}
        {filtered.map(s => {
          const busy = s.status === 'In Progress';
          return (
            <div
              key={s.id}
              className={`session-card ${s.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <div className="session-title">{s.title}</div>
              <div className="session-meta">
                <span className="session-date">{s.date}</span>
                <span className={`badge ${busy ? 'busy' : 'done'}`}>
                  {busy
                    ? <><Loader2 style={{ width: 9, height: 9, animation: 'spin 1s linear infinite' }} /> Running</>
                    : <><Check style={{ width: 9, height: 9 }} /> Done</>
                  }
                </span>
              </div>
              <button className="session-delete" onClick={e => onDelete(e, s.id)}>
                <Trash2 />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="footer-btns">
          <button className="icon-btn" onClick={onToggleTheme} title="Toggle theme">
            {light ? <Moon /> : <Sun />}
          </button>
          <button className="icon-btn" onClick={onRefresh} title="Reload history">
            <RefreshCw />
          </button>
        </div>
      </div>
    </aside>
  );
}
