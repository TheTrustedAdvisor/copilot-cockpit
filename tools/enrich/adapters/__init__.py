"""Source adapters for the model enrichment pipeline.

Each adapter is a module exporting:

    SOURCE_ID: str
        Must match the key in tools/enrich/sources.yml.

    def parse(html: str) -> list[dict]:
        Return a list of parsed records. Each record MUST carry per-field
        source metadata so the merge step can score confidence:

            {
                "id": "claude-sonnet-4-5",
                "name": {
                    "value": "Claude Sonnet 4.5",
                    "source": "github-docs-supported-models",
                    "sourceUrl": "https://docs.github.com/...",
                    "verifiedAt": "2026-04-10",
                    "confidence": 95,
                },
                ...
            }

Adapters MUST NOT write to data/copilot-models.json. They write only to
tools/cache/parsed/<source>.json via cache.write_parsed().
"""
