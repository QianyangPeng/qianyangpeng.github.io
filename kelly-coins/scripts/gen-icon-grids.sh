#!/bin/bash
# Generate watercolor icon library for Kelly Coins
# Strategy: 3 × 4x4 grids (48 icons total, ~$0.24)
# Each grid generates 16 icons in ONE image for guaranteed style consistency,
# then split-icons.py carves them into individual transparent PNGs.

OKEY="${OPENAI_API_KEY:-}"
ROOT="C:/Users/qypen/Documents/kelly-coins"
OUT="$ROOT/scripts/gen-output"
LOG="$ROOT/scripts/gen-icon-grids.log"
mkdir -p "$OUT"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

STYLE_BASE='Children storybook watercolor illustration style. Soft hand-painted brush strokes, warm cream paper background, muted pastel palette (peach, rose, butter-yellow, sage-mint, lavender), gentle watercolor bleeds at edges, no outlines or cel-shading, Beatrix-Potter-meets-Oliver-Jeffers dreamy aesthetic. Each icon is a single centered object with soft paper backdrop, consistent lighting from the top-left, no text labels.'

log "=== Icon Grid Generation Starting ==="

# ============================================================
# GRID 1: TASKS (16 daily-habit icons for a 4-year-old)
# ============================================================
TASK_PROMPT="A 4 by 4 grid of exactly 16 hand-painted watercolor icons for a children's chore-tracking app. Reading left-to-right, top-to-bottom:

Row 1: (1) a cute cartoon bathtub filled with bubbles, (2) a pink toothbrush with a dab of toothpaste, (3) a folded child's dress with a bow, (4) two small hands with soap bubbles washing.

Row 2: (5) a plate of colorful vegetables including broccoli and carrots, (6) a red apple with a green leaf and a yellow banana, (7) a clear glass of water with a striped straw, (8) an open storybook with tiny stars floating above.

Row 3: (9) a wooden toy box with a stuffed teddy peeking out, (10) two small hands offering a flower to each other (sharing), (11) a mini broom next to a dustpan, (12) a green watering can tilted with water droplets.

Row 4: (13) a small pet food bowl with kibble and a paw print, (14) a pink heart with a pair of sparkles (representing saying thank you), (15) a crescent moon and a fluffy pillow (bedtime), (16) a box of crayons next to a sheet of paper with a scribble.

$STYLE_BASE Each of the 16 cells is clearly separated by soft paper space, no borders or grid lines drawn. Each object is centered in its cell and takes up about 60 percent of the cell space. The whole image has a unified warm cream paper tone."

# ============================================================
# GRID 2: REWARDS (16 treat / activity / outing icons)
# ============================================================
REWARD_PROMPT="A 4 by 4 grid of exactly 16 hand-painted watercolor icons for a children's reward catalog. Reading left-to-right, top-to-bottom:

Row 1: (1) a chocolate bar with the wrapper half-peeled, (2) a scoop of pink ice cream in a waffle cone, (3) a round red lollipop on a white stick, (4) a single chocolate chip cookie.

Row 2: (5) a small pudding cup with whipped cream, (6) a basket of fresh fruit (strawberries apple pear), (7) a stack of two small storybooks, (8) a sheet of colorful star-shaped stickers.

Row 3: (9) a tin box of rainbow crayons, (10) a soft brown teddy bear, (11) a yellow movie ticket with popcorn beside it, (12) a tall green tree for a park visit.

Row 4: (13) a blue swimming pool with a floaty ring, (14) a red-and-white picnic basket with a sandwich, (15) a yellow playground slide with a small star on top, (16) a cartoon zoo entrance gate with a giraffe peeking over.

$STYLE_BASE Each of the 16 cells is clearly separated by soft paper space, no borders or grid lines drawn. Each object is centered in its cell and takes up about 60 percent of the cell space. The whole image has a unified warm cream paper tone."

# ============================================================
# GRID 3: VIRTUAL / SHOP ITEMS (16 dress-up + magical items)
# ============================================================
VIRTUAL_PROMPT="A 4 by 4 grid of exactly 16 hand-painted watercolor icons for a children's virtual shop of magical dress-up items. Reading left-to-right, top-to-bottom:

Row 1: (1) a fairy magic wand with a star at the tip, (2) a pair of pastel butterfly wings, (3) a flower crown made of pink and yellow blossoms, (4) a golden sparkle star.

Row 2: (5) a rainbow bow hair ribbon, (6) a princess tiara with tiny pink gems, (7) a cluster of three magic sparkles, (8) a cute heart-shaped hair clip.

Row 3: (9) a tiny bouquet of pink roses tied with a ribbon, (10) a single golden music note, (11) a red heart-shaped balloon with a string, (12) a small honey-colored teddy bear with a bow.

Row 4: (13) a white fluffy bunny plushie with pink inner ears, (14) a pastel rainbow with a small cloud, (15) a single curled unicorn horn with rainbow swirls, (16) a wooden paint palette with dots of different colored paint.

$STYLE_BASE Each of the 16 cells is clearly separated by soft paper space, no borders or grid lines drawn. Each object is centered in its cell and takes up about 60 percent of the cell space. The whole image has a unified warm cream paper tone."

# ============================================================
# Run all three grids in parallel (each is ~60s on the API).
# We keep the paper background — rembg will remove it per cell later.
# ============================================================

generate_grid() {
  local name="$1"
  local prompt="$2"
  local out="$OUT/$name.png"
  log "Starting $name..."
  python scripts/openai-generate.py \
    --prompt "$prompt" \
    --output "$out" \
    --api-key "$OKEY" \
    --size "1024x1024" \
    --no-transparent \
    2>&1 | tee -a "$LOG"
  if [ -f "$out" ]; then
    log "DONE: $name → $out ($(stat -c%s "$out" 2>/dev/null || stat -f%z "$out") bytes)"
  else
    log "FAILED: $name"
  fi
}

generate_grid "tasks-grid"    "$TASK_PROMPT"    &
P1=$!
generate_grid "rewards-grid"  "$REWARD_PROMPT"  &
P2=$!
generate_grid "virtual-grid"  "$VIRTUAL_PROMPT" &
P3=$!

wait $P1 $P2 $P3

log "=== All three icon grids finished ==="
ls -la "$OUT/"*.png | tee -a "$LOG"
