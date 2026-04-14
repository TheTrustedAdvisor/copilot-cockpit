#!/usr/bin/env bash
# =============================================================
# Record Demo — Copilot Cockpit Terminal Recording Pipeline
# =============================================================
# Usage:
#   ./tools/record-demo.sh agent-mode       # Record single demo
#   ./tools/record-demo.sh --all            # Record all demos
#
# Requirements:
#   - asciinema (pip install asciinema)
#   - agg (https://github.com/asciinema/agg/releases)
#
# Pipeline: script.sh → asciinema → .cast → agg → .gif
# =============================================================

set -euo pipefail

SCRIPTS_DIR="media/scripts"
CASTS_DIR="media/casts"
RECORDINGS_DIR="media/recordings"

# agg settings
AGG_THEME="monokai"
AGG_FONT_SIZE="16"
AGG_SPEED="1.5"
AGG_COLS="100"
AGG_ROWS="30"

# Find tools
ASCIINEMA="${ASCIINEMA:-asciinema}"
AGG="${AGG:-agg}"

check_deps() {
    if ! command -v "$ASCIINEMA" &>/dev/null; then
        echo "ERROR: asciinema not found. Install: pip install asciinema"
        exit 1
    fi
    if ! command -v "$AGG" &>/dev/null; then
        echo "ERROR: agg not found. Download from: https://github.com/asciinema/agg/releases"
        exit 1
    fi
}

record_demo() {
    local name="$1"
    local script="${SCRIPTS_DIR}/${name}-demo.sh"
    local cast="${CASTS_DIR}/${name}.cast"
    local gif="${RECORDINGS_DIR}/${name}.gif"

    if [[ ! -f "$script" ]]; then
        echo "ERROR: Script not found: $script"
        return 1
    fi

    echo "── Recording: ${name} ──"

    # Step 1: Record with asciinema
    echo "  [1/3] Recording .cast..."
    "$ASCIINEMA" rec \
        --command "$script" \
        --cols "$AGG_COLS" \
        --rows "$AGG_ROWS" \
        --overwrite \
        "$cast"

    # Step 2: Convert to GIF with agg
    echo "  [2/3] Converting to .gif..."
    "$AGG" \
        --theme "$AGG_THEME" \
        --font-size "$AGG_FONT_SIZE" \
        --speed "$AGG_SPEED" \
        "$cast" "$gif"

    # Step 3: Report size
    local size
    size=$(du -h "$gif" | cut -f1)
    echo "  [3/3] Done: ${gif} (${size})"

    # Warn if too large
    local bytes
    bytes=$(stat -c%s "$gif" 2>/dev/null || stat -f%z "$gif" 2>/dev/null)
    if (( bytes > 2097152 )); then
        echo "  WARNING: GIF exceeds 2MB target. Consider optimizing with:"
        echo "    convert ${gif} -layers optimize -fuzz 5% ${gif}"
    fi
}

# --- Main ---
check_deps

if [[ "${1:-}" == "--all" ]]; then
    echo "Recording all demos..."
    for script in "${SCRIPTS_DIR}"/*-demo.sh; do
        name=$(basename "$script" -demo.sh)
        record_demo "$name"
        echo
    done
    echo "All recordings complete."
elif [[ -n "${1:-}" ]]; then
    record_demo "$1"
else
    echo "Usage: $0 <demo-name> | --all"
    echo
    echo "Available demos:"
    for script in "${SCRIPTS_DIR}"/*-demo.sh 2>/dev/null; do
        echo "  $(basename "$script" -demo.sh)"
    done
fi
