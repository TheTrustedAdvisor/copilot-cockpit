"""Anthropic Models API adapter.

Pulls rich model metadata from the authoritative first-party source:
    GET https://api.anthropic.com/v1/models            (list)
    GET https://api.anthropic.com/v1/models/{id}       (detail)

As of 2026-04, the detail endpoint returns a deeply nested capability
tree with fields like `max_input_tokens`, `max_output_tokens`,
`capabilities.image_input`, `capabilities.thinking.types`,
`capabilities.effort`, `capabilities.context_management.*`, pricing,
deprecation dates, and more. That is significantly richer than any HTML
docs page we could scrape.

Auth: requires ANTHROPIC_API_KEY in .env (or env). The key is only read
via os.environ — it is never logged, cached, or written to disk.

Output: one record per Anthropic model, with every mapped field wrapped
in `{value, source, sourceUrl, verifiedAt, confidence}` per the adapter
contract documented in adapters/__init__.py.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any

SOURCE_ID = "anthropic-api"
SOURCE_LABEL = "anthropic-api"
BASE_URL = "https://api.anthropic.com/v1"
API_VERSION = "2023-06-01"


def _today() -> str:
    return _dt.date.today().isoformat()


def _field(value: Any, source_url: str) -> dict:
    """Wrap a scalar value in the per-field source-metadata envelope."""
    return {
        "value": value,
        "source": SOURCE_LABEL,
        "sourceUrl": source_url,
        "verifiedAt": _today(),
        "confidence": 100,
    }


def _normalize(detail: dict) -> dict:
    """Map one Anthropic /v1/models/{id} payload to a CPT record.

    Unknown/missing fields are simply omitted — normalize.py will merge
    them from other sources if available.
    """
    model_id = detail.get("id")
    detail_url = f"{BASE_URL}/models/{model_id}"

    record: dict[str, Any] = {"id": model_id}

    if "display_name" in detail:
        record["displayName"] = _field(detail["display_name"], detail_url)

    if "created_at" in detail:
        record["releasedAt"] = _field(detail["created_at"], detail_url)

    if "deprecation" in detail and detail["deprecation"]:
        record["deprecatedAt"] = _field(detail["deprecation"], detail_url)

    # Context / output windows — Anthropic exposes these at the top level.
    if "max_input_tokens" in detail:
        record["contextWindow"] = _field(detail["max_input_tokens"], detail_url)
    if "max_output_tokens" in detail:
        record["maxOutputTokens"] = _field(detail["max_output_tokens"], detail_url)

    caps = detail.get("capabilities") or {}

    # Modality inputs
    if "image_input" in caps:
        record["imageInput"] = _field(bool(caps["image_input"]), detail_url)
    if "pdf_input" in caps:
        record["pdfInput"] = _field(bool(caps["pdf_input"]), detail_url)

    # Structured outputs & tool use
    if "structured_outputs" in caps:
        record["structuredOutputs"] = _field(bool(caps["structured_outputs"]), detail_url)
    if "tool_use" in caps:
        record["toolUse"] = _field(bool(caps["tool_use"]), detail_url)
    if "citations" in caps:
        record["citations"] = _field(bool(caps["citations"]), detail_url)
    if "code_execution" in caps:
        record["codeExecution"] = _field(bool(caps["code_execution"]), detail_url)
    if "batch" in caps:
        record["batchApi"] = _field(bool(caps["batch"]), detail_url)

    # Thinking / reasoning
    thinking = caps.get("thinking")
    if isinstance(thinking, dict) and "types" in thinking:
        record["thinkingTypes"] = _field(list(thinking["types"]), detail_url)

    effort = caps.get("effort")
    if isinstance(effort, dict) and "levels" in effort:
        record["effortLevels"] = _field(list(effort["levels"]), detail_url)
    elif isinstance(effort, list):
        record["effortLevels"] = _field(list(effort), detail_url)

    # Context management strategies (priming, compaction, etc.)
    ctx_mgmt = caps.get("context_management")
    if isinstance(ctx_mgmt, dict):
        strategies = sorted(k for k, v in ctx_mgmt.items() if v)
        if strategies:
            record["contextManagement"] = _field(strategies, detail_url)

    # Pricing — useful for cost tooltips in the cockpit detail blade.
    pricing = detail.get("pricing") or {}
    if pricing:
        record["pricing"] = _field(pricing, detail_url)

    return record


def harvest(cache, refresh: bool = False) -> list[dict]:
    api_key = cache.require_env("ANTHROPIC_API_KEY")
    headers = {
        "x-api-key": api_key,
        "anthropic-version": API_VERSION,
    }

    list_url = f"{BASE_URL}/models?limit=1000"
    listing = cache.get_or_fetch_json(
        SOURCE_ID,
        "models-list",
        list_url,
        refresh=refresh,
        headers=headers,
    )

    records: list[dict] = []
    for entry in listing.get("data", []):
        model_id = entry.get("id")
        if not model_id:
            continue
        detail = cache.get_or_fetch_json(
            SOURCE_ID,
            f"model-{model_id}",
            f"{BASE_URL}/models/{model_id}",
            refresh=refresh,
            headers=headers,
        )
        records.append(_normalize(detail))

    return records
