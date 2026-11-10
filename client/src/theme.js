// Theme ("skin") engine. A theme only changes how things look: every page,
// flow and shortcut works the same in all of them. Each theme is one CSS file
// in src/themes, scoped by [data-theme="<id>"] on <html>, and registers itself
// in THEMES below so the Theme factory can list it.
//
// mode: 'both'  -> follows the sidebar light/dark button (Classic only)
//       'dark' / 'light' -> the theme sets the mode itself

export const THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Your current planner look. Light and dark follow the sun and moon button.',
    mode: 'both',
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Neon pink and cyan over a purple night, with a grid floor scrolling toward a striped sunset.',
    mode: 'dark',
  },
  {
    id: 'holo',
    name: 'Holo HUD',
    description: 'A sci-fi heads-up display: cyan lines, square corners, corner brackets and a scan sweep.',
    mode: 'dark',
  },
  {
    id: 'aurora',
    name: 'Aurora glass',
    description: 'Frosted panels over a slowly drifting aurora; cards light up under your cursor.',
    mode: 'dark',
  },
  {
    id: 'notebook',
    name: 'Living notebook',
    description: 'Warm dotted paper, serif headings and ink: ticks are written in and lines struck through.',
    mode: 'light',
  },
];

const THEME_KEY = 'ui_theme';
const SPLIT_KEY = 'zen_split';

const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice just isn't remembered */
  }
};

export const getThemeId = () => {
  const id = read(THEME_KEY, 'classic');
  return THEMES.some((t) => t.id === id) ? id : 'classic';
};
export const getTheme = () => THEMES.find((t) => t.id === getThemeId()) || THEMES[0];
export const getZenSplit = () => (read(SPLIT_KEY, '30') === '20' ? '20' : '30');

export const applyTheme = (id) => {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  write(THEME_KEY, theme.id);
  window.dispatchEvent(new CustomEvent('ui-theme-changed', { detail: theme }));
};

export const applyZenSplit = (value) => {
  const v = value === '20' ? '20' : '30';
  document.documentElement.dataset.zenSplit = v;
  write(SPLIT_KEY, v);
};

export const initTheme = () => {
  document.documentElement.dataset.theme = getThemeId();
  document.documentElement.dataset.zenSplit = getZenSplit();
};
