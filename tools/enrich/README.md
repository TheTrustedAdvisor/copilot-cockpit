# Model Enrichment Pipeline

Harvests fresh model metadata from upstream sources (docs.github.com,
provider docs, MS Learn MCP, the Copilot changelog) into
`data/copilot-models.json` via a reproducible, human-gated pipeline.

**Status:** P0 scaffold only. No adapters yet — see #24 (P1), #25 (P2).

## Why this exists

`data/copilot-models.json` was hand-maintained and went stale fast. The
GitHub Copilot model catalog changes every few weeks. This pipeline
replaces guesswork with a multi-source merge where every field can be
traced back to an upstream URL and a verification date.

## Design principles

1. **Per-field source of truth.** Every enriched field carries
   `{ source, sourceUrl, verifiedAt, confidence }` so the UI can badge
   stale or disputed values.
2. **Two stages, one direction.** Harvest fetches; normalize merges.
   Neither writes to `data/`.
3. **Human-gated merges.** The diff step (post-P2) prints a patch and
   requires a human commit. No auto-writes.
4. **Idempotent, audited cache.** Every upstream payload lands in a
   date-stamped folder so we can diff two runs against each other.
5. **Adapter-per-source.** New sources drop in as a single file under
   `adapters/`; `harvest.py` doesn't need to change.

## Layout

```
tools/enrich/
├── __init__.py
├── harvest.py          # CLI entry: fetch + parse
├── normalize.py        # (stub) merge parsed outputs
├── cache.py            # filesystem cache helpers
├── sources.yml         # source registry (URLs + adapter names)
├── requirements.txt    # requests, beautifulsoup4, pyyaml, rich, pytest
├── adapters/
│   └── __init__.py     # (empty — P1/P2 add files here)
└── README.md           # this file

tools/cache/            # .gitignored
├── sources/<source-id>/<YYYY-MM-DD>/<slug>.html
└── parsed/<source-id>.json
```

## Installation

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/enrich/requirements.txt
```

## Usage

```bash
# List the registered sources (no fetch).
python3 -m tools.enrich.harvest --list-sources

# Harvest one source.
python3 -m tools.enrich.harvest --source github-docs-supported-models

# Harvest all sources (skips any whose adapter isn't implemented yet).
python3 -m tools.enrich.harvest --all

# Force a refetch, bypassing today's cache.
python3 -m tools.enrich.harvest --source openai-models --refresh
```

Exit codes:

- `0` — success, or `--list-sources`
- `1` — unknown source id, or unexpected runtime error
- `2` — adapter not implemented yet for that source (expected during P1/P2
  rollout). `--all` keeps going past `rc=2`.

## Adding a new adapter

1. Pick a source id (kebab-case, e.g. `anthropic-models`).
2. Add an entry to `sources.yml` with `url`, `type`, `adapter`, `slug`,
   `fields`, `phase`.
3. Create `adapters/<adapter>.py` exporting:
   ```python
   SOURCE_ID = "anthropic-models"

   def parse(html: str) -> list[dict]:
       ...
   ```
4. Write a pytest snapshot test under `tests/fixtures/enrich/<source-id>/`
   — cache a real HTML response, assert the parser against a committed
   `expected.json`.

## Source-of-truth matrix

| Field | Primary source | Adapter | Phase |
| --- | --- | --- | --- |
| `id`, `name`, `provider`, `status`, `modeAvailability` | `docs.github.com/.../supported-models` | `github_supported_models` | P1 |
| `taskFit`, `strengths` | `docs.github.com/.../model-comparison` | `github_model_comparison` | P1 |
| `contextWindow`, `knowledgeCutoff` (OpenAI) | `platform.openai.com/docs/models` | `openai_models` | P2 |
| `contextWindow`, `knowledgeCutoff` (Anthropic) | `docs.anthropic.com/.../models` | `anthropic_models` | P2 |
| `contextWindow`, `knowledgeCutoff` (Google) | `ai.google.dev/.../models` | `google_models` | P2 |
| `ideAvailability` | MS Learn MCP (dev-only) | `ms_learn` | P3 |
| `releasedAt`, `deprecatedAt` | `github.blog/changelog/label/copilot/feed/` | `copilot_changelog` | P4 |

## Data safety

This pipeline NEVER writes to `data/copilot-models.json` on its own. The
eventual merge step (post-P2) prints a human-reviewed diff; the commit is
always manual. If you see `harvest.py` or `normalize.py` touching
`data/`, treat it as a bug.
