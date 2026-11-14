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

// Google Fonts for each theme. Only the active theme's sheet is loaded (one
// <link id="theme-font">), so the other themes' fonts are never downloaded.
const THEME_FONTS = {
  classic: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap',
  synthwave: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Space+Grotesk:wght@400;500;600;700&display=swap',
  holo: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap',
  aurora: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  notebook: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&family=Instrument+Sans:wght@400;500;600;700&family=Caveat:wght@500;700&display=swap',
};

const loadThemeFont = (id) => {
  const href = THEME_FONTS[id];
  let link = document.getElementById('theme-font');
  if (!link) {
    link = document.createElement('link');
    link.id = 'theme-font';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
};

export const getThemeId = () => {
  const id = read(THEME_KEY, 'classic');
  return THEMES.some((t) => t.id === id) ? id : 'classic';
};
export const getTheme = () => THEMES.find((t) => t.id === getThemeId()) || THEMES[0];

export const applyTheme = (id) => {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  loadThemeFont(theme.id);
  write(THEME_KEY, theme.id);
  window.dispatchEvent(new CustomEvent('ui-theme-changed', { detail: theme }));
};


export const initTheme = () => {
  const id = getThemeId();
  document.documentElement.dataset.theme = id;
  loadThemeFont(id);
};
