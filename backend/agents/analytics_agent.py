from settings import BASE_MODEL
from state import AgentState
from tools.llm import generate

def build_context(results: list) -> str:
    if not results:
        return ""
    context = "Previous task results:\n"
    for r in results:
        context += f"\n[Task {r['task_id']} - {r['type']}]\n{r['response']}\n"
    return context

def analyze(state: AgentState):
    subtasks = state['subtasks']
    idx = state['current_task_index']
    task = subtasks[idx]

    context = build_context(state['results'])
    goal = task.get('goal', '')

    if not context:
        response = f"Cannot complete analysis: no prior research data available for: {goal}"
    else:
        prompt = f"""{context}

Current task: {goal}

Using only the information above, reason through this task. Identify patterns, draw conclusions, compare options, or explain causes as required by the goal. Be specific — reference findings from the data above, don't make unsupported claims."""

        print("Analyzing |", end=" ", flush=True)
        response = generate(prompt, BASE_MODEL)

    state['results'].append({
        "task_id": task.get("id"),
        "type": task.get("type"),
        "response": response
    })
    state['current_task_index'] = idx + 1

    return state