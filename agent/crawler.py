import httpx
from bs4 import BeautifulSoup


_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

_REMOVE_TAGS = {"script", "style", "nav", "header", "footer", "aside", "iframe", "noscript"}


def crawl_url(url: str) -> dict:
    """Fetch a URL and extract title + main body text."""
    with httpx.Client(headers=_HEADERS, follow_redirects=True, timeout=15) as client:
        resp = client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    title = (soup.title.string or "").strip() if soup.title else ""

    for tag in soup(list(_REMOVE_TAGS)):
        tag.decompose()

    # prefer <article> or <main>, fall back to <body>
    container = soup.find("article") or soup.find("main") or soup.body
    if container is None:
        raise ValueError("본문을 찾을 수 없습니다.")

    paragraphs = [p.get_text(" ", strip=True) for p in container.find_all("p")]
    content = "\n".join(p for p in paragraphs if len(p) > 30)

    if not content:
        content = container.get_text(" ", strip=True)

    if len(content) < 100:
        raise ValueError("본문이 너무 짧습니다. 크롤링을 지원하지 않는 페이지일 수 있습니다.")

    return {"title": title, "content": content[:8000]}
