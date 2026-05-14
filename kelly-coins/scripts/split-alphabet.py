#!/usr/bin/env python3
"""Split the watercolor word illustration grid into individual transparent PNGs.

The grid came out as 4 columns × 6 rows = 24 cells. The model put items in
roughly the order requested but with some drift. This script crops each cell,
removes the cream background via rembg, and saves with a known label.

Row-major mapping from the generated image (manually verified):
  row 0: angel,    butterfly, cake,    elephant
  row 1: fox,      giraffe,   heart,   jellyfish
  row 2: koala,    lion,      mushroom, owl
  row 3: pumpkin,  queen,     rainbow, turtle
  row 4: unicorn,  violin,    star,    turtle2     (turtle dup)
  row 5: zebra,    whale,     xylophone, yarn
"""

import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from rembg import remove, new_session


WORD_LABELS = [
    "angel",     "butterfly", "cake",      "elephant",
    "fox",       "giraffe",   "heart",     "jellyfish",
    "koala",     "lion",      "mushroom",  "owl",
    "pumpkin",   "queen",     "rainbow",   "turtle",
    "unicorn",   "violin",    "star",      "turtle2",
    "zebra",     "whale",     "xylophone", "yarn",
]


def trim_transparent(img: Image.Image, pad: int = 12) -> Image.Image:
    bbox = img.getbbox()
    if bbox is None:
        return img
    cropped = img.crop(bbox)
    w, h = cropped.size
    out = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    out.paste(cropped, (pad, pad))
    return out


def main():
    root = Path(__file__).resolve().parent.parent
    grid_path = root / "scripts" / "gen-output" / "alphabet-words-grid.png"
    out_dir = root / "client" / "child" / "assets" / "icons" / "alphabet"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not grid_path.exists():
        print(f"ERROR: {grid_path} not found")
        sys.exit(1)

    session = new_session("isnet-general-use")
    grid = Image.open(grid_path).convert("RGBA")
    gw, gh = grid.size
    cols, rows = 4, 6
    cw, ch = gw // cols, gh // rows
    print(f"Splitting {grid_path.name} ({gw}x{gh}) -> {cw}x{ch} per cell")

    for i, label in enumerate(WORD_LABELS):
        if label.endswith("2"):
            continue  # skip duplicates
        row = i // cols
        col = i % cols
        box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
        cell = grid.crop(box)

        buf = BytesIO()
        cell.save(buf, format="PNG")
        transparent = Image.open(
            BytesIO(remove(buf.getvalue(), session=session))
        ).convert("RGBA")
        trimmed = trim_transparent(transparent, pad=12)
        out_path = out_dir / f"{label}.png"
        trimmed.save(out_path, "PNG")
        print(f"  [{i:02d}] {label:12s} -> {trimmed.size[0]:3d}x{trimmed.size[1]:3d}  {out_path.name}")

    print(f"\nDone. Assets in {out_dir}")


if __name__ == "__main__":
    main()
