from state import AgentState
from tools.llm import generate
from tools.webSurfing import search_web
from settings import BASE_MODEL
import json


def is_bad_result(raw: str) -> bool:
    if not raw or len(raw.strip()) < 100:
        return True
    bad_signals = ["search failed: all providers", "could not fetch", "error"]
    return any(signal in raw.lower() for signal in bad_signals)


def rephrase_query(goal: str, original_query: str) -> str:
    prompt = f"""The following search query returned poor results: "{goal}"

Original user question for context: "{original_query}"

Rewrite it as a better, more specific web search query. Return ONLY the new query, nothing else."""
    return generate(prompt, BASE_MODEL)


def expand_queries(goal: str, original_query: str) -> list[str]:
    """Generate 3 diverse search queries."""
    prompt = f"""You are helping research the following goal for a user's question.

Original user question: "{original_query}"
Current research goal: "{goal}"

Generate 3 different web search queries to research this goal from different angles.
Make sure the queries are specific and technical where the topic is technical.
Return ONLY a JSON array of 3 strings. No explanation, no markdown.
Example: ["query one", "query two", "query three"]"""

    raw = generate(prompt, BASE_MODEL)
    raw = raw.strip().strip("```json").strip("```").strip()
    try:
        queries = json.loads(raw)
        return queries if isinstance(queries, list) else [goal]
    except Exception:
        return [goal]


def build_context(results: list) -> str:
    if not results:
        return ""
    context = "Previous task results:\n"
    for r in results:
        context += f"\n[Task {r['task_id']} - {r['type']}]\n{r['response']}\n"
    return context


def research(state: AgentState):
    subtasks = state['subtasks']
    idx = state['current_task_index']
    task = subtasks[idx]

    context = build_context(state['results'])
    goal = task.get('goal', '')
    original_query = state.get('query', goal)

    if state['mode'] == "deep":
        print("Expanding-Queries |", end=" ", flush=True)
        queries = expand_queries(goal, original_query)
    else:
        queries = [goal]

    print("Searching-Web |", end=" ", flush=True)
    all_results = []
    for q in queries:
        result = search_web(q, 3)
        # Accept result as long as it's not a total provider exhaustion
        if result and "search failed: all providers" not in result.lower():
            all_results.append(result)

    # If we got nothing from expanded queries, try the goal directly
    if not all_results:
        print("Replanning-Query |", end=" ", flush=True)
        rephrased = rephrase_query(goal, original_query)
        result = search_web(rephrased, 4)
        if result and "search failed: all providers" not in result.lower():
            all_results.append(result)

    if all_results:
        raw_results = "\n\n---\n\n".join(all_results)
    else:
        # All searches exhausted — use whatever the last search returned
        # so the LLM at least has some signal rather than hallucinating
        raw_results = search_web(goal, 4)

    prompt = f"""{context}

Search results for current task:
{raw_results}

Current task: {goal}
Original user question: {original_query}

Extract and summarise only the information relevant to the current task from the search results above.
Respect the context of the original user question when selecting what is relevant.
At the end, list all URLs found in the search results under a "Sources:" section.

Format:
<your summary>

Sources:
- <url1>
- <url2>"""

    print("Extracting-Searches |", end=" ", flush=True)
    response = generate(prompt, BASE_MODEL)

    state['results'].append({
        "task_id": task.get("id"),
        "type": task.get("type"),
        "response": response
    })
    state['current_task_index'] = idx + 1

    return state
