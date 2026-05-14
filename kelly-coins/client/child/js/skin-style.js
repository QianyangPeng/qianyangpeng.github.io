// Skin Style Manager
// Determines which art style folder to load skin PNGs from
// Stored in localStorage so it persists across sessions
//
// Available styles (subfolders under client/child/assets/characters/styles/):
//   - watercolor: soft hand-painted watercolor storybook (Beatrix Potter / Oliver Jeffers feel)
//   - gacha:      premium ultra-detailed gacha-style art (Princess Connect / Honkai Star Rail)
//   - crayon:     warm hand-drawn chibi style with soft cel-shading
//   - old:        original simple chibi style
//
// EXTENSION POINT: add more styles here when generating new art sets

const STORAGE_KEY = 'kelly-coins-skin-style';
const DEFAULT_STYLE = 'watercolor';

export const AVAILABLE_STYLES = [
  { id: 'watercolor', label: '水彩绘本', desc: '温暖手绘童话风',   preview: 'default.png' },
  { id: 'gacha',      label: '精致手游', desc: '高质量手游立绘',   preview: 'default.png' },
  { id: 'crayon',     label: '蜡笔插画', desc: '柔和蜡笔童趣风',   preview: 'default.png' },
  { id: 'old',        label: '简约可爱', desc: '原版简约可爱风格', preview: 'default.png' },
];

// Get the active style ID
export function getSkinStyle() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_STYLE;
}

// Set the active style ID and broadcast change
export function setSkinStyle(styleId) {
  if (!AVAILABLE_STYLES.find(s => s.id === styleId)) return;
  localStorage.setItem(STORAGE_KEY, styleId);
  // Notify listeners
  styleListeners.forEach(cb => {
    try { cb(styleId); } catch (e) { console.error(e); }
  });
}

// Build the asset path for a skin in the current style
// Falls back gracefully if a style folder is missing the skin
export function skinImageSrc(skinId, styleOverride = null) {
  const style = styleOverride || getSkinStyle();
  return `/child/assets/characters/styles/${style}/${skinId || 'default'}.png`;
}

// Subscribe to style change events
const styleListeners = [];
export function onSkinStyleChange(callback) {
  styleListeners.push(callback);
  return () => {
    const i = styleListeners.indexOf(callback);
    if (i >= 0) styleListeners.splice(i, 1);
  };
}
