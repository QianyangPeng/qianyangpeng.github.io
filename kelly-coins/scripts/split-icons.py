#!/usr/bin/env python3
"""Split watercolor icon grids into individual transparent PNGs.

Each grid is a 4x4 layout of 16 icons on cream paper background. For each
cell we:
  1. Crop the cell (256x256 from a 1024x1024 grid)
  2. Use rembg to remove the cream paper → transparent PNG
  3. Trim the transparent border → bounding box of the actual icon
  4. Add a small transparent padding so the icon has breathing room
  5. Save as <out_dir>/<label>.png
"""

import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from rembg import remove, new_session

# ---- Labels for each grid (position index → filename) ----
# Order must match the prompt in scripts/gen-icon-grids.sh exactly.

TASK_LABELS = [
    "bath",        "brush-teeth", "get-dressed",  "wash-hands",
    "veggies",     "fruit",       "water",        "read-book",
    "tidy-toys",   "share",       "sweep",        "water-plant",
    "pet-feed",    "thank-you",   "bedtime",      "draw",
]

REWARD_LABELS = [
    "chocolate",   "ice-cream",   "lollipop",     "cookie",
    "pudding",     "fruit-basket","books",        "stickers",
    "crayons",     "teddy",       "movie",        "park",
    "swimming",    "picnic",      "playground",   "zoo",
]

SHOP_LABELS = [
    "magic-wand",  "wings",       "flower-crown", "gold-star",
    "rainbow-bow", "tiara",       "sparkles",     "heart-clip",
    "bouquet",     "music-note",  "balloon",      "teddy-bear",
    "bunny",       "rainbow",     "unicorn-horn", "palette",
]

GRIDS = [
    ("tasks",   "tasks-grid.png",   TASK_LABELS,   "client/child/assets/icons/tasks"),
    ("rewards", "rewards-grid.png", REWARD_LABELS, "client/child/assets/icons/rewards"),
    ("shop",    "virtual-grid.png", SHOP_LABELS,   "client/child/assets/icons/shop"),
]


def trim_transparent(img: Image.Image, pad: int = 16) -> Image.Image:
    """Crop the image to the bounding box of its non-transparent pixels,
    add `pad` pixels of transparent breathing room on each side."""
    bbox = img.getbbox()
    if bbox is None:
        return img
    cropped = img.crop(bbox)
    w, h = cropped.size
    out = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    out.paste(cropped, (pad, pad))
    return out


def split_grid(grid_path: Path, labels: list, out_dir: Path, rembg_session):
    grid = Image.open(grid_path).convert("RGBA")
    grid_w, grid_h = grid.size
    rows, cols = 4, 4
    cell_w = grid_w // cols
    cell_h = grid_h // rows

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Splitting {grid_path.name} ({grid_w}x{grid_h}) → {cell_w}x{cell_h} per cell")

    for i, label in enumerate(labels):
        row = i // cols
        col = i % cols
        box = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
        cell = grid.crop(box)

        buf = BytesIO()
        cell.save(buf, format="PNG")
        transparent = Image.open(BytesIO(remove(buf.getvalue(), session=rembg_session))).convert("RGBA")

        trimmed = trim_transparent(transparent, pad=16)
        out_path = out_dir / f"{label}.png"
        trimmed.save(out_path, "PNG")
        print(f"  [{i:02d}] {label:14s} → {trimmed.size[0]:3d}x{trimmed.size[1]:3d}  {out_path}")


def main():
    project_root = Path(__file__).resolve().parent.parent
    gen_out = project_root / "scripts" / "gen-output"

    # The default `u2net` model is slower but handles soft watercolor edges better
    # than `isnet-general-use`. rembg caches the model on first run.
    session = new_session("isnet-general-use")

    for grid_name, grid_file, labels, out_rel in GRIDS:
        grid_path = gen_out / grid_file
        if not grid_path.exists():
            print(f"WARNING: {grid_path} not found, skipping")
            continue
        out_dir = project_root / out_rel
        split_grid(grid_path, labels, out_dir, session)
        print()

    print("Done.")


if __name__ == "__main__":
    main()
