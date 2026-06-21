import ast
import math
import operator

_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARYOPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}
_FUNCS = {
    "sqrt": math.sqrt,
    "abs": abs,
    "round": round,
    "log": math.log,
    "log10": math.log10,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "min": min,
    "max": max,
}
_NAMES = {
    "pi": math.pi,
    "e": math.e,
}


class UnsafeExpression(Exception):
    pass


def _eval_node(node):
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise UnsafeExpression(f"disallowed constant: {node.value!r}")
    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _BINOPS:
            raise UnsafeExpression(f"disallowed operator: {op_type.__name__}")
        return _BINOPS[op_type](_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _UNARYOPS:
            raise UnsafeExpression(f"disallowed operator: {op_type.__name__}")
        return _UNARYOPS[op_type](_eval_node(node.operand))
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _FUNCS:
            raise UnsafeExpression("disallowed function call")
        args = [_eval_node(a) for a in node.args]
        return _FUNCS[node.func.id](*args)
    if isinstance(node, ast.Name):
        if node.id in _NAMES:
            return _NAMES[node.id]
        raise UnsafeExpression(f"disallowed name: {node.id}")
    raise UnsafeExpression(f"disallowed expression: {type(node).__name__}")


def calculate(expr: str) -> str:
    """Evaluate a math expression using a whitelisted AST walk (no eval())."""
    try:
        tree = ast.parse(expr, mode="eval")
        result = _eval_node(tree)
        return str(result)
    except UnsafeExpression as e:
        return f"Calculator rejected expression: {e}"
    except ZeroDivisionError:
        return "Calculator error: division by zero"
    except Exception as e:
        return f"Calculator error: {e}"