# Kelly Coins - Project Instructions

## Overview
A gamified chore-tracking app for young children. Kids earn virtual coins by completing household tasks, then redeem coins for real-world or virtual rewards. Built as a mobile-first web app (iPhone/iPad) with a child-facing game UI and a parent management dashboard.

## Architecture

### Tech Stack
- **Backend**: Node.js + Express, JSON file-based persistence (`kelly-coins.json`)
- **Frontend**: Vanilla HTML/CSS/JS with ES Modules (`<script type="module">`)
- **No build step** — browser-native modules, zero bundling
- **No external JS dependencies** — only Google Fonts (Noto Sans SC) for CJK text

### Directory Structure
```
client/
  child/                    # Child-facing game UI
    index.html              # Shell HTML (minimal, loads modules)
    css/styles.css          # All child styles
    js/
      app.js                # Main controller, page routing
      api.js                # API client (all fetch calls)
      state.js              # Global state management
      router.js             # Simple hash-based page router
      pages/
        home.js             # Main screen: character + menu buttons
        tasks.js            # Earn coins: task grid
        rewards.js          # Redeem rewards: reward grid
        shop.js             # Virtual shop for character items
        wheel.js            # Lucky spin wheel (Canvas)
      components/
        character.js        # Character display (PNG-based)
        nav.js              # Bottom navigation bar
        header.js           # Top bar: coins, avatar, level
        toast.js            # Toast notifications
        animations.js       # Coin bursts, celebrations
        modal.js            # Reusable modal/dialog
    assets/
      characters/           # Character PNG sprites (to be added)
  parent/                   # Parent management dashboard
    index.html
    css/styles.css
    js/
      app.js
      api.js
      pages/
        dashboard.js        # Overview metrics
        tasks.js            # Task CRUD
        rewards.js          # Reward CRUD
        approvals.js        # Redemption approval queue
        children.js         # Child profile management
        history.js          # Transaction log
      components/
        nav.js
        toast.js
        modal.js
server/
  index.js                  # Express entry, static file serving
  db/database.js            # JSON persistence, multi-child support
  routes/
    child.js                # Child-facing API endpoints
    parent.js               # Parent-facing API endpoints
```

### Multi-Child Data Model
```json
{
  "children": {
    "kelly": { "name": "Kelly", "age": 4, "coins": 0, "avatar": "default", "level": 1 },
    "selina": { "name": "Selina", "age": 0, "coins": 0, "avatar": "default", "level": 1 }
  },
  "tasks": [{ "id": "...", "name": "...", "coins": 1, "icon_emoji": "...", "is_active": true }],
  "rewards": [{ "id": "...", "name": "...", "coins_cost": 1, "icon_emoji": "...", "category": "real|virtual", "is_active": true }],
  "transactions": [{ "child_id": "kelly", "task_name": "...", "coins_earned": 1, "created_at": "..." }],
  "redemptions": [{ "child_id": "kelly", "reward_name": "...", "coins_spent": 1, "status": "pending|approved|rejected", "created_at": "..." }]
}
```

### API Convention
- All child-facing APIs require `?child=<childId>` query parameter
- Parent APIs operate across all children or accept optional `?child=<childId>`
- Responses are JSON: `{ success: true, data: ... }` or `{ success: false, error: "..." }`

## Code Style
- Use ES Module syntax (`import`/`export`) in all frontend JS
- 2-space indentation
- Single quotes for JS strings
- Chinese for user-facing text, English for code identifiers and comments
- Each JS module exports a single class or a set of named functions
- CSS class names use BEM-lite: `block__element--modifier`

## Design Principles
- **Mobile-first**: all interactions via touch, no keyboard required
- **Child-friendly**: large touch targets (min 44px), big emoji, bright colors, minimal text
- **Modular**: each page/component is a self-contained module, easy to add new pages
- **Extensible**: structured to support future features (battle system, multiplayer, pets)

## Visual Design System — Dreamy Watercolor Storybook
The UI uses a hand-painted watercolor storybook aesthetic (Beatrix Potter / Oliver Jeffers feel).
The previous "deep purple + gold-edged RPG" theme was fully replaced. Do NOT reintroduce:
dark purple gradients, gold borders, black/navy shadows, neon glows.

### Fonts (loaded in `client/child/index.html`)
- `--font-body`: LXGW WenKai Screen — warm hand-written Chinese body text
- `--font-display`: Fredoka — round friendly English/number display
- `--font-numeric`: DM Sans — tabular numerics for clock/coin counts

### Color system (defined in `:root` of `client/child/css/styles.css`)
- 5-tier surfaces: `--surface-0` (cream) → `--surface-4` (warm tan)
- 4-tier text in warm browns: `--text-1` (darkest) → `--text-4` (mutest)
- 6-stop brand families: `--peach-*`, `--rose-*`, `--mint-*`, `--butter-*`, `--lavender-*`
- Warm shadow tint: always use `rgba(var(--shadow-warm), x)` — never pure black shadows
- `--shadow-warm: 60, 34, 24` (warm brown)

### Shadow convention (3-layer warm system)
```css
box-shadow:
  0 4px 12px rgba(var(--shadow-warm), 0.14),   /* key light */
  0 2px 4px rgba(var(--shadow-warm), 0.10),    /* fill */
  0 0 0 1px rgba(255, 255, 255, 0.7) inset,    /* rim highlight */
  0 2px 0 rgba(255, 255, 255, 0.85) inset;     /* top white edge */
```

### 3D button depth system (Toca-Boca-style tactile press)
Every interactive card/button has a physical "pressed" feel. The key trick is
a SOLID bottom box-shadow that looks like the literal side of a button, plus
`transform: translateY(depth)` on `:active` so the whole element sinks into
the edge when pressed.

Variables live in `:root`:
```
--d3-depth:     5px;   /* default card/button depth */
--d3-depth-sm:  3px;   /* smaller chips */
--d3-depth-lg:  7px;   /* hero buttons (wheel spin, achievement unlock) */
--d3-edge-peach / mint / rose / butter / lavender / cream / warm
--d3-rest       /* shadow stack at rest */
--d3-rest-sm    /* shadow stack at rest, small */
--d3-rest-lg    /* shadow stack at rest, large (deeper, richer) */
--d3-pressed    /* shadow stack when pressed — edge collapses */
--d3-transition /* 80ms cubic-bezier for the press */
```

Pattern for any new tappable element:
```css
.my-btn {
  transform: translateY(0);
  will-change: transform, box-shadow;
  transition: var(--d3-transition);
  box-shadow: var(--d3-rest);        /* or build custom with colored edge */
}
.my-btn:active {
  transform: translateY(var(--d3-depth));
  transition-duration: 0.05s;
  box-shadow: var(--d3-pressed);
}
```

For colored buttons (peach/mint/etc), hand-build the shadow stack with the
matching `--d3-edge-*` color so the press feel is consistent with its hue.
Always pair the solid edge shadow with an inner top highlight and inner
bottom darkening for a pillowy crown/curvature effect.

### Sound + haptic feedback (`client/child/js/sfx.js`)
Web Audio API synthesized sounds — no audio files. All sounds are generated
on the fly with oscillators + envelopes, which keeps the app tiny and matches
the watercolor aesthetic with soft musical plucks (not arcade bleeps).

Public API:
```js
import { sfx } from './sfx.js';
sfx.tap();          // soft pluck — every button press (auto-wired globally)
sfx.highlight();    // two-tap first-tap signal
sfx.confirm();      // two-note ascending bloop — save/submit
sfx.earn(n);        // coin rising sparkle, scales with n
sfx.complete();     // C-E-G major chord arpeggio — task complete
sfx.unlock();       // bigger sparkly complete — achievement
sfx.swipe();        // short sweep — page nav
sfx.error();        // gentle bonk for invalid action
sfx.setMuted(bool); // also mutes haptics (one toggle)
sfx.isMuted();
```

- All sounds auto-prime on first user gesture (iOS/Safari requirement)
- `navigator.vibrate` fires alongside sounds for haptic feedback on mobile
- Mute toggle lives in settings modal under "声音与震动"
- Global tap sound is wired via delegated `pointerdown` in `app.js setupGlobalTapSound()`
- Specific celebratory sounds (earn/complete/unlock) are fired from the
  component that triggers them (e.g., `pages/tasks.js` on task complete)

### Theme system (`client/child/js/theme.js`)
Five watercolor colorways that override peach/rose/mint/butter/lavender/surface variables:
`peach` (default 暖意蜜桃), `blossom` (樱花绽放), `sage` (薄荷花园), `sky` (天空梦境), `autumn` (秋日暖阳).
Each theme exports a `swatch` gradient string rendered directly in settings modal.

### Skin style system (`client/child/js/skin-style.js`)
Character PNGs live in `client/child/assets/characters/styles/<style>/<skin>.png`.
Available styles: `watercolor` (default), `gacha`, `crayon`, `old`.
Use `skinImageSrc(skinId)` to build asset paths — handles style switching.

### Watercolor asset directories (all already generated)
- `client/child/assets/characters/styles/watercolor/` — 6 character skins
- `client/child/assets/backgrounds/watercolor/` — 8 backgrounds (time/season/weather)
- `client/child/assets/ui/watercolor/` — paper-texture, decorations, banners, frames

### Dynamic background (`client/child/js/components/dynamic-background.js`)
Tries `/child/assets/backgrounds/watercolor/<scene>.png` first, falls back to the
legacy path. Ambient particles (snow/rain/fireflies/butterflies) match the scene.

## Common Commands
```bash
# Start dev server (port 3000)
cd C:/Users/qypen/Documents/kelly-coins && node server/index.js

# Regenerate a single watercolor asset via OpenAI gpt-image-1
python scripts/openai-generate.py <prompt> --out <path>
python scripts/openai-edit.py <prompt> --style-ref <ref.png> --out <path>

# Full watercolor asset regeneration (19 assets, ~$0.80, 30-40 min)
bash scripts/gen-watercolor.sh
```

## Known Gotchas
- Service worker (`sw.js`) aggressively caches. After CSS/JS changes:
  `localStorage.clear(); caches.keys().then(k => k.forEach(x => caches.delete(x))); location.reload()`
- All child-facing API calls require `?child=<childId>` — missing query = 400
- `rembg` cleanup runs on generated character PNGs to remove backgrounds
- LocalStorage keys: `kelly-coins-skin-style`, `kelly-coins-ui-theme`, `kelly-coins-current-child`

## Progress & Handoff
See `PROGRESS.md` in repo root for current session state, completed work,
and explicit "start here next time" pointer. Update it at end of each major session.

## Key Users
- **Kelly**: 4 years old, primary user of child UI
- **Selina**: 8 months old (Kelly's younger sister), in the system but too young to use
- **Parents**: manage tasks, rewards, approve redemptions via parent dashboard
