#!/bin/bash
# Batch generate all game assets using Nano Banana (Gemini API)
# Run this when your Gemini API credits are available
# Usage: bash scripts/generate-assets.sh YOUR_API_KEY

API_KEY="${1:-$GEMINI_API_KEY}"
SCRIPT="python3 $HOME/.claude/skills/banana/scripts/generate.py"
ASSETS="client/child/assets"

if [ -z "$API_KEY" ]; then
  echo "Usage: bash scripts/generate-assets.sh YOUR_GEMINI_API_KEY"
  exit 1
fi

GEN="$SCRIPT --api-key $API_KEY --resolution 2K --image-only --aspect-ratio 1:1"

echo "=== Generating Character Skins ==="

$GEN --prompt "A cute chibi anime girl game character, approximately 4 years old with a large head and small body in classic chibi 1:1 proportions. Big sparkly round eyes with star highlights, rosy cheeks, cheerful smile. Bubblegum pink hair in twin tails with red ribbons. Sky-blue dress with puffy sleeves, white peter pan collar, white stockings, small red mary jane shoes. Full body standing pose, slight angle, one hand waving. Soft cel-shading style inspired by Genshin Impact chibi art. Warm lighting, magical sparkle particles. Professional game character sprite. Transparent background." \
  && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/characters/default.png"
echo "  -> default.png"

$GEN --prompt "Same cute chibi anime girl (4yo, pink twin tails) now wearing an elegant pink princess ball gown with sparkly tiara, glass slippers, magical rose petals floating around her. Royal purple cape with gold trim. Full body standing pose. Genshin Impact chibi character art style. Transparent background." \
  && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/characters/princess.png"
echo "  -> princess.png"

$GEN --prompt "Same cute chibi anime girl (4yo, pink twin tails) now wearing cute silver and gold knight armor with a tiny decorative sword and round shield with star emblem. Red cape flowing. Determined cheerful expression. Full body standing pose. Genshin Impact chibi character art style. Transparent background." \
  && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/characters/knight.png"
echo "  -> knight.png"

$GEN --prompt "Same cute chibi anime girl (4yo, pink hair) transformed into a little mermaid with an iridescent blue-green fish tail, seashell accessories, coral crown. Holding a small starfish. Underwater bubbles and sparkles. Full body pose. Genshin Impact chibi character art style. Transparent background." \
  && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/characters/mermaid.png"
echo "  -> mermaid.png"

$GEN --prompt "Same cute chibi anime girl (4yo, pink twin tails) wearing a cute round white space suit with pink accents, clear helmet showing her face, small jetpack with star decorations. Stars and planets floating around. Full body standing pose. Genshin Impact chibi character art style. Transparent background." \
  && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/characters/astronaut.png"
echo "  -> astronaut.png"

$GEN --prompt "Same cute chibi anime girl (4yo, pink hair now longer and flowing) as a forest fairy with delicate butterfly wings in pastel rainbow colors, flower crown of roses and daisies, green leaf dress. Magical glowing particles and tiny flowers floating around. Full body pose. Genshin Impact chibi character art style. Transparent background." \
  && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/characters/fairy.png"
echo "  -> fairy.png"

echo ""
echo "=== Generating Task Icons ==="

for item in \
  "1|Two cute chibi anime sisters playing together with toys, warm pastel colors, soft lighting, game icon style illustration" \
  "2|Cute cartoon bathtub overflowing with colorful bubbles, yellow rubber duck, sparkly clean water, game icon style" \
  "3|Sparkly cartoon toothbrush with rainbow toothpaste and star sparkle effects, cute game icon style" \
  "4|Cute cartoon wardrobe with colorful dress on hanger, sparkle effects, game icon style illustration" \
  "5|Cute overflowing toy box with teddy bear, blocks, and ball, colorful game icon style illustration" \
  "6|Cute cartoon vegetables with happy faces - broccoli and carrot smiling, game icon style illustration" \
  "7|Cute cartoon broom and dustpan with sparkle cleaning effects, game icon style illustration"
do
  ID="${item%%|*}"
  PROMPT="${item#*|}"
  $GEN --prompt "$PROMPT. Transparent background." \
    && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/icons/tasks/$ID.png"
  echo "  -> tasks/$ID.png"
done

echo ""
echo "=== Generating Reward Icons ==="

for item in \
  "1|Delicious chocolate bar with golden wrapper partially opened showing chocolate, game icon style illustration" \
  "2|Colorful ice cream cone with three scoops (pink strawberry, vanilla, chocolate) and sprinkles, game icon style" \
  "3|Cute cartoon tablet device showing a play button on screen, colorful, game icon style illustration" \
  "4|Colorful inflatable bouncy castle with slides and fun decorations, game icon style illustration" \
  "5|Magical fairy tale castle with fireworks in the sky, Disney-inspired, game icon style illustration" \
  "6|Cute virtual doll in a beautiful outfit displayed on a sparkly stand, game icon style illustration" \
  "7|Magical open storybook with sparkles and tiny characters coming out of pages, game icon style illustration"
do
  ID="${item%%|*}"
  PROMPT="${item#*|}"
  $GEN --prompt "$PROMPT. Transparent background." \
    && cp ~/Documents/nanobanana_generated/$(ls -t ~/Documents/nanobanana_generated/ | head -1) "$ASSETS/icons/rewards/$ID.png"
  echo "  -> rewards/$ID.png"
done

echo ""
echo "=== Done! ==="
echo "Generated assets are in: $ASSETS/"
ls -la "$ASSETS/characters/" "$ASSETS/icons/tasks/" "$ASSETS/icons/rewards/"
