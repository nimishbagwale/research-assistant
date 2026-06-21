"""
Run this ONCE from your backend/ directory:
    python migrate_history.py

Reads episodic_history.jsonl (old flat format) and writes sessions.jsonl
(new grouped format). Each contiguous block of Q&As on the same calendar
date becomes one session. Re-running is safe — it checks if sessions.jsonl
already exists and skips if non-empty.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

OLD_FILE = "episodic_history.jsonl"
NEW_FILE = "sessions.jsonl"

def parse_date(ts: str) -> str:
    try:
        return datetime.fromisoformat(ts).strftime("%m/%d/%Y")
    except Exception:
        return datetime.now().strftime("%m/%d/%Y")

def migrate():
    old_path = Path(OLD_FILE)
    new_path = Path(NEW_FILE)

    if not old_path.exists():
        print(f"[migrate] {OLD_FILE} not found — nothing to migrate.")
        return

    # Don't overwrite existing sessions.jsonl if it already has data
    if new_path.exists() and new_path.stat().st_size > 0:
        print(f"[migrate] {NEW_FILE} already exists and is non-empty — skipping.")
        print("  Delete sessions.jsonl manually if you want to re-migrate.")
        return

    # Read all old entries
    entries = []
    with open(old_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                pass

    if not entries:
        print("[migrate] No entries found in episodic_history.jsonl.")
        return

    # Group entries by date — each date becomes one session
    sessions_by_date: dict = {}
    for entry in entries:
        date = parse_date(entry.get("timestamp", ""))
        if date not in sessions_by_date:
            sessions_by_date[date] = []
        sessions_by_date[date].append(entry)

    # Build session objects
    sessions = []
    for date, msgs in sessions_by_date.items():
        first_query = msgs[0].get("user_query", "Session")
        session = {
            "id": str(uuid.uuid4()),
            "title": first_query[:48],
            "date": date,
            "created_at": msgs[0].get("timestamp", datetime.now().isoformat()),
            "messages": [
                {
                    "user_query": m.get("user_query", ""),
                    "assistant_response": m.get("assistant_response", ""),
                    "timestamp": m.get("timestamp", ""),
                }
                for m in msgs
            ],
        }
        sessions.append(session)

    # Sort oldest first so sidebar shows them in right order
    sessions.sort(key=lambda s: s["created_at"])

    # Write new sessions.jsonl
    with open(new_path, "w") as f:
        for s in sessions:
            f.write(json.dumps(s) + "\n")

    print(f"[migrate] Done. Converted {len(entries)} entries into {len(sessions)} sessions.")
    for s in sessions:
        print(f"  [{s['date']}] {s['title']} — {len(s['messages'])} message(s)")

if __name__ == "__main__":
    migrate()