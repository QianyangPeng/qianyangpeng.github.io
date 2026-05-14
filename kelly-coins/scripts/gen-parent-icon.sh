#!/bin/bash
# Generate the parent PWA home-screen icon.
# Watercolor cozy home badge matching the existing Kelly Coins visual language.

OKEY="${OPENAI_API_KEY:-}"
ROOT="C:/Users/qypen/Documents/kelly-coins"
OUT="$ROOT/scripts/gen-output/parent-icon.png"
LOG="$ROOT/scripts/gen-parent-icon.log"

PROMPT="A single iconic hand-painted watercolor illustration of a cozy small storybook house, centered composition, square format. The house has a warm golden-yellow glowing window with soft light spilling out, a small red heart above the front door, and a tiny yellow star perched on the chimney. Around the house are gentle watercolor petals and tiny sparkles floating in the air. Rendered in the same soft children-book watercolor style as Beatrix Potter meets Oliver Jeffers: soft hand-painted brush strokes, warm cream paper background, muted pastel palette (peach, butter-yellow, sage-mint, dusty-rose, lavender), gentle watercolor bleeds at the edges, no outlines or cel-shading, no text or letters anywhere. The image should read as a warm 'parent guardian / family home' badge suitable for a PWA app icon �?conveying warmth, home, and gentle care."

echo "[$(date '+%H:%M:%S')] Starting parent icon gen..." | tee "$LOG"
python scripts/openai-generate.py \
  --prompt "$PROMPT" \
  --output "$OUT" \
  --api-key "$OKEY" \
  --size "1024x1024" \
  --no-transparent \
  2>&1 | tee -a "$LOG"
echo "[$(date '+%H:%M:%S')] Done." | tee -a "$LOG"
ls -la "$OUT" 2>&1 | tee -a "$LOG"
