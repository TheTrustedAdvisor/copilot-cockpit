"""Filesystem cache for upstream HTML/JSON.

Cache layout (idempotent, auditable, gitignored):
    tools/cache/sources/<source-id>/<YYYY-MM-DD>/<slug>.html
    tools/cache/parsed/<source-id>.json

The date folder gives us a simple audit trail: if a later harvest flips a
value unexpectedly, we can diff the raw HTML of two dates against each
other before touching data/copilot-models.json.
"""

from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path
from typing import Optional

# Repo root is three levels up from this file: tools/enrich/cache.py → cpt/
REPO_ROOT = Path(__file__).resolve().parents[2]
CACHE_ROOT = REPO_ROOT / "tools" / "cache"
SOURCES_ROOT = CACHE_ROOT / "sources"
PARSED_ROOT = CACHE_ROOT / "parsed"


def _today() -> str:
    return _dt.date.today().isoformat()


def source_path(source_id: str, slug: str, date: Optional[str] = None) -> Path:
    """Return the on-disk path for a cached source payload."""
    return SOURCES_ROOT / source_id / (date or _today()) / f"{slug}.html"


def parsed_path(source_id: str) -> Path:
    """Return the on-disk path for an adapter's parsed output."""
    return PARSED_ROOT / f"{source_id}.json"


def read_source(source_id: str, slug: str, date: Optional[str] = None) -> Optional[str]:
    """Return cached source text if present, else None."""
    path = source_path(source_id, slug, date)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def write_source(source_id: str, slug: str, body: str, date: Optional[str] = None) -> Path:
    """Write a source payload into the cache and return its path."""
    path = source_path(source_id, slug, date)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


def get_or_fetch(
    source_id: str,
    slug: str,
    url: str,
    refresh: bool = False,
) -> str:
    """Return cached HTML for today, fetching it with requests if missing.

    Imports requests lazily so that `--list-sources` works in a fresh
    checkout without requirements.txt installed yet.
    """
    if not refresh:
        cached = read_source(source_id, slug)
        if cached is not None:
            return cached

    import requests  # lazy

    resp = requests.get(url, timeout=30, headers={
        "User-Agent": "copilot-cockpit-enrich/0.1 (+https://github.com/TheTrustedAdvisor/copilot-cockpit)",
    })
    resp.raise_for_status()
    write_source(source_id, slug, resp.text)
    return resp.text


def write_parsed(source_id: str, records: list[dict]) -> Path:
    """Write an adapter's parsed output as JSON."""
    path = parsed_path(source_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"source": source_id, "records": records}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return path
