import json
import uuid
from datetime import datetime

SESSIONS_FILE = "sessions.jsonl"

# ── in-memory store: { session_id: session_dict } ──────────────────────────
_sessions: dict = {}


def _load_sessions_from_disk():
    """Load all sessions from sessions.jsonl into memory on startup."""
    try:
        with open(SESSIONS_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    s = json.loads(line)
                    _sessions[s["id"]] = s
                except Exception:
                    pass
    except FileNotFoundError:
        pass


def _save_all_to_disk():
    """Rewrite the entire file — simple approach for small datasets."""
    with open(SESSIONS_FILE, "w") as f:
        for s in _sessions.values():
            f.write(json.dumps(s) + "\n")


# Load on import so the server has history from the moment it starts
_load_sessions_from_disk()


# ── public API ──────────────────────────────────────────────────────────────

def create_session() -> str:
    """Create a new empty session, persist it, return its id."""
    sid = str(uuid.uuid4())
    session = {
        "id": sid,
        "title": "",
        "date": datetime.now().strftime("%m/%d/%Y"),
        "created_at": datetime.now().isoformat(),
        "messages": [],
    }
    _sessions[sid] = session
    _save_all_to_disk()
    return sid


def append_to_session(session_id: str, query: str, response: str):
    """Add a Q&A turn to an existing session and persist."""
    if session_id not in _sessions:
        create_session()

    session = _sessions[session_id]
    session["messages"].append({
        "user_query": query,
        "assistant_response": response,
        "timestamp": datetime.now().isoformat(),
    })
    if not session["title"] and query:
        session["title"] = query[:48]

    _save_all_to_disk()


def delete_session(session_id: str) -> bool:
    """Remove a session from memory and disk. Returns True if deleted."""
    if session_id not in _sessions:
        return False
    del _sessions[session_id]
    _save_all_to_disk()
    return True


def get_all_sessions() -> list:
    """Return all sessions sorted newest first."""
    return sorted(_sessions.values(), key=lambda s: s.get("created_at", ""), reverse=True)


def get_session_history(session_id: str) -> list:
    """Return the chat_history list format that agents expect."""
    session = _sessions.get(session_id, {})
    return session.get("messages", [])


# ── legacy helpers ──────────────────────────────────────────────────────────

def _extract_summary(response: str, max_chars: int = 300) -> str:
    import re
    match = re.search(r'##\s*Summary\s*\n(.+?)(?=\n##|\Z)', response, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()[:max_chars]
    return response.strip()[:max_chars]


def format_history(chat_history: list, max_turns: int = 3) -> str:
    """
    Only last 3 turns, assistant response trimmed to Summary section (~300 chars).
    Prevents old report blobs from polluting the LLM context.
    """
    if not chat_history:
        return ""
    recent = chat_history[-max_turns:]
    lines = ["Conversation so far (context only — do not repeat old answers verbatim):"]
    for entry in recent:
        lines.append(f"User: {entry['user_query']}")
        short = _extract_summary(entry['assistant_response'])
        lines.append(f"Assistant (summary): {short}")
    return "\n".join(lines)


def store_chat_history(query: str, response: str) -> dict:
    return {
        "timestamp": datetime.now().isoformat(),
        "user_query": query,
        "assistant_response": response,
    }


def store_episode(chat_history: list):
    """Legacy no-op."""
    pass
