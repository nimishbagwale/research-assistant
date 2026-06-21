from settings import BASE_MODEL
from state import AgentState
from tools.llm import generate

def critic(state: AgentState):
    final_response = state['final_response']
    original_query = state['query']
    max_retries = state.get('critic_retries', 0)

    prompt = f"""You are a quality critic. Score the following answer on a scale of 1-5 based on how well it answers the original query.

Original query: {original_query}

Answer to evaluate:
{final_response}

Scoring criteria:
- 5: Complete, specific, accurate, well-structured
- 4: Good but missing minor details
- 3: Partially answers the query, some gaps
- 2: Vague or missing key information
- 1: Does not answer the query

Reply ONLY with this JSON:
{{"score": <1-5>, "reason": "<one sentence why>", "revision_instruction": "<what specifically needs to improve, or empty string if score >= 4>"}}"""

    print("Critiquing |", end=" ", flush=True)
    raw = generate(prompt, BASE_MODEL)

    try:
        import json
        raw = raw.strip().strip("```json").strip("```").strip()
        result = json.loads(raw)
        score = result.get("score", 3)
        revision_instruction = result.get("revision_instruction", "")
    except Exception:
        score = 4
        revision_instruction = ""

    state['critic_score'] = score
    state['critic_retries'] = max_retries + 1

    if score < 4 and max_retries < 2 and revision_instruction:
        state['results'].append({
            "task_id": "critic",
            "type": "critic_feedback",
            "response": f"Revision needed: {revision_instruction}"
        })
        state['needs_revision'] = True
        state['current_task_index'] = len(state['subtasks']) - 1
    else:
        state['needs_revision'] = False

    return state
