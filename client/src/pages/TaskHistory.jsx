import React, { useState, useEffect } from 'react';
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

  const handleTaskTextClick = (e, text) => {
    e.stopPropagation();
    setActiveTooltip({
      text,
      x: e.clientX,
      y: e.clientY
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

  for (let i = -2; i <= 2; i++) {
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

  return (
    <div className="jira-board-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minHeight: 'calc(100vh - 8rem)' }}>
      
      {/* Header Banner */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '1.25rem 2rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          boxShadow: '0 10px 30px rgba(255,255,255,0.01), inset 0 1px 0 rgba(255,255,255,0.02)',
          borderRadius: '16px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.15)'
          }}>
            <History size={22} color="var(--accent-primary)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Work <span className="gradient-text">Board</span>
              </h1>
              
              {/* Navigation controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '9999px', padding: '0.15rem 0.4rem', border: '1px solid rgba(255, 255, 255, 0.05)', userSelect: 'none' }}>
                <button
                  onClick={() => setBoardCenterOffset(prev => prev - 1)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  className="nav-arrow-btn"
                  title="Navigate back 1 day"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {boardCenterOffset !== 0 && (
                  <button
                    onClick={() => setBoardCenterOffset(0)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      padding: '0 0.4rem',
                      transition: 'all 0.2s ease',
                    }}
                    title="Jump back to Today"
                  >
                    Today
                  </button>
                )}
                
                <button
                  onClick={() => setBoardCenterOffset(prev => prev + 1)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  className="nav-arrow-btn"
                  title="Navigate forward 1 day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', fontSize: '0.8rem' }}>
              Drag and drop tasks between days to reschedule them
            </p>
          </div>
        </div>
      </div>

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
          paddingBottom: '1rem',
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
                  fontWeight: 800, 
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
                      className={`mirror-checkbox ${day.isDone ? (day.track === 'AI' ? 'checked-ai' : 'checked-sd') : ''}`}
                      style={{ width: '22px', height: '22px', flexShrink: 0, marginTop: '2px' }}
                    >
                      {day.isDone ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <Circle size={11} style={{ opacity: 0.3 }} />
                      )}
                    </button>

                    <div style={{ flex: 1 }}>
                      <span className={`badge ${day.track === 'AI' ? 'badge-ai' : 'badge-sd'}`} style={{ fontSize: '0.55rem', padding: '0.05rem 0.3rem', marginBottom: '0.2rem', display: 'inline-block' }}>
                        {day.track}
                      </span>
                      <p 
                        onClick={(e) => {
                          if (day.topic.length > 80) {
                            handleTaskTextClick(e, day.topic);
                          }
                        }}
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
                          cursor: day.topic.length > 80 ? 'pointer' : 'default'
                        }}
                        title={day.topic.length > 80 ? 'Click to show full description' : ''}
                      >
                        {day.topic}
                      </p>
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
                      <span className="badge" style={{ fontSize: '0.55rem', padding: '0.05rem 0.3rem', background: 'rgba(249, 115, 22, 0.08)', color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.15)', marginBottom: '0.2rem', display: 'inline-block' }}>
                        Gen
                      </span>
                      <p 
                        onClick={(e) => {
                          if (task.text.length > 80) {
                            handleTaskTextClick(e, task.text);
                          }
                        }}
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
                          cursor: task.text.length > 80 ? 'pointer' : 'default'
                        }}
                        title={task.text.length > 80 ? 'Click to show full description' : ''}
                      >
                        {task.text}
                      </p>
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
                        <span style={{ fontWeight: 700 }}>Add</span>
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
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Full Task Description</span>
              <button 
                onClick={() => setActiveTooltip(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <X size={12} />
              </button>
            </div>
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary)' }}>{activeTooltip.text}</p>
          </div>
        </>
      )}

    </div>
  );
};

export default TaskHistory;
