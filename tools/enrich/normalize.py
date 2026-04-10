"""Merge parsed adapter outputs into a single enriched_models.json.

P0 (#23) ships this module as a stub. The merge logic lands later:
    - P1/P2: fill tools/cache/parsed/<source>.json per adapter
    - Post-P2 issue: implement merge_all() that joins by model id,
      resolves conflicts (primary source wins, secondary triggers
      confidence decay), and writes tools/cache/enriched_models.json.
"""

from __future__ import annotations

from pathlib import Path

from . import cache


def merge_all() -> Path:
    """Placeholder — implemented once P1+P2 adapters exist.

    Raises NotImplementedError so that anyone wiring the diff UI early
    gets a loud signal instead of a silently empty merge.
    """
    raise NotImplementedError(
        "normalize.merge_all() is a post-P2 deliverable. "
        "Run tools.enrich.harvest first; merge lands in a follow-up issue."
    )


def parsed_sources() -> list[Path]:
    """Return all parsed adapter outputs currently on disk."""
    if not cache.PARSED_ROOT.exists():
        return []
    return sorted(cache.PARSED_ROOT.glob("*.json"))
