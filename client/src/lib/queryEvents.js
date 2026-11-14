import { queryClient } from './queryClient';

const sameDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

// Which cached pages a successful write to an API path can change. Pages update
// themselves optimistically; this only marks the other copies stale so the next
// page that shows them refetches (nothing is refetched right away).
const WRITE_EFFECTS = [
  [/^\/api\/plans?(\/|$)/, [['plans'], ['dashboard']]],
  [/^\/api\/normal-tasks/, [['dashboard']]],
  [/^\/api\/dsa-logs/, [['dashboard']]],
  [/^\/api\/study-logs/, [['dashboard']]],
  [/^\/api\/pomodoro-sessions/, [['dashboard']]],
  [/^\/api\/meds/, [['meds'], ['dashboard']]],
  [/^\/api\/(notes|note-groups)/, [['notes'], ['note-groups']]],
];

const markStaleAfterWrite = (input, init) => {
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method === 'GET' || method === 'HEAD') return;
  let path;
  try {
    path = new URL(input instanceof Request ? input.url : String(input), window.location.href).pathname;
  } catch {
    return;
  }
  for (const [pattern, keys] of WRITE_EFFECTS) {
    if (!pattern.test(path)) continue;
    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'none' }));
  }
};

// The app's existing window events, turned into cache updates so cached pages stay current
export const installQueryEvents = () => {
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const res = await originalFetch(input, init);
    if (res.ok) markStaleAfterWrite(input, init);
    return res;
  };

  // Quick add (Ctrl K) added tasks for a date
  window.addEventListener('tasks-changed', (e) => {
    if (e.detail?.date) queryClient.invalidateQueries({ queryKey: ['dashboard', 'today', e.detail.date] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'week'] });
  });

  // Voice assistant changed something
  window.addEventListener('data-changed', (e) => {
    const scope = e.detail?.scope;
    if (scope === 'tasks') queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    if (scope === 'meds') queryClient.invalidateQueries({ queryKey: ['meds'] });
    if (scope === 'notes') {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note-groups'] });
      // Single-note copies may be out of date now: let NoteDetail fetch
      queryClient.removeQueries({ queryKey: ['note'] });
    }
    if (scope === 'plans') queryClient.invalidateQueries({ queryKey: ['plans'] });
  });

  // A dose was ticked somewhere (dashboard, meds page, reminder): patch every cached copy
  window.addEventListener('med-log-updated', (e) => {
    const { date, log } = e.detail || {};
    if (!log) return;
    queryClient.setQueryData(['meds', 'logs'], (prev) => {
      if (!prev) return prev;
      const exists = prev.some((l) => sameDay(l.date, log.date));
      return exists ? prev.map((l) => (sameDay(l.date, log.date) ? log : l)) : [...prev, log];
    });
    if (date) {
      queryClient.setQueryData(['dashboard', 'today', date], (prev) => (
        prev ? { ...prev, meds: { ...prev.meds, todayLog: log } } : prev
      ));
    }
  });
};
