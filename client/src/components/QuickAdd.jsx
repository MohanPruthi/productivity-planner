import React, { useEffect, useRef, useState } from 'react';
import Dialog from './Dialog';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const localDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Opens with Ctrl+K (Cmd+K on Mac) or the "Quick add" button anywhere in the app.
// Adds a task for today or tomorrow; pages showing tasks refresh on 'tasks-changed'.
export const openQuickAdd = () => window.dispatchEvent(new Event('quick-add-open'));

const QuickAdd = () => {
  const { getAuthHeaders } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [when, setWhen] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('quick-add-open', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('quick-add-open', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setError('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const close = () => setOpen(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Type the task first.');
      return;
    }
    const date = localDate(when);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/normal-tasks`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { date } }));
      setText('');
      setOpen(false);
    } catch {
      setError("Couldn't add the task. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Quick add"
      subtitle="Add a task without leaving this page"
      footer={
        <>
          <span className="ui-hint spacer">Ctrl K opens this anywhere</span>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={close}>Cancel</button>
          <button type="submit" form="quick-add-form" className="ui-btn ui-btn-primary" disabled={saving}>
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </>
      }
    >
      <form id="quick-add-form" onSubmit={submit} className="ui-field">
        <input
          ref={inputRef}
          className="input-control"
          placeholder="Review board PR"
          aria-label="Task"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
        />
        {error && <span className="quick-add-error" role="alert">{error}</span>}
        <div className="ui-segmented" role="group" aria-label="Day">
          <button type="button" className={when === 0 ? 'active' : ''} onClick={() => setWhen(0)}>Today</button>
          <button type="button" className={when === 1 ? 'active' : ''} onClick={() => setWhen(1)}>Tomorrow</button>
        </div>
      </form>
    </Dialog>
  );
};

export default QuickAdd;
