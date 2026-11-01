import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Calendar, 
  History, 
  X,
  GripVertical,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const CustomDatePickerButton = ({ onSelectDate, buttonStyle, label = "Custom" }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(new Date());
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const buttonRef = React.useRef(null);

  const updatePosition = React.useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverHeight = 220;
      let top = rect.top - popoverHeight - 8;
      if (top < 10) {
        top = rect.bottom + 8;
      }
      let left = rect.left + rect.width / 2 - 110;
      left = Math.max(10, Math.min(left, window.innerWidth - 230));
      setCoords({ top, left });
    }
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  React.useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysGrid = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  const getFormattedDateString = (dayNum) => {
    const y = year;
    const m = String(month + 1).padStart(2, '0');
    const day = String(dayNum).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.2rem',
          cursor: 'pointer',
          background: isOpen ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
          border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
          borderRadius: '6px',
          padding: '0.12rem 0.4rem',
          fontSize: '0.65rem',
          color: isOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          ...buttonStyle
        }}
        title="Pick custom date"
      >
        <Calendar size={11} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{label}</span>
      </button>

      {isOpen && createPortal(
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 999998,
              background: 'transparent'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '220px',
              background: 'var(--bg-tertiary, #1e293b)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              borderRadius: '14px',
              padding: '0.65rem 0.75rem',
              boxShadow: '0 20px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.2)',
              zIndex: 999999,
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <ChevronLeft size={13} />
              </button>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {monthName}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <ChevronRight size={13} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '4px' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => (
                <span key={w} style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {w}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
              {daysGrid.map((dayNum, idx) => {
                if (dayNum === null) {
                  return <div key={`empty-${idx}`} />;
                }
                const dateStr = getFormattedDateString(dayNum);
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(dateStr);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '0.2rem 0',
                      borderRadius: '5px',
                      border: isToday ? '1px solid var(--accent-primary)' : 'none',
                      background: isToday ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      color: isToday ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontSize: '0.68rem',
                      fontWeight: isToday ? 800 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={(e) => {
                      if (!isToday) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isToday) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

const TaskHistory = () => {
  const { getAuthHeaders } = useAuth();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Kanban additions
  const [addingTaskColumn, setAddingTaskColumn] = useState(null);
  const [colTaskText, setColTaskText] = useState('');
  const [draggedOverDate, setDraggedOverDate] = useState(null);
  const [boardCenterOffset, setBoardCenterOffset] = useState(0);
  const [activeTooltip, setActiveTooltip] = useState(null); // { text, x, y }

  const handleTaskTextClick = (e, text, taskId = null, category = null, sourceDate = null) => {
    e.stopPropagation();
    setActiveTooltip({
      text,
      x: e.clientX,
      y: e.clientY,
      taskId,
      category,
      sourceDate
    });
  };

  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate 5 days columns centered on today + offset
  const today = new Date();
  const centerDate = new Date(today);
  centerDate.setDate(today.getDate() + boardCenterOffset);

  const columns = [];
  const todayStr = getLocalDateString(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);

  for (let i = -4; i <= 4; i++) {
    const d = new Date(centerDate);
    d.setDate(centerDate.getDate() + i);
    const dStr = getLocalDateString(d);
    
    let label = d.toLocaleDateString('en-US', { weekday: 'short' });
    if (dStr === todayStr) label = 'Today';
    else if (dStr === yesterdayStr) label = 'Yesterday';
    else if (dStr === tomorrowStr) label = 'Tomorrow';

    columns.push({
      dateStr: dStr,
      label,
      formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    });
  }

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/dashboard/history`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Failed to fetch history logs');
      }
      const json = await res.json();
      setHistoryData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e, taskId, category, sourceDate) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.setData('taskCategory', category);
    e.dataTransfer.setData('sourceDate', sourceDate);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    setDraggedOverDate(null);

    const taskId = e.dataTransfer.getData('taskId');
    const category = e.dataTransfer.getData('taskCategory');
    const sourceDate = e.dataTransfer.getData('sourceDate');

    if (!taskId || sourceDate === targetDate) return;

    // Optimistic UI Update
    setHistoryData(prev => {
      let movedTask = null;

      // 1. Remove from source date group
      const updated = prev.map(group => {
        if (group.date === sourceDate) {
          if (category === 'planDay') {
            movedTask = group.planDays.find(d => d.id === taskId);
            return { ...group, planDays: group.planDays.filter(d => d.id !== taskId) };
          } else {
            movedTask = group.normalTasks.find(t => t.id === taskId);
            return { ...group, normalTasks: group.normalTasks.filter(t => t.id !== taskId) };
          }
        }
        return group;
      });

      if (!movedTask) return prev;

      // 2. Add to target date group
      let targetGroupExists = false;
      const final = updated.map(group => {
        if (group.date === targetDate) {
          targetGroupExists = true;
          if (category === 'planDay') {
            return { ...group, planDays: [...group.planDays, { ...movedTask, date: targetDate }] };
          } else {
            return { ...group, normalTasks: [...group.normalTasks, { ...movedTask, date: targetDate }] };
          }
        }
        return group;
      });

      if (!targetGroupExists) {
        final.push({
          date: targetDate,
          planDays: category === 'planDay' ? [{ ...movedTask, date: targetDate }] : [],
          normalTasks: category === 'normalTask' ? [{ ...movedTask, date: targetDate }] : []
        });
      }

      return final;
    });

    // API update
    try {
      const endpoint = category === 'planDay' 
        ? `${API_BASE_URL}/api/plan/days/${taskId}` 
        : `${API_BASE_URL}/api/normal-tasks/${taskId}`;
      
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: targetDate })
      });

      if (!res.ok) {
        throw new Error('Failed to update task date');
      }
    } catch (err) {
      console.error('Error shifting task date:', err);
      fetchHistory(); // rollback
    }
  };

  const handleRescheduleTask = async (taskId, category, sourceDate, targetDate) => {
    if (!taskId || !targetDate || sourceDate === targetDate) return;

    // Optimistic UI Update
    setHistoryData(prev => {
      let movedTask = null;

      // 1. Remove from source date group
      const updated = prev.map(group => {
        if (group.date === sourceDate) {
          if (category === 'planDay') {
            movedTask = group.planDays.find(d => d.id === taskId);
            return { ...group, planDays: group.planDays.filter(d => d.id !== taskId) };
          } else {
            movedTask = group.normalTasks.find(t => t.id === taskId);
            return { ...group, normalTasks: group.normalTasks.filter(t => t.id !== taskId) };
          }
        }
        return group;
      });

      if (!movedTask) return prev;

      // 2. Add to target date group
      let targetGroupExists = false;
      const final = updated.map(group => {
        if (group.date === targetDate) {
          targetGroupExists = true;
          if (category === 'planDay') {
            return { ...group, planDays: [...group.planDays, { ...movedTask, date: targetDate }] };
          } else {
            return { ...group, normalTasks: [...group.normalTasks, { ...movedTask, date: targetDate }] };
          }
        }
        return group;
      });

      if (!targetGroupExists) {
        final.push({
          date: targetDate,
          planDays: category === 'planDay' ? [{ ...movedTask, date: targetDate }] : [],
          normalTasks: category === 'normalTask' ? [{ ...movedTask, date: targetDate }] : []
        });
      }

      return final;
    });

    // API update
    try {
      const endpoint = category === 'planDay' 
        ? `${API_BASE_URL}/api/plan/days/${taskId}` 
        : `${API_BASE_URL}/api/normal-tasks/${taskId}`;
      
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: targetDate })
      });

      if (!res.ok) {
        throw new Error('Failed to update task date');
      }
    } catch (err) {
      console.error('Error shifting task date:', err);
      fetchHistory(); // rollback
    }
  };

  const handleToggleTask = async (taskId, category, currentIsDone) => {
    try {
      const endpoint = category === 'planDay' 
        ? `${API_BASE_URL}/api/plan/days/${taskId}` 
        : `${API_BASE_URL}/api/normal-tasks/${taskId}`;
      
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isDone: !currentIsDone })
      });

      if (res.ok) {
        setHistoryData(prev => prev.map(group => ({
          ...group,
          planDays: group.planDays.map(d => d.id === taskId ? { ...d, isDone: !currentIsDone } : d),
          normalTasks: group.normalTasks.map(t => t.id === taskId ? { ...t, isDone: !currentIsDone } : t)
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId, category) => {
    if (category === 'planDay') return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/normal-tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        setHistoryData(prev => prev.map(group => ({
          ...group,
          normalTasks: group.normalTasks.filter(t => t.id !== taskId)
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddColTaskSubmit = async (dateStr) => {
    if (!colTaskText.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/normal-tasks`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: dateStr,
          text: colTaskText.trim()
        })
      });

      if (res.ok) {
        const newTask = await res.json();
        setHistoryData(prev => {
          let found = false;
          const updated = prev.map(group => {
            if (group.date === dateStr) {
              found = true;
              return { ...group, normalTasks: [...group.normalTasks, newTask] };
            }
            return group;
          });
          if (!found) {
            updated.push({
              date: dateStr,
              planDays: [],
              normalTasks: [newTask]
            });
          }
          return updated;
        });
        setColTaskText('');
        setAddingTaskColumn(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Loader text="Loading Jira Work Board..." />;
  }

  if (error) {
    return <div className="error-state">Error: {error}</div>;
  }

  return (
    <div className="jira-board-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minHeight: 'calc(100vh - 8rem)' }}>
      
      {/* Header Banner */}
      <header className="page-header tone-board">
        <div className="page-header-main">
          <div className="page-header-icon">
            <History size={20} />
          </div>
          <div>
            <h1 className="page-header-title">Work board</h1>
            <p className="page-header-subtitle">Drag tasks between days to reschedule them</p>
          </div>
        </div>
      </header>

      {/* Board columns container */}
      <div 
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        style={{ 
          display: 'flex', 
          flexDirection: 'row',
          gap: '1.25rem', 
          overflowX: 'auto', 
          paddingTop: '0.65rem',
          paddingBottom: '1rem',
          paddingLeft: '0.35rem',
          paddingRight: '0.35rem',
          flex: 1,
          alignItems: 'stretch',
          width: '100%'
        }}
      >
        {columns.map(col => {
          const isColToday = col.dateStr === getLocalDateString();
          const dayGroup = historyData.find(g => g.date === col.dateStr) || { planDays: [], normalTasks: [] };
          const isOver = draggedOverDate === col.dateStr;

          return (
            <div 
              key={col.dateStr}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setDraggedOverDate(col.dateStr)}
              onDrop={(e) => handleDrop(e, col.dateStr)}
              className="glass-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '1.1rem 0.9rem',
                background: isColToday 
                  ? 'rgba(99, 102, 241, 0.02)' 
                  : isOver 
                  ? 'rgba(255, 255, 255, 0.03)' 
                  : 'rgba(255, 255, 255, 0.01)',
                border: isColToday 
                  ? '1px solid rgba(99, 102, 241, 0.25)' 
                  : isOver
                  ? '1px solid var(--accent-primary)'
                  : '1px solid var(--border-light)',
                borderRadius: '16px',
                flex: '1 0 250px',
                minHeight: '480px',
                transition: 'all 0.2s ease',
                boxShadow: isColToday ? '0 10px 30px rgba(99, 102, 241, 0.03)' : 'none'
              }}
            >
              {/* Column Header */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline', 
                  borderBottom: '1px solid var(--border-light)', 
                  paddingBottom: '0.65rem',
                  marginBottom: '1rem',
                  flexShrink: 0
                }}
              >
                <span style={{ 
                  fontWeight: 600, 
                  fontSize: '0.9rem', 
                  color: isColToday ? 'var(--accent-primary)' : 'var(--text-primary)' 
                }}>
                  {col.label}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {col.formattedDate}
                </span>
              </div>

              {/* Tasks List area */}
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.75rem', 
                  flex: 1, 
                  overflowY: 'auto',
                  paddingTop: '0.4rem',
                  paddingBottom: '0.4rem',
                  paddingRight: '4px',
                  minHeight: '100px'
                }}
              >
                {dayGroup.planDays.length === 0 && dayGroup.normalTasks.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', opacity: 0.5, gap: '0.25rem', padding: '2rem 0' }}>
                    <Calendar size={24} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>No tasks</span>
                  </div>
                )}

                {/* Planner Days */}
                {dayGroup.planDays.map(day => (
                  <div 
                    key={day.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, day.id, 'planDay', col.dateStr)}
                    className="task-item-dashboard"
                    style={{
                      padding: '0.65rem 0.8rem',
                      background: day.isDone ? 'rgba(255,255,255,0.005)' : 'rgba(255,255,255,0.015)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      cursor: 'grab',
                      transition: 'all 0.2s'
                    }}
                  >
                    <GripVertical 
                      size={13} 
                      style={{ color: 'var(--text-muted)', marginTop: '4px', opacity: 0.4, cursor: 'grab', flexShrink: 0 }} 
                    />
                    
                    <button 
                      onClick={() => handleToggleTask(day.id, 'planDay', day.isDone)}
                      className={`mirror-checkbox ${day.isDone ? 'checked-plan' : ''}`}
                      style={{ '--tone': day.planWeek?.plan?.color || 'var(--mod-plans)' }}
                      style={{ width: '22px', height: '22px', flexShrink: 0, marginTop: '2px' }}
                    >
                      {day.isDone ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <Circle size={11} style={{ opacity: 0.3 }} />
                      )}
                    </button>

                    <div style={{ flex: 1 }}>
                      <span className="badge plan-badge" style={{ '--tone': day.planWeek?.plan?.color || 'var(--mod-plans)', marginBottom: '0.2rem', display: 'inline-block' }}>
                        {day.planWeek?.plan?.name || day.track}
                      </span>
                      <p 
                        onClick={(e) => handleTaskTextClick(e, day.topic, day.id, 'planDay', col.dateStr)}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          lineHeight: '1.35',
                          color: day.isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: day.isDone ? 'line-through' : 'none',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer'
                        }}
                        title="Click to view details and reschedule options"
                      >
                        {day.topic}
                      </p>

                      {col.dateStr < todayStr && !day.isDone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.45rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRescheduleTask(day.id, 'planDay', col.dateStr, todayStr);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              background: 'rgba(99, 102, 241, 0.08)',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              borderRadius: '6px',
                              padding: '0.12rem 0.4rem',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              color: 'var(--accent-primary)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title="Reschedule task to Today"
                          >
                            <span>→ Today</span>
                          </button>

                          <CustomDatePickerButton 
                            onSelectDate={(dateVal) => handleRescheduleTask(day.id, 'planDay', col.dateStr, dateVal)} 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Normal Tasks */}
                {dayGroup.normalTasks.map(task => (
                  <div 
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id, 'normalTask', col.dateStr)}
                    className="task-item-dashboard"
                    style={{
                      padding: '0.65rem 0.8rem',
                      background: task.isDone ? 'rgba(255,255,255,0.005)' : 'rgba(255,255,255,0.015)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      cursor: 'grab',
                      transition: 'all 0.2s'
                    }}
                  >
                    <GripVertical 
                      size={13} 
                      style={{ color: 'var(--text-muted)', marginTop: '4px', opacity: 0.4, cursor: 'grab', flexShrink: 0 }} 
                    />
                    
                    <button 
                      onClick={() => handleToggleTask(task.id, 'normalTask', task.isDone)}
                      className={`mirror-checkbox ${task.isDone ? 'checked-gen' : ''}`}
                      style={{ width: '22px', height: '22px', flexShrink: 0, marginTop: '2px' }}
                    >
                      {task.isDone ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <Circle size={11} style={{ opacity: 0.3 }} />
                      )}
                    </button>

                    <div style={{ flex: 1 }}>
                      <span className="badge" style={{ fontSize: '0.55rem', padding: '0.05rem 0.3rem', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-primary)', borderColor: 'rgba(99, 102, 241, 0.15)', marginBottom: '0.2rem', display: 'inline-block' }}>
                        Gen
                      </span>
                      <p 
                        onClick={(e) => handleTaskTextClick(e, task.text, task.id, 'normalTask', col.dateStr)}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          lineHeight: '1.35',
                          color: task.isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: task.isDone ? 'line-through' : 'none',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer'
                        }}
                        title="Click to view details and reschedule options"
                      >
                        {task.text}
                      </p>

                      {col.dateStr < todayStr && !task.isDone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.45rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRescheduleTask(task.id, 'normalTask', col.dateStr, todayStr);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              background: 'rgba(99, 102, 241, 0.08)',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              borderRadius: '6px',
                              padding: '0.12rem 0.4rem',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              color: 'var(--accent-primary)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title="Reschedule task to Today"
                          >
                            <span>→ Today</span>
                          </button>

                          <CustomDatePickerButton 
                            onSelectDate={(dateVal) => handleRescheduleTask(task.id, 'normalTask', col.dateStr, dateVal)} 
                          />
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => handleDeleteTask(task.id, 'normalTask')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s ease', padding: '2px', alignSelf: 'flex-start' }}
                      className="btn-trash-hover"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Task input area */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.65rem', marginTop: '0.65rem', flexShrink: 0 }}>
                {addingTaskColumn === col.dateStr ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Task description..."
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px' }}
                      value={colTaskText}
                      onChange={(e) => setColTaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddColTaskSubmit(col.dateStr);
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => {
                          setAddingTaskColumn(null);
                          setColTaskText('');
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                      <button 
                        className="mirror-btn-pill dsa-submit"
                        onClick={() => handleAddColTaskSubmit(col.dateStr)}
                        style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem' }}
                      >
                        <span style={{ fontWeight: 600 }}>Add</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTaskColumn(col.dateStr)}
                    style={{ 
                      width: '100%', 
                      background: 'rgba(255, 255, 255, 0.01)', 
                      border: '1px dashed var(--border-light)', 
                      borderRadius: '8px', 
                      padding: '0.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '4px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <Plus size={12} />
                    <span style={{ fontWeight: 600 }}>Create Task</span>
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {activeTooltip && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9998,
              background: 'transparent'
            }}
            onClick={() => setActiveTooltip(null)}
          />
          <div 
            style={{
              position: 'fixed',
              top: Math.min(activeTooltip.y + 12, window.innerHeight - 220),
              left: Math.min(activeTooltip.x + 12, window.innerWidth - 340),
              maxWidth: '320px',
              background: 'var(--bg-tertiary, #1e293b)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              borderRadius: '12px',
              padding: '0.85rem 1.1rem',
              color: 'var(--text-primary)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              fontSize: '0.8rem',
              lineHeight: '1.45',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              animation: 'fadeIn 0.12s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>Full Task Description</span>
              <button 
                onClick={() => setActiveTooltip(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <X size={12} />
              </button>
            </div>
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary)' }}>{activeTooltip.text}</p>

            {activeTooltip.taskId && (
              <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>Reschedule:</span>
                {activeTooltip.sourceDate !== todayStr && (
                  <button
                    onClick={() => {
                      handleRescheduleTask(activeTooltip.taskId, activeTooltip.category, activeTooltip.sourceDate, todayStr);
                      setActiveTooltip(null);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '6px',
                      padding: '0.15rem 0.45rem',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    title="Reschedule task to Today"
                  >
                    <span>→ Today</span>
                  </button>
                )}
                
                <CustomDatePickerButton 
                  label="Custom Date"
                  buttonStyle={{ padding: '0.15rem 0.45rem', fontSize: '0.68rem' }}
                  onSelectDate={(dateVal) => {
                    handleRescheduleTask(activeTooltip.taskId, activeTooltip.category, activeTooltip.sourceDate, dateVal);
                    setActiveTooltip(null);
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
};

export default TaskHistory;
