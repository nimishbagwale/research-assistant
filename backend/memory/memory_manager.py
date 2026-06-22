import json
import uuid
from datetime import datetime
import os

MONGODB_URI = os.getenv("MONGODB_URI", "")

# ── MongoDB or in-memory fallback ────────────────────────────────────────────
_use_mongo = bool(MONGODB_URI)
_collection = None

if _use_mongo:
    try:
        from pymongo import MongoClient
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        _db = _client["research_assistant"]
        _collection = _db["sessions"]
        print("[Memory] Using MongoDB Atlas")
    except Exception as e:
        print(f"[Memory] MongoDB failed: {e} — falling back to in-memory")
        _use_mongo = False

# In-memory fallback (local dev)
_sessions: dict = {}

if not _use_mongo:
    print("[Memory] Using in-memory store (sessions will reset on restart)")


# ── public API ───────────────────────────────────────────────────────────────

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
    if _use_mongo:
        _collection.insert_one({**session, "_id": sid})
    else:
        _sessions[sid] = session
    return sid


def append_to_session(session_id: str, query: str, response: str):
    msg = {
        "user_query": query,
        "assistant_response": response,
        "timestamp": datetime.now().isoformat(),
    }
    if _use_mongo:
        update = {"$push": {"messages": msg}}
        # Set title from first message
        _collection.update_one(
            {"_id": session_id, "title": ""},
            {"$set": {"title": query[:48]}}
        )
        _collection.update_one({"_id": session_id}, update)
    else:
        if session_id not in _sessions:
            return
        session = _sessions[session_id]
        session["messages"].append(msg)
        if not session["title"] and query:
            session["title"] = query[:48]


def delete_session(session_id: str) -> bool:
    if _use_mongo:
        result = _collection.delete_one({"_id": session_id})
        return result.deleted_count > 0
    else:
        if session_id not in _sessions:
            return False
        del _sessions[session_id]
        return True


def get_all_sessions() -> list:
    if _use_mongo:
        docs = list(_collection.find({}, {"_id": 0}).sort("created_at", -1))
        return docs
    return sorted(_sessions.values(), key=lambda s: s.get("created_at", ""), reverse=True)


def get_sessions_by_user(user_id: str) -> list:
    if _use_mongo:
        docs = list(_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1))
        return docs
    return sorted(
        [s for s in _sessions.values() if s.get("user_id", "anonymous") == user_id],
        key=lambda s: s.get("created_at", ""),
        reverse=True
    )


def get_session_history(session_id: str) -> list:
    if _use_mongo:
        doc = _collection.find_one({"_id": session_id}, {"messages": 1})
        return doc["messages"] if doc else []
    session = _sessions.get(session_id, {})
    return session.get("messages", [])


# ── legacy helpers ───────────────────────────────────────────────────────────

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