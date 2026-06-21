import json
from tools.llm import generate
from state import AgentState
from memory.memory_manager import format_history

def plan_task(state: AgentState):
    state['critic_retries'] = 0
    state['needs_revision'] = False
    state['critic_score'] = 0
    user_query = state['query']
    mode = state.get('mode', 'deep')
    mode_instruction = (
        "Use at most 1 web_search task and go straight to summarize. Keep it fast."
        if mode == "quick"
        else "Use web_search + analytical + summarize as needed for a thorough answer."
    )

    history = format_history(state.get('chat_history', []))
    history_block = f"\n{history}\n" if history else ""

    prompt = f"""{history_block}You are a research planner for an AI assistant. Break the user query into 2-4 subtasks.

Each subtask is a JSON object with:
- id: task number
- goal: one clear sentence — what to find or do
- type: "chat" | "web_search" | "analytical" | "summarize" | "doubt" | "self_ask" | "tool_use"

Type rules:
- "chat"       → casual conversation (greetings, small talk, opinions, identity questions like "who are you", "what can you do", "who made you"). Return ONLY one task of this type, no others.
- "web_search" → needs real-time or recent data (news, stats, current events, product info, recommendations, lists, comparisons, how-to guides)
- "analytical" → needs reasoning over already-retrieved data (why, compare, evaluate, what causes)
- "tool_use"   → needs a calculator, code execution, currency conversion, or the current date/time
- "summarize"  → condenses all previous task results into a final answer. ALWAYS the last task unless type is "chat".
- "doubt"      → ONLY when the query is completely unanswerable without knowing more (e.g. "help me with my project" — no domain given). Do NOT use for anything searchable.
- "self_ask"   → complex exploratory queries needing background context before searching

Rules:
- Use conversation history ONLY to resolve references like "them", "their prices", "compare them" — make the referenced entity explicit in every task goal (e.g. "Redmi Note 12 and Samsung A56 prices")
- Never re-research what was already answered — only plan tasks for the new follow-up question
- If query is casual → single "chat" task
- If query asks for a list, steps, recommendation, comparison, or how-to → ALWAYS use web_search, never doubt
- If query needs math/code/currency/date → use tool_use, not web_search
- Never use more than 2 web_search tasks
- analytical tasks must come AFTER web_search tasks
- Prescribed mode: {mode_instruction}

CRITICAL — Summarize task goal:
The "summarize" task goal MUST include:
  1. The original user's output format (e.g. "in ten steps", "as a table", "bullet list", "comparison")
  2. The core topic being summarised
  Example: if user asked "in ten steps how to build X", the summarize goal must say
  "Summarise findings into a ten-step guide on how to build X"

Return ONLY a JSON array. No explanation, no markdown.

Examples:

User: "hey what's up"
[
  {{"id": 1, "goal": "Respond naturally to a casual greeting", "type": "chat"}}
]

User: "latest trends in generative AI"
[
  {{"id": 1, "goal": "Find the most recent developments and trends in generative AI 2025-2026", "type": "web_search"}},
  {{"id": 2, "goal": "Analyse which generative AI trends are most impactful and why", "type": "analytical"}},
  {{"id": 3, "goal": "Summarise findings into a clear answer covering the key generative AI trends", "type": "summarize"}}
]

User: "in ten steps how to build a RAG project to get hired"
[
  {{"id": 1, "goal": "Find how to build a Retrieval-Augmented Generation (RAG) project: architecture, components, best practices 2025", "type": "web_search"}},
  {{"id": 2, "goal": "Find what RAG project features and skills employers look for in AI/ML job applications", "type": "web_search"}},
  {{"id": 3, "goal": "Summarise findings into a ten-step guide for building an impressive RAG project that helps get hired at top tech companies", "type": "summarize"}}
]

User: "give me 3 good laptops for gaming in 2026"
[
  {{"id": 1, "goal": "Find the best gaming laptops to buy in 2026 with specs and prices", "type": "web_search"}},
  {{"id": 2, "goal": "Summarise the top 3 gaming laptop recommendations with key specs and reasons", "type": "summarize"}}
]

User: "what's 18% of 4500, and convert that to INR at 1 USD = 83.2 INR"
[
  {{"id": 1, "goal": "Calculate 18% of 4500 and convert the result from USD to INR using the given rate", "type": "tool_use"}},
  {{"id": 2, "goal": "Summarise the calculation result for the user", "type": "summarize"}}
]

User: "who made you" or "what are you" or "what can you do" or "what can you help me with"
[
  {{"id": 1, "goal": "Respond as a helpful AI research assistant — explain what topics and tasks you can help with, without mentioning specific model names or creators", "type": "chat"}}
]

User: "help me with my project"
[
  {{"id": 1, "goal": "Ask the user what their project is about and what kind of help they need", "type": "doubt"}}
]

User query: {user_query}
"""

    print("Planning |", end=" ", flush=True)
    raw = generate(prompt)
    raw = raw.strip().strip("```json").strip("```").strip()

    try:
        subtasks = json.loads(raw)
    except json.JSONDecodeError:
        subtasks = [
            {"id": 1, "goal": user_query, "type": "web_search"},
            {"id": 2, "goal": f"Summarise findings for: {user_query}", "type": "summarize"}
        ]

    state['subtasks'] = subtasks
    state['current_task_index'] = 0
    state['results'] = []
    return state