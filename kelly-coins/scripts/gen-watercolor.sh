#!/bin/bash
# Generate all watercolor assets for the UI overhaul
# Sequential because OpenAI rate limits + we want consistency

OKEY="${OPENAI_API_KEY:-}"
ROOT="C:/Users/qypen/Documents/kelly-coins"
WC_CHAR="$ROOT/client/child/assets/characters/styles/watercolor"
WC_BG="$ROOT/client/child/assets/backgrounds/watercolor"
WC_UI="$ROOT/client/child/assets/ui/watercolor"
STYLE_REF="$ROOT/client/child/assets/style-drafts/preview-dreamy.png"
DEFAULT_REF="$WC_CHAR/default.png"
LOG="$ROOT/scripts/gen-watercolor.log"

cd "$ROOT" || exit 1
mkdir -p "$WC_CHAR" "$WC_BG" "$WC_UI"

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"
}

# Helper: generate edit (with input ref)
gen_edit() {
  local INPUT="$1"
  local OUT="$2"
  local PROMPT="$3"
  local SIZE="${4:-1024x1536}"
  python3 scripts/openai-edit.py \
    --api-key "$OKEY" \
    --input "$INPUT" \
    --output "$OUT" \
    --size "$SIZE" \
    --prompt "$PROMPT" 2>&1
}

# Helper: generate from text only
gen_text() {
  local OUT="$1"
  local PROMPT="$2"
  local SIZE="${3:-1024x1024}"
  python3 scripts/openai-generate.py \
    --api-key "$OKEY" \
    --output "$OUT" \
    --size "$SIZE" \
    --prompt "$PROMPT" \
    --no-transparent 2>&1
}

> "$LOG"
log "===== Watercolor asset generation started ====="

# Common preamble for character skins (use default.png as style anchor for consistency)
CHAR_PREAMBLE="Soft hand-painted watercolor children's book illustration matching the reference image style EXACTLY. Cute chibi cartoon girl character, Asian girl, round face, large dark almond brown eyes with sparkly highlights, warm rosy cheeks, cheerful warm smile, dark brown hair styled in low side pigtails with small ribbon ties at base of pigtails. Style: soft watercolor washes with visible brush textures, hand-drawn ink line work slightly imperfect and warm, gentle pastel color palette, picture book art style like Beatrix Potter and Oliver Jeffers, NO digital cel-shading, no anime sharpness, no thick black outlines. Chibi proportions with large head 1:1.3 body ratio. Full body head to feet with empty space above and below. Off-white or transparent background."

# ============================================================
# CHARACTER SKINS (5 more, default.png already done)
# ============================================================

log "[1/19] princess.png"
gen_edit "$DEFAULT_REF" "$WC_CHAR/princess.png" \
  "$CHAR_PREAMBLE Outfit: a soft pink watercolor princess ball gown with multiple gentle tulle layers, white silk gloves up to elbows, golden tiara with a small ruby gem on her head, small pink mary janes. Holding a hand-painted bouquet of pink and cream roses. Tiny watercolor rose petals floating around her. Pose: full body standing in slight 3/4 angle, joyful princess expression with head slightly tilted." | tail -2

log "[2/19] knight.png"
gen_edit "$DEFAULT_REF" "$WC_CHAR/knight.png" \
  "$CHAR_PREAMBLE Outfit: cute soft silver and warm bronze paladin armor hand-painted in watercolor with gentle metallic sheen, soft white inner shirt visible at collar, warm red watercolor cape flowing behind, holding a tiny decorative sword in one hand and a small round shield with a star emblem in the other, brown leather knee boots. Hair in low pigtails with small red ribbon ties. Brave determined-yet-cheerful expression. Tiny watercolor sparkles around her." | tail -2

log "[3/19] mermaid.png"
gen_edit "$DEFAULT_REF" "$WC_CHAR/mermaid.png" \
  "$CHAR_PREAMBLE Outfit: a high-coverage soft turquoise and pink mermaid princess one-piece costume that goes from neck to a flowing watercolor fishtail at the bottom (where legs would be), the tail has gentle scale patterns painted in pearl, teal, pink and pale gold watercolor washes. Coral and seashell hair clips, small pearl necklace. Long flowing dark brown hair painted in soft watercolor waves. Holding a small cream-colored watercolor starfish. Watercolor bubbles and tiny pastel fish floating around her. Floating gentle pose with tail curving to one side." | tail -2

log "[4/19] astronaut.png"
gen_edit "$DEFAULT_REF" "$WC_CHAR/astronaut.png" \
  "$CHAR_PREAMBLE Outfit: a cute soft white and peach watercolor space suit with hand-painted star patches on the chest, a clear glass dome helmet with warm peach trim showing her happy face inside with low pigtails visible, white space gloves, white space boots with soft peach accents. Tiny watercolor stars and small pastel planets (pink saturn, mint earth) floating around her. Standing pose, one hand pointing forward in exploration. Watercolor space adventure feel." | tail -2

log "[5/19] fairy.png"
gen_edit "$DEFAULT_REF" "$WC_CHAR/fairy.png" \
  "$CHAR_PREAMBLE Outfit: a soft sage green watercolor leaf dress with tiny watercolor flowers (pink roses, white daisies, yellow buttercups) painted on it, green vine details at waist, soft mossy green ankle boots. Long flowing dark brown hair with a watercolor flower crown of pink roses and white daisies on her head. Large translucent watercolor butterfly wings on her back painted in pastel rainbow colors (pink, lavender, mint, peach). Holding a small wooden wand with a glowing pink crystal flower at the top. Tiny watercolor butterflies and golden pollen sparkles around her. Floating dance pose with wings spread." | tail -2

log "===== Character skins done. Starting backgrounds ====="

# ============================================================
# BACKGROUNDS (8 watercolor scenes - 1536x1024 landscape)
# ============================================================

BG_PREAMBLE="Hand-painted watercolor children's book illustration of a Pacific Northwest residential backyard scene. Top-down 3/4 perspective view. Soft watercolor washes with visible brush textures, gentle pastel color palette, hand-drawn ink line work slightly imperfect and warm. Picture book art style like Beatrix Potter or Oliver Jeffers. Features: a wooden deck with railings on the left, lush green lawn in center, tall evergreen pine trees in background, gray-blue exterior wall of a craftsman house at top edge, stone pathway curving through grass, garden beds with flowers, wood plank fence on right. NO characters, NO people, just the environment. Cozy hand-painted storybook art."

log "[6/19] spring-morning.png"
gen_text "$WC_BG/spring-morning.png" \
  "$BG_PREAMBLE Spring morning scene: pink cherry blossom trees in soft watercolor bloom, gentle golden sunrise light, dewdrops sparkling on grass, tiny watercolor butterflies, fresh new green leaves, warm pastel colors, cozy peaceful morning watercolor atmosphere." \
  "1536x1024" | tail -2

log "[7/19] summer-day.png"
gen_text "$WC_BG/summer-day.png" \
  "$BG_PREAMBLE Bright summer afternoon: vivid emerald green watercolor lawn, soft cyan blue sky with painted fluffy white clouds, tall sunflowers in garden beds, warm golden sunshine, vibrant cheerful watercolor colors, joyful summer mood." \
  "1536x1024" | tail -2

log "[8/19] summer-rain.png"
gen_text "$WC_BG/summer-rain.png" \
  "$BG_PREAMBLE Rainy summer day: visible watercolor rain droplets falling, small puddles on the wooden deck, wet glistening grass, lush deeper green watercolor washes, soft blue-gray watercolor atmosphere, cozy moody peaceful rain scene." \
  "1536x1024" | tail -2

log "[9/19] fall-day.png"
gen_text "$WC_BG/fall-day.png" \
  "$BG_PREAMBLE Autumn fall scene: maple trees with brilliant watercolor orange and red leaves, scattered fallen leaves on the lawn and deck, warm amber and orange watercolor tones, golden hour sunlight, cozy autumn watercolor feel." \
  "1536x1024" | tail -2

log "[10/19] winter-snow.png"
gen_text "$WC_BG/winter-snow.png" \
  "$BG_PREAMBLE Winter snow scene: thick fluffy watercolor white snow covering the wooden deck, lawn blanketed in soft watercolor snow, evergreen trees frosted with snow, snowflakes painted gently falling, magical quiet watercolor atmosphere, soft blue-white watercolor tones, warm yellow lights glowing from house windows." \
  "1536x1024" | tail -2

log "[11/19] night-clear.png"
gen_text "$WC_BG/night-clear.png" \
  "$BG_PREAMBLE Clear night scene: deep indigo watercolor night sky filled with painted stars and a soft full moon, moon reflection on the wooden deck, glowing watercolor fireflies floating over the lawn, deep blue-purple watercolor tones, magical mysterious watercolor mood, warm yellow window lights." \
  "1536x1024" | tail -2

log "[12/19] night-rain.png"
gen_text "$WC_BG/night-rain.png" \
  "$BG_PREAMBLE Rainy night: dark watercolor night sky with rain falling, raindrops hitting the wooden deck creating small watercolor ripples, puddles on the lawn reflecting warm yellow light from house windows, glistening wet grass, cozy warm yellow window glow, deep blue-black watercolor atmosphere." \
  "1536x1024" | tail -2

log "[13/19] sunrise-fog.png"
gen_text "$WC_BG/sunrise-fog.png" \
  "$BG_PREAMBLE Misty foggy sunrise: soft white watercolor fog rolling over the lawn, early sunrise orange and pink glow filtering through the watercolor mist, ethereal magical watercolor atmosphere, fog wrapping around tree trunks, dewdrops, peaceful dreamlike watercolor mood." \
  "1536x1024" | tail -2

log "===== Backgrounds done. Starting UI sprites ====="

# ============================================================
# UI SPRITE ASSETS (6 images)
# ============================================================

log "[14/19] paper-texture.png"
gen_text "$WC_UI/paper-texture.png" \
  "Hand-painted watercolor paper texture for a children's app background. Warm cream and peach color washes, subtle visible brush textures and gentle paper grain, very soft pastel watercolor wash going from pale cream at top to soft peach at bottom, slight watercolor bleeding patterns at edges, no characters or objects, just a beautiful clean watercolor paper background. Edges fade naturally without hard borders. Pastel storybook palette. Suitable for tiling/repeating." \
  "1536x1024" | tail -2

log "[15/19] decorations.png"
python3 scripts/openai-generate.py \
  --api-key "$OKEY" \
  --output "$WC_UI/decorations.png" \
  --size "1024x1024" \
  --prompt "A sprite sheet of small hand-painted watercolor decorations on a transparent background, scattered loosely (not in a grid): tiny watercolor butterflies in different pastel colors (pink, lavender, mint, peach), small hand-painted flowers (pink roses, white daisies, yellow tulips), tiny golden sparkles and stars, small painted hearts, small painted leaves and vines, tiny moon and cloud doodles. Picture book art style with soft watercolor brush textures, hand-drawn ink lines, no digital sharpness. Pastel color palette. About 20-30 individual decorative elements scattered across the canvas with empty space between them so they can be cropped individually." 2>&1 | tail -2

log "[16/19] hud-banner.png"
gen_text "$WC_UI/hud-banner.png" \
  "A long horizontal hand-painted watercolor banner/strip in cream and peach color, with delicate hand-painted floral and butterfly decorations along the edges (tiny pink roses, small mint leaves, pastel butterflies). Subtle watercolor brush texture. Picture book art style. The center area is empty/clean for text overlay. Warm soft watercolor color palette. Suitable as a decorative top header bar for a children's storybook app." \
  "1536x1024" | tail -2

log "[17/19] nav-banner.png"
gen_text "$WC_UI/nav-banner.png" \
  "A long horizontal hand-painted watercolor strip/banner in soft dusty pink and butter yellow with hand-painted decorations: small flower vines along the top edge, painted butterflies, tiny golden sparkles. Picture book art style with warm watercolor brush textures. Center area has 5 empty spaces for icon buttons. Suitable as a decorative bottom navigation bar background for a children's storybook app." \
  "1536x1024" | tail -2

log "[18/19] card-frame.png"
python3 scripts/openai-generate.py \
  --api-key "$OKEY" \
  --output "$WC_UI/card-frame.png" \
  --size "1024x1024" \
  --prompt "A hand-painted watercolor card/frame design on transparent background. A rounded rectangular soft cream-colored card with hand-painted soft pink rose decorations at the corners and small watercolor butterflies, gentle watercolor edges with slight bleeding, picture book art style. The center is mostly empty/clean for content. Soft warm pastel palette. Like a children's storybook page with watercolor flowers in the corners. Transparent or off-white background." 2>&1 | tail -2

log "[19/19] button-base.png"
python3 scripts/openai-generate.py \
  --api-key "$OKEY" \
  --output "$WC_UI/button-base.png" \
  --size "1024x1024" \
  --prompt "A hand-painted watercolor circular button design on transparent background. A soft cream colored circle with a thin warm peach watercolor border, slight visible brush texture, tiny watercolor flower at the top, picture book art style. Empty center for an icon. Round button suitable for a children's app navigation bar. Cozy soft warm pastel palette. Transparent background." 2>&1 | tail -2

log "===== ALL DONE ====="
log "Running rembg cleanup on character skins..."

# Clean up character backgrounds with rembg
for skin in princess knight mermaid astronaut fairy; do
  if [ -f "$WC_CHAR/$skin.png" ]; then
    log "rembg: $skin.png"
    python3 -c "
from rembg import remove
from PIL import Image
img = Image.open('$WC_CHAR/$skin.png')
out = remove(img)
out.save('$WC_CHAR/$skin.png')
print('OK')
" 2>&1 | tail -1
  fi
done

log "===== Cleanup complete ====="
log "Final inventory:"
ls -la "$WC_CHAR/" "$WC_BG/" "$WC_UI/" 2>&1 | tee -a "$LOG"
