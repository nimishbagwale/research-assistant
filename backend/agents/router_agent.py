from state import AgentState

def router(state: AgentState):
    if state.get('awaiting_clarification'):
        return "END"

    subtasks = state['subtasks']
    idx = state['current_task_index']
    
    if idx >= len(subtasks):
        return "END"
    
    current = subtasks[idx]
    task_type = current.get('type', 'doubt')
    
    if task_type == "chat":
        return "CHAT"
    elif task_type == "web_search":
        return "WEB_SEARCH"
    elif task_type == "self_ask":
        return "SELF_ASK"
    elif task_type == "analytical":
        return "ANALYTICAL"
    elif task_type == "tool_use":
        return "TOOL_USE"
    elif task_type == "summarize":
        return "SUMMARIZE"
    elif task_type == "doubt":
        return "DOUBT"
    else:
        return "CONVO"