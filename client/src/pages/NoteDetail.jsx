import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  ArrowLeft,
  FileText,
  ListTodo,
  Check,
  Pin,
  Trash2,
  Lock,
  Globe,
  AlertCircle,
  Clock,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  RemoveFormatting,
  GripVertical,
  Plus,
  X
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

const NoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders, privacyMode } = useAuth();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editable state
  const [title, setTitle] = useState('');
  const [colorTag, setColorTag] = useState('#eab308');
  const [isPersonal, setIsPersonal] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [toastMessage, setToastMessage] = useState(null);

  // Todo Drag & Drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Rich Text Editor Ref
  const editorRef = useRef(null);
  const contentRef = useRef('');
  const isInitialLoadedRef = useRef(false);

  // Auto-save refs
  const titleRef = useRef(title);
  const colorTagRef = useRef(colorTag);
  const isPersonalRef = useRef(isPersonal);
  const isPinnedRef = useRef(isPinned);
  const checklistRef = useRef(checklist);
  const pendingChangesRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { colorTagRef.current = colorTag; }, [colorTag]);
  useEffect(() => { isPersonalRef.current = isPersonal; }, [isPersonal]);
  useEffect(() => { isPinnedRef.current = isPinned; }, [isPinned]);
  useEffect(() => { checklistRef.current = checklist; }, [checklist]);

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

  // Fetch single note by ID
  useEffect(() => {
    let isMounted = true;
    const fetchNote = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
          headers: getAuthHeaders()
        });

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Note not found or has been deleted.');
          }
          throw new Error('Failed to load note');
        }

        const data = await res.json();
        if (!isMounted) return;

        setNote(data);
        setTitle(data.title || '');
        titleRef.current = data.title || '';
        setColorTag(data.colorTag || '#eab308');
        colorTagRef.current = data.colorTag || '#eab308';
        setIsPersonal(Boolean(data.isPersonal));
        isPersonalRef.current = Boolean(data.isPersonal);
        setIsPinned(Boolean(data.isPinned));
        isPinnedRef.current = Boolean(data.isPinned);

        // Parse checklist if todo
        let parsedChecklist = [];
        if (Array.isArray(data.checklist)) {
          parsedChecklist = data.checklist;
        } else if (typeof data.checklist === 'string' && data.checklist.trim()) {
          try {
            parsedChecklist = JSON.parse(data.checklist);
          } catch (e) {
            parsedChecklist = [];
          }
        }
        if (data.type === 'todo' && parsedChecklist.length === 0) {
          parsedChecklist = [{ id: `item_${Date.now()}`, text: '', isDone: false }];
        }
        setChecklist(parsedChecklist);
        checklistRef.current = parsedChecklist;

        // Initial HTML for rich editor
        const rawContent = data.content || '';
        let initialHtml = '';
        if (rawContent) {
          // If content already contains HTML tags
          if (rawContent.includes('<') && rawContent.includes('>')) {
            initialHtml = DOMPurify.sanitize(rawContent);
          } else {
            // Raw text or markdown: convert to formatted HTML
            const parsed = marked.parse(rawContent);
            initialHtml = DOMPurify.sanitize(parsed);
          }
        }
        contentRef.current = initialHtml;

        // Set initial HTML once editorRef is available
        setTimeout(() => {
          if (editorRef.current && !isInitialLoadedRef.current) {
            editorRef.current.innerHTML = initialHtml;
            isInitialLoadedRef.current = true;
          }
        }, 50);

      } catch (err) {
        if (!isMounted) return;
        console.error(err);
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchNote();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Perform actual save to backend
  const performSave = useCallback(async () => {
    if (!id) return;
    const currentTitle = titleRef.current;
    if (!currentTitle || !currentTitle.trim()) return;

    setSaveStatus('saving');

    try {
      const payload = {
        title: currentTitle.trim(),
        colorTag: colorTagRef.current,
        isPersonal: isPersonalRef.current,
        isPinned: isPinnedRef.current
      };

      if (note?.type === 'todo') {
        payload.checklist = checklistRef.current;
      } else {
        payload.content = editorRef.current ? editorRef.current.innerHTML : contentRef.current;
      }

      const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to auto-save');
      }

      const updated = await res.json();
      setNote(updated);
      pendingChangesRef.current = false;
      setSaveStatus('saved');
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveStatus('error');
    }
  }, [id, note?.type, getAuthHeaders]);

  // Schedule auto-save on edit with debounce (750ms)
  const scheduleAutoSave = useCallback(() => {
    pendingChangesRef.current = true;
    setSaveStatus('saving');
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      performSave();
    }, 750);
  }, [performSave]);

  // Flush pending save on navigating back
  const handleBack = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    if (pendingChangesRef.current) {
      await performSave();
    }
    navigate('/notes');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (pendingChangesRef.current) {
        performSave();
      }
    };
  }, [performSave]);

  // Handle rich editor input (auto-saves on typing)
  const handleEditorInput = () => {
    if (editorRef.current) {
      contentRef.current = editorRef.current.innerHTML;
      scheduleAutoSave();
    }
  };

  // Paste handler: handles markdown text and formatted doc text
  const handleEditorPaste = (e) => {
    e.preventDefault();
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    // Check if pasted plain text contains markdown patterns (#, ##, **, -, 1., `, >)
    const hasMarkdownPatterns = /^(\s*#{1,6}\s+|\s*[-*+]\s+|\s*\d+\.\s+|```|> )|(\*\*[^*]+\*\*)|(__[^_]+__)|(`[^`]+`)/m.test(textData);

    let contentToInsert = '';

    if (hasMarkdownPatterns && textData) {
      // Parse markdown to HTML
      const parsed = marked.parse(textData);
      contentToInsert = DOMPurify.sanitize(parsed);
    } else if (htmlData) {
      // Clean HTML from Google Docs / Word / Web by removing messy inline styles while keeping semantic tags
      const cleaned = DOMPurify.sanitize(htmlData, {
        ALLOWED_TAGS: [
          'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
          'strong', 'b', 'em', 'i', 'u', 's', 'strike', 
          'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'br', 'hr', 'a', 'span'
        ],
        ALLOWED_ATTR: ['href', 'target']
      });
      contentToInsert = cleaned;
    } else if (textData) {
      // Plain text: split into clean paragraphs
      const paragraphs = textData
        .split(/\r?\n\r?\n/)
        .map(p => `<p>${p.replace(/\r?\n/g, '<br>')}</p>`)
        .join('');
      contentToInsert = paragraphs || `<p>${textData}</p>`;
    }

    if (contentToInsert) {
      document.execCommand('insertHTML', false, contentToInsert);
      handleEditorInput();
    }
  };

  // Toolbar action helper
  const execCmd = (cmd, val = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(cmd, false, val);
    handleEditorInput();
  };

  // Notion-style Todo Handlers
  const handleInsertChecklistItem = (afterIndex = -1) => {
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: '',
      isDone: false
    };

    setChecklist(prev => {
      let next;
      if (afterIndex < 0 || afterIndex >= prev.length) {
        next = [...prev, newItem];
      } else {
        next = [...prev];
        next.splice(afterIndex + 1, 0, newItem);
      }
      checklistRef.current = next;
      scheduleAutoSave();
      return next;
    });

    setTimeout(() => {
      const inputs = document.querySelectorAll('.notion-todo-input');
      const targetIdx = afterIndex < 0 ? inputs.length - 1 : afterIndex + 1;
      if (inputs[targetIdx]) {
        inputs[targetIdx].focus();
      }
    }, 30);
  };

  const handleToggleChecklistItem = (itemId) => {
    setChecklist(prev => {
      const next = prev.map(item =>
        item.id === itemId ? { ...item, isDone: !item.isDone } : item
      );
      checklistRef.current = next;
      scheduleAutoSave();
      return next;
    });
  };

  const handleUpdateChecklistItemText = (itemId, newText) => {
    setChecklist(prev => {
      const next = prev.map(item =>
        item.id === itemId ? { ...item, text: newText } : item
      );
      checklistRef.current = next;
      scheduleAutoSave();
      return next;
    });
  };

  const handleDeleteChecklistItem = (itemId, idx = -1) => {
    setChecklist(prev => {
      const filtered = prev.filter(item => item.id !== itemId);
      const next = filtered.length > 0 ? filtered : [{ id: `item_${Date.now()}`, text: '', isDone: false }];
      checklistRef.current = next;
      scheduleAutoSave();
      return next;
    });

    if (idx > 0) {
      setTimeout(() => {
        const inputs = document.querySelectorAll('.notion-todo-input');
        if (inputs[idx - 1]) {
          inputs[idx - 1].focus();
        }
      }, 30);
    }
  };

  const handleTodoKeyDown = (e, idx, item) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInsertChecklistItem(idx);
    } else if (e.key === 'Backspace' && item.text === '' && checklist.length > 1) {
      e.preventDefault();
      handleDeleteChecklistItem(item.id, idx);
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      const inputs = document.querySelectorAll('.notion-todo-input');
      if (inputs[idx - 1]) inputs[idx - 1].focus();
    } else if (e.key === 'ArrowDown' && idx < checklist.length - 1) {
      e.preventDefault();
      const inputs = document.querySelectorAll('.notion-todo-input');
      if (inputs[idx + 1]) inputs[idx + 1].focus();
    }
  };

  // Todo Drag & Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', index.toString());
    } catch (err) {}
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setChecklist(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, moved);
      checklistRef.current = next;
      scheduleAutoSave();
      return next;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Pin toggle with max 3 check
  const handleTogglePin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${id}/pin`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errData = await res.json();
        showToast(errData.error || 'Failed to update pin');
        return;
      }

      const updated = await res.json();
      setIsPinned(Boolean(updated.isPinned));
      showToast(updated.isPinned ? 'Note pinned to top' : 'Note unpinned');
    } catch (err) {
      console.error(err);
      showToast('Error updating pin status');
    }
  };

  // Delete note
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete note');
      navigate('/notes');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete note');
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to save immediately
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        performSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performSave]);

  if (loading) {
    return <Loader text="Loading Note..." />;
  }

  if (error || !note) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1.25rem' }}>
        <div style={{ color: 'var(--text-muted)' }}>
          <AlertCircle size={40} color="#ff3b30" />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{error || 'Note not found'}</h2>
        <button
          onClick={() => navigate('/notes')}
          className="note-detail-back-btn"
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Notes</span>
        </button>
      </div>
    );
  }

  // If in office mode and this is a personal note, hide and prompt
  if (privacyMode && isPersonal) {
    return (
      <div className="glass-card" style={{ maxWidth: '600px', margin: '4rem auto', padding: '3rem 2rem', textAlign: 'center', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(234, 179, 8, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308' }}>
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Personal Note Locked</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
          This note belongs to your <strong>Personal Workspace</strong>. Switch from Office space to Personal space using the lock icon in the sidebar to view and edit this note.
        </p>
        <button
          onClick={() => navigate('/notes')}
          className="note-detail-back-btn"
          style={{ marginTop: '0.5rem', padding: '0.6rem 1.35rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Notes Listing</span>
        </button>
      </div>
    );
  }

  const isTodo = note.type === 'todo';
  const completedTodoCount = checklist.filter(i => i.isDone && i.text.trim()).length;
  const totalTodoCount = checklist.filter(i => i.text.trim()).length;

  return (
    <div 
      className="note-detail-page" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.5rem', 
        width: '100%', 
        minHeight: 'calc(100vh - 8rem)', 
        paddingBottom: '4rem' 
      }}
    >
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
            fontWeight: 650,
            animation: 'medToastSlideInTop 0.25s ease forwards'
          }}
        >
          <AlertCircle size={17} color="#ff2d55" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation & Action Header */}
      <div
        className="glass-card"
        style={{
          padding: '1rem 1.6rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderRadius: '18px',
          border: `1px solid ${colorTag}28`
        }}
      >
        {/* Left: Back button & Note Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            onClick={handleBack}
            className="note-detail-back-btn"
            title="Return to notes listing"
          >
            <ArrowLeft size={16} />
            <span>Notes</span>
          </button>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.08)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: `${colorTag}18`,
                border: `1px solid ${colorTag}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colorTag
              }}
            >
              {isTodo ? <ListTodo size={16} /> : <FileText size={16} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <Clock size={12} />
              <span>{formatRelativeTime(note.updatedAt || note.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Right: Editable Workspace Toggle, Color Tag, Pin, Delete, Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* Workspace Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsPersonal(prev => {
                const next = !prev;
                isPersonalRef.current = next;
                scheduleAutoSave();
                return next;
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.42rem 0.85rem',
              borderRadius: '9px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: isPersonal ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isPersonal ? 'rgba(234, 179, 8, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              color: isPersonal ? '#fbbf24' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
            title={isPersonal ? 'Currently in Personal Workspace (Private)' : 'Currently in Office Workspace (Shared)'}
          >
            {isPersonal ? <Lock size={13} /> : <Globe size={13} />}
            <span>{isPersonal ? 'Personal' : 'Office'}</span>
          </button>

          {/* Color Tag Picker Palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.3rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {TAG_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColorTag(c);
                  colorTagRef.current = c;
                  scheduleAutoSave();
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: c,
                  border: colorTag === c ? '2px solid #ffffff' : '1.5px solid transparent',
                  boxShadow: colorTag === c ? `0 0 10px ${c}` : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transform: colorTag === c ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.15s ease'
                }}
                title={c}
              />
            ))}
          </div>

          {/* Pin Button */}
          <button
            type="button"
            onClick={handleTogglePin}
            style={{
              background: isPinned ? `${colorTag}18` : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isPinned ? `${colorTag}55` : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '9px',
              padding: '0.45rem 0.65rem',
              color: isPinned ? colorTag : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              fontWeight: 650,
              transition: 'all 0.2s ease'
            }}
            title={isPinned ? 'Unpin note' : 'Pin note to top'}
          >
            <Pin size={13} fill={isPinned ? colorTag : 'none'} style={{ transform: isPinned ? 'rotate(45deg)' : 'none' }} />
            <span>{isPinned ? 'Pinned' : 'Pin'}</span>
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 59, 48, 0.2)',
              borderRadius: '9px',
              padding: '0.45rem 0.65rem',
              color: '#ff3b30',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              fontWeight: 650,
              transition: 'all 0.2s ease'
            }}
            className="note-delete-hover"
            title="Delete this note"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          {/* Auto-save Status Indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.78rem',
              fontWeight: 650,
              padding: '0.45rem 0.8rem',
              borderRadius: '9px',
              background: saveStatus === 'saving' 
                ? 'rgba(234, 179, 8, 0.12)' 
                : saveStatus === 'error'
                ? 'rgba(255, 59, 48, 0.12)'
                : 'rgba(255, 255, 255, 0.035)',
              color: saveStatus === 'saving'
                ? '#fbbf24'
                : saveStatus === 'error'
                ? '#ff453a'
                : 'var(--text-muted)',
              border: '1px solid',
              borderColor: saveStatus === 'saving'
                ? 'rgba(234, 179, 8, 0.28)'
                : saveStatus === 'error'
                ? 'rgba(255, 59, 48, 0.28)'
                : 'rgba(255, 255, 255, 0.06)',
              transition: 'all 0.2s ease',
              userSelect: 'none'
            }}
            title={saveStatus === 'saving' ? 'Saving changes...' : saveStatus === 'error' ? 'Failed to auto-save' : 'All changes saved automatically'}
          >
            {saveStatus === 'saving' ? (
              <>
                <span className="save-pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle size={13} color="#ff453a" />
                <span>Save failed</span>
              </>
            ) : (
              <>
                <Check size={13} strokeWidth={2.8} color="#10b981" />
                <span style={{ color: 'var(--text-secondary)' }}>Saved</span>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Main Note Canvas Card */}
      <div
        className="glass-card"
        style={{
          '--note-accent': colorTag,
          borderRadius: '22px',
          padding: '2.25rem 2.75rem',
          border: `1px solid ${colorTag}33`,
          boxShadow: `0 18px 45px rgba(0, 0, 0, 0.4), 0 0 25px ${colorTag}15`,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          minHeight: '650px',
          background: 'linear-gradient(135deg, rgba(20, 22, 32, 0.94) 0%, rgba(13, 14, 20, 0.96) 100%)'
        }}
      >
        {/* Heading Input Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: `2px solid ${colorTag}44`, paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: colorTag, display: 'flex', alignItems: 'center' }}>
              {isTodo ? <ListTodo size={26} /> : <FileText size={26} />}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                titleRef.current = e.target.value;
                scheduleAutoSave();
              }}
              placeholder="Note Heading..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                fontSize: '1.75rem',
                fontWeight: 850,
                color: 'var(--text-primary)',
                outline: 'none',
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-sans)',
                padding: '0.2rem 0'
              }}
            />
          </div>
        </div>

        {/* Content Body: Rich Formatted Editor Canvas OR Notion-Style Todo Canvas */}
        {isTodo ? (
          /* Todo Checklist Mode */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header info / Clear Completed */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 750,
                    color: totalTodoCount > 0 && completedTodoCount === totalTodoCount ? '#34d399' : 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Check size={11} strokeWidth={3} />
                  <span>{completedTodoCount}/{totalTodoCount} completed</span>
                </span>
              </div>

              {checklist.some(i => i.isDone) && (
                <button
                  type="button"
                  onClick={() => setChecklist(prev => {
                    const remaining = prev.filter(i => !i.isDone);
                    const next = remaining.length > 0 ? remaining : [{ id: `item_${Date.now()}`, text: '', isDone: false }];
                    checklistRef.current = next;
                    scheduleAutoSave();
                    return next;
                  })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Clear completed items
                </button>
              )}
            </div>

            {/* Checklist items list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {checklist.map((item, idx) => (
                <div
                  key={item.id}
                  className="notion-todo-row"
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '8px',
                    transition: 'all 0.15s ease',
                    opacity: draggedIndex === idx ? 0.35 : 1,
                    borderTop: dragOverIndex === idx && draggedIndex !== null && draggedIndex > idx ? `2px solid ${colorTag}` : '2px solid transparent',
                    borderBottom: dragOverIndex === idx && draggedIndex !== null && draggedIndex < idx ? `2px solid ${colorTag}` : '2px solid transparent',
                    background: dragOverIndex === idx && draggedIndex !== null && draggedIndex !== idx ? 'rgba(255, 255, 255, 0.05)' : undefined
                  }}
                >
                  {/* Grip Handle */}
                  <div
                    className="notion-todo-drag-handle"
                    style={{
                      cursor: 'grab',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.25,
                      transition: 'opacity 0.15s ease',
                      padding: '2px',
                      flexShrink: 0
                    }}
                    title="Drag to reorder"
                  >
                    <GripVertical size={14} />
                  </div>

                  {/* Checkbox button */}
                  <button
                    type="button"
                    onClick={() => handleToggleChecklistItem(item.id)}
                    style={{
                      background: item.isDone ? colorTag : 'transparent',
                      border: `1.5px solid ${item.isDone ? colorTag : 'rgba(255, 255, 255, 0.3)'}`,
                      borderRadius: '5px',
                      width: '19px',
                      height: '19px',
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
                    {item.isDone && <Check size={12} color="#ffffff" strokeWidth={3.5} />}
                  </button>

                  {/* Todo text input */}
                  <input
                    type="text"
                    className="notion-todo-input"
                    value={item.text}
                    onChange={(e) => handleUpdateChecklistItemText(item.id, e.target.value)}
                    onKeyDown={(e) => handleTodoKeyDown(e, idx, item)}
                    placeholder="To-do item..."
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: item.isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: item.isDone ? 'line-through' : 'none',
                      fontSize: '1rem',
                      lineHeight: 1.5,
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                      padding: '0.2rem 0'
                    }}
                  />

                  {/* Delete Item */}
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklistItem(item.id, idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      opacity: 0.3,
                      transition: 'opacity 0.15s ease'
                    }}
                    className="notion-todo-delete-btn"
                    title="Delete item"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}

              {/* Notion-style "+ Add a to-do..." trigger */}
              <button
                type="button"
                onClick={() => handleInsertChecklistItem(checklist.length - 1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.45rem 0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.92rem',
                  marginTop: '0.4rem',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                className="notion-add-todo-row"
              >
                <div style={{
                  width: '19px',
                  height: '19px',
                  borderRadius: '5px',
                  border: '1.5px dashed rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Plus size={12} color="var(--text-muted)" />
                </div>
                <span>Add a to-do... (or press Enter)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Plain Note Mode: Formatted Rich Text Editor */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Formatting Toolbar */}
            <div className="editor-toolbar">
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('bold')}
                title="Bold (Ctrl+B)"
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('italic')}
                title="Italic (Ctrl+I)"
              >
                <Italic size={15} />
              </button>
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('underline')}
                title="Underline (Ctrl+U)"
              >
                <Underline size={15} />
              </button>
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('strikeThrough')}
                title="Strikethrough"
              >
                <Strikethrough size={15} />
              </button>

              <div className="editor-toolbar-separator" />

              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('formatBlock', '<h1>')}
                title="Heading 1"
              >
                <Heading1 size={16} />
              </button>
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('formatBlock', '<h2>')}
                title="Heading 2"
              >
                <Heading2 size={16} />
              </button>
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('formatBlock', '<h3>')}
                title="Heading 3"
              >
                <Heading3 size={16} />
              </button>

              <div className="editor-toolbar-separator" />

              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('insertUnorderedList')}
                title="Bullet List"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('insertOrderedList')}
                title="Numbered List"
              >
                <ListOrdered size={16} />
              </button>

              <div className="editor-toolbar-separator" />

              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('formatBlock', '<blockquote>')}
                title="Blockquote"
              >
                <Quote size={15} />
              </button>
              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('formatBlock', '<pre>')}
                title="Code Block"
              >
                <Code size={15} />
              </button>

              <div className="editor-toolbar-separator" />

              <button
                type="button"
                className="editor-toolbar-btn"
                onClick={() => execCmd('removeFormat')}
                title="Clear Formatting"
              >
                <RemoveFormatting size={15} />
              </button>
            </div>

            {/* Rich ContentEditable Canvas */}
            <div
              ref={editorRef}
              className="rich-editor-canvas custom-modal-scrollbar"
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              data-placeholder="Start typing your note here, or paste formatted text from markdown or docs..."
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default NoteDetail;
