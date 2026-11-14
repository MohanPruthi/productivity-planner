import { queryClient } from './queryClient';

const sameDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

// The app's existing window events, turned into cache updates so cached pages stay current
export const installQueryEvents = () => {
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
