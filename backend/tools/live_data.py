import requests


def get_exchange_rate(base: str = "USD", target: str = "INR", amount: float = 1.0) -> str:
    """Convert currency using the free, keyless Frankfurter API."""
    try:
        resp = requests.get(
            "https://api.frankfurter.app/latest",
            params={"from": base.upper(), "to": target.upper()},
            timeout=5,
        )
        data = resp.json()
        rate = data.get("rates", {}).get(target.upper())
        if rate is None:
            return f"Could not find an exchange rate for {base} to {target}"
        converted = rate * float(amount)
        return f"{amount} {base.upper()} = {converted:.2f} {target.upper()} (rate: {rate})"
    except Exception as e:
        return f"Exchange rate lookup failed: {e}"