"""Filesystem cache for upstream payloads (HTML, JSON, anything).

Cache layout (idempotent, auditable, gitignored):
    tools/cache/sources/<source-id>/<YYYY-MM-DD>/<slug>.<ext>
    tools/cache/parsed/<source-id>.json

The date folder gives us a simple audit trail: if a later harvest flips a
value unexpectedly, we can diff the raw payload of two dates against each
other before touching data/copilot-models.json.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
from pathlib import Path
from typing import Any, Mapping, Optional

# Repo root is three levels up from this file: tools/enrich/cache.py → cpt/
REPO_ROOT = Path(__file__).resolve().parents[2]
CACHE_ROOT = REPO_ROOT / "tools" / "cache"
SOURCES_ROOT = CACHE_ROOT / "sources"
PARSED_ROOT = CACHE_ROOT / "parsed"

USER_AGENT = (
    "copilot-cockpit-enrich/0.1 "
    "(+https://github.com/TheTrustedAdvisor/copilot-cockpit)"
)


def _today() -> str:
    return _dt.date.today().isoformat()


def source_path(
    source_id: str,
    slug: str,
    suffix: str = ".html",
    date: Optional[str] = None,
) -> Path:
    """Return the on-disk path for a cached source payload.

    `suffix` must include the leading dot (e.g. ".html", ".json").
    """
    return SOURCES_ROOT / source_id / (date or _today()) / f"{slug}{suffix}"


def parsed_path(source_id: str) -> Path:
    """Return the on-disk path for an adapter's parsed output."""
    return PARSED_ROOT / f"{source_id}.json"


def read_source(
    source_id: str,
    slug: str,
    suffix: str = ".html",
    date: Optional[str] = None,
) -> Optional[str]:
    """Return cached source text if present, else None."""
    path = source_path(source_id, slug, suffix, date)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def write_source(
    source_id: str,
    slug: str,
    body: str,
    suffix: str = ".html",
    date: Optional[str] = None,
) -> Path:
    """Write a source payload into the cache and return its path."""
    path = source_path(source_id, slug, suffix, date)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


def get_or_fetch(
    source_id: str,
    slug: str,
    url: str,
    refresh: bool = False,
    headers: Optional[Mapping[str, str]] = None,
    suffix: str = ".html",
) -> str:
    """Return cached payload for today, fetching it via HTTP if missing.

    Imports requests lazily so that `--list-sources` works in a fresh
    checkout without all deps installed yet.
    """
    if not refresh:
        cached = read_source(source_id, slug, suffix=suffix)
        if cached is not None:
            return cached

    import requests  # lazy

    merged_headers = {"User-Agent": USER_AGENT}
    if headers:
        merged_headers.update(headers)

    resp = requests.get(url, timeout=30, headers=merged_headers)
    resp.raise_for_status()
    write_source(source_id, slug, resp.text, suffix=suffix)
    return resp.text


def get_or_fetch_json(
    source_id: str,
    slug: str,
    url: str,
    refresh: bool = False,
    headers: Optional[Mapping[str, str]] = None,
) -> Any:
    """Same as get_or_fetch but for JSON endpoints.

    Response is cached as .json on disk and returned pre-parsed.
    """
    body = get_or_fetch(
        source_id=source_id,
        slug=slug,
        url=url,
        refresh=refresh,
        headers=headers,
        suffix=".json",
    )
    return json.loads(body)


def write_parsed(source_id: str, records: list[dict]) -> Path:
    """Write an adapter's parsed output as JSON."""
    path = parsed_path(source_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {"source": source_id, "records": records, "verifiedAt": _today()},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return path


def load_dotenv_if_present() -> None:
    """Load REPO_ROOT/.env into os.environ if the file exists.

    Uses python-dotenv if available, otherwise parses KEY=value lines by
    hand (no shell-escape handling — .env files should use simple
    `KEY=value` syntax).
    """
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return

    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(env_path, override=False)
        return
    except ImportError:
        pass

    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def require_env(name: str) -> str:
    """Return env var `name`, raising a helpful error if missing."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing environment variable {name}. "
            f"Add it to {REPO_ROOT / '.env'} (gitignored) and re-run."
        )
    return value
