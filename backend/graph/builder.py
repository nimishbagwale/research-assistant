from langgraph.graph import StateGraph, END
from agents.planner_agent import plan_task
from agents.router_agent import router
from state import AgentState
from agents.conversation_agent import converse, summarize, doubt
from agents.research_agent import research
from agents.analytics_agent import analyze
from agents.critic_agent import critic
from agents.self_ask_agent import self_ask
from agents.tool_agent import tool_use

def critic_router(state: AgentState):
    if state.get('needs_revision'):
        return "SUMMARIZER"   # loop back for revision
    return "END"

def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("PLANNER", plan_task)
    graph.add_node("WEB_SEARCH", research)
    graph.add_node("ANALYTICAL", analyze)
    graph.add_node("SUMMARIZER", summarize)
    graph.add_node("CHAT", converse)
    graph.add_node("DOUBT", doubt)
    graph.add_node("CRITIC", critic)        
    graph.add_node("SELF_ASK", self_ask)
    graph.add_node("TOOL_USE", tool_use)

    graph.set_entry_point("PLANNER")

    graph.add_conditional_edges("PLANNER", router, {
        "WEB_SEARCH": "WEB_SEARCH",
        "ANALYTICAL": "ANALYTICAL",
        "CHAT": "CHAT",
        "SELF_ASK": "SELF_ASK",
        "TOOL_USE": "TOOL_USE",
        "SUMMARIZE": "SUMMARIZER",
        "DOUBT": "DOUBT",
        "END": END,
    })

    graph.add_conditional_edges("SELF_ASK", router, {
        "WEB_SEARCH": "WEB_SEARCH",
        "TOOL_USE": "TOOL_USE",
        "SUMMARIZE": "SUMMARIZER",
        "END": END,
    })

    graph.add_conditional_edges("WEB_SEARCH", router, {
        "WEB_SEARCH": "WEB_SEARCH",
        "ANALYTICAL": "ANALYTICAL",
        "TOOL_USE": "TOOL_USE",
        "SUMMARIZE": "SUMMARIZER",
        "DOUBT": "DOUBT",
        "END": END,
    })

    graph.add_conditional_edges("ANALYTICAL", router, {
        "WEB_SEARCH": "WEB_SEARCH",
        "ANALYTICAL": "ANALYTICAL",
        "TOOL_USE": "TOOL_USE",
        "SUMMARIZE": "SUMMARIZER",
        "DOUBT": "DOUBT",
        "END": END,
    })

    graph.add_conditional_edges("TOOL_USE", router, {
        "WEB_SEARCH": "WEB_SEARCH",
        "ANALYTICAL": "ANALYTICAL",
        "TOOL_USE": "TOOL_USE",
        "SUMMARIZE": "SUMMARIZER",
        "DOUBT": "DOUBT",
        "END": END,
    })

    # summarizer always goes to critic now
    graph.add_edge("SUMMARIZER", "CRITIC")

    # critic decides: revise or end
    graph.add_conditional_edges("CRITIC", critic_router, {
        "SUMMARIZER": "SUMMARIZER",
        "END": END,
    })

    graph.add_edge("CHAT", END)
    graph.add_edge("DOUBT", END)

    return graph.compile()