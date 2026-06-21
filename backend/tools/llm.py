from settings import LLM_PROVIDER, GROQ_API_KEY, GROQ_MODEL, BASE_MODEL


def _groq_generate(prompt: str) -> str:
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
        temperature=0.3,
    )
    return response.choices[0].message.content


def _groq_stream(prompt: str):
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    stream = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
        temperature=0.3,
        stream=True,
    )
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
