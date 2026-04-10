"""Google Gemini API adapter (generativelanguage.googleapis.com/v1beta).

Pulls model metadata from the first-party source:
    GET /v1beta/models?pageSize=200&key={GOOGLE_API_KEY}

The list endpoint already returns full detail for every model (unlike
Anthropic, where we had to fan out per id), so this adapter makes a
single HTTP call.

Auth: Google supports either a `?key=…` query param OR an
`x-goog-api-key` header. We use the header so the key never appears
in a URL — no risk of it leaking into a requests traceback on HTTP
errors or into the cache filename. GOOGLE_API_KEY must be present in
.env (or the environment).

Notable fields captured: displayName, description, inputTokenLimit,
outputTokenLimit, supportedGenerationMethods, thinking (boolean),
version, temperature defaults. Embedding / tuning / imagegen variants
come back too; downstream normalize.py decides which to surface.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any

SOURCE_ID = "google-genai-api"
SOURCE_LABEL = "google-genai-api"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


def _today() -> str:
    return _dt.date.today().isoformat()


def _strip_prefix(name: str) -> str:
    """'models/gemini-2.5-pro' -> 'gemini-2.5-pro'."""
    return name.split("/", 1)[1] if name.startswith("models/") else name


def _field(value: Any, source_url: str) -> dict:
    return {
        "value": value,
        "source": SOURCE_LABEL,
        "sourceUrl": source_url,
        "verifiedAt": _today(),
        "confidence": 100,
    }


def _normalize(entry: dict, public_url: str) -> dict:
    """Map one Gemini models/* payload to a CPT record.

    `public_url` is a key-less URL suitable for sourceUrl attribution.
    """
    model_id = _strip_prefix(entry.get("name", ""))
    record: dict[str, Any] = {"id": model_id}

    if "displayName" in entry:
        record["displayName"] = _field(entry["displayName"], public_url)
    if "description" in entry:
        record["description"] = _field(entry["description"], public_url)
    if "version" in entry:
        record["version"] = _field(entry["version"], public_url)
    if "inputTokenLimit" in entry:
        record["contextWindow"] = _field(entry["inputTokenLimit"], public_url)
    if "outputTokenLimit" in entry:
        record["maxOutputTokens"] = _field(entry["outputTokenLimit"], public_url)
    if "supportedGenerationMethods" in entry:
        record["supportedMethods"] = _field(
            list(entry["supportedGenerationMethods"]), public_url
        )
    if "thinking" in entry:
        # Gemini exposes this as a plain boolean; normalize to match the
        # richer Anthropic `thinkingTypes: [adaptive, enabled]` later.
        record["thinkingEnabled"] = _field(bool(entry["thinking"]), public_url)
    if "temperature" in entry:
        record["defaultTemperature"] = _field(entry["temperature"], public_url)
    if "maxTemperature" in entry:
        record["maxTemperature"] = _field(entry["maxTemperature"], public_url)

    return record


def harvest(cache, refresh: bool = False) -> list[dict]:
    api_key = cache.require_env("GOOGLE_API_KEY")
    headers = {"x-goog-api-key": api_key}

    list_url = f"{BASE_URL}/models?pageSize=200"
    listing = cache.get_or_fetch_json(
        SOURCE_ID,
        "models-list",
        list_url,
        refresh=refresh,
        headers=headers,
    )

    records: list[dict] = []
    for entry in listing.get("models", []):
        if "name" not in entry:
            continue
        records.append(_normalize(entry, list_url))
    return records
