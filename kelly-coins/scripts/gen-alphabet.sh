#!/bin/bash
# Generate alphabet game assets: 26 letter cards + 26 word illustrations
# Uses OpenAI gpt-image-1. Two 1024x1536 grids split into individual cards.
#
# Grid A: letter cards (A-Z) — watercolor painted capital letters on cream paper
# Grid B: word illustrations (26 magical fairytale words) — transparent PNG
#
# Layout: 5 columns × 6 rows = 30 cells. We use 26 + 4 decorative. Ordering:
#   A B C D E
#   F G H I J
#   K L M N O
#   P Q R S T
#   U V W X Y
#   Z . . . .

OKEY="${OPENAI_API_KEY:-}"
ROOT="C:/Users/qypen/Documents/kelly-coins"
OUT="$ROOT/scripts/gen-output"
LOG="$ROOT/scripts/gen-alphabet.log"

cd "$ROOT" || exit 1
mkdir -p "$OUT"

echo "[$(date '+%H:%M:%S')] Starting alphabet grid generation" | tee "$LOG"

LETTER_PROMPT="A children's book illustration in soft watercolor style on warm cream paper, showing a 5-column by 6-row grid of 26 capital letters A through Z arranged in reading order (A B C D E on top row, F G H I J on second row, K L M N O on third row, P Q R S T on fourth row, U V W X Y on fifth row, Z alone in bottom left, the remaining 4 cells empty cream), each letter hand-painted in a different soft pastel watercolor (peach, rose, mint, butter yellow, lavender, sky blue), friendly rounded sans-serif style suitable for young children, each letter centered in its cell with a subtle decorative flourish around it like a tiny flower or sparkle, Beatrix Potter storybook feel, no photorealism, warm cozy nursery atmosphere, vintage children's primer aesthetic, NO other text or labels, just the letters"

WORD_PROMPT="A children's book illustration in soft watercolor style on warm cream paper, showing a 5-column by 6-row grid of 26 adorable cute objects, each in its own cell. Reading order: row 1 (Angel cute small winged girl, Butterfly colorful wings, Cake layered with cherry on top, Dragon friendly tiny green, Elephant plump gray with pink ears), row 2 (Fox orange sitting, Giraffe tall yellow with spots, Heart red puffy, Ice cream cone with pink scoop, Jellyfish pink translucent), row 3 (Koala gray hugging branch, Lion golden with mane, Mushroom red cap white spots, Nest brown with three blue eggs, Owl brown big eyes), row 4 (Pumpkin orange with curly vine, Queen cute small with crown, Rainbow arched colorful, Star yellow 5-point smiling, Turtle green shell cute), row 5 (Unicorn white with pink horn, Violin wooden with bow, Whale blue with water spout, Xylophone rainbow colored bars, Yarn ball pink), row 6 (Zebra striped cute, then 4 empty cream cells). Each object hand-painted in soft watercolor pastels, friendly anthropomorphic chibi style, slight outline, subtle drop shadow, Beatrix Potter / Oliver Jeffers storybook feel, no photorealism, each item centered in its cell, warm cozy nursery atmosphere, NO text or letter labels on the image"

echo "[$(date '+%H:%M:%S')] Generating letter grid (1/2)..." | tee -a "$LOG"
python3 scripts/openai-generate.py \
    --api-key "$OKEY" \
    --prompt "$LETTER_PROMPT" \
    --output "$OUT/alphabet-letters-grid.png" \
    --size "1024x1536" \
    --no-transparent 2>&1 | tee -a "$LOG"

echo "[$(date '+%H:%M:%S')] Generating word grid (2/2)..." | tee -a "$LOG"
python3 scripts/openai-generate.py \
    --api-key "$OKEY" \
    --prompt "$WORD_PROMPT" \
    --output "$OUT/alphabet-words-grid.png" \
    --size "1024x1536" \
    --no-transparent 2>&1 | tee -a "$LOG"

echo "[$(date '+%H:%M:%S')] Done. Grids saved to $OUT/" | tee -a "$LOG"
