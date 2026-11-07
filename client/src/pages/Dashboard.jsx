import React, { useState, useEffect } from 'react';
import { LayoutDashboard as DashboardIcon } from 'lucide-react';
import Illustration from '../components/Illustration';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import { 
  CheckCircle2, 
  Circle, 
  Target, 
  Flame, 
  Code2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  AlertCircle,
  Edit2,
  Pill,
  Check
} from 'lucide-react';

const Dashboard = () => {
  const { getAuthHeaders, privacyMode, workspaceVisibility } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dateParam = searchParams.get('date');

  const [todayData, setTodayData] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState('');

  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const activeDateStr = dateParam || getLocalDateString();

  const fetchData = async (dateStr) => {
    try {
      setLoading(true);
      setError('');
      const [todayRes, weekRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard/today?date=${dateStr}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/dashboard/week`, { headers: getAuthHeaders() })
      ]);

      if (!todayRes.ok || !weekRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const todayJson = await todayRes.json();
      const weekJson = await weekRes.json();

      setTodayData(todayJson);
      setWeekData(weekJson);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeDateStr);
  }, [activeDateStr]);

  useEffect(() => {
    const handleMedLogUpdated = (e) => {
      const { date, log } = e.detail || {};
      if (date === activeDateStr && log) {
        setTodayData(prev => ({
          ...prev,
          meds: {
            ...prev?.meds,
            todayLog: log
          }
        }));
      }
    };
    window.addEventListener('med-log-updated', handleMedLogUpdated);
    return () => window.removeEventListener('med-log-updated', handleMedLogUpdated);
  }, [activeDateStr]);

  const handleToggleTask = async (taskId, currentIsDone) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/days/${taskId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isDone: !currentIsDone }),
      });
      if (res.ok) {
        setTodayData(prev => ({
          ...prev,
          planDays: prev.planDays.map(day => 
            day.id === taskId ? { ...day, isDone: !currentIsDone } : day
          )
        }));
      }
    } catch (err) {
      console.error('Error toggling planner task:', err);
    }
  };

  const handleToggleNormalTask = async (taskId, currentIsDone) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/normal-tasks/${taskId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isDone: !currentIsDone }),
      });
      if (res.ok) {
        setTodayData(prev => ({
          ...prev,
          normalTasks: prev.normalTasks.map(t => 
            t.id === taskId ? { ...t, isDone: !currentIsDone } : t
          )
        }));
      }
    } catch (err) {
      console.error('Error toggling normal task:', err);
    }
  };

  const handleAddNormalTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/normal-tasks`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: activeDateStr,
          text: newTaskText.trim()
        })
      });

      if (res.ok) {
        const newTask = await res.json();
        setTodayData(prev => ({
          ...prev,
          normalTasks: [...(prev.normalTasks || []), newTask]
        }));
        setNewTaskText('');
      }
    } catch (err) {
      console.error('Error adding normal task:', err);
    }
  };

  const handleDeleteNormalTask = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/normal-tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setTodayData(prev => ({
          ...prev,
          normalTasks: prev.normalTasks.filter(t => t.id !== taskId)
        }));
      }
    } catch (err) {
      console.error('Error deleting normal task:', err);
    }
  };

  const handleStartEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
  };

  const handleSaveEditTask = async (taskId) => {
    if (!editingTaskText.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/normal-tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: editingTaskText.trim() }),
      });
      if (res.ok) {
        setTodayData(prev => ({
          ...prev,
          normalTasks: prev.normalTasks.map(t => 
            t.id === taskId ? { ...t, text: editingTaskText.trim() } : t
          )
        }));
        setEditingTaskId(null);
      }
    } catch (err) {
      console.error('Error saving edited task:', err);
    }
  };

  const handleToggleDashboardMed = async (type, currentValue) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meds/log`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: activeDateStr,
          [type]: !currentValue
        })
      });
      if (res.ok) {
        const updatedLog = await res.json();
        setTodayData(prev => ({
          ...prev,
          meds: {
            ...prev?.meds,
            todayLog: updatedLog
          }
        }));
        window.dispatchEvent(new CustomEvent('med-log-updated', {
          detail: {
            date: activeDateStr,
            type,
            value: !currentValue,
            log: updatedLog
          }
        }));
      }
    } catch (err) {
      console.error('Error toggling dashboard med:', err);
    }
  };

  const navigateDays = (direction) => {
    const d = new Date(activeDateStr);
    d.setDate(d.getDate() + direction);
    setSearchParams({ date: getLocalDateString(d) });
  };

  const setDayShortcut = (shortcut) => {
    const today = new Date();
    if (shortcut === 'yesterday') {
      today.setDate(today.getDate() - 1);
      setSearchParams({ date: getLocalDateString(today) });
    } else if (shortcut === 'tomorrow') {
      today.setDate(today.getDate() + 1);
      setSearchParams({ date: getLocalDateString(today) });
    } else {
      setSearchParams({});
    }
  };

  if (loading) {
    return <Loader text="Aligning Zen Zone Dashboard..." />;
  }

  if (error) {
    return <div className="error-state">Error: {error}</div>;
  }

  const streak = weekData?.streak || 0;

  // Header string logic
  const todayStr = getLocalDateString();
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayObj);
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrowObj);

  let dayLabel = 'Daily';
  if (activeDateStr === todayStr) dayLabel = "Today's";
  else if (activeDateStr === yesterdayStr) dayLabel = "Yesterday's";
  else if (activeDateStr === tomorrowStr) dayLabel = "Tomorrow's";

  const formattedDate = new Date(activeDateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const filteredPlanDays = (todayData?.planDays || []).filter(day => {
    if (privacyMode) {
      const isHiddenFromDashboard = (sysConfig) => sysConfig?.showInOffice === false && sysConfig?.showOnDashboard === false;
      if (isHiddenFromDashboard(workspaceVisibility?.plans)) return false;
      // Personal plans stay out of the office workspace
      if (day.planWeek?.plan?.isPersonal) return false;
    }
    return true;
  });

  const filteredNormalTasks = (todayData?.normalTasks || []).filter(task => {
    if (privacyMode) {
      if (workspaceVisibility?.taskHistory?.showInOffice === false && workspaceVisibility?.taskHistory?.showOnDashboard === false) return false;
    }
    return true;
  });

  const totalTasksCount = filteredPlanDays.length + filteredNormalTasks.length;
  const completedTasksCount = 
    filteredPlanDays.filter(d => d.isDone).length + 
    filteredNormalTasks.filter(t => t.isDone).length;

  // Daily DSA Questions
  const dailyDsaLogs = todayData?.dsaLogs || [];
  const showMedsWidget = todayData?.meds?.schedule && !(privacyMode && workspaceVisibility?.meds?.showInOffice === false && workspaceVisibility?.meds?.showOnDashboard === false);
  const showDsaColumn = !(privacyMode && workspaceVisibility?.dsaLog?.showInOffice === false && workspaceVisibility?.dsaLog?.showOnDashboard === false);

  return (
    <div className="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Header Banner */}
      <header className="page-header tone-default">
        <div className="page-header-main">
          <div className="page-header-icon">
            <DashboardIcon size={20} />
          </div>
          <div>
            <h1 className="page-header-title">{dayLabel === 'Daily' ? 'Overview' : dayLabel.replace("'s", '')}</h1>
            <p className="page-header-subtitle">{formattedDate}</p>
          </div>
        </div>
        
        {/* Streak indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Day switches */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '9999px', border: '1px solid var(--border-light)' }}>
            <button 
              className={`mirror-btn-pill ${activeDateStr === yesterdayStr ? 'checked-ai' : ''}`}
              onClick={() => setDayShortcut('yesterday')}
              style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', borderRadius: '9999px', border: 'none', background: activeDateStr === yesterdayStr ? 'var(--bg-tertiary)' : 'transparent', color: activeDateStr === yesterdayStr ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Yesterday
            </button>
            <button 
              className={`mirror-btn-pill ${activeDateStr === todayStr ? 'checked-ai' : ''}`}
              onClick={() => setDayShortcut('today')}
              style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', borderRadius: '9999px', border: 'none', background: activeDateStr === todayStr ? 'var(--bg-tertiary)' : 'transparent', color: activeDateStr === todayStr ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Today
            </button>
            <button 
              className={`mirror-btn-pill ${activeDateStr === tomorrowStr ? 'checked-ai' : ''}`}
              onClick={() => setDayShortcut('tomorrow')}
              style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', borderRadius: '9999px', border: 'none', background: activeDateStr === tomorrowStr ? 'var(--bg-tertiary)' : 'transparent', color: activeDateStr === tomorrowStr ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Tomorrow
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.1rem', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.01)' }}>
            <Flame color={streak > 0 ? 'var(--mod-dsa)' : 'var(--text-muted)'} size={22} className={streak > 0 ? 'flame-active' : ''} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Streak</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{streak} {streak === 1 ? 'day' : 'days'}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-main-grid" style={!showDsaColumn ? { gridTemplateColumns: '1fr' } : {}}>
        
        {/* Tasks Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
              Tasks Checklist
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                onClick={() => navigateDays(-1)} 
                className="mirror-checkbox" 
                style={{ width: '28px', height: '28px' }}
                title="Previous Day"
              >
                <ChevronLeft size={14} />
              </button>
              <button 
                onClick={() => navigateDays(1)} 
                className="mirror-checkbox" 
                style={{ width: '28px', height: '28px' }}
                title="Next Day"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="glass-card glow-tracker" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '350px' }}>
            {totalTasksCount === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '0.75rem' }}>
                <Illustration name="tasks-empty" />
                <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>No tasks logged for this date.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Planner tasks */}
                {filteredPlanDays.map(day => (
                  <div 
                    key={day.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '1rem', 
                      padding: '0.85rem 1.1rem', 
                      borderRadius: '12px', 
                      background: day.isDone ? 'rgba(255, 255, 255, 0.005)' : 'rgba(255, 255, 255, 0.015)', 
                      border: '1px solid var(--border-light)',
                      transition: 'all 0.2s'
                    }}
                    className="task-item-dashboard"
                  >
                    <button 
                      onClick={() => handleToggleTask(day.id, day.isDone)}
                      className={`mirror-checkbox ${day.isDone ? 'checked-plan' : ''}`}
                      style={{ '--tone': day.planWeek?.plan?.color || 'var(--mod-plans)' }}
                      style={{ marginTop: '0.15rem' }}
                    >
                      {day.isDone ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Circle size={16} style={{ opacity: 0.3 }} />
                      )}
                    </button>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span className="badge plan-badge" style={{ '--tone': day.planWeek?.plan?.color || 'var(--mod-plans)' }}>
                          {day.planWeek?.plan?.name || `${day.track} plan`}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Week {day.planWeek?.weekNumber}</span>
                      </div>
                      
                      <p style={{ 
                        fontSize: '0.925rem', 
                        fontWeight: 500, 
                        color: day.isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: day.isDone ? 'line-through' : 'none',
                        lineHeight: '1.4'
                      }}>
                        {day.topic || 'No topic details entered.'}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Normal Tasks */}
                {filteredNormalTasks.map(task => (
                  <div 
                    key={task.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '1rem', 
                      padding: '0.85rem 1.1rem', 
                      borderRadius: '12px', 
                      background: task.isDone ? 'rgba(255, 255, 255, 0.005)' : 'rgba(255, 255, 255, 0.015)', 
                      border: '1px solid var(--border-light)',
                      transition: 'all 0.2s'
                    }}
                    className="task-item-dashboard"
                  >
                    <button 
                      onClick={() => handleToggleNormalTask(task.id, task.isDone)}
                      className={`mirror-checkbox ${task.isDone ? 'checked-gen' : ''}`}
                      style={{ marginTop: '0.15rem' }}
                    >
                      {task.isDone ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Circle size={16} style={{ opacity: 0.3 }} />
                      )}
                    </button>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span className="badge" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-primary)', borderColor: 'rgba(99, 102, 241, 0.15)' }}>
                          General Task
                        </span>
                      </div>
                      
                      {editingTaskId === task.id ? (
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={editingTaskText}
                            onChange={(e) => setEditingTaskText(e.target.value)}
                            className="input-control"
                            style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditTask(task.id);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            autoFocus
                          />
                          <button 
                            onClick={() => handleSaveEditTask(task.id)}
                            className="mirror-btn-pill"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingTaskId(null)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '4px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p style={{ 
                          fontSize: '0.925rem', 
                          fontWeight: 500, 
                          color: task.isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: task.isDone ? 'line-through' : 'none',
                          lineHeight: '1.4'
                        }}>
                          {task.text}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center', alignSelf: 'flex-start', marginTop: '0.1rem' }}>
                      <button 
                        onClick={() => handleDeleteNormalTask(task.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s ease', padding: '4px' }}
                        className="btn-trash-hover"
                        title="Delete Task"
                      >
                        <Trash2 size={12} />
                      </button>
                      {editingTaskId !== task.id && (
                        <button 
                          onClick={() => handleStartEditTask(task)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s ease', padding: '4px' }}
                          className="btn-edit-hover"
                          title="Edit Task"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Task Addition Form */}
            <form onSubmit={handleAddNormalTask} style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '1.1rem' }}>
              <input
                type="text"
                placeholder="Add a new custom task for this date..."
                className="input-control"
                style={{ flex: 1, padding: '0.75rem 1.1rem', fontSize: '0.9rem' }}
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
              />
              <button type="submit" className="mirror-btn-pill tracker-submit" style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={16} />
                <span style={{ fontWeight: 600 }}>Add Task</span>
              </button>
            </form>
          </div>

          {/* Meds Checklist Widget */}
          {showMedsWidget && (() => {
            const medSchedule = todayData?.meds?.schedule;
            const medLogToday = todayData?.meds?.todayLog;
            if (!medSchedule) return null;
            
            const start = new Date(medSchedule.startDate);
            start.setHours(0,0,0,0);
            const activeDate = new Date(activeDateStr);
            activeDate.setHours(0,0,0,0);
            const diffTime = activeDate.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            const isMedsActiveForDate = diffDays >= 1 && diffDays <= medSchedule.durationDays;
            
            if (!isMedsActiveForDate) return null;
            
            const morningCompleted = medLogToday ? medLogToday.morning : false;
            const eveningCompleted = medLogToday ? medLogToday.evening : false;
            
            return (
              <div 
                className="tone-meds glass-card glow-med" 
                style={{ 
                  padding: '0.85rem 1.1rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Pill size={15} color="var(--mod-meds)" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {medSchedule.medName}
                    </span>
                  </div>
                  <span className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-secondary)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    Day {diffDays} of {medSchedule.durationDays}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                  {/* Morning Pill */}
                  <button
                    onClick={() => handleToggleDashboardMed('morning', morningCompleted)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: morningCompleted ? 'rgba(48, 209, 88, 0.25)' : 'var(--med-btn-uncompleted-border, rgba(255, 255, 255, 0.03))',
                      background: morningCompleted ? 'rgba(48, 209, 88, 0.04)' : 'var(--med-btn-uncompleted-bg, rgba(255, 255, 255, 0.005))',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: morningCompleted ? '#30d158' : 'var(--text-secondary)'
                    }}
                  >
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '1.5px solid',
                      borderColor: morningCompleted ? '#30d158' : 'var(--med-circle-uncompleted-border, rgba(255, 255, 255, 0.2))',
                      background: morningCompleted ? '#30d158' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}>
                      {morningCompleted && <Check size={8} strokeWidth={4} />}
                    </div>
                    <span>Morning Pill</span>
                  </button>

                  {/* Dinner Pill */}
                  <button
                    onClick={() => handleToggleDashboardMed('evening', eveningCompleted)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: eveningCompleted ? 'rgba(48, 209, 88, 0.25)' : 'var(--med-btn-uncompleted-border, rgba(255, 255, 255, 0.03))',
                      background: eveningCompleted ? 'rgba(48, 209, 88, 0.04)' : 'var(--med-btn-uncompleted-bg, rgba(255, 255, 255, 0.005))',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: eveningCompleted ? '#30d158' : 'var(--text-secondary)'
                    }}
                  >
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '1.5px solid',
                      borderColor: eveningCompleted ? '#30d158' : 'var(--med-circle-uncompleted-border, rgba(255, 255, 255, 0.2))',
                      background: eveningCompleted ? '#30d158' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}>
                      {eveningCompleted && <Check size={8} strokeWidth={4} />}
                    </div>
                    <span>Dinner Pill</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {showDsaColumn && (
          /* DSA Tracker Column */
          <div className="tone-dsa" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
              DSA Logs
            </h2>

            <div className="glass-card glow-dsa" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
              
              {/* Header info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                <div style={{ background: 'rgba(249, 115, 22, 0.08)', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mod-dsa)' }}>
                  <Code2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Logged Questions</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Questions solved on this day</p>
                </div>
              </div>

              {/* Questions list */}
              {dailyDsaLogs.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '0.5rem', minHeight: '180px' }}>
                  <Illustration name="dsa-empty" size={110} />
                  <p style={{ fontSize: '0.85rem' }}>No questions logged on this date.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto', maxHeight: '260px' }}>
                  {dailyDsaLogs.map(log => (
                    <div 
                      key={log.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          #{log.questionNumber} - {log.title || 'Untitled'}
                        </span>
                      </div>

                      <span 
                        className="badge" 
                        style={{ 
                          fontSize: '0.62rem',
                          padding: '0.1rem 0.4rem',
                          background: log.difficulty === 'Easy' 
                            ? 'rgba(48, 209, 88, 0.08)' 
                            : log.difficulty === 'Medium' 
                            ? 'rgba(255, 159, 10, 0.08)' 
                            : 'rgba(255, 69, 58, 0.08)',
                          color: log.difficulty === 'Easy' 
                            ? '#30d158' 
                            : log.difficulty === 'Medium' 
                            ? '#ff9f0a' 
                            : '#ff453a',
                          borderColor: log.difficulty === 'Easy' 
                            ? 'rgba(48, 209, 88, 0.15)' 
                            : log.difficulty === 'Medium' 
                            ? 'rgba(255, 159, 10, 0.15)' 
                            : 'rgba(255, 69, 58, 0.15)',
                          fontWeight: 600
                        }}
                      >
                        {log.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Link to DSA logs */}
              <button 
                className="mirror-btn-pill dsa-submit"
                onClick={() => navigate('/dsa-log')}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem', marginTop: 'auto' }}
              >
                <span style={{ fontWeight: 600 }}>Log Questions Page</span>
              </button>

            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default Dashboard;
