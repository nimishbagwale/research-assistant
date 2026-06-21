# 🔍 Agentic Research Assistant

A multi-agent AI research pipeline that plans, searches, analyzes, and summarizes answers in real-time.

**[Live Demo](https://research-assistant-olive.vercel.app/)** • **[Backend API](https://research-assistant-api-1cvk.onrender.com/docs)**

---

## 🧠 Architecture

```
User Query → Planner → Router → [Web Search / Analysis / Tools] → Summarizer → Critic → Response
```

- **Planner** — breaks query into subtasks
- **Router** — decides which agent handles each subtask  
- **Researcher** — searches web via DuckDuckGo + Tavily fallback + Google scrape
- **Analyzer** — reasoning over findings
- **Tool Agent** — calculator, code sandbox, live currency, datetime
- **Summarizer** — compiles structured markdown report
- **Critic** — reviews quality, sends back for revision if needed

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| LLM | Groq (LLaMA-3 70B) |
| Agent Graph | LangGraph |
| Backend | FastAPI + Uvicorn |
| Web Search | DuckDuckGo + Tavily + Google scrape fallback |
| Frontend | React + Vite |
| Deployment | Render (backend) + Vercel (frontend) |

---

## ✨ Features

- Real-time agent pipeline with live step-by-step streaming
- Multi-agent self-correction loop (Critic → Summarizer → Critic)
- Structured report cards — Summary, Key Findings, Comparison Table, Sources, Confidence
- User-isolated session history (localStorage based)
- Deep and Quick research modes
- 3-tier web search fallback (DDGS → Tavily → Google)
- Light/Dark theme toggle

---

## 🚀 Local Setup

### Backend
```bash
cd backend
pip install -r requirements.txt

# Create .env file
LLM_PROVIDER=ollama        # or groq
GROQ_API_KEY=your_key      # if using groq
TAVILY_KEY=your_key

python server.py
```

### Frontend
```bash
cd research-frontend
npm install

# Create .env.local
VITE_API_URL=http://localhost:8000

npm run dev
```

---

## 🌐 Deployment

- **Backend** — Render (free tier) with cron-job.org keep-alive ping every 14 min
- **Frontend** — Vercel (free tier) with SPA routing via vercel.json

---

## 📁 Project Structure

```
├── backend/
│   ├── agents/          # Planner, Router, Researcher, Analyzer, Critic, etc.
│   ├── graph/           # LangGraph state machine builder
│   ├── memory/          # Session management
│   ├── tools/           # LLM, web search, calculator, code sandbox, currency
│   ├── server.py        # FastAPI app
│   ├── main.py          # Graph runner + SSE streamer
│   └── state.py         # AgentState TypedDict
└── research-frontend/
    ├── src/
    │   ├── api/         # client.js, parser.js
    │   ├── components/  # Sidebar, ChatPanel, ReportCard, AgentActivity
    │   └── App.jsx
    └── vite.config.js
```

---

## 👤 Author

**Nimish Bagwale** — B.Tech CS (2027) | AI/ML & SDE  
[GitHub](https://github.com/nimishbagwale) • [LinkedIn](https://linkedin.com/in/your-profile)