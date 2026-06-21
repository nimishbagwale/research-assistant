import json
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from main import run, run_stream
from memory.memory_manager import (
    create_session,
    append_to_session,
    get_sessions_by_user,
    get_session_history,
    delete_session,
    store_episode,
)
from settings import BASE_MODEL

app = FastAPI(title="Agentic Research Assistant API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class QueryRequest(BaseModel):
    query: str
    session_id: str = ""
    mode: str = "deep"
    user_id: Optional[str] = "anonymous"

class NewSessionRequest(BaseModel):
    user_id: Optional[str] = "anonymous"


# ── Session management ───────────────────────────────────────────────────────

@app.post("/session/new")
def new_session(req: NewSessionRequest):
    sid = create_session(user_id=req.user_id)
    return {"session_id": sid}


@app.delete("/session/{session_id}")
def remove_session(session_id: str):
    deleted = delete_session(session_id)
    return {"deleted": deleted, "session_id": session_id}


# ── Chat endpoints ───────────────────────────────────────────────────────────

@app.post("/chat")
def chat(req: QueryRequest):
    sid = req.session_id or create_session(user_id=req.user_id)
    history = get_session_history(sid)
    response, _ = run(req.query, history, mode=req.mode)
    append_to_session(sid, req.query, response)
    return {"response": response, "session_id": sid}


@app.post("/chat/stream")
def chat_stream(req: QueryRequest):
    sid = req.session_id or create_session(user_id=req.user_id)
    history = get_session_history(sid)

    def stream():
        final_text = ""
        try:
            for event in run_stream(req.query, history, mode=req.mode):
                if event.get("event") == "final":
                    final_text = event.get("text", "")
                yield json.dumps(event) + "\n"
        except Exception as e:
            yield json.dumps({"event": "error", "message": str(e)}) + "\n"
            return
        append_to_session(sid, req.query, final_text)

    return StreamingResponse(stream(), media_type="application/x-ndjson")


# ── History ──────────────────────────────────────────────────────────────────

@app.get("/history")
def get_history(user_id: str = Query(default="anonymous")):
    return {"sessions": get_sessions_by_user(user_id)}


@app.post("/clear")
def clear_history():
    return {"status": "cleared"}


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": BASE_MODEL}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)