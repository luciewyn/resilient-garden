#!/usr/bin/env python3
"""Fill background whitespace in the ASCII garden map with U+2591 (░).

Reads ASCII2_garden_map.txt, pads every line to a fixed column width,
replaces runs of 2+ ordinary spaces with the same number of ░ characters
(single spaces between words are left untouched), and writes the result
to ASCII2_garden_map-filled.txt.

Text-holding box interiors (Garden Bed 01/02/03, Greenhouse, Harvest)
are excluded from the fill and restored to their original characters
afterward, so their padding stays plain space rather than shading right
up against the label text and box borders. These five regions were
hand-identified by inspecting the source's own '|'/'+' column
alignment (see PROTECTED_REGIONS below) -- they are specific to the
current layout of this artwork, not inferred generically, because a
generic "between any two |" rule would also catch the many decorative
uses of '|' elsewhere in the map (the soil-cluster well illustration,
the greenhouse fence, the cow and compost-creature figures).

Re-run this script whenever ASCII2_garden_map.txt is edited. If a box
structure moves, update PROTECTED_REGIONS to match its new position.
"""
from pathlib import Path
import re

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT_ROOT / "ASCII2_garden_map.txt"
OUTPUT = PROJECT_ROOT / "ASCII2_garden_map-filled.txt"

FILL_CHAR = "░"
RUN_PATTERN = re.compile(r" {2,}")

# Extra fully-shaded rows prepended to the generated output only -- the
# clean source file never gains these. They sit above the artwork as a
# shaded field the map's background continues into, matching the ░ used
# everywhere else, so they're plain FILL_CHAR runs with no protected
# regions of their own.
TOP_SHADE_ROWS = 3

# (first_line, last_line, first_col, last_col) -- all inclusive, 0-indexed,
# matching Python slicing when used as line[first_col:last_col + 1].
PROTECTED_REGIONS = [
    (90, 96, 65, 86),    # Garden Bed 01
    (106, 113, 85, 106),  # Garden Bed 02
    (118, 125, 143, 164),  # Garden Bed 03
    (60, 61, 59, 75),    # Greenhouse label
    (141, 148, 90, 119),  # Harvest label/body
]


def fill_line(line: str, width: int) -> str:
    padded = line + " " * max(0, width - len(line))
    return RUN_PATTERN.sub(lambda m: FILL_CHAR * len(m.group()), padded)


def restore_protected_regions(filled_lines: list[str], original_lines: list[str]) -> None:
    for first_line, last_line, first_col, last_col in PROTECTED_REGIONS:
        for i in range(first_line, last_line + 1):
            filled = filled_lines[i]
            original = original_lines[i]
            filled_lines[i] = (
                filled[:first_col] + original[first_col:last_col + 1] + filled[last_col + 1:]
            )


def main() -> None:
    raw = SOURCE.read_text(encoding="utf-8")

    if FILL_CHAR in raw:
        raise SystemExit(
            f"{SOURCE.name} already contains {FILL_CHAR!r} -- the reverse-transform "
            "verification this script relies on assumes a clean source. Aborting."
        )

    # Operate on real content lines only, not a phantom blank line after a
    # trailing newline.
    if raw.endswith("\n"):
        raw = raw[:-1]
    original_lines = raw.split("\n")

    width = max(len(line) for line in original_lines)
    # Pad every original line to `width` too, so protected-region restoration
    # (which reads from original_lines) has real characters at every column.
    padded_originals = [line + " " * max(0, width - len(line)) for line in original_lines]

    filled_lines = [fill_line(line, width) for line in original_lines]
    restore_protected_regions(filled_lines, padded_originals)

    # Prepended after protected-region restoration so PROTECTED_REGIONS'
    # line indices (0-indexed against original_lines) stay correct --
    # prepending first would shift every one of them by TOP_SHADE_ROWS.
    shade_row = FILL_CHAR * width
    filled_lines = [shade_row] * TOP_SHADE_ROWS + filled_lines

    OUTPUT.write_text("\n".join(filled_lines) + "\n", encoding="utf-8")

    print(f"{SOURCE.name}: {len(original_lines)} lines, width {width}")
    print(f"wrote {OUTPUT.name}: {len(filled_lines)} lines ({TOP_SHADE_ROWS} shade rows + {len(original_lines)} source lines)")


if __name__ == "__main__":
    main()
