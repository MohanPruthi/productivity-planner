// Runs the "ui" instructions the server sends back with a command result.
export const runUiActions = (ui, navigate) => {
  for (const a of ui || []) {
    switch (a?.type) {
      case 'navigate':
        if (a.to) navigate(a.to);
        break;
      case 'openNote':
        if (a.noteId) navigate(`/note/${a.noteId}`);
        break;
      case 'zen':
        window.dispatchEvent(new CustomEvent('zen-command', { detail: { op: a.op, mode: a.mode } }));
        break;
      case 'openPending':
        navigate('/task-history');
        // the page mounts after the navigation: give it a moment to attach its listener
        setTimeout(() => window.dispatchEvent(new CustomEvent('open-pending')), 400);
        break;
      case 'refresh':
        window.dispatchEvent(new CustomEvent('data-changed', { detail: { scope: a.scope } }));
        if (a.scope === 'tasks') window.dispatchEvent(new CustomEvent('tasks-changed'));
        break;
      default:
        break;
    }
  }
};
