from dotenv import load_dotenv
import os

load_dotenv()

# ── LLM provider ─────────────────────────────────────────────────────────────
# Set LLM_PROVIDER=groq in .env / Render env vars to use Groq.
# Defaults to "ollama" so local dev works without any change.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # "groq" | "ollama"

# Groq
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama3-70b-8192")   # free, fast

# Ollama (local dev)
CHAT_MODEL = os.getenv("CHAT_MODEL", "phi3.5:latest")
BASE_MODEL = os.getenv("BASE_MODEL", "llama3:latest")

# Search
TAVILY_KEY = os.getenv("TAVILY_KEY", "")
