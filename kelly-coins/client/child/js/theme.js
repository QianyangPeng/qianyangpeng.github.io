// UI Theme System — Watercolor storybook colorways
// Stores theme preference in localStorage and applies CSS variable overrides.
// Each theme overrides the primary brand color stops (peach/rose/mint/butter/lavender).
// The default theme is 'peach', matching the base CSS variables in styles.css.

const STORAGE_KEY = 'kelly-coins-ui-theme';

// All variables that get overridden — listed here so we can reset cleanly
const OVERRIDE_KEYS = [
  '--peach-50', '--peach-100', '--peach-300', '--peach-500', '--peach-700', '--peach-900',
  '--rose-50', '--rose-100', '--rose-300', '--rose-500', '--rose-700',
  '--mint-50', '--mint-100', '--mint-300', '--mint-500', '--mint-700',
  '--butter-50', '--butter-100', '--butter-300', '--butter-500', '--butter-700',
  '--lavender-50', '--lavender-100', '--lavender-300', '--lavender-500', '--lavender-700',
  '--surface-0', '--surface-1', '--surface-2',
];

export const THEMES = {
  // Default — warm peach + butter (matches base CSS)
  peach: {
    id: 'peach',
    name: '暖意蜜桃',
    desc: '温暖奶油',
    swatch: 'linear-gradient(135deg, #FFE8D6 0%, #F5BB1D 100%)',
    cssVars: {
      // empty — matches base
    },
  },

  // Soft rose + pink blossom
  blossom: {
    id: 'blossom',
    name: '樱花绽放',
    desc: '柔粉花语',
    swatch: 'linear-gradient(135deg, #FCD5D5 0%, #E8867A 100%)',
    cssVars: {
      '--peach-50':  '#FFEDED',
      '--peach-100': '#FCD5D5',
      '--peach-300': '#F5A7A7',
      '--peach-500': '#E8867A',
      '--peach-700': '#C96458',
      '--peach-900': '#8F3A30',
      '--rose-50':   '#FFF0F5',
      '--rose-100':  '#FBDCE5',
      '--rose-300':  '#F2A8BD',
      '--rose-500':  '#E77F9D',
      '--rose-700':  '#B9536F',
      '--butter-50':  '#FFF8EC',
      '--butter-100': '#FDECC8',
      '--butter-300': '#F9D57E',
      '--butter-500': '#E8AF3C',
      '--butter-700': '#A77718',
      '--surface-0': '#FFF8F4',
      '--surface-1': '#FBECE6',
      '--surface-2': '#F6DCD2',
    },
  },

  // Fresh mint + sage garden
  sage: {
    id: 'sage',
    name: '薄荷花园',
    desc: '青翠清新',
    swatch: 'linear-gradient(135deg, #D8F0DC 0%, #6CC48E 100%)',
    cssVars: {
      '--peach-50':  '#EEF7EC',
      '--peach-100': '#D8F0DC',
      '--peach-300': '#A6DDB0',
      '--peach-500': '#6CC48E',
      '--peach-700': '#468E5D',
      '--peach-900': '#285438',
      '--rose-50':   '#FBF0F5',
      '--rose-100':  '#F2D5E0',
      '--mint-50':   '#EEF7EC',
      '--mint-100':  '#D8F0DC',
      '--mint-300':  '#A6DDB0',
      '--mint-500':  '#6CC48E',
      '--mint-700':  '#2E7D54',
      '--butter-50':  '#FEF9E7',
      '--butter-100': '#FCEFC0',
      '--butter-300': '#F5DB78',
      '--butter-500': '#D9B31F',
      '--butter-700': '#8E7112',
      '--surface-0': '#F7FDF5',
      '--surface-1': '#EEF6EA',
      '--surface-2': '#DBE9D5',
    },
  },

  // Soft sky + lavender dream
  sky: {
    id: 'sky',
    name: '天空梦境',
    desc: '薰衣淡蓝',
    swatch: 'linear-gradient(135deg, #DAE0F2 0%, #826AAB 100%)',
    cssVars: {
      '--peach-50':  '#EDF0FA',
      '--peach-100': '#DAE0F2',
      '--peach-300': '#AEB6DA',
      '--peach-500': '#826AAB',
      '--peach-700': '#554480',
      '--peach-900': '#2F254F',
      '--rose-50':   '#F6EEF5',
      '--rose-100':  '#EADAE6',
      '--rose-300':  '#D5A8C9',
      '--rose-500':  '#B077A0',
      '--rose-700':  '#7B4F6F',
      '--mint-50':   '#EAF6F7',
      '--mint-100':  '#D2E9EC',
      '--mint-300':  '#9BCDD3',
      '--mint-500':  '#5AA7B0',
      '--mint-700':  '#2F6A72',
      '--butter-50':  '#FCF8E8',
      '--butter-100': '#F6EAC0',
      '--butter-300': '#E9C96B',
      '--butter-500': '#C99E1A',
      '--butter-700': '#7E5E0D',
      '--lavender-50':  '#EEEAFA',
      '--lavender-100': '#DCD5F2',
      '--lavender-300': '#B1A4DE',
      '--lavender-500': '#826AAB',
      '--lavender-700': '#4D3982',
      '--surface-0': '#F5F3FB',
      '--surface-1': '#E8E5F2',
      '--surface-2': '#D6D2E5',
    },
  },

  // Warm autumn + amber leaves
  autumn: {
    id: 'autumn',
    name: '秋日暖阳',
    desc: '琥珀温暖',
    swatch: 'linear-gradient(135deg, #F9DCB7 0%, #C96A1C 100%)',
    cssVars: {
      '--peach-50':  '#FDF0DE',
      '--peach-100': '#F9DCB7',
      '--peach-300': '#EFAF69',
      '--peach-500': '#D27C2C',
      '--peach-700': '#93500E',
      '--peach-900': '#562D06',
      '--rose-50':   '#FCE9DF',
      '--rose-100':  '#F6CFB9',
      '--rose-300':  '#E8996F',
      '--rose-500':  '#C96A1C',
      '--rose-700':  '#7E3E0C',
      '--mint-50':   '#F3F0DE',
      '--mint-100':  '#DCD5A3',
      '--mint-300':  '#B1A95A',
      '--mint-500':  '#827A22',
      '--mint-700':  '#4B4610',
      '--butter-50':  '#FFF6E0',
      '--butter-100': '#FCE6A7',
      '--butter-300': '#F3C142',
      '--butter-500': '#BA7C10',
      '--butter-700': '#764A04',
      '--lavender-50':  '#F8EEE6',
      '--lavender-100': '#EDD6C0',
      '--lavender-300': '#D6A17E',
      '--lavender-500': '#A56A3E',
      '--lavender-700': '#6A3F1F',
      '--surface-0': '#FFF6EA',
      '--surface-1': '#FBE8CD',
      '--surface-2': '#F3D2A3',
    },
  },
};

const themeListeners = [];

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'peach';
}

export function setTheme(themeId) {
  if (!THEMES[themeId]) return;
  localStorage.setItem(STORAGE_KEY, themeId);
  applyTheme(themeId);
  themeListeners.forEach(cb => { try { cb(themeId); } catch {} });
}

export function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.peach;
  const root = document.documentElement;

  // Reset previous overrides
  OVERRIDE_KEYS.forEach(key => root.style.removeProperty(key));

  // Apply new theme variables
  Object.entries(theme.cssVars || {}).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Set theme class for any theme-specific CSS rules
  root.classList.remove(...Object.keys(THEMES).map(t => `theme-${t}`));
  root.classList.add(`theme-${themeId}`);
}

export function initTheme() {
  applyTheme(getTheme());
}

export function onThemeChange(callback) {
  themeListeners.push(callback);
}

export function getAvailableThemes() {
  return Object.values(THEMES);
}
