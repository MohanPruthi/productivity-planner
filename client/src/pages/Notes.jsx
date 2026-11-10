import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import '../styles/notes.css';
import Illustration from '../components/Illustration';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { 
  FileText, 
  ListTodo,
  Plus, 
  Pin, 
  Trash2, 
  Search, 
  Lock, 
  Globe, 
  X, 
  Check, 
  AlertCircle,
  Clock,
  Folder,
  FolderInput,
  FolderMinus
} from 'lucide-react';

const TAG_COLORS = [
  '#eab308', // Amber / Gold
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink / Rose
  '#f97316', // Orange
  '#ff2d55', // Crimson
  '#14b8a6', // Teal
  '#a855f7'  // Violet
];

const getRandomColor = () => {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

// Editable group name; commits on blur or Enter
const GroupNameField = ({ name, autoFocus, onCommit }) => {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  const commit = () => {
    const next = draft.trim() || 'New group';
    setDraft(next);
    if (next !== name) onCommit(next);
  };
  return (
    <input
      type="text"
      className="input-control notes-group-name-input"
      aria-label="Group name"
      value={draft}
      maxLength={80}
      autoFocus={autoFocus}
      onFocus={(e) => autoFocus && e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
      }}
    />
  );
};

const Notes = () => {
  const navigate = useNavigate();
  const { getAuthHeaders, privacyMode } = useAuth();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Groups + drag and drop state
  const [groups, setGroups] = useState([]);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [renameFocusId, setRenameFocusId] = useState(null);
  const [dragNoteId, setDragNoteId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // 'note:<id>' | 'group:<id>' | 'page'
  const panelRef = useRef(null);

  // Quick Create Metadata Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [noteTypeInput, setNoteTypeInput] = useState('note'); // 'note' | 'todo'
  const [colorTagInput, setColorTagInput] = useState('#eab308');
  const [isPersonalInput, setIsPersonalInput] = useState(false);
  const [isPinnedInput, setIsPinnedInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch all notes
  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/notes`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load notes');
      const data = await res.json();
      setNotes(data || []);
      try {
        const gres = await fetch(`${API_BASE_URL}/api/note-groups`, { headers: getAuthHeaders() });
        setGroups(gres.ok ? ((await gres.json()) || []) : []);
      } catch (gerr) {
        console.error(gerr);
        setGroups([]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Filter notes based on privacy mode and search query
  const visibleNotes = useMemo(() => {
    return notes.filter(note => {
      if (privacyMode && note.isPersonal) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = note.title && note.title.toLowerCase().includes(q);
        const matchContent = note.content && note.content.toLowerCase().includes(q);
        const matchChecklist = Array.isArray(note.checklist) && note.checklist.some(item => 
          item.text && item.text.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchContent && !matchChecklist) return false;
      }
      return true;
    });
  }, [notes, privacyMode, searchQuery]);

  // Groups: a group shows only if it has at least one visible note; only visible notes are listed/counted
  const groupIds = useMemo(() => new Set(groups.map(g => g.id)), [groups]);
  const visibleGroups = useMemo(() => {
    return groups
      .map(g => ({ ...g, visibleNotes: visibleNotes.filter(n => n.groupId === g.id) }))
      .filter(g => g.visibleNotes.length > 0);
  }, [groups, visibleNotes]);

  // Groups offered in the "Move to group" menu (ignores search, respects office mode)
  const movableGroups = useMemo(() => {
    return groups.filter(g => notes.some(n => n.groupId === g.id && !(privacyMode && n.isPersonal)));
  }, [groups, notes, privacyMode]);

  // Separate pinned and unpinned notes (grouped notes live inside their group)
  const { pinnedNotes, unpinnedNotes } = useMemo(() => {
    const pinned = [];
    const unpinned = [];
    visibleNotes.forEach(n => {
      if (n.groupId && groupIds.has(n.groupId)) return;
      if (n.isPinned) pinned.push(n);
      else unpinned.push(n);
    });
    return { pinnedNotes: pinned, unpinnedNotes: unpinned };
  }, [visibleNotes, groupIds]);

  const openGroup = visibleGroups.find(g => g.id === openGroupId) || null;
  const openGroupKey = openGroup ? openGroup.id : null;

  useEffect(() => {
    if (openGroupKey && panelRef.current) {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panelRef.current.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [openGroupKey]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  // Open Quick Metadata Create Modal
  const handleOpenCreate = (initialType = 'note') => {
    setTitleInput('');
    setNoteTypeInput(initialType);
    setColorTagInput(getRandomColor());
    setIsPersonalInput(false);
    setIsPinnedInput(false);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  // Submit Quick Create Modal -> Saves metadata & navigates to full editor at /note/:id
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!titleInput.trim()) {
      showToast('Please enter a note heading.');
      return;
    }

    if (isPinnedInput) {
      const currentlyPinnedCount = notes.filter(n => n.isPinned).length;
      if (currentlyPinnedCount >= 3) {
        showToast('Cannot pin more than 3 notes to the top.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: titleInput.trim(),
        type: noteTypeInput,
        colorTag: colorTagInput,
        isPersonal: isPersonalInput,
        isPinned: isPinnedInput,
        content: '',
        checklist: noteTypeInput === 'todo' ? [{ id: `item_${Date.now()}`, text: '', isDone: false }] : []
      };

      const res = await fetch(`${API_BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create note');
      }

      const createdNote = await res.json();
      setIsCreateModalOpen(false);
      navigate(`/note/${createdNote.id}`);
    } catch (err) {
      console.error(err);
      showToast(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Pin Toggle on Card
  const handleTogglePin = async (e, note) => {
    e.stopPropagation();
    const currentlyPinnedCount = notes.filter(n => n.isPinned).length;

    if (!note.isPinned && currentlyPinnedCount >= 3) {
      showToast('Cannot pin more than 3 notes to the top.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${note.id}/pin`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errData = await res.json();
        showToast(errData.error || 'Failed to update pin');
        return;
      }

      const updatedNote = await res.json();
      setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
    } catch (err) {
      console.error(err);
      showToast('Error toggling pin status');
    }
  };

  // Delete Note on Card
  const handleDeleteNote = async (e, noteId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Failed to delete note');
      const deleted = notes.find(n => n.id === noteId);
      const remaining = notes.filter(n => n.id !== noteId);
      setNotes(remaining);
      if (deleted && deleted.groupId) pruneGroupIfEmpty(deleted.groupId, remaining);
    } catch (err) {
      console.error(err);
      showToast('Error deleting note');
    }
  };

  // Direct toggle of checklist item from card
  const handleToggleCardChecklistItem = async (e, note, itemId) => {
    e.stopPropagation();
    let currentChecklist = [];
    if (Array.isArray(note.checklist)) {
      currentChecklist = note.checklist;
    } else if (typeof note.checklist === 'string') {
      try {
        currentChecklist = JSON.parse(note.checklist);
      } catch (err) {
        currentChecklist = [];
      }
    }

    const updatedChecklist = currentChecklist.map(item =>
      item.id === itemId ? { ...item, isDone: !item.isDone } : item
    );

    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, checklist: updatedChecklist } : n));

    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ checklist: updatedChecklist })
      });
      if (!res.ok) throw new Error('Failed to update todo item');
      const saved = await res.json();
      setNotes(prev => prev.map(n => n.id === note.id ? saved : n));
    } catch (err) {
      console.error(err);
      fetchNotes();
    }
  };

  // ---- Groups ----
  const jsonHeaders = () => ({ ...getAuthHeaders(), 'Content-Type': 'application/json' });

  // Delete a group that no longer holds any notes
  const pruneGroupIfEmpty = async (groupId, remainingNotes) => {
    if (!groupId || remainingNotes.some(n => n.groupId === groupId)) return;
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setOpenGroupId(cur => (cur === groupId ? null : cur));
    try {
      await fetch(`${API_BASE_URL}/api/note-groups/${groupId}`, { method: 'DELETE', headers: getAuthHeaders() });
    } catch (err) {
      console.error(err);
    }
  };

  const moveNote = async (noteId, groupId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note || (note.groupId || null) === groupId) return;
    const oldGroupId = note.groupId || null;
    const before = notes;
    const after = notes.map(n => n.id === noteId ? { ...n, groupId } : n);
    setNotes(after);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ groupId })
      });
      if (!res.ok) throw new Error('Failed to move note');
      const saved = await res.json();
      setNotes(prev => prev.map(n => n.id === noteId ? saved : n));
      pruneGroupIfEmpty(oldGroupId, after);
    } catch (err) {
      console.error(err);
      setNotes(before);
      showToast('Could not move note');
    }
  };

  // Create a group holding the given notes, then open it with the name ready to rename
  const createGroupWith = async (noteIds) => {
    const oldGroupIds = [...new Set(noteIds.map(id => notes.find(n => n.id === id)?.groupId).filter(Boolean))];
    try {
      const res = await fetch(`${API_BASE_URL}/api/note-groups`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ noteIds })
      });
      if (!res.ok) throw new Error('Failed to create group');
      const group = await res.json();
      const after = notes.map(n => noteIds.includes(n.id) ? { ...n, groupId: group.id } : n);
      setGroups(prev => [...prev, group]);
      setNotes(after);
      setRenameFocusId(group.id);
      setOpenGroupId(group.id);
      oldGroupIds.forEach(gid => pruneGroupIfEmpty(gid, after));
    } catch (err) {
      console.error(err);
      showToast('Could not create group');
    }
  };

  const renameGroup = async (groupId, name) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
    try {
      const res = await fetch(`${API_BASE_URL}/api/note-groups/${groupId}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to rename group');
    } catch (err) {
      console.error(err);
      showToast('Could not rename group');
      fetchNotes();
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete the group "${group.name}"? Its notes are kept.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/note-groups/${group.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete group');
      setGroups(prev => prev.filter(g => g.id !== group.id));
      setNotes(prev => prev.map(n => n.groupId === group.id ? { ...n, groupId: null } : n));
      setOpenGroupId(null);
    } catch (err) {
      console.error(err);
      showToast('Could not delete group');
    }
  };

  const handleMoveSelect = (e, note) => {
    e.stopPropagation();
    const v = e.target.value;
    if (v === '__new') createGroupWith([note.id]);
    else if (v === '__none') moveNote(note.id, null);
    else if (v) moveNote(note.id, v);
  };

  // ---- Drag and drop ----
  const endDrag = () => { setDragNoteId(null); setDropTarget(null); };
  const draggedNote = dragNoteId ? notes.find(n => n.id === dragNoteId) : null;

  const onNoteDragStart = (e, note) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', note.id);
    setDragNoteId(note.id);
  };

  const dragOverTarget = (e, key, allowed) => {
    if (!dragNoteId || !allowed) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== key) setDropTarget(key);
  };

  const dragLeaveTarget = (e, key) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropTarget(cur => (cur === key ? null : cur));
  };

  const onDropOnNote = (e, target) => {
    if (!dragNoteId || dragNoteId === target.id) return;
    e.preventDefault();
    e.stopPropagation();
    const id = dragNoteId;
    endDrag();
    if (target.groupId && groupIds.has(target.groupId)) moveNote(id, target.groupId);
    else createGroupWith([target.id, id]);
  };

  const onDropOnGroup = (e, group) => {
    if (!dragNoteId) return;
    e.preventDefault();
    e.stopPropagation();
    const id = dragNoteId;
    endDrag();
    moveNote(id, group.id);
  };

  const onDropOnPage = (e) => {
    if (!draggedNote || !draggedNote.groupId) return;
    e.preventDefault();
    const id = dragNoteId;
    endDrag();
    moveNote(id, null);
  };

  if (loading) {
    return <Loader text="Loading Notes..." />;
  }

  if (error) {
    return <div className="error-state">Error: {error}</div>;
  }

  const renderNoteCard = (note, inGroup = false) => {
    const cardColor = note.colorTag || '#eab308';
    const isTodo = note.type === 'todo';
    const checklist = Array.isArray(note.checklist) ? note.checklist : [];
    const completedCount = checklist.filter(i => i.isDone).length;
    const totalCount = checklist.length;

    return (
      <div
        key={note.id}
        onClick={() => navigate(`/note/${note.id}`)}
        draggable
        onDragStart={(e) => onNoteDragStart(e, note)}
        onDragEnd={endDrag}
        onDragOver={(e) => dragOverTarget(e, `note:${note.id}`, dragNoteId !== note.id)}
        onDragLeave={(e) => dragLeaveTarget(e, `note:${note.id}`)}
        onDrop={(e) => onDropOnNote(e, note)}
        className={`glass-card note-card-curved${dragNoteId === note.id ? ' notes-dragging' : ''}${dropTarget === `note:${note.id}` ? ' notes-drop-target' : ''}`}
        style={{
          '--note-color': cardColor,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: '18px',
          padding: '1.25rem 1.35rem 1.15rem',
          background: 'rgba(255, 255, 255, 0.015)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.45)',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '175px',
          overflow: 'hidden'
        }}
      >
        {/* Sticky Top-Right Badge on Personal Space for Personal Notes */}
        {!privacyMode && note.isPersonal && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'rgba(255, 255, 255, 0.05)',
              borderBottomLeftRadius: '12px',
              borderTopRightRadius: '18px',
              padding: '0.22rem 0.6rem 0.28rem',
              color: 'var(--text-secondary)',
              fontSize: '0.62rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.28rem',
              backdropFilter: 'blur(8px)',
              zIndex: 3
            }}
            title="Visible only in Personal Workspace"
          >
            <Lock size={10} strokeWidth={2.2} color="var(--text-muted)" />
            <span>Personal</span>
          </div>
        )}

        <div>
          {/* Header Row: Type Icon + Title */}
          <div style={{ paddingRight: (!privacyMode && note.isPersonal) ? '65px' : '0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isTodo ? (
              <ListTodo size={16} color={cardColor} style={{ flexShrink: 0, opacity: 0.95 }} />
            ) : (
              <FileText size={16} color={cardColor} style={{ flexShrink: 0, opacity: 0.95 }} />
            )}
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
                flex: 1
              }}
              title={note.title}
            >
              {note.title}
            </h3>
          </div>

          {/* Full Length Underline in Note Tag Color */}
          <div
            style={{
              width: '100%',
              height: '2.5px',
              borderRadius: '2px',
              background: cardColor,
              boxShadow: `0 0 8px ${cardColor}66`,
              marginTop: '0.45rem',
              marginBottom: '0.75rem'
            }}
          />

          {/* Body Preview: Checklist preview for Todo, Formatted Text preview for Standard Note */}
          {isTodo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {checklist.length === 0 ? (
                <span style={{ fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No checklist items</span>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
                    {checklist.slice(0, 4).map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.82rem'
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleToggleCardChecklistItem(e, note, item.id)}
                          style={{
                            background: item.isDone ? cardColor : 'transparent',
                            border: `1.5px solid ${item.isDone ? cardColor : 'rgba(255, 255, 255, 0.25)'}`,
                            borderRadius: '5px',
                            width: '15px',
                            height: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            padding: 0,
                            transition: 'all 0.15s ease'
                          }}
                          title={item.isDone ? 'Mark as undone' : 'Mark as done'}
                        >
                          {item.isDone && <Check size={10} color="#ffffff" strokeWidth={3.5} />}
                        </button>
                        <span
                          style={{
                            color: item.isDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                            textDecoration: item.isDone ? 'line-through' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1
                          }}
                        >
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {checklist.length > 4 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.1rem' }}>
                      + {checklist.length - 4} more {checklist.length - 4 === 1 ? 'item' : 'items'}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                maxHeight: '85px',
                overflow: 'hidden'
              }}
            >
              {note.content ? (
                <div
                  className="note-card-html-preview"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      note.content.includes('<') ? note.content : marked.parse(note.content)
                    )
                  }}
                />
              ) : (
                <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Empty note</span>
              )}
            </div>
          )}
        </div>

        {/* Footer: Date, Todo Completed Count, Pin & Delete Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <Clock size={11} />
              <span>{formatRelativeTime(note.updatedAt || note.createdAt)}</span>
            </div>

            {/* Clean X/X completed pill in footer */}
            {isTodo && (
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  color: totalCount > 0 && completedCount === totalCount ? '#a5b4fc' : 'var(--text-muted)',
                  background: 'rgba(255, 255, 255, 0.035)',
                  padding: '0.12rem 0.45rem',
                  borderRadius: '5px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Check size={9} strokeWidth={3} color={totalCount > 0 && completedCount === totalCount ? '#818cf8' : 'var(--text-muted)'} />
                <span>{completedCount}/{totalCount} completed</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {/* Move to group (keyboard / touch friendly) */}
            <label className="notes-move" title="Move to group" onClick={(e) => e.stopPropagation()}>
              <FolderInput size={14} />
              <select
                aria-label={`Move "${note.title}" to group`}
                value=""
                onChange={(e) => handleMoveSelect(e, note)}
              >
                <option value="">Move to group</option>
                {note.groupId && <option value="__none">No group</option>}
                {movableGroups.filter(g => g.id !== note.groupId).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
                <option value="__new">New group</option>
              </select>
            </label>

            {inGroup && (
              <button
                type="button"
                className="notes-card-icon-btn"
                onClick={(e) => { e.stopPropagation(); moveNote(note.id, null); }}
                title="Remove from group"
                aria-label="Remove from group"
              >
                <FolderMinus size={14} />
              </button>
            )}

            {/* Pin Button in Bottom Bar */}
            <button
              onClick={(e) => handleTogglePin(e, note)}
              style={{
                background: note.isPinned ? `${cardColor}18` : 'transparent',
                border: '1px solid',
                borderColor: note.isPinned ? `${cardColor}44` : 'transparent',
                borderRadius: '6px',
                padding: '0.3rem',
                color: note.isPinned ? cardColor : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              className="note-pin-btn"
              title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
            >
              <Pin size={14} fill={note.isPinned ? cardColor : 'none'} style={{ transform: note.isPinned ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }} />
            </button>

            {/* Delete Button */}
            <button
              onClick={(e) => handleDeleteNote(e, note.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.3rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
              className="note-delete-hover"
              title="Delete Note"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGroupTile = (group) => {
    const key = `group:${group.id}`;
    const count = group.visibleNotes.length;
    return (
      <div
        key={group.id}
        role="button"
        tabIndex={0}
        aria-label={`Open group ${group.name}, ${count} ${count === 1 ? 'note' : 'notes'}`}
        aria-expanded={openGroupId === group.id}
        className={`notes-group-tile${dropTarget === key ? ' notes-drop-target' : ''}`}
        onClick={() => setOpenGroupId(openGroupId === group.id ? null : group.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpenGroupId(openGroupId === group.id ? null : group.id);
          }
        }}
        onDragOver={(e) => dragOverTarget(e, key, true)}
        onDragLeave={(e) => dragLeaveTarget(e, key)}
        onDrop={(e) => onDropOnGroup(e, group)}
      >
        <div className="notes-group-preview" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <span key={i} style={group.visibleNotes[i] ? { background: group.visibleNotes[i].colorTag || '#eab308' } : undefined} />
          ))}
        </div>
        <div className="notes-group-meta">
          <span className="notes-group-name" title={group.name}>{group.name}</span>
          <span className="notes-group-count">{count} {count === 1 ? 'note' : 'notes'}</span>
        </div>
      </div>
    );
  };

  const renderGroupPanel = (group) => (
    <section
      ref={panelRef}
      className="cc-tile notes-group-panel"
      aria-label={`Group ${group.name}`}
      onDragOver={(e) => { if (dragNoteId) e.stopPropagation(); }}
      onDrop={(e) => { if (dragNoteId) { e.stopPropagation(); endDrag(); } }}
    >
      <div className="notes-group-head">
        <Folder size={18} color="var(--tone)" aria-hidden="true" />
        <GroupNameField
          key={group.id}
          name={group.name}
          autoFocus={renameFocusId === group.id}
          onCommit={(name) => renameGroup(group.id, name)}
        />
        <span className="cc-meta">{group.visibleNotes.length} {group.visibleNotes.length === 1 ? 'note' : 'notes'}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => handleDeleteGroup(group)}>
          <Trash2 size={14} />
          <span>Delete group</span>
        </button>
        <button type="button" className="ui-icon-btn" onClick={() => setOpenGroupId(null)} aria-label="Close group">
          <X size={16} />
        </button>
      </div>
      <p className="notes-group-hint">
        {dragNoteId && draggedNote && draggedNote.groupId === group.id
          ? 'Drop the note outside this panel to remove it from the group.'
          : 'Drag a note out of this panel to remove it, or use the folder buttons on each note.'}
      </p>
      <div className="notes-group-grid">
        {group.visibleNotes.map(n => renderNoteCard(n, true))}
      </div>
    </section>
  );

  return (
    <div className="notes-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%', minHeight: 'calc(100vh - 8rem)', paddingBottom: '3rem' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999999,
            background: 'rgba(20, 15, 22, 0.95)',
            border: '1px solid rgba(255, 45, 85, 0.4)',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 20px rgba(255, 45, 85, 0.25)',
            borderRadius: '12px',
            padding: '0.75rem 1.25rem',
            backdropFilter: 'blur(16px)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            animation: 'medToastSlideInTop 0.25s ease forwards'
          }}
        >
          <AlertCircle size={17} color="#ff2d55" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Heading Banner */}
      <header className="page-header tone-notes">
        <div className="page-header-main">
          <div className="page-header-icon">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Notes</h1>
            <p className="page-header-subtitle">{privacyMode ? 'Office workspace, personal notes hidden' : 'All notes'} · {visibleNotes.length} {visibleNotes.length === 1 ? 'note' : 'notes'}</p>
          </div>
        </div>

        {/* Action Controls: Search & Create */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Expanding search */}
          <div className={`notes-search${(searchOpen || searchQuery) ? ' open' : ''}`} role="search">
            <div className="notes-search-field">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search notes"
                aria-label="Search notes"
                value={searchQuery}
                tabIndex={(searchOpen || searchQuery) ? 0 : -1}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setSearchOpen(false);
                    e.currentTarget.blur();
                  }
                }}
                className="input-control"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="notes-search-clear"
                  aria-label="Clear search"
                  onClick={() => { setSearchQuery(''); if (searchInputRef.current) searchInputRef.current.focus(); }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="ui-icon-btn"
              aria-label="Search notes"
              aria-expanded={Boolean(searchOpen || searchQuery)}
              onClick={() => { setSearchOpen(true); if (searchInputRef.current) searchInputRef.current.focus(); }}
            >
              <Search size={16} />
            </button>
          </div>

          {/* Single Create Button */}
          <button
            onClick={() => handleOpenCreate('note')}
            style={{
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '10px'
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>New note</span>
          </button>
        </div>
      </header>

      {/* Main Listing Grid */}
      {visibleNotes.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            borderRadius: '20px'
          }}
        >
          <Illustration name="notes-empty" />
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
              {searchQuery ? 'No notes match your search' : 'Start your first note'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, maxWidth: '380px' }}>
              {searchQuery 
                ? 'Try a different keyword or clear the search field to see all notes.' 
                : 'Create your first plain note or to-do checklist to capture thoughts, ideas, or links.'}
            </p>
          </div>
          {!searchQuery && (
            <div style={{ marginTop: '0.5rem' }}>
              <button
                onClick={() => handleOpenCreate('note')}
                style={{
                  padding: '0.65rem 1.45rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  borderRadius: '10px'
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>New note</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
          className={dropTarget === 'page' ? 'notes-drop-zone-active' : undefined}
          onDragOver={(e) => dragOverTarget(e, 'page', Boolean(draggedNote && draggedNote.groupId))}
          onDragLeave={(e) => dragLeaveTarget(e, 'page')}
          onDrop={onDropOnPage}
        >

          {openGroup && renderGroupPanel(openGroup)}
          
          {/* Pinned Notes Section */}
          {pinnedNotes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pin size={15} color="#eab308" fill="#eab308" style={{ transform: 'rotate(45deg)' }} />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pinned ({pinnedNotes.length})
                </h2>
              </div>
              <div className="notes-3col-grid">
                {pinnedNotes.map(n => renderNoteCard(n))}
              </div>
            </div>
          )}

          {/* Others / Unpinned Notes Section */}
          {(unpinnedNotes.length > 0 || visibleGroups.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pinnedNotes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Others
                  </h2>
                </div>
              )}
              <div className="notes-3col-grid">
                {visibleGroups.map(renderGroupTile)}
                {unpinnedNotes.map(n => renderNoteCard(n))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Quick Metadata Create Note Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'modalFadeIn 0.2s ease forwards'
          }}
          onClick={handleCloseCreateModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card custom-modal-scrollbar"
            style={{
              width: '560px',
              maxWidth: '94vw',
              borderRadius: '20px',
              padding: '1.85rem 2rem',
              background: 'linear-gradient(135deg, rgba(20, 22, 32, 0.98) 0%, rgba(13, 14, 20, 0.98) 100%)',
              border: `1px solid ${colorTagInput}44`,
              boxShadow: `0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px ${colorTagInput}22`,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: `${colorTagInput}18`,
                    border: `1px solid ${colorTagInput}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colorTagInput
                  }}
                >
                  {noteTypeInput === 'todo' ? <ListTodo size={18} /> : <FileText size={18} />}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
                    {noteTypeInput === 'todo' ? 'New Todo Checklist' : 'New Note'}
                  </h2>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Set up note metadata and continue to editor
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseCreateModal}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
                className="btn-trash-hover"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Metadata Form */}
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Format Type Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Format Type
                </label>
                <div style={{ display: 'flex', gap: '0.45rem', background: 'rgba(255, 255, 255, 0.025)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', width: 'fit-content' }}>
                  <button
                    type="button"
                    onClick={() => setNoteTypeInput('note')}
                    style={{
                      padding: '0.45rem 1.1rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: noteTypeInput === 'note' ? `${colorTagInput}55` : 'transparent',
                      background: noteTypeInput === 'note' ? `${colorTagInput}20` : 'transparent',
                      color: noteTypeInput === 'note' ? (colorTagInput || '#fbbf24') : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <FileText size={15} />
                    <span>Plain Note</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteTypeInput('todo')}
                    style={{
                      padding: '0.45rem 1.1rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: noteTypeInput === 'todo' ? `${colorTagInput}55` : 'transparent',
                      background: noteTypeInput === 'todo' ? `${colorTagInput}20` : 'transparent',
                      color: noteTypeInput === 'todo' ? (colorTagInput || '#fbbf24') : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <ListTodo size={15} />
                    <span>Todo Checklist</span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Heading
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '1rem', color: colorTagInput, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    {noteTypeInput === 'todo' ? <ListTodo size={18} /> : <FileText size={18} />}
                  </div>
                  <input
                    type="text"
                    placeholder={noteTypeInput === 'todo' ? "Enter todo checklist heading..." : "Enter note heading..."}
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="input-control"
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      padding: '0.7rem 1rem 0.7rem 2.65rem',
                      borderRadius: '11px',
                      background: 'rgba(255, 255, 255, 0.02)'
                    }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Color Tag Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Color Tag
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorTagInput(c)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: c,
                        border: colorTagInput === c ? '2.5px solid #ffffff' : '2px solid transparent',
                        boxShadow: colorTagInput === c ? `0 0 10px ${c}` : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transform: colorTagInput === c ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.15s ease'
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Workspace Visibility Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.025)', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isPersonalInput ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isPersonalInput ? '#eab308' : 'var(--text-muted)'
                    }}
                  >
                    {isPersonalInput ? <Lock size={15} /> : <Globe size={15} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isPersonalInput ? 'Personal Workspace' : 'Office Workspace'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>
                      {isPersonalInput ? 'Private to personal space' : 'Visible in both spaces'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPersonalInput(prev => !prev)}
                  style={{
                    width: '42px',
                    height: '23px',
                    borderRadius: '12px',
                    background: isPersonalInput ? '#eab308' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      width: '17px',
                      height: '17px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: '3px',
                      left: isPersonalInput ? '22px' : '3px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </button>
              </div>

              {/* Pin to Top Checkbox / Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.2rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Pin note to top
                </span>
                <button
                  type="button"
                  onClick={() => setIsPinnedInput(prev => !prev)}
                  style={{
                    background: isPinnedInput ? `${colorTagInput}18` : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isPinnedInput ? `${colorTagInput}55` : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '8px',
                    padding: '0.35rem 0.65rem',
                    color: isPinnedInput ? colorTagInput : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Pin size={13} fill={isPinnedInput ? colorTagInput : 'none'} style={{ transform: isPinnedInput ? 'rotate(45deg)' : 'none' }} />
                  <span>{isPinnedInput ? 'Pinned' : 'Not Pinned'}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    padding: '0.45rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.5rem 1.15rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  className="btn-save-subtle"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>{submitting ? 'Creating…' : 'Create note'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Notes;
