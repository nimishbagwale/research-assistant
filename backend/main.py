from graph.builder import build_graph
from state import AgentState
from memory.memory_manager import store_chat_history, store_episode
import argparse

# Maps actual LangGraph node names to the step ids the frontend ticks off.
# If you rename/add a node in builder.py, update this dict too.
NODE_TO_STEP = {
    "PLANNER":    "planning",
    "WEB_SEARCH": "researching",
    "SELF_ASK":   "researching",
    "ANALYTICAL": "analyzing",
    "TOOL_USE":   "tools",
    "SUMMARIZER": "summarizing",
    "CHAT":       "summarizing",
    "DOUBT":      "summarizing",
    "CRITIC":     "critiquing",
}


def run(user_query: str, chat_history: list = None, mode: str = "deep") -> tuple[str, dict]:
    if chat_history is None:
        chat_history = []
    graph = build_graph()
    initial_state: AgentState = {
        "query": user_query, "subtasks": [], "mode": mode,
        "current_task_index": 0, "results": [], "final_response": "",
        "awaiting_clarification": False, "critic_score": 0,
        "critic_retries": 0, "needs_revision": False,
        "chat_history": chat_history,
    }
    final_state = graph.invoke(initial_state)
    print()
    return final_state.get("final_response", "No response generated."), final_state


def run_stream(user_query: str, chat_history: list = None, mode: str = "deep"):
    """
    Same pipeline, but yields a progress event the instant each LangGraph
    node actually finishes — no fake delays.

      {"event": "done",   "step": "<id>"}
      {"event": "revert", "step": "critiquing", "to": "summarizing"}
      {"event": "final",  "text": "<answer>"}
    """
    if chat_history is None:
        chat_history = []
    graph = build_graph()
    initial_state: AgentState = {
        "query": user_query, "subtasks": [], "mode": mode,
        "current_task_index": 0, "results": [], "final_response": "",
        "awaiting_clarification": False, "critic_score": 0,
        "critic_retries": 0, "needs_revision": False,
        "chat_history": chat_history,
    }

    final_response = "No response generated."

    for chunk in graph.stream(initial_state, stream_mode="updates"):
        for node_name, node_state in chunk.items():
            if node_state.get("final_response"):
                final_response = node_state["final_response"]

            if node_name == "CRITIC":
                if node_state.get("needs_revision"):
                    yield {"event": "revert", "step": "critiquing", "to": "summarizing"}
                    continue
                yield {"event": "done", "step": "critiquing"}
                yield {"event": "final", "text": final_response}
                return

            if node_name in ("CHAT", "DOUBT"):
                yield {"event": "done", "step": NODE_TO_STEP[node_name]}
                yield {"event": "final", "text": final_response}
                return

            step = NODE_TO_STEP.get(node_name)
            if step:
                yield {"event": "done", "step": step}

    yield {"event": "final", "text": final_response}  # safety net


if __name__ == "__main__":
    print("Multi-Agent Research Assistant")
    print("Type 'exit' to quit\n")
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["quick", "deep"], default="deep")
    args = parser.parse_args()
    chat_history = []
    while True:
        query = input("You: ").strip()
        if not query:
            continue
        if query.lower() == "exit":
            store_episode(chat_history)
            break
        response, _ = run(query, chat_history, mode=args.mode)
        print(f"\nAssistant: {response}\n")
        chat_history.append(store_chat_history(query, response))