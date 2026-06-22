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

def is_code_query(query: str) -> bool:
    """Detect if the user wants code output."""
    keywords = ['write', 'code', 'program', 'function', 'script', 'implement',
                'algorithm', 'snippet', 'example code', 'show me how to',
                'python', 'javascript', 'java', 'c++', 'sql', 'bash']
    q = query.lower()
    return any(k in q for k in keywords)

def build_summarize_prompt(state: AgentState) -> str:
    subtasks = state['subtasks']
    idx = len(subtasks) - 1
    task = subtasks[idx]
    context = build_context(state['results'])
    original_query = state.get('query', task.get('goal', ''))
    summarize_goal = task.get('goal', '')

    # Code query — completely different format, no findings grid
    if is_code_query(original_query):
        return f"""{context}

The user asked for code. Write a clean, direct response using EXACTLY these sections:

## Summary
One sentence explaining what the code does.

## Key Findings
Write a single item — the complete code solution with explanation:
1. Here is the complete solution: [brief explanation]

Then put the full code block in the Summary section itself, after the explanation sentence, like this:

## Summary
[explanation sentence]

```python
# full code here
```

## Sources
- https://docs.python.org

## Confidence
High

Rules:
- Put the FULL code block inside ## Summary, after the explanation
- ## Key Findings should have at most 2-3 lines explaining what the code does — NO code fragments
- Never split code across multiple findings items
- Always use proper markdown code fences with language tag

Original user query: {original_query}"""

    return f"""{context}

Based on the research findings above, write a structured answer using EXACTLY these markdown sections:

## Summary
Write 2-3 sentences directly answering the query. Add inline citations after each specific claim like this: [https://source.com]

## Key Findings
IMPORTANT: Respect the user's requested output format exactly.
- If the user asked for a numbered list, use numbered items (1. 2. 3. ...)
- If the user asked for a ranked list or "top N" list, number each item and include scores/ratings
- If the user asked for bullet points, use dashes (- item)
- Each item should be on its own line
- Each item must end with an inline citation [https://source.com]
(Skip this section entirely if there is only one finding or if this is a simple one-sentence factual query)

## Comparison
(Include ONLY if the query explicitly compares multiple items, products, options, or candidates)
Use a clean markdown table. For subjective columns like Performance, Quality, Value: use ★★★★☆ star ratings (5 stars max).
| Item | Metric1 | Metric2 | Price |
|------|---------|---------|-------|
| ...  | ...     | ...     | ...   |
(Skip this section entirely if not comparing multiple items)

## Sources
List each unique source URL on its own line:
- https://source1.com
- https://source2.com

## Confidence
High

(Replace "High" with Medium or Low based on source quality and consistency across sources)

Rules:
- ALWAYS output Summary, Sources, and Confidence sections
- Use EXACTLY the ## headings shown above — no other headings, no sub-headings
- Be specific: include names, numbers, dates, specs, and prices where available
- Every factual claim in Summary and Key Findings MUST have an inline citation [https://url]
- The output format in Key Findings MUST match what the user requested (list, numbered, table, steps, etc.)

Summarize goal: {summarize_goal}
Original user query (use this to determine the correct output format): {original_query}"""

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
    prompt = build_summarize_prompt(state)

    print("Summarizing |", end=" ", flush=True)
    response = generate(prompt, BASE_MODEL)

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