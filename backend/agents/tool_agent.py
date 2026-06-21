import json

from settings import BASE_MODEL
from state import AgentState
from tools.llm import generate
from tools.registry import run_tool, tool_descriptions

MAX_TOOL_ROUNDS = 4


def build_context(results: list) -> str:
    if not results:
        return ""
    context = "Previous task results:\n"
    for r in results:
        context += f"\n[Task {r['task_id']} - {r['type']}]\n{r['response']}\n"
    return context


def build_decision_prompt(goal: str, context: str, call_log: list) -> str:
    history = "\n".join(call_log) if call_log else "(none yet)"
    return f"""{context}

Available tools:
{tool_descriptions()}

Current task: {goal}

Tool calls made so far this task:
{history}

Decide your next step. Reply with ONLY one JSON object, no explanation, no markdown.
- To call a tool: {{"tool": "<tool_name>", "args": {{...}}}}
- If you already have enough information to answer: {{"tool": null, "answer": "<final answer>"}}
"""


def safe_json_parse(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
        return {"tool": None, "answer": cleaned}
    except Exception:
        return {"tool": None, "answer": cleaned}


def tool_use(state: AgentState):
    subtasks = state['subtasks']
    idx = state['current_task_index']
    task = subtasks[idx]
    goal = task.get('goal', '')

    context = build_context(state['results'])
    call_log = []
    final_answer = None

    for round_num in range(MAX_TOOL_ROUNDS):
        print(f"Tool-Deciding (round {round_num + 1}) |", end=" ", flush=True)
        prompt = build_decision_prompt(goal, context, call_log)
        raw = generate(prompt, BASE_MODEL)
        decision = safe_json_parse(raw)

        tool_name = decision.get("tool")
        if not tool_name:
            final_answer = decision.get("answer", "") or "\n".join(call_log)
            break

        args = decision.get("args", {}) or {}
        print(f"Calling-Tool({tool_name}) |", end=" ", flush=True)
        result = run_tool(tool_name, args)
        call_log.append(f"Called {tool_name}({args}) -> {result}")

    if final_answer is None:
        final_answer = "Reached tool-call limit without a final answer.\n" + "\n".join(call_log)

    state['results'].append({
        "task_id": task.get("id"),
        "type": task.get("type"),
        "response": final_answer
    })
    state['current_task_index'] = idx + 1
    return state