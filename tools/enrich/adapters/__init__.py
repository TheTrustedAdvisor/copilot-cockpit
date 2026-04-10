"""Source adapters for the model enrichment pipeline.

Each adapter is a module that exports:

    SOURCE_ID: str
        Must match the key in tools/enrich/sources.yml.

    def harvest(cache) -> list[dict]:
        Fetch (or read from cache), normalize, and return a list of
        parsed records. Adapters own their own fetching — use the
        `cache.get_or_fetch(...)` / `cache.get_or_fetch_json(...)`
        helpers for consistent date-stamped caching.

Each record MUST carry per-field source metadata so the merge step can
score confidence later:

    {
        "id": "claude-sonnet-4-5",
        "displayName": {
            "value": "Claude Sonnet 4.5",
            "source": "anthropic-api",
            "sourceUrl": "https://api.anthropic.com/v1/models/claude-sonnet-4-5",
            "verifiedAt": "2026-04-10",
            "confidence": 100
        },
        "contextWindow": { "value": 200000, "source": ..., ... },
        ...
    }

Adapters MUST NOT write to data/copilot-models.json. They write only to
tools/cache/parsed/<source>.json via `cache.write_parsed()`, which
`harvest.py` calls after the adapter returns.

Auth-guarded adapters should call `cache.require_env("ANTHROPIC_API_KEY")`
etc. — that helper raises a clear RuntimeError pointing at the .env file
if the key is missing, instead of blowing up deep inside requests.
"""
