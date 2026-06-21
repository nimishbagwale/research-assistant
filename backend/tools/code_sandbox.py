import os
import subprocess
import sys
import tempfile

try:
    import resource
    _HAS_RESOURCE = os.name == "posix"
except ImportError:
    _HAS_RESOURCE = False

_BLOCKED_BUILTINS = ["open", "eval", "exec", "compile", "input", "exit", "quit"]
_BLOCKED_MODULES = ["os", "subprocess", "socket", "shutil"]

_PRELUDE = f"""
import builtins as _b
for _name in {_BLOCKED_BUILTINS!r}:
    if hasattr(_b, _name):
        setattr(_b, _name, None)
import sys as _sys
for _mod in {_BLOCKED_MODULES!r}:
    _sys.modules[_mod] = None
"""


def _limit_resources():
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))


def run_sandboxed(code: str, timeout: int = 5) -> str:
    """
    Best-effort sandbox for a single local user. Blocks common dangerous
    builtins/modules and caps CPU+memory on POSIX (no-op on Windows).
    NOT safe for multi-tenant or internet-facing use — for that, run each
    call in its own Docker container instead.
    Code must print() its result; return value is otherwise discarded.
    """
    full_code = _PRELUDE + "\n" + code
    path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(full_code)
            path = f.name

        kwargs = {"capture_output": True, "text": True, "timeout": timeout}
        if _HAS_RESOURCE:
            kwargs["preexec_fn"] = _limit_resources

        result = subprocess.run([sys.executable, path], **kwargs)

        if result.returncode != 0:
            return f"Code ran with errors:\n{result.stderr.strip()[-1000:]}"
        output = result.stdout.strip()
        return output[-2000:] if output else "Code ran with no output. Use print() to return a result."
    except subprocess.TimeoutExpired:
        return f"Code execution timed out after {timeout}s"
    except Exception as e:
        return f"Sandbox error: {e}"
    finally:
        if path:
            try:
                os.remove(path)
            except OSError:
                pass