from settings import LLM_PROVIDER, GROQ_API_KEY, GROQ_MODEL, BASE_MODEL

# FIX: gpt-oss models sometimes try to call a built-in "web.run" tool when they lack data.
# Groq then rejects the request with 400 tool_use_failed. We forbid tools in a system
# message and retry once on that specific error.
NO_TOOLS_SYSTEM = (
    "You have NO tools and NO internet access. Never call any function or tool "
    "(e.g. web.run, browser, search). Answer in plain text using only the text provided. "
    "If information is missing, say so instead of trying to look it up."
)
FALLBACK_TEXT = "I couldn't generate a response right now. Please try again in a moment."


def _groq_kwargs(prompt: str) -> dict:
    kwargs = dict(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": NO_TOOLS_SYSTEM},  # FIX: added system message
            {"role": "user", "content": prompt},
        ],
        max_tokens=1500,
        temperature=0.3,
        tool_choice="none",  # FIX: explicit
    )
    if "gpt-oss" in GROQ_MODEL:
        kwargs["reasoning_effort"] = "low"  # FIX: less reasoning = faster, fewer stray tool calls
    return kwargs


def _groq_generate(prompt: str) -> str:
    from groq import Groq, BadRequestError
    client = Groq(api_key=GROQ_API_KEY)
    # FIX: retry loop instead of crashing the whole request
    for attempt in range(2):
        try:
            response = client.chat.completions.create(**_groq_kwargs(prompt))
            return response.choices[0].message.content or FALLBACK_TEXT
        except BadRequestError as e:
            print(f"[Groq 400, attempt {attempt + 1}] {e}")
            if "tool_use_failed" not in str(e):
                break
    return FALLBACK_TEXT  # FIX: graceful fallback, no 500


def _groq_stream(prompt: str):
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    stream = client.chat.completions.create(**_groq_kwargs(prompt), stream=True)  # FIX: same safe kwargs
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def _ollama_generate(prompt: str, model: str) -> str:
    from langchain_ollama import OllamaLLM
    return OllamaLLM(model=model).invoke(prompt)


def _ollama_stream(prompt: str, model: str):
    from langchain_ollama import OllamaLLM
    for chunk in OllamaLLM(model=model).stream(prompt):
        yield chunk


def generate(user_query: str, model_used: str = BASE_MODEL) -> str:
    if LLM_PROVIDER == "groq" and GROQ_API_KEY:
        return _groq_generate(user_query)
    return _ollama_generate(user_query, model_used)


def generate_stream(user_query: str, model_used: str = BASE_MODEL):
    if LLM_PROVIDER == "groq" and GROQ_API_KEY:
        yield from _groq_stream(user_query)
    else:
        yield from _ollama_stream(user_query, model_used)