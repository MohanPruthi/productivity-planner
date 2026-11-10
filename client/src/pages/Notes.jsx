import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Clock
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

const Notes = () => {
  const navigate = useNavigate();
  const { getAuthHeaders, privacyMode } = useAuth();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Separate pinned and unpinned notes
  const { pinnedNotes, unpinnedNotes } = useMemo(() => {
    const pinned = [];
    const unpinned = [];
    visibleNotes.forEach(n => {
      if (n.isPinned) pinned.push(n);
      else unpinned.push(n);
    });
    return { pinnedNotes: pinned, unpinnedNotes: unpinned };
  }, [visibleNotes]);

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
      setNotes(prev => prev.filter(n => n.id !== noteId));
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

  if (loading) {
    return <Loader text="Loading Notes..." />;
  }

  if (error) {
    return <div className="error-state">Error: {error}</div>;
  }

  const renderNoteCard = (note) => {
    const cardColor = note.colorTag || '#eab308';
    const isTodo = note.type === 'todo';
    const checklist = Array.isArray(note.checklist) ? note.checklist : [];
    const completedCount = checklist.filter(i => i.isDone).length;
    const totalCount = checklist.length;

    return (
      <div
        key={note.id}
        onClick={() => navigate(`/note/${note.id}`)}
        className="glass-card note-card-curved"
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
          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-control"
              style={{
                paddingLeft: '2.3rem',
                paddingRight: '0.85rem',
                paddingTop: '0.55rem',
                paddingBottom: '0.55rem',
                fontSize: '0.85rem',
                borderRadius: '10px',
                width: '190px'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex'
                }}
              >
                <X size={13} />
              </button>
            )}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
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
                {pinnedNotes.map(renderNoteCard)}
              </div>
            </div>
          )}

          {/* Others / Unpinned Notes Section */}
          {unpinnedNotes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pinnedNotes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Others
                  </h2>
                </div>
              )}
              <div className="notes-3col-grid">
                {unpinnedNotes.map(renderNoteCard)}
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
