import re  # FIX: for detect_format()
from settings import BASE_MODEL, CHAT_MODEL
from state import AgentState
from tools.llm import generate
from memory.memory_manager import format_history

def build_context(results: list) -> str:
    if not results:
        return ""
    context = "Previous task results:\n"
    for r in results:
        context += f"\n[Task {r['task_id']} - {r['type']}]\n{r['response']}\n"
    return context

# FIX: the old is_code_query() used substring matching, so "PostgreSQL" matched "sql",
# "JavaScript" matched "java", "description" matched "script", etc. Any such query
# was forced into the code prompt (hardcoded Python output + fake docs.python.org source).
# Now: word-boundary regexes, evaluated in priority order, and the chosen format is
# also appended to the answer as "## Format" so the frontend does not have to guess.
_CODE_VERB = r"(write|implement|code|create|generate|build|debug|fix|refactor)"
_CODE_NOUN = r"(code|script|snippet|function|program|algorithm|regex|class|query|api|endpoint)"

def detect_format(query: str) -> str:
    q = query.lower().strip()
    if (re.search(rf"\b{_CODE_VERB}\b.{{0,40}}\b{_CODE_NOUN}\b", q)
            or re.search(r"\b(code (for|to)|in (python|javascript|java|c\+\+|bash|sql|typescript)\b)", q)
            or re.search(r"\b(sql|python|javascript|bash|regex|java)\b.{0,25}\b(query|script|function|snippet|code|program)\b", q)  # FIX: "sql query to ..."
            or re.search(r"\bimplement\b", q)):
        return "code"
    if re.search(r"\b(vs\.?|versus|compare|comparison|difference between|differences between|better than|pros and cons)\b", q):
        return "comparison"
    if re.search(r"\b(step[- ]by[- ]step|how (do|to|can|should) |steps? (to|for)|tutorial|roadmap|in \w+ steps)\b", q) \
            or re.search(r"\bguide (to|for|me)\b", q):
        return "howto"
    if re.search(r"\b(top \d+|\d+ (best|good|great|top)|best|list of|ranking|ranked|recommend\w*)\b", q):
        return "list"
    # FIX: "what are the latest developments..." is research, not a definition
    if re.search(r"^(what is|what's|who is|define|explain|meaning of)\b", q) and len(q.split()) <= 9 \
            and not re.search(r"\b(latest|recent|new|news|trends?|developments?|20\d\d)\b", q):
        return "definition"
    return "research"

FORMAT_RULES = {
    "code": """The user asked for code. Use this layout:
## Summary
One or two sentences on what the code does, then ONE fenced code block with a language tag.
## Key Findings
2-3 short lines explaining how it works. NO code in this section.""",
    "comparison": """The user asked for a comparison. Use this layout:
## Summary
2-3 sentences with the verdict. Inline citations like [https://source.com].
## Comparison
A markdown table is REQUIRED. First column = the items compared, other columns = criteria. 4-7 criteria.
## Key Findings
2-4 bullet takeaways (when to pick which). Each ends with a citation.""",
    "howto": """The user asked for steps / a how-to. Use this layout:
## Summary
2 sentences on the goal and approach.
## Key Findings
Numbered list. EVERY item must start with "Step N:" (e.g. "1. Step 1: Install ..."). Respect any step count the user asked for.""",
    "list": """The user asked for a list / recommendations. Use this layout:
## Summary
2 sentences.
## Key Findings
Numbered list (1. 2. 3.). Respect any count the user asked for (e.g. top 5). Each item ends with a citation.""",
    "definition": """The user asked for an explanation. Use this layout:
## Summary
2-3 plain-language sentences.
## Key Findings
2-4 short points worth knowing. Each ends with a citation.""",
    "research": """The user asked an open research question. Use this layout:
## Summary
2-3 sentences directly answering the query with inline citations.
## Key Findings
3-6 bullet points (dashes), each one specific fact with numbers/dates/names and a citation.""",
}

def build_summarize_prompt(state: AgentState, fmt: str = "research") -> str:  # FIX: fmt passed in
    subtasks = state['subtasks']
    idx = len(subtasks) - 1
    task = subtasks[idx]
    context = build_context(state['results'])
    original_query = state.get('query', task.get('goal', ''))
    summarize_goal = task.get('goal', '')

    return f"""{context}

Write the final answer using ONLY the markdown ## sections below. Required output format: {fmt.upper()}.

{FORMAT_RULES[fmt]}

## Sources
Unique source URLs taken from the research above, one per line as "- https://...". If the research has no URLs, omit this section. Never invent URLs.

## Confidence
High, Medium or Low (based on source quality and agreement). If no search results were available, use Low.

Rules:
- Use EXACTLY these ## headings, no others, no sub-headings.
- Be specific: names, numbers, dates, prices.
- Never call tools. Use only the research above.
- Cite ONLY with full URLs in square brackets like [https://site.com/page]. Never use numbered citations like [1] or 【1】.  # FIX: stops 【1】 leaking into the UI

Summarize goal: {summarize_goal}
Original user query: {original_query}"""

def converse(state: AgentState):
    history = format_history(state.get('chat_history', []))
    subtasks = state['subtasks']
    idx = state['current_task_index']
    task = subtasks[idx]

    context = build_context(state['results'])

    CHAT_SYSTEM = """You are a helpful AI research assistant. You help users find information, compare options, and summarize research.
You were built as part of an Agentic Research Assistant project.
Never mention your underlying model name (like Phi, LLaMA, etc.) — just say you are an AI research assistant.
Keep replies concise, friendly, and on-topic."""

    if context:
        prompt = f"{CHAT_SYSTEM}\n\n{history}\nPrevious task results:\n{context}\nCurrent task:\n{task.get('goal', '')}"
    else:
        prompt = f"{CHAT_SYSTEM}\n\n{history}\nUser: {task.get('goal', '')}"

    if task.get("type") == "chat":
        print("Chat-Replying |", end=" ", flush=True)
        response = generate(prompt, CHAT_MODEL)
    else:
        print("Chat-Replying |", end=" ", flush=True)
        response = generate(prompt, BASE_MODEL)

    state['results'].append({
        "task_id": task.get("id"),
        "type": task.get("type"),
        "response": response
    })
    state['current_task_index'] = idx + 1

    if task.get("type") in ("chat", "summarize"):
        state['final_response'] = response

    state['awaiting_clarification'] = False
    return state

def summarize(state: AgentState):
    subtasks = state['subtasks']
    idx = state['current_task_index']

    if idx >= len(subtasks):
        idx = len(subtasks) - 1

    task = subtasks[idx]
    fmt = detect_format(state.get('query', ''))  # FIX: deterministic format from the user's query
    prompt = build_summarize_prompt(state, fmt)

    print("Summarizing |", end=" ", flush=True)
    response = generate(prompt, BASE_MODEL)
    # FIX: tell the frontend which layout to render (it parses "## Format")
    response = response.rstrip() + f"\n\n## Format\n{fmt}"

    state['results'].append({
        "task_id": task.get("id"),
        "type": task.get("type"),
        "response": response
    })

    state['current_task_index'] = idx + 1
    state['final_response'] = response
    state['awaiting_clarification'] = False
    return state

def doubt(state: AgentState):
    history = format_history(state.get('chat_history', []))
    subtasks = state['subtasks']
    idx = state['current_task_index']
    task = subtasks[idx]
    goal = task.get('goal', '')

    prompt = f"""{history}

The user's query is ambiguous or missing information needed to proceed.

Ambiguity: {goal}

Ask the user a short, precise clarifying question to resolve this. Reply with ONLY the question — no preamble, no explanation."""

    print("Doubt-Question |", end=" ", flush=True)
    response = generate(prompt, BASE_MODEL)

    state['results'].append({
        "task_id": task.get("id"),
        "type": task.get("type"),
        "response": response
    })
    state['current_task_index'] = idx + 1
    state['final_response'] = response
    state['awaiting_clarification'] = True
    return state