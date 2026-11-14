import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Page cache: answers are kept in memory, and list queries also in localStorage for
// a day, so a page opens with its last data and refreshes in the background.

const CACHE_VERSION = 1; // bump when a cached response changes shape
const MAX_AGE = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'planner_query_cache';
// Only list queries are saved across reloads (a single note, for one, is not)
const PERSISTED_ROOTS = new Set(['dashboard', 'meds', 'notes', 'note-groups', 'plans']);

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

// Saved caches belong to one account: a different user (or version) discards them
const currentBuster = () => {
  try {
    const user = JSON.parse(storage?.getItem('user') || 'null');
    return user?.id ? `${user.id}:${CACHE_VERSION}` : null;
  } catch {
    return null;
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

let savingFor = null;
const persister = createSyncStoragePersister({
  storage: storage && {
    getItem: (key) => storage.getItem(key),
    removeItem: (key) => storage.removeItem(key),
    // A save queued before sign-out must not write the old account's data back
    setItem: (key, value) => {
      if (savingFor && savingFor === currentBuster()) storage.setItem(key, value);
    },
  },
  key: STORAGE_KEY,
  throttleTime: 0,
});

// Synchronous, before the first render, so cached pages paint immediately
export const restoreQueryCache = () => {
  try {
    const saved = persister.restoreClient();
    if (!saved) return;
    if (saved.buster === currentBuster() && Date.now() - saved.timestamp <= MAX_AGE) {
      hydrate(queryClient, saved.clientState);
    } else {
      persister.removeClient();
    }
  } catch {
    persister.removeClient();
  }
};

const save = () => {
  savingFor = currentBuster();
  if (!savingFor) return;
  persister.persistClient({
    timestamp: Date.now(),
    buster: savingFor,
    clientState: dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => query.state.status === 'success' && PERSISTED_ROOTS.has(query.queryKey[0]),
    }),
  });
};

// Saves at most once a second while the cache changes, and once more when the page goes away
export const startPersistingQueryCache = () => {
  let timer = null;
  queryClient.getQueryCache().subscribe(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      save();
    }, 1000);
  });
  window.addEventListener('pagehide', () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    save();
  });
};

// Sign-out: forget everything, in memory and on disk
export const clearQueryCache = () => {
  savingFor = null;
  queryClient.clear();
  persister.removeClient();
};
