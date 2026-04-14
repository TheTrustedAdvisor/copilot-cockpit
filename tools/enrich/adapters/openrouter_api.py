"""OpenRouter API adapter (openrouter.ai/api/v1/models).

Unauthenticated aggregator that exposes a unified schema over ~350
models from every major provider. We use it for two reasons:

1. **OpenAI gap**: platform.openai.com/docs/models is thin, and the
   native /v1/models endpoint requires auth and returns almost no
   metadata. OpenRouter gives us context_length, pricing, modality,
   and supported_parameters for every GPT/o-series model.
2. **Cross-provider sanity check**: when Anthropic and Google both
   return their own data, OpenRouter acts as a third witness that can
   flag disagreements during the merge step.

No auth, single HTTP call. The list endpoint returns full detail for
every model — no fan-out needed.

Captured fields per model: displayName, description, contextWindow,
knowledgeCutoff, pricing, inputModalities, outputModalities, tokenizer,
supportedParameters, releasedAt, expirationDate, huggingFaceId.

IDs are kept in `provider/model-id` form (e.g. `openai/gpt-5.4-pro`)
for uniqueness across providers. The `provider` slug is extracted into
its own field so normalize.py can decide which source to trust for
which field per provider.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any

SOURCE_ID = "openrouter-api"
SOURCE_LABEL = "openrouter-api"
BASE_URL = "https://openrouter.ai/api/v1"
LIST_URL = f"{BASE_URL}/models"


def _today() -> str:
    return _dt.date.today().isoformat()


def _field(value: Any) -> dict:
    return {
        "value": value,
        "source": SOURCE_LABEL,
        "sourceUrl": LIST_URL,
        "verifiedAt": _today(),
        "confidence": 90,  # aggregator — slightly below first-party APIs
    }


def _normalize(entry: dict) -> dict:
    model_id = entry.get("id", "")
    record: dict[str, Any] = {"id": model_id}

    # Split "openai/gpt-5.4-pro" → provider="openai"
    if "/" in model_id:
        record["provider"] = _field(model_id.split("/", 1)[0])

    if "name" in entry:
        record["displayName"] = _field(entry["name"])
    if "description" in entry:
        record["description"] = _field(entry["description"])
    if "context_length" in entry:
        record["contextWindow"] = _field(entry["context_length"])
    if "knowledge_cutoff" in entry and entry["knowledge_cutoff"]:
        record["knowledgeCutoff"] = _field(entry["knowledge_cutoff"])

    pricing = entry.get("pricing")
    if pricing:
        record["pricing"] = _field(pricing)  # strings, preserved as-is

    arch = entry.get("architecture") or {}
    if "input_modalities" in arch:
        record["inputModalities"] = _field(list(arch["input_modalities"]))
    if "output_modalities" in arch:
        record["outputModalities"] = _field(list(arch["output_modalities"]))
    if "tokenizer" in arch:
        record["tokenizer"] = _field(arch["tokenizer"])

    if "supported_parameters" in entry:
        record["supportedParameters"] = _field(list(entry["supported_parameters"]))

    if entry.get("created"):
        # `created` is a Unix epoch int.
        try:
            iso = _dt.datetime.fromtimestamp(
                int(entry["created"]), tz=_dt.timezone.utc
            ).strftime("%Y-%m-%dT%H:%M:%SZ")
            record["releasedAt"] = _field(iso)
        except (ValueError, TypeError, OSError):
            pass

    if "expiration_date" in entry and entry["expiration_date"]:
        record["expirationDate"] = _field(entry["expiration_date"])
    if "hugging_face_id" in entry and entry["hugging_face_id"]:
        record["huggingFaceId"] = _field(entry["hugging_face_id"])

    return record


def harvest(cache, refresh: bool = False) -> list[dict]:
    # No auth required.
    listing = cache.get_or_fetch_json(
        SOURCE_ID,
        "models-list",
        LIST_URL,
        refresh=refresh,
    )

    records: list[dict] = []
    for entry in listing.get("data", []):
        if not entry.get("id"):
            continue
        records.append(_normalize(entry))
    return records
