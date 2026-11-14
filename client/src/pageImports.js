// The dynamic imports behind each lazy page. App.jsx hands these to React.lazy and
// the sidebar calls them early (hover/focus, idle time) so a page's chunk is
// usually downloaded before the click. Same functions, so the chunks are shared.
export const pageImports = {
  plans: () => import('./pages/Plans'),
  dsaLog: () => import('./pages/DsaLog'),
  taskHistory: () => import('./pages/TaskHistory'),
  meds: () => import('./pages/Meds'),
  hrDirectory: () => import('./pages/HrDirectory'),
  themeFactory: () => import('./pages/ThemeFactory'),
  notes: () => import('./pages/Notes'),
  noteDetail: () => import('./pages/NoteDetail'),
  settings: () => import('./pages/Settings'),
};

// Route path -> its page import (Dashboard is in the main bundle, so it has none)
const byPath = {
  '/plans': pageImports.plans,
  '/dsa-log': pageImports.dsaLog,
  '/task-history': pageImports.taskHistory,
  '/meds': pageImports.meds,
  '/hr-directory': pageImports.hrDirectory,
  '/themes': pageImports.themeFactory,
  '/notes': pageImports.notes,
  '/settings': pageImports.settings,
};

// A failed preload is harmless: React.lazy retries the import on navigation
export const preloadPage = (path) => {
  byPath[path]?.().catch(() => {});
};

export const preloadAllPages = () => {
  Object.values(pageImports).forEach((load) => load().catch(() => {}));
};
