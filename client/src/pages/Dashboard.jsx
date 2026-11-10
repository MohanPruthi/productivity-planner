import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import { openQuickAdd } from '../components/QuickAdd';
import { Trash2, ChevronLeft, ChevronRight, Plus, Edit2, Check } from 'lucide-react';

const Dashboard = () => {
  const { user, getAuthHeaders, privacyMode, workspaceVisibility } = useAuth();
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

  // Tasks added from Quick add (Ctrl K)
  useEffect(() => {
    const onTasksChanged = (e) => {
      if (e.detail?.date === activeDateStr) fetchData(activeDateStr);
    };
    window.addEventListener('tasks-changed', onTasksChanged);
    return () => window.removeEventListener('tasks-changed', onTasksChanged);
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

  // Greeting on today, plain day name otherwise
  const hour = new Date().getHours();
  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const headline = activeDateStr === todayStr
    ? (firstName ? `${greeting}, ${firstName}` : greeting)
    : (dayLabel === 'Daily' ? 'Overview' : dayLabel.replace("'s", ''));
  const tasksLeft = totalTasksCount - completedTasksCount;
  const tasksLeftText = tasksLeft === 0 ? 'all tasks done' : `${tasksLeft} ${tasksLeft === 1 ? 'task' : 'tasks'} left`;

  const isToday = activeDateStr === todayStr;
  const shortDate = new Date(activeDateStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const dayButtons = [
    ['yesterday', 'Yesterday', yesterdayStr],
    ['today', 'Today', todayStr],
    ['tomorrow', 'Tomorrow', tomorrowStr],
  ];

  // Meds for the selected day
  const medSchedule = todayData?.meds?.schedule;
  const medLog = todayData?.meds?.todayLog;
  let medDay = 0;
  if (medSchedule) {
    const start = new Date(medSchedule.startDate);
    start.setHours(0, 0, 0, 0);
    const active = new Date(activeDateStr);
    active.setHours(0, 0, 0, 0);
    medDay = Math.floor((active.getTime() - start.getTime()) / 86400000) + 1;
  }
  const showMedsTile = showMedsWidget && medDay >= 1 && medDay <= medSchedule.durationDays;
  const meds = [
    ['morning', 'Morning pill', 'Before 12:00', !!medLog?.morning],
    ['evening', 'Dinner pill', 'After 20:00', !!medLog?.evening],
  ];

  // Plan progress: personal space only, since plans can be personal
  const planWeeks = !privacyMode ? (weekData?.weeklyProgress || []).slice(0, 3) : [];

  return (
    <div className="cc-dash">
      <header className="cc-head">
        <div>
          <h1 className="cc-greet">{headline}</h1>
          <p className="cc-sub">
            {shortDate}
            {totalTasksCount > 0 && ` · ${tasksLeftText}`}
            {streak > 0 && ` · ${streak}-day streak`}
          </p>
        </div>
        <div className="cc-head-tools">
          <div className="cc-days" role="group" aria-label="Choose day">
            <button type="button" className="cc-day-step" onClick={() => navigateDays(-1)} aria-label="Previous day">
              <ChevronLeft size={15} />
            </button>
            {dayButtons.map(([key, label, str]) => (
              <button
                key={key}
                type="button"
                className={activeDateStr === str ? 'active' : ''}
                aria-pressed={activeDateStr === str}
                onClick={() => setDayShortcut(key)}
              >
                {label}
              </button>
            ))}
            <button type="button" className="cc-day-step" onClick={() => navigateDays(1)} aria-label="Next day">
              <ChevronRight size={15} />
            </button>
          </div>
          <button type="button" className="cc-quick" onClick={openQuickAdd}>
            <Plus size={15} />
            <span>Quick add</span>
            <kbd>Ctrl K</kbd>
          </button>
        </div>
      </header>

      <div className={`cc-grid ${showDsaColumn || showMedsTile ? '' : 'single'}`}>
        <section className="cc-tile cc-tasks" aria-labelledby="cc-tasks-title">
          <div className="cc-tile-head">
            <h2 id="cc-tasks-title">Tasks</h2>
            {totalTasksCount > 0 && <span className="cc-meta">{completedTasksCount} of {totalTasksCount} done</span>}
          </div>

          {totalTasksCount === 0 ? (
            <p className="cc-empty">Nothing planned for {isToday ? 'today' : 'this day'} yet.</p>
          ) : (
            <ul className="cc-list">
              {filteredPlanDays.map((day) => (
                <li key={day.id} className={`cc-row ${day.isDone ? 'done' : ''}`}>
                  <button
                    type="button"
                    className="cc-check"
                    style={{ '--check': day.planWeek?.plan?.color || 'var(--mod-plans)' }}
                    aria-pressed={day.isDone}
                    aria-label={day.isDone ? 'Mark not done' : 'Mark done'}
                    onClick={() => handleToggleTask(day.id, day.isDone)}
                  >
                    {day.isDone && <Check size={12} strokeWidth={3} />}
                  </button>
                  <div className="cc-row-text">
                    <span>{day.topic || 'No topic set'}</span>
                    <small>
                      <i style={{ background: day.planWeek?.plan?.color || 'var(--mod-plans)' }} />
                      {day.planWeek?.plan?.name || `${day.track} plan`} · week {day.planWeek?.weekNumber}
                    </small>
                  </div>
                </li>
              ))}
              {filteredNormalTasks.map((task) => (
                <li key={task.id} className={`cc-row ${task.isDone ? 'done' : ''}`}>
                  <button
                    type="button"
                    className="cc-check"
                    aria-pressed={task.isDone}
                    aria-label={task.isDone ? 'Mark not done' : 'Mark done'}
                    onClick={() => handleToggleNormalTask(task.id, task.isDone)}
                  >
                    {task.isDone && <Check size={12} strokeWidth={3} />}
                  </button>
                  {editingTaskId === task.id ? (
                    <form
                      className="cc-row-edit"
                      onSubmit={(e) => { e.preventDefault(); handleSaveEditTask(task.id); }}
                    >
                      <input
                        autoFocus
                        aria-label="Edit task"
                        value={editingTaskText}
                        onChange={(e) => setEditingTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setEditingTaskId(null)}
                      />
                      <button type="submit" className="ui-btn ui-btn-ghost">Save</button>
                    </form>
                  ) : (
                    <>
                      <div className="cc-row-text"><span>{task.text}</span></div>
                      <div className="cc-row-actions">
                        <button type="button" className="ui-icon-btn" onClick={() => handleStartEditTask(task)} aria-label="Edit task">
                          <Edit2 size={14} />
                        </button>
                        <button type="button" className="ui-icon-btn danger" onClick={() => handleDeleteNormalTask(task.id)} aria-label="Delete task">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form className="cc-add" onSubmit={handleAddNormalTask}>
            <Plus size={16} aria-hidden="true" />
            <input
              placeholder="Add a task"
              aria-label="New task"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
            />
            {newTaskText.trim() && <button type="submit" className="ui-btn ui-btn-ghost">Add</button>}
          </form>
        </section>

        {showDsaColumn && (
          <section className="cc-tile cc-dsa tone-dsa" aria-labelledby="cc-dsa-title">
            <div className="cc-tile-head">
              <h2 id="cc-dsa-title">DSA</h2>
              <button type="button" className="cc-link" onClick={() => navigate('/dsa-log')}>Open log</button>
            </div>
            <div className="cc-figure">
              <strong>{dailyDsaLogs.length}</strong>
              <span>solved {isToday ? 'today' : 'this day'}</span>
            </div>
            {dailyDsaLogs.length > 0 && (
              <ul className="cc-mini-list">
                {dailyDsaLogs.map((log) => (
                  <li key={log.id}>
                    <span className="cc-qnum">#{log.questionNumber}</span>
                    <span className="cc-qtitle">{log.title || 'Untitled'}</span>
                    <span className={`cc-diff ${String(log.difficulty).toLowerCase()}`}>{log.difficulty}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {showMedsTile && (
          <section className="cc-tile cc-meds tone-meds" aria-labelledby="cc-meds-title">
            <div className="cc-tile-head">
              <h2 id="cc-meds-title">{medSchedule.medName}</h2>
              <span className="cc-meta">Day {medDay} of {medSchedule.durationDays}</span>
            </div>
            <ul className="cc-list">
              {meds.map(([type, label, hint, done]) => (
                <li key={type} className={`cc-row ${done ? 'done' : ''}`}>
                  <button
                    type="button"
                    className="cc-check"
                    style={{ '--check': 'var(--mod-meds)' }}
                    aria-pressed={done}
                    aria-label={done ? `${label}: taken` : `${label}: mark taken`}
                    onClick={() => handleToggleDashboardMed(type, done)}
                  >
                    {done && <Check size={12} strokeWidth={3} />}
                  </button>
                  <div className="cc-row-text"><span>{label}</span><small>{hint}</small></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {planWeeks.length > 0 && (
          <section className="cc-tile cc-plans tone-plans" aria-labelledby="cc-plans-title">
            <div className="cc-tile-head">
              <h2 id="cc-plans-title">This week's plans</h2>
              <button type="button" className="cc-link" onClick={() => navigate('/plans')}>Open plans</button>
            </div>
            <ul className="cc-plan-list">
              {planWeeks.map((w) => (
                <li key={w.id}>
                  <div className="cc-plan-name">
                    <span>{w.planName || 'Plan'}</span>
                    <small>Week {w.weekNumber}{w.goalText ? ` · ${w.goalText}` : ''}</small>
                  </div>
                  <div className="ui-progress"><div style={{ width: `${w.completionPercentage}%` }} /></div>
                  <span className="cc-plan-pct">{w.completionPercentage}%</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
