import json
import uuid
from datetime import datetime
import os

SESSIONS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sessions.jsonl")

_sessions: dict = {}


def _load_sessions_from_disk():
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
    try:
        with open(SESSIONS_FILE, "w") as f:
            for s in _sessions.values():
                f.write(json.dumps(s) + "\n")
    except Exception:
        pass


_load_sessions_from_disk()


def create_session(user_id: str = "anonymous") -> str:
    sid = str(uuid.uuid4())
    session = {
        "id": sid,
        "user_id": user_id,
        "title": "",
        "date": datetime.now().strftime("%m/%d/%Y"),
        "created_at": datetime.now().isoformat(),
        "messages": [],
    }
    _sessions[sid] = session
    _save_all_to_disk()
    return sid


def append_to_session(session_id: str, query: str, response: str):
    if session_id not in _sessions:
        return
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
    if session_id not in _sessions:
        return False
    del _sessions[session_id]
    _save_all_to_disk()
    return True


def get_all_sessions() -> list:
    return sorted(_sessions.values(), key=lambda s: s.get("created_at", ""), reverse=True)


def get_sessions_by_user(user_id: str) -> list:
    return sorted(
        [s for s in _sessions.values() if s.get("user_id", "anonymous") == user_id],
        key=lambda s: s.get("created_at", ""),
        reverse=True
    )


def get_session_history(session_id: str) -> list:
    session = _sessions.get(session_id, {})
    return session.get("messages", [])


def _extract_summary(response: str, max_chars: int = 300) -> str:
    import re
    match = re.search(r'##\s*Summary\s*\n(.+?)(?=\n##|\Z)', response, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()[:max_chars]
    return response.strip()[:max_chars]


def format_history(chat_history: list, max_turns: int = 3) -> str:
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
    pass