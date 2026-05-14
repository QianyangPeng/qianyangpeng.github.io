# Kelly Coins — Progress & Handoff

> **For future Claude sessions**: Read this + `CLAUDE.md` before doing anything.
> Update the "Last session" section and "Next up" section at the end of major work.

---

## Last session — 2026-04-07 (night): Level-up + Child Picker + Accessibility ✅

### What shipped

**Level-up ceremony** (`components/level-up.js` — new file):
- Server now computes level from `total_earned` (not current balance) via `computeLevel()` in `database.js`
- `trackLifetimeEarned()` updates `child.level` on every earn call
- `/api/earn` response now includes `new_level` field
- `tasks.js` detects `new_level > prevLevel` and triggers `showLevelUp(newLevel)` at 800ms delay
- Full-screen overlay: rotating conic-gradient rays, 8 floating ⭐ orbits, animated level badge pop (`scale(0.5→1.12→1)`), auto-dismiss at 6s
- sfx.unlock + 7-pulse vibrate pattern + voice announce

**Multi-child switcher** (`components/child-picker.js` — new file):
- Tapping the header avatar opens a bottom-sheet picker
- Fetches `/api/children`, renders each child's skin image + name + coins
- Currently active child highlighted (mint ✓ badge)
- On select: `setState` + `setChildId` + page reload at `#home` (clean state reset)
- On dismiss: tap overlay or dismiss button

**Header upgrade** (`components/header.js`):
- Avatar is now a `<button>` with `aria-haspopup="dialog"` → opens child picker
- Shows the equipped skin's PNG thumbnail (falls back to 🧒 emoji on load error)
- Level badge and coin counter have `aria-label` / `aria-live` attributes

**Accessibility pass**:
- All interactive cards get descriptive `aria-label` (tasks, rewards, shop skins/items/inventory)
- Coin counter: `aria-live="polite"` so screen readers announce changes
- Level badge: `aria-label="等级X"`
- `@media (prefers-reduced-motion: reduce)` block in CSS disables: card stagger, page slides, screen pulse, skeleton shimmer, level-up animations, offline banner transition, child picker slide

**New files:**
- `client/child/js/components/level-up.js`
- `client/child/js/components/child-picker.js`

**Modified files:**
- `server/db/database.js` — `computeLevel()` + level update in `trackLifetimeEarned`
- `server/routes/child.js` — `new_level` in earn response
- `client/child/js/pages/tasks.js` — level-up detection + ARIA
- `client/child/js/pages/rewards.js` — ARIA labels
- `client/child/js/pages/shop.js` — ARIA labels (skins, items, inventory)
- `client/child/js/components/header.js` — rewritten with avatar button + skin image
- `client/child/css/styles.css` — level-up overlay, child picker, prefers-reduced-motion

---

## Last session — 2026-04-07 (evening): Motion Choreography + Loading/Error/Offline ✅

### What shipped

**Motion choreography** (Option A):
- Direction-aware page transitions (`router.js`): navigation "forward" (home→tasks→shop→…)
  slides content in from the right; going "back" slides from the left. Uses 28px
  `translateX` spring curves — replaces the old symmetric 8px fade nudge.
- Card stagger entry (`pages/tasks.js`, `rewards.js`, `shop.js`): each card in a grid
  fades up from `translateY(18px) scale(0.95)` with 55ms stagger between cards.
  CSS class `.card-enter` + `--stagger-i` CSS variable, both set per-card.
- Screen pulse on task complete (`pages/tasks.js`): after `coinBurst`, the whole `#app`
  does a subtle `scale(1 → 1.014 → 0.994 → 1.005 → 1)` spring bounce via `.app--pulse`.

**Loading / error / offline states** (Option B):
- Skeleton loaders (`components/loading.js` — new file): `showSkeleton(el, count, layout)`
  injects shimmer placeholder cards (cream gradient sweep, 1.6s loop). Variants:
  `'grid'` (2-col, default), `'row'`/`'skin'` (horizontal carousel), `'inv'` (3-col).
- Grid error state (`components/loading.js`): `showGridError(el, retryFn)` injects an
  error card with a peach 3D retry button. Wired into every loadX() catch block.
- Global offline banner (`components/offline.js` — new file): fixed top strip, slides in
  via CSS `transform: translateY(-110% → 0)` when `navigator.onLine` is false. Has
  "重试" button that reloads the page. Init in `app.js`.

**New files:**
- `client/child/js/components/loading.js` — skeleton + error helpers
- `client/child/js/components/offline.js` — offline banner

**CSS additions** (appended to `client/child/css/styles.css`):
- `@keyframes slideOutLeft/Right + slideInRight/Left` — direction-aware page transitions
- `.content--exit-forward/back` and `.content--enter-forward/back` classes
- `.card-enter` + `@keyframes cardFadeUp` — stagger entry
- `.app--pulse` + `@keyframes screenPulse` — task complete screen bounce
- `.skeleton-grid / .skeleton-row` wrappers + `.skeleton-card` + `@keyframes skeletonShimmer`
- `.grid-error` + `.grid-error__retry` (3D peach button)
- `.offline-banner` + `.offline-banner--visible` + `.offline-banner__retry`

### Verified conceptually
All 8 modified/created files are consistent with the design system (warm shadows, brand
colors, 3D depth system, spring easing). Logic reviewed against existing page mount/unmount
flow and API error paths.

---

## Last session — 2026-04-07 (late): Tactility Pass ✅

### What shipped
Addressed the two biggest "still feels like a prototype" complaints from the
earlier session: **flat buttons** and **fonts that felt ordinary**. Also added
sound + haptic feedback which was completely missing before.

**3D button depth system** (`client/child/css/styles.css` `:root` + all card/button selectors):
- Added `--d3-depth / --d3-rest / --d3-pressed / --d3-transition` variable system
- Five colored edges: `--d3-edge-peach / mint / rose / butter / lavender / cream / warm`
- Every tappable element now has a literal "button side" via solid bottom box-shadow,
  and `:active` translates the element down by the depth so it sinks into the edge.
- Selectors upgraded: `.menu-card`, `.task-card`, `.reward-card`, `.shop-card`,
  `.skin-card`, `.modal__btn`, `.task-progress__btn`, `.pv-key` (all three variants),
  `.wheel-spin-btn`, `.achievement-unlock__btn`, `.settings-toggle-btn`, `.reader-btn`,
  `.settings-style-card`, `.settings-theme-card`, `.item-card`, `.inv-card`,
  `.story-card`, `.seed-card`, `.achievement-card`, `.shop-tab`

**Font hierarchy upgrade**:
- Added `--fw-display: 700` and `--fw-heavy: 800` weight presets to `:root`
- Loaded DM Sans weight 800 in `index.html`
- Clock `.home__time`: 4.6rem/500 → 5.4rem/800, stronger embossed text-shadow
- Coin counter `.header__coin-count`: 1.2rem/700 → 1.35rem/800
- Kelly name `.header__name`: text-base/600 → text-lg/700
- Level badge `.header__level`: uppercase + bolder weight
- Page titles `.page__title`: 2xl/600 → 2xl/800 + embossed text-shadow
- Task/reward card names: body font → display font, 700 weight
- Menu card labels: 600 → 700
- pv-key digits: 600 → 800 (super chunky numerals)

**Sound + haptic system** (`client/child/js/sfx.js` — new file):
- Web Audio API synthesized sounds — zero audio files needed
- 9 public methods: `tap / highlight / confirm / earn(n) / complete / unlock / swipe / error + controls`
- Each sound is an ADSR-shaped oscillator burst (sine/triangle) matching the
  watercolor aesthetic — soft plucks, not arcade bleeps
- Auto-primes AudioContext on first user gesture (iOS/Safari compliance)
- Pairs with `navigator.vibrate` for haptic feedback on mobile
- Mute toggle in settings modal under "声音与震动" section
- Global tap sound wired via delegated `pointerdown` in `app.js setupGlobalTapSound()`
- Task complete chord fires from `pages/tasks.js` after coin award (earn chime
  then 0.28s later, complete chord; achievement unlock sparkle at 1.5s if any)
- pv-key has per-variant sounds: OK=confirm, clear=error, digits=highlight

**Other file changes**:
- `client/child/js/components/settings-modal.js`: imports `sfx`, adds 声音与震动
  section with toggle that calls `sfx.setMuted`, plays a `confirm` sound on enable
- `client/child/js/pages/tasks.js`: imports `sfx`, fires earn/complete/unlock
  sequences on task-completion success path; `sfx.error` on API failure

### Verified in browser
Task cards show clear 5px warm-brown bottom edge with drop shadow below it.
Parent-verify keypad shows colored edges per variant (cream/rose/mint).
Task-progress modal confirm button has a deep peach edge. Home clock is now
weight 800 DM Sans with strong embossed shadow. Settings modal shows the new
sound toggle with mint 3D depth when enabled.

### Still open (deferred to next session)
- Motion choreography (scene-level entry animations, page transitions)
- Loading / error / offline states
- Accessibility (screen reader labels, reduced-motion respect, high contrast)
- All the commercial-gap items in the section below

---

## Previous session — 2026-04-07 (early): Full Watercolor UI Overhaul ✅

### What shipped
Complete replacement of the old "deep purple + gold RPG" look with a
**dreamy watercolor storybook** aesthetic (Beatrix Potter / Oliver Jeffers feel).

**Assets** (19 generated via OpenAI `gpt-image-1`, all in place):
- 6 watercolor character skins in `client/child/assets/characters/styles/watercolor/`
  (default/princess/knight/mermaid/astronaut/fairy)
- 8 watercolor backgrounds in `client/child/assets/backgrounds/watercolor/`
  (spring-morning, summer-day, summer-rain, fall-day, winter-snow,
   night-clear, night-rain, sunrise-fog)
- 6 UI sprites in `client/child/assets/ui/watercolor/`
  (paper-texture, decorations, hud-banner, nav-banner, card-frame, button-base)

**CSS overhaul** (`client/child/css/styles.css`, ~4250 lines):
- New design system: 5-tier surfaces, 4-tier warm-brown text, 6-stop brand colors
  (peach/rose/mint/butter/lavender), warm brown shadow tint
- New fonts: LXGW WenKai Screen (body) + Fredoka (display) + DM Sans (numeric)
- Every component rewritten: header HUD, bottom nav, character frames, home
  screensaver + widgets, all card types, all modals, toast, settings modal,
  parent-verify math gate, achievement unlock, voice banner, install prompt,
  garden plot, seed shop, story reader, achievements grid, animations

**JS wiring**:
- `theme.js` — 5 new watercolor colorways with gradient swatches
- `skin-style.js` — watercolor added + set as default style
- `dynamic-background.js` — serves from `watercolor/` with graceful fallback
- `settings-modal.js` — swatch logic updated

### Verified in browser (Chrome DevTools tested)
Home, tasks, rewards, shop (all 3 tabs), settings (skin picker + theme picker +
reminders), parent-verify math gate, task-progress modal, garden, story list,
wheel, achievements, theme switching (peach → sage mint → back), inventory empty state.

---

## Plan D status

### 1. 3D button depth — DONE ✅ (2026-04-07 late)
Every card/button now has a solid colored bottom edge + translateY press-down.
See `--d3-*` CSS variables in `:root` and the pattern documented in `CLAUDE.md`.

### 2. Sound effects + haptic — DONE ✅ (2026-04-07 late)
`client/child/js/sfx.js` — Web Audio API synthesized sounds, no audio files.
Global tap sound is delegated in `app.js`, celebratory sounds fire from
`pages/tasks.js`. Mute toggle in settings. Ambient music loop is NOT yet done
(would need recorded audio — currently silent in-between taps).

### 3. Motion choreography — DONE ✅ (2026-04-07 evening)
Direction-aware page transitions (slide left/right by nav order), card stagger entry
(55ms apart, translateY spring), screen pulse after task complete. See session above.

### 4. Additional open items (from commercial-gap analysis)
- Cloud account system + multi-device sync (biggest product gap)
- Onboarding flow for new families (currently assumes you're Kelly's family)
- Real database (SQLite minimum, currently raw JSON file)
- Automated tests (zero coverage today)
- Error monitoring (Sentry or equivalent)
- COPPA compliance for US ages-under-13
- Native iOS/Android wrapper (Capacitor) for App Store distribution
- Content template library (pre-made task packs by age)
- ~~Loading / error / offline states~~ DONE ✅ (2026-04-07 evening)

---

## Next up — start here next session

All previous candidates done. Good next directions:

### Option E: Home screensaver parallax + clock polish
- Subtle character parallax when clock ticks (translateX ±2px, DeviceOrientation on mobile)
- Weather widget improvements (animated rain/snow on the HUD)

### Option F: Parent dashboard polish
- Approval queue UI review (parent endpoint exists, UI may be sparse)
- Weekly report view: Kelly's stats for the week
- Task completion photo gallery in parent dashboard

### Option G: PWA / native shell improvements
- Service worker cache strategy improvements (cache-first for assets, network-first for API)
- Capacitor wrapper for App Store distribution
- Push notification support for parent approvals

**Before touching code**:
- Read `CLAUDE.md` for the design system rules (warm shadows, brand color families, fonts, 3D depth system, sfx module)
- Check `client/child/css/styles.css` `:root` for available CSS variables
- Server runs via `node server/index.js` on port 3000
- Test pages by navigating Chrome to `localhost:3000/child/`
- The 3D button and sfx systems are both documented in `CLAUDE.md` — reuse them, don't reinvent

---

## File inventory (what to read first)
- `CLAUDE.md` — architecture, design system, 3D depth system, sfx API, conventions, commands
- `PROGRESS.md` — this file, session history and next steps
- `client/child/css/styles.css` — the entire UI, ~4350 lines. `:root` has the
  full design system (colors, fonts, shadows, 3D depth variables)
- `client/child/js/sfx.js` — Web Audio sound module (tap/earn/complete/unlock/etc)
- `client/child/js/theme.js` — theme system + 5 watercolor colorways
- `client/child/js/skin-style.js` — skin style manager (watercolor default)
- `client/child/js/components/dynamic-background.js` — scene selection logic
- `client/child/js/components/settings-modal.js` — settings UI with sound toggle
- `client/child/js/app.js` — app shell + global tap sound delegation
- `client/child/js/pages/tasks.js` — task completion + earn/complete/unlock sounds
- `server/index.js` — Express entry point
- `server/db/database.js` — JSON persistence layer

---

## 2026-05-07 update: touch-only mini games added
- Reworked `client/child/js/pages/games.js` into a five-game touch lobby:
  找一找, 颜色花园, 数星星, 形状小屋, 翻翻乐.
- Added `client/child/js/pages/touch-mini-games.js` with four new non-mic games
  using existing sound effects, haptics, coin bursts, celebrations, and TTS via `speak()`.
- Cleaned `client/child/js/pages/find-animal-game.js` Chinese copy and kept it
  touch-only with existing alphabet watercolor icon assets.
- Added touch game CSS to `client/child/css/styles.css`, preserving the watercolor
  tactile 3D button style.
- Updated `server/routes/child.js` game reward allowlist/labels for new game IDs.
- Bumped `client/child/sw.js` cache version to `kelly-v3-touch-games` and precached
  the new game modules.
- Verified with `node --check` on changed JS/server files, HTTP 200 for `/`, HTTP 200
  for the new module, and a no-coin reward POST for `color-match`.
