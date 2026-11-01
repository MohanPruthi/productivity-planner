import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, ChevronDown, Check, Trash2, Sparkles, Database } from 'lucide-react';
import Loader from '../components/Loader';
import PageHeader from '../components/PageHeader';
import Illustration from '../components/Illustration';
import { API_BASE_URL } from '../config';

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Plan = ({ track }) => {
  const { getAuthHeaders } = useAuth();
  const [weeks, setWeeks] = useState([]);
  const [activeWeekId, setActiveWeekId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Week form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [weekNumber, setWeekNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [goalText, setGoalText] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success indicator states for autosave
  const [savingStates, setSavingStates] = useState({}); // dayId: 'saved' | 'saving' | 'error'

  const fetchWeeks = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/plan/weeks?track=${track}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to load ${track} weeks`);
      }
      const data = await res.json();
      setWeeks(data);

      // Auto-expand current or latest week
      if (data.length > 0) {
        // Week dates are stored as UTC midnight, so compare calendar days
        const todayStr = getLocalDateString();
        const activeWeek = data.find(w => {
          const start = new Date(w.startDate).toISOString().split('T')[0];
          const end = new Date(w.endDate).toISOString().split('T')[0];
          return todayStr >= start && todayStr <= end;
        });

        if (activeWeek) {
          setActiveWeekId(activeWeek.id);
        } else {
          // Default to the latest week
          setActiveWeekId(data[data.length - 1].id);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeks();
  }, [track]);

  // Pre-fill next week details in add week form
  useEffect(() => {
    if (weeks.length > 0) {
      const nextNum = Math.max(...weeks.map(w => w.weekNumber)) + 1;
      setWeekNumber(nextNum);
      
      // Calculate next start date (day after previous week's end date)
      const lastWeekEnd = new Date(weeks[weeks.length - 1].endDate);
      const nextStart = new Date(lastWeekEnd);
      nextStart.setDate(lastWeekEnd.getDate() + 1);
      setStartDate(nextStart.toISOString().split('T')[0]);
    } else {
      setWeekNumber(1);
      setStartDate(getLocalDateString());
    }
  }, [weeks, showAddForm]);

  const handleCreateWeek = async (e) => {
    e.preventDefault();
    if (!weekNumber || !startDate) {
      setFormError('Please enter a week number and start date');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/weeks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          track,
          weekNumber: parseInt(weekNumber),
          startDate,
          goalText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create week');

      setWeeks(prev => [...prev, data].sort((a, b) => a.weekNumber - b.weekNumber));
      setActiveWeekId(data.id);
      setShowAddForm(false);
      setGoalText('');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDay = async (weekId, dayId, currentIsDone) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/days/${dayId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isDone: !currentIsDone }),
      });
      if (res.ok) {
        setWeeks(prevWeeks => 
          prevWeeks.map(w => {
            if (w.id === weekId) {
              const updatedDays = w.planDays.map(d => 
                d.id === dayId ? { ...d, isDone: !currentIsDone } : d
              );
              return { ...w, planDays: updatedDays };
            }
            return w;
          })
        );
      }
    } catch (err) {
      console.error('Error toggling day:', err);
    }
  };

  const handleUpdateDayText = async (weekId, dayId, field, value) => {
    setSavingStates(prev => ({ ...prev, [dayId]: 'saving' }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/days/${dayId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Save failed');

      setWeeks(prevWeeks => 
        prevWeeks.map(w => {
          if (w.id === weekId) {
            const updatedDays = w.planDays.map(d => 
              d.id === dayId ? { ...d, [field]: value } : d
            );
            return { ...w, planDays: updatedDays };
          }
          return w;
        })
      );
      setSavingStates(prev => ({ ...prev, [dayId]: 'saved' }));
      setTimeout(() => {
        setSavingStates(prev => {
          const copy = { ...prev };
          delete copy[dayId];
          return copy;
        });
      }, 1500);
    } catch (err) {
      setSavingStates(prev => ({ ...prev, [dayId]: 'error' }));
    }
  };

  const handleDeleteWeek = async (weekId) => {
    if (!window.confirm('Are you sure you want to delete this study week? All plan details for this week will be lost.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/weeks/${weekId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setWeeks(prev => prev.filter(w => w.id !== weekId));
        if (activeWeekId === weekId) {
          setActiveWeekId(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete week');
      }
    } catch (err) {
      console.error('Error deleting week:', err);
      alert('Failed to delete week');
    }
  };

  // Week dates are stored as UTC midnight: compare calendar days, not instants
  const utcDay = (dateStr) => new Date(dateStr).toISOString().split('T')[0];
  const todayStr = getLocalDateString();
  const isCurrentWeek = (week) => todayStr >= utcDay(week.startDate) && todayStr <= utcDay(week.endDate);
  const isToday = (day) => utcDay(day.date) === todayStr;

  const formatShortDay = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const formatDay = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  // Grow AI plan text areas with their content
  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  if (loading) {
    return <Loader text={`Loading ${track} plan...`} />;
  }

  const isAI = track === 'AI';
  const currentWeek = weeks.find(isCurrentWeek);
  const allDays = weeks.flatMap(w => w.planDays);
  const overallPercent = allDays.length ? Math.round((allDays.filter(d => d.isDone).length / allDays.length) * 100) : 0;

  return (
    <div className={`plan-page tone-${isAI ? 'ai' : 'sd'}`}>
      <PageHeader
        icon={isAI ? Sparkles : Database}
        tone={isAI ? 'ai' : 'sd'}
        title={isAI ? 'AI learning plan' : 'System design plan'}
        subtitle={isAI ? 'LLM internals, evaluation and fine-tuning, week by week' : 'Distributed systems and architecture, one topic a day'}
        actions={
          <button className="ui-btn ui-btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={16} />
            Add week
          </button>
        }
      />

      {error && <div className="text-error">{error}</div>}

      {weeks.length > 0 && (
        <div className="ui-stat-row">
          <div className="ui-stat">
            <div className="ui-stat-label">This week</div>
            <div className="ui-stat-value">
              {currentWeek ? `${currentWeek.planDays.filter(d => d.isDone).length} of ${currentWeek.planDays.length}` : '—'}
            </div>
            <div className="ui-stat-meta">{currentWeek ? `Week ${currentWeek.weekNumber} done` : 'No week covers today'}</div>
          </div>
          <div className="ui-stat">
            <div className="ui-stat-label">Overall</div>
            <div className="ui-stat-value">{overallPercent}%</div>
            <div className="ui-progress" style={{ marginTop: '0.5rem' }}><div style={{ width: `${overallPercent}%` }} /></div>
          </div>
          <div className="ui-stat">
            <div className="ui-stat-label">Weeks planned</div>
            <div className="ui-stat-value">{weeks.length}</div>
            <div className="ui-stat-meta">{weeks.filter(w => w.planDays.every(d => d.isDone)).length} completed</div>
          </div>
        </div>
      )}

      {showAddForm && (
        <form className="glass-card plan-add-form" onSubmit={handleCreateWeek}>
          <h2 className="ui-section-title">New week</h2>
          {formError && <div className="text-error">{formError}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="weekNum">Week number</label>
              <input id="weekNum" type="number" className="input-control" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="startDate">Start date</label>
              <input id="startDate" type="date" className="input-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="goalText">Goal for the week</label>
            <input
              id="goalText"
              type="text"
              className="input-control"
              placeholder={isAI ? 'Understand attention and build a tiny transformer' : 'Caching strategies and CDNs'}
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
            />
          </div>
          <div className="plan-add-actions">
            <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="ui-btn ui-btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create week'}</button>
          </div>
        </form>
      )}

      {weeks.length === 0 ? (
        <div className="glass-card plan-empty">
          <Illustration name="plan-empty" size={150} />
          <p className="plan-empty-title">No weeks planned yet</p>
          <p className="plan-empty-text">Add your first week to start tracking {isAI ? 'your AI learning' : 'system design topics'}.</p>
          <button className="ui-btn ui-btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus size={16} />
            Add week
          </button>
        </div>
      ) : (
        <div className="plan-weeks">
          {weeks.map(week => {
            const isExpanded = activeWeekId === week.id;
            const doneCount = week.planDays.filter(d => d.isDone).length;
            const percent = Math.round((doneCount / week.planDays.length) * 100);
            const current = isCurrentWeek(week);
            const days = isAI
              ? [...week.planDays].sort((a, b) => (a.isWeekend === b.isWeekend ? 0 : a.isWeekend ? -1 : 1))
              : week.planDays;

            return (
              <section key={week.id} className={`glass-card plan-week ${isExpanded ? 'open' : ''}`}>
                <div className="plan-week-head" onClick={() => setActiveWeekId(isExpanded ? null : week.id)}>
                  <div className="plan-week-title">
                    <div className="plan-week-name">
                      Week {week.weekNumber}
                      {current && <span className="plan-pill">This week</span>}
                    </div>
                    <div className="plan-week-meta">
                      {formatDay(week.startDate)} – {formatDay(week.endDate)}
                      {week.goalText && <> · {week.goalText}</>}
                    </div>
                  </div>
                  <div className="plan-week-progress">
                    <div className="ui-progress"><div style={{ width: `${percent}%` }} /></div>
                    <span>{doneCount}/{week.planDays.length}</span>
                  </div>
                  <div className="plan-week-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="ui-icon-btn danger" onClick={() => handleDeleteWeek(week.id)} title="Delete week">
                      <Trash2 size={15} />
                    </button>
                    <button className="ui-icon-btn" onClick={() => setActiveWeekId(isExpanded ? null : week.id)} title={isExpanded ? 'Collapse' : 'Expand'}>
                      <ChevronDown size={18} className={`plan-chevron ${isExpanded ? 'up' : ''}`} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="plan-days">
                    {days.map(day => (
                      <div key={day.id} className={`plan-day ${day.isDone ? 'done' : ''} ${!isAI && isToday(day) ? 'today' : ''}`}>
                        <button
                          className={`plan-check ${day.isDone ? 'checked' : ''}`}
                          onClick={() => handleToggleDay(week.id, day.id, day.isDone)}
                          title={day.isDone ? 'Mark as not done' : 'Mark as done'}
                        >
                          {day.isDone && <Check size={13} strokeWidth={3} />}
                        </button>

                        <div className="plan-day-label">
                          {isAI ? (
                            <>
                              <span>{day.isWeekend ? 'Weekend' : 'Weekdays'}</span>
                              <small>{day.isWeekend ? 'Sat – Sun' : 'Mon – Fri'}</small>
                            </>
                          ) : (
                            <>
                              <span>{formatShortDay(day.date)}{isToday(day) && <em> · Today</em>}</span>
                              <small>{formatDay(day.date)}</small>
                            </>
                          )}
                        </div>

                        {isAI ? (
                          <textarea
                            className="plan-topic"
                            rows={2}
                            ref={autoGrow}
                            onInput={(e) => autoGrow(e.target)}
                            placeholder={day.isWeekend ? 'Weekend plan' : 'Weekday plan'}
                            defaultValue={day.topic}
                            onBlur={(e) => e.target.value !== (day.topic || '') && handleUpdateDayText(week.id, day.id, 'topic', e.target.value)}
                          />
                        ) : (
                          <input
                            type="text"
                            className="plan-topic"
                            placeholder="Add a topic"
                            defaultValue={day.topic}
                            onBlur={(e) => e.target.value !== (day.topic || '') && handleUpdateDayText(week.id, day.id, 'topic', e.target.value)}
                          />
                        )}

                        <span className={`plan-save ${savingStates[day.id] || ''}`}>
                          {savingStates[day.id] === 'saving' && 'Saving'}
                          {savingStates[day.id] === 'saved' && 'Saved'}
                          {savingStates[day.id] === 'error' && 'Not saved'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Plan;
