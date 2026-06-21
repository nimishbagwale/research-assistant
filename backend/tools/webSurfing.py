from settings import TAVILY_KEY as tavily_key
import requests
from bs4 import BeautifulSoup


def fetch_page(url: str, max_chars: int = 3000) -> str:
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=5)
        soup = BeautifulSoup(res.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return text[:max_chars]
    except Exception as e:
        return f"Could not fetch page: {e}"


def _format_ddgs(results, max_results):
    formatted = []
    for r in results[:2]:
        url = r.get('href', '')
        snippet = r.get('body', '')
        page_content = fetch_page(url)
        formatted.append(
            f"Title: {r.get('title', '')}\n"
            f"URL: {url}\n"
            f"Snippet: {snippet}\n"
            f"Full content: {page_content}"
        )
    for r in results[2:max_results]:
        formatted.append(
            f"Title: {r.get('title', '')}\n"
            f"URL: {r.get('href', '')}\n"
            f"Snippet: {r.get('body', '')}"
        )
    return "\n\n---\n\n".join(formatted)


def _search_ddgs(query: str, max_results: int) -> str | None:
    """Try DuckDuckGo. Returns result string or None on failure."""
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        if results:
            return _format_ddgs(results, max_results)
        print("[DDGS] No results found.")
        return None
    except Exception as e:
        print(f"[DDGS failed] {e}")
        return None


def _search_tavily(query: str, max_results: int) -> str | None:
    """Try Tavily. Returns result string or None on failure."""
    if not tavily_key:
        return None
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=tavily_key)
        results = client.search(query, max_results=max_results)
        formatted = []
        for r in results.get("results", []):
            formatted.append(
                f"Title: {r.get('title', '')}\n"
                f"Snippet: {r.get('content', '')}\n"
                f"URL: {r.get('url', '')}"
            )
        if formatted:
            return "\n\n".join(formatted)
        print("[Tavily] No results found.")
        return None
    except Exception as e:
        print(f"[Tavily failed] {e}")
        return None


def _search_google_scrape(query: str, max_results: int) -> str | None:
    """Last-resort: scrape Google search snippets (no key needed)."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/124.0.0.0 Safari/537.36"
        }
        url = f"https://www.google.com/search?q={requests.utils.quote(query)}&num={max_results}"
        res = requests.get(url, headers=headers, timeout=8)
        soup = BeautifulSoup(res.text, "html.parser")
        formatted = []
        for g in soup.select("div.g")[:max_results]:
            title_el = g.select_one("h3")
            link_el = g.select_one("a")
            snippet_el = g.select_one("div.VwiC3b, span.aCOpRe, div[data-sncf]")
            title = title_el.get_text() if title_el else ""
            link = link_el["href"] if link_el and link_el.get("href", "").startswith("http") else ""
            snippet = snippet_el.get_text() if snippet_el else ""
            if title or snippet:
                formatted.append(f"Title: {title}\nURL: {link}\nSnippet: {snippet}")
        if formatted:
            return "\n\n---\n\n".join(formatted)
        print("[Google scrape] No results parsed.")
        return None
    except Exception as e:
        print(f"[Google scrape failed] {e}")
        return None


def search_web(query: str, max_results: int = 4) -> str:
    """
    Search with a 3-tier fallback: DDGS → Tavily → Google scrape.
    Always returns a non-empty string (or a clear failure message).
    """
    result = _search_ddgs(query, max_results)
    if result:
        return result

    print("[Fallback] Trying Tavily...")
    result = _search_tavily(query, max_results)
    if result:
        return result

    print("[Fallback] Trying Google scrape...")
    result = _search_google_scrape(query, max_results)
    if result:
        return result

    return f"Search failed: all providers exhausted for query: {query}"
