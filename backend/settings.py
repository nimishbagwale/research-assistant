from dotenv import load_dotenv
import os

load_dotenv()

# FIX: Render env values sometimes get pasted with quotes/spaces/newlines -> Tavily "Unauthorized".
def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip().strip('"').strip("'")

LLM_PROVIDER = _env("LLM_PROVIDER", "ollama")  # "groq" | "ollama"

# Groq
GROQ_API_KEY = _env("GROQ_API_KEY")  # FIX: cleaned via _env
GROQ_MODEL = _env("GROQ_MODEL", "openai/gpt-oss-20b")

# Ollama (local dev)
CHAT_MODEL = _env("CHAT_MODEL", "phi3.5:latest")
BASE_MODEL = _env("BASE_MODEL", "llama3:latest")

# Search
TAVILY_KEY = _env("TAVILY_KEY")  # FIX: cleaned via _env