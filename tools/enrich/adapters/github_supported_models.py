"""docs.github.com — Supported AI models adapter.

Source: https://docs.github.com/en/copilot/reference/ai-models/supported-models

The page serves five HTML tables that together define every
Copilot-specific overlay field the provider APIs don't know about:

    table 0  Supported AI models in Copilot
             cols: Model, Provider, Release status, Agent, Ask, Edit
             → status, modeAvailability

    table 1  Model retirement history
             cols: Model, Retirement date, Suggested alternative
             → deprecatedAt, suggestedAlternative

    table 2  Supported AI models per client
             cols: Model, GitHub.com, Copilot CLI, VS Code, Visual Studio,
                   Eclipse, Xcode, JetBrains IDEs
             → ideAvailability

    table 3  Supported AI models per Copilot plan
             cols: Model, Free, Student, Pro, Pro+, Business, Enterprise
             → planAvailability

    table 4  Model multipliers
             cols: Model, Paid-plan multiplier, Free-plan multiplier
             → pricingMultiplier

The display names in the table ("GPT-4.1", "Claude Opus 4.6 (fast mode)
(preview)") are slugified back to CPT ids ("gpt-4-1", "claude-opus-4-
6-fast") via a small dedicated function — this is the binding between
docs.github.com and our internal schema.
"""

from __future__ import annotations

import datetime as _dt
import re
from typing import Any, Optional

SOURCE_ID = "github-docs-supported-models"
SOURCE_LABEL = "github-docs-supported-models"
PAGE_URL = (
    "https://docs.github.com/en/copilot/reference/"
    "ai-models/supported-models"
)


def _today() -> str:
    return _dt.date.today().isoformat()


def _field(value: Any, fragment: str = "") -> dict:
    url = f"{PAGE_URL}#{fragment}" if fragment else PAGE_URL
    return {
        "value": value,
        "source": SOURCE_LABEL,
        "sourceUrl": url,
        "verifiedAt": _today(),
        "confidence": 95,
    }


def slugify_display_name(name: str) -> str:
    """Map a docs.github.com display name back to a CPT model id.

    Handles the special "(fast mode)" suffix (→ "-fast") and drops any
    other parenthetical qualifiers ("(preview)").
    """
    s = name.lower().strip()
    # Special: "(fast mode)" becomes part of the id as "-fast"
    if "(fast mode)" in s:
        s = s.replace("(fast mode)", "fast")
    # Drop all remaining parentheses groups (e.g. "(preview)")
    s = re.sub(r"\s*\([^)]*\)\s*", " ", s)
    # Dots / spaces → dashes
    s = s.replace(".", "-").replace(" ", "-")
    # Collapse runs of dashes
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def _cell_is_included(cell) -> bool:
    """Return True if a table cell contains an 'Included' check SVG.

    docs.github.com uses two aria-labels in every availability matrix:
        <svg aria-label="Included">      — truthy (octicon-check)
        <svg aria-label="Not included">  — falsy  (octicon-x)

    Substring matching 'included' would catch BOTH, so we use an exact
    aria-label match and fall back to the octicon class name.
    """
    svg = cell.find("svg")
    if svg is None:
        return False
    label = (svg.get("aria-label") or "").strip().lower()
    if label == "included":
        return True
    if label == "not included":
        return False
    # Fallback: octicon class name distinguishes check vs. x.
    classes = " ".join(svg.get("class") or [])
    if "octicon-check" in classes:
        return True
    return False


def _row_cells(row):
    """Return (header_th, [data_cells]) for a normal-looking row."""
    cells = row.find_all(["th", "td"])
    if not cells:
        return None, []
    return cells[0], cells[1:]


def _parse_status_table(table) -> dict[str, dict]:
    """table 0 → {slug: {status, modeAvailability}}"""
    out: dict[str, dict] = {}
    body = table.find("tbody") or table
    for row in body.find_all("tr"):
        head, cells = _row_cells(row)
        if head is None or len(cells) < 5:
            continue
        name = head.get_text(" ", strip=True)
        slug = slugify_display_name(name)
        provider_cell = cells[0].get_text(" ", strip=True)
        status_cell = cells[1].get_text(" ", strip=True).lower() or None
        mode_flags = {
            "agent": _cell_is_included(cells[2]),
            "ask": _cell_is_included(cells[3]),
            "edit": _cell_is_included(cells[4]),
        }
        out[slug] = {
            "displayNameRaw": name,
            "provider": provider_cell,
            "status": status_cell,
            "modeAvailability": mode_flags,
        }
    return out


def _parse_retirement_table(table) -> dict[str, dict]:
    """table 1 → {slug: {deprecatedAt, suggestedAlternative}}"""
    out: dict[str, dict] = {}
    body = table.find("tbody") or table
    for row in body.find_all("tr"):
        head, cells = _row_cells(row)
        if head is None or len(cells) < 2:
            continue
        name = head.get_text(" ", strip=True)
        slug = slugify_display_name(name)
        date = cells[0].get_text(" ", strip=True) or None
        alt = cells[1].get_text(" ", strip=True) or None
        out[slug] = {
            "deprecatedAt": date,
            "suggestedAlternative": alt,
        }
    return out


def _parse_matrix_table(
    table,
    column_key_map: dict[int, str],
) -> dict[str, dict[str, bool]]:
    """Parse an availability matrix (IDE or plan) into {slug: {key: bool}}.

    `column_key_map` maps data-cell index (0-based AFTER the row header)
    to the canonical key we want to store.
    """
    out: dict[str, dict[str, bool]] = {}
    body = table.find("tbody") or table
    for row in body.find_all("tr"):
        head, cells = _row_cells(row)
        if head is None:
            continue
        name = head.get_text(" ", strip=True)
        slug = slugify_display_name(name)
        flags: dict[str, bool] = {}
        for idx, key in column_key_map.items():
            if idx >= len(cells):
                flags[key] = False
                continue
            flags[key] = _cell_is_included(cells[idx])
        out[slug] = flags
    return out


def _parse_multiplier_table(table) -> dict[str, dict]:
    """table 4 → {slug: {pricingMultiplier: {paid, free}}}"""
    out: dict[str, dict] = {}
    body = table.find("tbody") or table
    for row in body.find_all("tr"):
        head, cells = _row_cells(row)
        if head is None or len(cells) < 2:
            continue
        name = head.get_text(" ", strip=True)
        slug = slugify_display_name(name)

        def _num(text: str) -> Optional[float]:
            text = text.strip()
            if not text or text.lower() in ("—", "-", "n/a"):
                return None
            try:
                return float(text)
            except ValueError:
                return None

        paid = _num(cells[0].get_text(" ", strip=True))
        free = _num(cells[1].get_text(" ", strip=True))
        out[slug] = {
            "pricingMultiplier": {"paid": paid, "free": free},
        }
    return out


# Column indices for the per-client and per-plan matrices. These are
# after the first <th> (the model name).
IDE_COLS = {
    0: "github-com",
    1: "copilot-cli",
    2: "vscode",
    3: "visual-studio",
    4: "eclipse",
    5: "xcode",
    6: "jetbrains",
}
PLAN_COLS = {
    0: "free",
    1: "student",
    2: "pro",
    3: "pro-plus",
    4: "business",
    5: "enterprise",
}


def parse_all(html: str) -> dict[str, dict]:
    """Parse every table on the page and return {slug: merged_record}.

    Merged record is a plain dict (per-field envelopes added later).
    """
    from bs4 import BeautifulSoup  # lazy import

    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    if len(tables) < 5:
        raise RuntimeError(
            f"{SOURCE_ID}: expected 5 tables on supported-models page, "
            f"got {len(tables)}. Page structure may have changed."
        )

    status = _parse_status_table(tables[0])
    retirement = _parse_retirement_table(tables[1])
    ide = _parse_matrix_table(tables[2], IDE_COLS)
    plan = _parse_matrix_table(tables[3], PLAN_COLS)
    multiplier = _parse_multiplier_table(tables[4])

    # Union all slugs seen; status table is the canonical set but
    # retirement rows may include older models we still want to capture.
    all_slugs = set(status) | set(retirement) | set(ide) | set(plan) | set(multiplier)
    merged: dict[str, dict] = {}
    for slug in all_slugs:
        rec: dict[str, Any] = {}
        if slug in status:
            rec.update(status[slug])
        if slug in retirement:
            rec.update(retirement[slug])
        if slug in ide:
            rec["ideAvailability"] = ide[slug]
        if slug in plan:
            rec["planAvailability"] = plan[slug]
        if slug in multiplier:
            rec.update(multiplier[slug])
        merged[slug] = rec
    return merged


def _wrap(raw: dict) -> dict:
    """Wrap a raw parsed record's fields in the per-field envelope."""
    out: dict[str, Any] = {"id": None}  # caller will set id
    for key, value in raw.items():
        if key in ("displayNameRaw",):
            continue
        out[key] = _field(value)
    return out


def harvest(cache, refresh: bool = False) -> list[dict]:
    html = cache.get_or_fetch(
        SOURCE_ID,
        "supported-models",
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
