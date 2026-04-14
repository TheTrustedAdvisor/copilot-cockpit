"""Merge parsed adapter outputs into a candidate enriched catalog.

Read-only: this module NEVER writes to data/copilot-models.json. It
reads tools/cache/parsed/*.json, matches records against the current
catalog using a canonicalized-id heuristic, picks a best value per
field using per-source confidence, and emits two artifacts:

    tools/cache/merged-candidate.json   — full candidate catalog
    (stdout)                             — a rich terminal report

The operator reviews the report + candidate file and then manually
patches data/copilot-models.json. That is the human-gated merge step
described in design principle #3.

Usage:
    python3 -m tools.enrich.normalize                # report for all
    python3 -m tools.enrich.normalize --model gpt-5-4  # one model
    python3 -m tools.enrich.normalize --all-matches  # show every candidate
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Optional

from . import cache

DATA_FILE = cache.REPO_ROOT / "data" / "copilot-models.json"
CANDIDATE_FILE = cache.CACHE_ROOT / "merged-candidate.json"

# Field → ordered list of preferred sources. First match with a non-null
# value wins. This is the field-level precedence table.
#
# For provider-specific fields (contextWindow on a Claude model) we want
# the provider's own API. OpenRouter is a fallback aggregator.
PRECEDENCE: dict[str, list[str]] = {
    # First-party provider APIs authoritative when the model belongs to
    # that provider; otherwise aggregator fills in.
    "displayName": ["anthropic-api", "google-genai-api", "openrouter-api"],
    "description": ["google-genai-api", "openrouter-api"],  # Anthropic has none
    # Provider name: docs.github.com is the authority for Copilot-specific
    # cases (e.g. "Fine-tuned GPT-5 mini" for raptor-mini).
    "provider": ["github-docs-supported-models", "openrouter-api"],
    "version": ["google-genai-api"],
    "contextWindow": ["anthropic-api", "google-genai-api", "openrouter-api"],
    "maxOutputTokens": ["anthropic-api", "google-genai-api", "openrouter-api"],
    "releasedAt": ["anthropic-api", "openrouter-api", "google-genai-api"],
    "deprecatedAt": ["github-docs-supported-models", "anthropic-api", "openrouter-api"],
    # docs.github.com-only overlay fields (Copilot-specific)
    "status": ["github-docs-supported-models"],
    "planAvailability": ["github-docs-supported-models"],
    "ideAvailability": ["github-docs-supported-models"],
    "modeAvailability": ["github-docs-supported-models"],
    "pricingMultiplier": ["github-docs-supported-models"],
    "suggestedAlternative": ["github-docs-supported-models"],
    # docs.github.com model-comparison page (task-fit + authoritative blurb)
    "taskArea": ["github-docs-model-comparison"],
    "excelsAt": ["github-docs-model-comparison"],
    "modelCardUrl": ["github-docs-model-comparison"],
    "taskFit": ["github-docs-model-comparison"],
    "pricing": ["anthropic-api", "openrouter-api"],  # OpenAI via OR
    "knowledgeCutoff": ["openrouter-api"],  # only OR currently has this
    "inputModalities": ["openrouter-api"],
    "outputModalities": ["openrouter-api"],
    "tokenizer": ["openrouter-api"],
    "supportedParameters": ["openrouter-api"],
    "huggingFaceId": ["openrouter-api"],
    # Anthropic-only
    "thinkingTypes": ["anthropic-api"],
    "effortLevels": ["anthropic-api"],
    "contextManagement": ["anthropic-api"],
    "imageInput": ["anthropic-api"],
    "pdfInput": ["anthropic-api"],
    "structuredOutputs": ["anthropic-api"],
    "citations": ["anthropic-api"],
    "codeExecution": ["anthropic-api"],
    "batchApi": ["anthropic-api"],
    # Google-only
    "thinkingEnabled": ["google-genai-api"],
    "supportedMethods": ["google-genai-api"],
    "defaultTemperature": ["google-genai-api"],
    "maxTemperature": ["google-genai-api"],
}


def canonicalize_id(raw: str) -> str:
    """Produce a matching key that bridges CPT / provider / OpenRouter.

    Examples:
        'gpt-5-4'                          → 'gpt-5-4'
        'openai/gpt-5.4'                   → 'gpt-5-4'
        'openai/gpt-5.4-pro'               → 'gpt-5-4-pro'
        'claude-sonnet-4-5-20250929'       → 'claude-sonnet-4-5'
        'claude-sonnet-4-6'                → 'claude-sonnet-4-6'
        'gemini-2.5-pro'                   → 'gemini-2-5-pro'
        'gemini-3.1-pro-preview'           → 'gemini-3-1-pro'
        'gemini-3-flash'                   → 'gemini-3-flash'
    """
    s = raw.lower().strip()

    # Strip 'provider/' prefix (OpenRouter)
    if "/" in s:
        s = s.split("/", 1)[1]

    # Strip 'models/' prefix (Gemini native)
    if s.startswith("models/"):
        s = s[len("models/"):]

    # Dots → dashes (Gemini 2.5 → 2-5; GPT-5.4 → 5-4)
    s = s.replace(".", "-")

    # Strip trailing 8-digit date (-20250929)
    s = re.sub(r"-\d{8}$", "", s)

    # Strip -preview / -exp / -latest variants that don't change identity
    s = re.sub(r"-(preview|exp|experimental|latest)(-.*)?$", "", s)

    # Strip trailing `-0` minor-version (Claude Sonnet 4.0 → claude-sonnet-4,
    # matching the unversioned Anthropic API id). Semver convention: .0 and
    # no suffix refer to the same release.
    s = re.sub(r"-0$", "", s)

    return s


def load_parsed_sources() -> dict[str, list[dict]]:
    """Return {source_id: [records…]} for every parsed/*.json on disk."""
    out: dict[str, list[dict]] = {}
    if not cache.PARSED_ROOT.exists():
        return out
    for path in sorted(cache.PARSED_ROOT.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        out[payload["source"]] = payload.get("records", [])
    return out


def index_by_canonical(records: list[dict]) -> dict[str, dict]:
    """Build {canonicalized_id → record} for one source's records.

    If two records collapse to the same canonical id (e.g. dated and
    undated Claude variants), the first wins — providers list newest
    first, so the undated alias is usually correct.
    """
    index: dict[str, dict] = {}
    for r in records:
        cid = canonicalize_id(r.get("id", ""))
        if cid and cid not in index:
            index[cid] = r
    return index


def find_matches(target_id: str, indices: dict[str, dict[str, dict]]) -> dict[str, dict]:
    """Return {source_id: record} of every source that has this model."""
    cid = canonicalize_id(target_id)
    matches: dict[str, dict] = {}
    for source_id, idx in indices.items():
        if cid in idx:
            matches[source_id] = idx[cid]
    return matches


def pick_value(
    field: str,
    matches: dict[str, dict],
) -> tuple[Any, Optional[str], Optional[str]]:
    """Pick the authoritative value for one field across matched sources.

    Returns (value, source_id, source_url). The first source listed in
    PRECEDENCE[field] that has a non-null value wins. Sources not in the
    precedence list for a field are ignored.
    """
    order = PRECEDENCE.get(field, [])
    for source_id in order:
        rec = matches.get(source_id)
        if not rec or field not in rec:
            continue
        envelope = rec[field]
        if not isinstance(envelope, dict) or "value" not in envelope:
            continue
        if envelope["value"] is None:
            continue
        return (
            envelope["value"],
            source_id,
            envelope.get("sourceUrl"),
        )
    return (None, None, None)


def merge_model(target_id: str, matches: dict[str, dict]) -> dict:
    """Produce a merged record with per-field source attribution."""
    merged: dict[str, Any] = {"id": target_id, "fields": {}}
    seen_fields: set[str] = set()
    for rec in matches.values():
        for k in rec:
            if k != "id":
                seen_fields.add(k)

    for field in sorted(seen_fields):
        value, source, url = pick_value(field, matches)
        merged["fields"][field] = {
            "value": value,
            "source": source,
            "sourceUrl": url,
        }
    merged["matchedSources"] = sorted(matches.keys())
    return merged


def load_target_catalog() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text(encoding="utf-8")).get("models", [])


# ── Reporting ─────────────────────────────────────────────────────────────


def _try_rich():
    try:
        from rich.console import Console
        from rich.table import Table
        return Console, Table
    except ImportError:
        return None, None


def report_target_coverage(
    target_models: list[dict],
    indices: dict[str, dict[str, dict]],
) -> None:
    """Print a coverage table: which target models matched which sources."""
    Console, Table = _try_rich()
    rows = []
    for tm in target_models:
        matches = find_matches(tm["id"], indices)
        rows.append(
            (
                tm["id"],
                tm.get("provider", "?"),
                ", ".join(sorted(matches.keys())) or "— no match —",
            )
        )

    if Console is None:
        print(f"{'MODEL':28}  {'PROVIDER':12}  MATCHED SOURCES")
        for r in rows:
            print(f"  {r[0]:28}  {r[1]:12}  {r[2]}")
        return

    console = Console()
    table = Table(title=f"Target catalog coverage ({len(rows)} models)")
    table.add_column("Model", style="cyan")
    table.add_column("Provider", style="magenta")
    table.add_column("Matched sources", style="green")
    for r in rows:
        table.add_row(*r)
    console.print(table)


def report_model_fields(
    target_id: str,
    matches: dict[str, dict],
    current: Optional[dict],
) -> None:
    """Print a per-field table showing the merged pick vs current catalog."""
    Console, Table = _try_rich()
    if Console is None:
        print(f"\n=== {target_id} ===")
        if not matches:
            print("  no matches")
            return
        merged = merge_model(target_id, matches)
        for field, info in merged["fields"].items():
            cur = (current or {}).get(field, "—")
            print(f"  {field:22}  current={cur!s:30}  picked={info['value']!s:40}  [{info['source']}]")
        return

    console = Console()
    if not matches:
        console.print(f"[yellow]{target_id}[/yellow]: no matches in any source")
        return

    merged = merge_model(target_id, matches)
    table = Table(
        title=f"{target_id}  [sources: {', '.join(merged['matchedSources'])}]",
        show_lines=False,
    )
    table.add_column("Field", style="cyan")
    table.add_column("Current catalog", style="yellow")
    table.add_column("Picked value", style="green")
    table.add_column("From", style="magenta")
    for field, info in merged["fields"].items():
        cur = (current or {}).get(field)
        cur_str = "—" if cur is None else str(cur)
        picked = info["value"]
        picked_str = "—" if picked is None else str(picked)
        if len(picked_str) > 80:
            picked_str = picked_str[:77] + "…"
        if len(cur_str) > 40:
            cur_str = cur_str[:37] + "…"
        table.add_row(field, cur_str, picked_str, info["source"] or "—")
    console.print(table)


def build_candidate(
    target_models: list[dict],
    indices: dict[str, dict[str, dict]],
) -> list[dict]:
    out = []
    for tm in target_models:
        matches = find_matches(tm["id"], indices)
        if not matches:
            continue
        out.append(merge_model(tm["id"], matches))
    return out


def merge_all() -> Path:
    """Build the candidate file and return its path. No stdout side effects."""
    parsed = load_parsed_sources()
    if not parsed:
        raise RuntimeError(
            "No parsed sources on disk. Run `python3 -m tools.enrich.harvest "
            "--all` first."
        )
    indices = {sid: index_by_canonical(recs) for sid, recs in parsed.items()}
    target = load_target_catalog()
    candidate = build_candidate(target, indices)

    CANDIDATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CANDIDATE_FILE.write_text(
        json.dumps(
            {
                "generatedAt": cache._today(),
                "precedence": PRECEDENCE,
                "models": candidate,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return CANDIDATE_FILE


def parsed_sources() -> list[Path]:
    """Return all parsed adapter outputs currently on disk (legacy API)."""
    if not cache.PARSED_ROOT.exists():
        return []
    return sorted(cache.PARSED_ROOT.glob("*.json"))


# ── CLI ───────────────────────────────────────────────────────────────────


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tools.enrich.normalize",
        description="Merge parsed adapter outputs into a candidate catalog.",
    )
    parser.add_argument("--model", help="Report a single model by id.")
    parser.add_argument(
        "--all-matches",
        action="store_true",
        help="Print per-field tables for every target model, not just coverage.",
    )
    args = parser.parse_args(argv)

    cache.load_dotenv_if_present()
    parsed = load_parsed_sources()
    if not parsed:
        print(
            "No parsed sources on disk. Run `python3 -m tools.enrich.harvest "
            "--all` first.",
            file=sys.stderr,
        )
        return 1

    indices = {sid: index_by_canonical(recs) for sid, recs in parsed.items()}
    target = load_target_catalog()
    if not target:
        print(f"Target catalog {DATA_FILE} is empty or missing.", file=sys.stderr)
        return 1

    if args.model:
        hits = [m for m in target if m["id"] == args.model]
        if not hits:
            print(f"Unknown model id: {args.model}", file=sys.stderr)
            print("Available:", ", ".join(m["id"] for m in target), file=sys.stderr)
            return 1
        current = hits[0]
        matches = find_matches(args.model, indices)
        report_model_fields(args.model, matches, current)
    else:
        report_target_coverage(target, indices)
        if args.all_matches:
            for tm in target:
                matches = find_matches(tm["id"], indices)
                report_model_fields(tm["id"], matches, tm)

    path = merge_all()
    print(f"\nCandidate written → {path.relative_to(cache.REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
