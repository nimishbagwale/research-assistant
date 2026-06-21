from tools.calculator import calculate
from tools.code_sandbox import run_sandboxed
from tools.live_data import get_exchange_rate
from tools.datetime_tool import get_datetime

TOOLS = {
    "calculator": {
        "fn": calculate,
        "description": 'Evaluate a math expression. Args: {"expr": "<expression>"}',
    },
    "code_exec": {
        "fn": run_sandboxed,
        "description": 'Run a short sandboxed Python snippet that must print() its result. Args: {"code": "<python code>"}',
    },
    "exchange_rate": {
        "fn": get_exchange_rate,
        "description": 'Convert currency. Args: {"base": "USD", "target": "INR", "amount": 100}',
    },
    "datetime": {
        "fn": get_datetime,
        "description": 'Get the current date/time, optionally offset by days. Args: {"days_offset": 0}',
    },
}


def tool_descriptions() -> str:
    return "\n".join(f"- {name}: {spec['description']}" for name, spec in TOOLS.items())


def run_tool(name: str, args: dict) -> str:
    if name not in TOOLS:
        return f"Unknown tool: {name}"
    try:
        return str(TOOLS[name]["fn"](**(args or {})))
    except TypeError as e:
        return f"Tool '{name}' called with bad arguments: {e}"
    except Exception as e:
        return f"Tool '{name}' failed: {e}"