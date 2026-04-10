"""Entry point for the model enrichment harvest.

Usage:
    python3 -m tools.enrich.harvest --list-sources
    python3 -m tools.enrich.harvest --source github-docs-supported-models
    python3 -m tools.enrich.harvest --all
    python3 -m tools.enrich.harvest --source openai-models --refresh

P0 (#23) ships this module with a working CLI but no adapters yet.
Running --source on an entry whose adapter does not yet exist prints a
clear "adapter not implemented" notice and exits non-zero — that's the
signal for P1/P2 to land their adapter files.
"""

from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path
from typing import Optional

import yaml

from . import cache

SOURCES_YML = Path(__file__).parent / "sources.yml"


def load_sources() -> dict:
    with SOURCES_YML.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict) or "sources" not in data:
        raise RuntimeError(f"{SOURCES_YML} is missing a top-level 'sources' key")
    return data["sources"]


def list_sources(sources: dict) -> None:
    # Keep output grep-friendly — no rich tables here, this is smoke-test output.
    print(f"{'SOURCE':38}  {'PHASE':5}  {'ADAPTER':30}  URL")
    for source_id, meta in sources.items():
        print(
            f"{source_id:38}  {meta.get('phase', '-'):5}  "
            f"{meta.get('adapter', '-'):30}  {meta.get('url', '')}"
        )


def load_adapter(adapter_name: str):
    """Import adapters.<name>, or return None if it doesn't exist yet."""
    try:
        return importlib.import_module(f"tools.enrich.adapters.{adapter_name}")
    except ModuleNotFoundError:
        return None


def harvest_one(source_id: str, meta: dict, refresh: bool) -> int:
    adapter_name = meta.get("adapter")
    if not adapter_name:
        print(f"[skip] {source_id}: no adapter declared in sources.yml", file=sys.stderr)
        return 2

    adapter = load_adapter(adapter_name)
    if adapter is None:
        print(
            f"[pending] {source_id}: adapter '{adapter_name}' not implemented yet "
            f"(phase {meta.get('phase', '?')})",
            file=sys.stderr,
        )
        return 2

    url = meta["url"]
    slug = meta.get("slug", source_id)
    html = cache.get_or_fetch(source_id, slug, url, refresh=refresh)

    records = adapter.parse(html)
    path = cache.write_parsed(source_id, records)
    print(f"[ok] {source_id}: {len(records)} records → {path.relative_to(cache.REPO_ROOT)}")
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tools.enrich.harvest",
        description="Harvest model metadata from upstream sources into tools/cache/parsed/.",
    )
    grp = parser.add_mutually_exclusive_group()
    grp.add_argument("--list-sources", action="store_true", help="List registered sources and exit.")
    grp.add_argument("--source", help="Run a single source by id (see --list-sources).")
    grp.add_argument("--all", action="store_true", help="Run all registered sources.")
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Bypass today's cache and re-fetch upstream.",
    )

    args = parser.parse_args(argv)
    sources = load_sources()

    if args.list_sources or (not args.source and not args.all):
        list_sources(sources)
        return 0

    if args.source:
        if args.source not in sources:
            print(f"unknown source: {args.source}", file=sys.stderr)
            print("use --list-sources to see registered ids", file=sys.stderr)
            return 1
        return harvest_one(args.source, sources[args.source], refresh=args.refresh)

    # --all: iterate every source, keep going on adapter-not-implemented (rc=2),
    # but fail hard on unexpected errors.
    exit_code = 0
    for source_id, meta in sources.items():
        rc = harvest_one(source_id, meta, refresh=args.refresh)
        if rc not in (0, 2):
            exit_code = rc
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
