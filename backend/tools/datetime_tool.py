from datetime import datetime, timedelta


def get_datetime(days_offset: int = 0) -> str:
    """Return the current date/time, optionally offset by N days."""
    try:
        target = datetime.now() + timedelta(days=int(days_offset))
        return target.strftime("%A, %d %B %Y, %H:%M:%S")
    except Exception as e:
        return f"Datetime error: {e}"