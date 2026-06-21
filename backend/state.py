from typing import TypedDict, List

class AgentState(TypedDict):
    query: str
    mode: str
    subtasks: List[dict]
    current_task_index: int
    results: List[dict]
    final_response: str
    awaiting_clarification: bool
    critic_score: int
    critic_retries: int
    needs_revision: bool
    chat_history: List[dict]   