"""docs.github.com — Model comparison adapter.

Source: https://docs.github.com/en/copilot/reference/ai-models/model-comparison

The page has 5 tables:

    table 0  Recommended models by task — the master
             cols: Model, Task area, Excels at (primary use case),
                   Further reading
             → taskArea, excelsAt, modelCardUrl

    tables 1-4  "Why it's a good fit" per task category
                cols: Model, Why it's a good fit
                Each table is preceded by an h2 "Task: <category>" heading.
                → taskFit[slug] = {category, whyItsAGoodFit}

Each model gets:

    {
      "id": "<slug>",
      "taskArea": "Deep reasoning and debugging",
      "excelsAt": "Complex problem-solving challenges, ...",
      "modelCardUrl": "https://docs.github.com/...",
      "taskFit": {
          "general-purpose": "Reliable default for most coding ...",
          "deep-reasoning": "Delivers deep reasoning ..."
      }
    }

`taskArea` is the ONE primary category the docs assign to the model,
while `taskFit` can carry recommendations from multiple task sections
(a model like GPT-5 mini is listed under both general-purpose AND
deep-reasoning "Why it's a good fit" tables).
"""

from __future__ import annotations

import datetime as _dt
import re
from typing import Any

from .github_supported_models import slugify_display_name

SOURCE_ID = "github-docs-model-comparison"
SOURCE_LABEL = "github-docs-model-comparison"
PAGE_URL = (
    "https://docs.github.com/en/copilot/reference/"
    "ai-models/model-comparison"
)


def _today() -> str:
    return _dt.date.today().isoformat()


def _field(value: Any) -> dict:
    return {
        "value": value,
        "source": SOURCE_LABEL,
        "sourceUrl": PAGE_URL,
        "verifiedAt": _today(),
        "confidence": 95,
    }


# Map the h2 heading text to a short slug we'll use as a dict key.
# Lowercase match on the heading (minus the "Task: " prefix).
_TASK_SLUGS: list[tuple[str, str]] = [
    ("general-purpose coding and writing", "general-purpose"),
    ("fast help with simple or repetitive tasks", "fast-help"),
    ("deep reasoning and debugging", "deep-reasoning"),
    ("working with visuals", "visuals"),
    ("agentic software development", "agentic"),
    ("general-purpose coding and agent tasks", "general-purpose-agent"),
]


def _task_slug(heading_text: str) -> str | None:
    """Map an h2 or category string to a canonical slug."""
    t = heading_text.lower().strip()
    if t.startswith("task:"):
        t = t[len("task:"):].strip()
    for needle, slug in _TASK_SLUGS:
        if needle in t:
            return slug
    return None


def _parse_master_table(table) -> dict[str, dict]:
    """Table 0 → {slug: {taskArea, excelsAt, modelCardUrl}}.

    Column order: Model | Task area | Excels at | Further reading.
    """
    out: dict[str, dict] = {}
    body = table.find("tbody") or table
    for row in body.find_all("tr"):
        cells = row.find_all(["th", "td"])
        if len(cells) < 3:
            continue
        name = cells[0].get_text(" ", strip=True)
        if not name:
            continue
        slug = slugify_display_name(name)
        task_area = cells[1].get_text(" ", strip=True) or None
        excels_at = cells[2].get_text(" ", strip=True) or None

        # Further reading column: try to get the link target if it's a
        # real model-card link; otherwise capture the text ("Coming soon",
        # "Not available", etc.)
        model_card_url = None
        if len(cells) >= 4:
            link = cells[3].find("a", href=True)
            if link:
                href = link["href"]
                if href.startswith("/"):
                    href = "https://docs.github.com" + href
                model_card_url = href

        out[slug] = {
            "taskArea": task_area,
            "excelsAt": excels_at,
            "modelCardUrl": model_card_url,
        }
    return out


def _parse_fit_tables(soup) -> dict[str, dict[str, str]]:
    """Walk h2 'Task: ...' sections and capture per-model fit prose.

    Returns {slug: {taskSlug: whyProse, ...}} — a single model can
    appear under multiple task categories.
    """
    result: dict[str, dict[str, str]] = {}
    for h2 in soup.find_all("h2"):
        heading = h2.get_text(" ", strip=True)
        if not heading.lower().startswith("task:"):
            continue
        slug = _task_slug(heading)
        if not slug:
            continue
        # Find the NEXT table within this section (before the next h2).
        sib = h2.find_next_sibling()
        found_table = None
        while sib and sib.name != "h2":
            if sib.name == "table":
                found_table = sib
                break
            # Also check nested tables inside wrapper divs.
            nested = getattr(sib, "find", lambda *_: None)("table")
            if nested is not None:
                found_table = nested
                break
            sib = sib.find_next_sibling()
        if not found_table:
            continue

        body = found_table.find("tbody") or found_table
        for row in body.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            name = cells[0].get_text(" ", strip=True)
            prose = cells[1].get_text(" ", strip=True)
            if not name or not prose:
                continue
            # Skip the header row of any simple table that lacks tbody.
            if name.lower() == "model":
                continue
            model_slug = slugify_display_name(name)
            result.setdefault(model_slug, {})[slug] = prose
    return result


def parse_all(html: str) -> dict[str, dict]:
    """Parse the whole page into {slug: merged_record}."""
    from bs4 import BeautifulSoup  # lazy import

    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    if not tables:
        raise RuntimeError(
            f"{SOURCE_ID}: no tables found on model-comparison page. "
            "Structure may have changed."
        )

    master = _parse_master_table(tables[0])
    fits = _parse_fit_tables(soup)

    all_slugs = set(master) | set(fits)
    merged: dict[str, dict] = {}
    for slug in all_slugs:
        rec: dict[str, Any] = {}
        if slug in master:
            rec.update({k: v for k, v in master[slug].items() if v is not None})
        if slug in fits:
            rec["taskFit"] = fits[slug]
        merged[slug] = rec
    return merged


def _wrap(raw: dict) -> dict:
    out: dict[str, Any] = {"id": None}
    for key, value in raw.items():
        out[key] = _field(value)
    return out


def harvest(cache, refresh: bool = False) -> list[dict]:
    html = cache.get_or_fetch(
        SOURCE_ID,
        "model-comparison",
        PAGE_URL,
        refresh=refresh,
        suffix=".html",
    )
    parsed = parse_all(html)
    records: list[dict] = []
    for slug, raw in sorted(parsed.items()):
        rec = _wrap(raw)
        rec["id"] = slug
        records.append(rec)
    return records
