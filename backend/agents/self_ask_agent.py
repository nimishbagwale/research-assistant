import json
from tools.llm import generate
from state import AgentState
from settings import BASE_MODEL
from tools.webSurfing import search_web

def self_ask(state: AgentState):
    subtasks = state['subtasks']
    idx = state['current_task_index']
    task = subtasks[idx]
    goal = task.get('goal', '')

    # Step 1: generate sub-questions
    prompt = f"""To thoroughly research the following query, what are the 3 most important sub-questions that need to be answered first?

Query: {goal}

Return ONLY a JSON array of 3 strings. No explanation, no markdown.
Example: ["sub-question 1", "sub-question 2", "sub-question 3"]"""

    print("Self-Asking |", end=" ", flush=True)
    raw = generate(prompt, BASE_MODEL)
    raw = raw.strip().strip("```json").strip("```").strip()

    try:
        sub_questions = json.loads(raw)
    except Exception:
        sub_questions = [goal]

    # Step 2: answer each sub-question via search
    sub_answers = []
    for q in sub_questions:
        result = search_web(q, 2)
        sub_answers.append(f"Q: {q}\nA: {result[:500] if result else 'No data found'}")

    combined = "\n\n".join(sub_answers)

    state['results'].append({
        "task_id": task.get("id"),
        "type": task.get("type"),
        "response": f"Sub-question research:\n{combined}"
    })
    state['current_task_index'] = idx + 1
    return state