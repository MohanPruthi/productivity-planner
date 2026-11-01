import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, ChevronDown, ChevronUp, CheckCircle2, Circle, AlertCircle, Trash2, Sparkles, Database } from 'lucide-react';
import Loader from '../components/Loader';
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

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <Loader text={`Structuring ${track} Course Plan...`} />;
  }

  return (
    <div className="plan-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Banner */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '2rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          boxShadow: track === 'AI' 
            ? '0 10px 30px rgba(59, 130, 246, 0.02), inset 0 1px 0 rgba(255,255,255,0.02)' 
            : '0 10px 30px rgba(16, 185, 129, 0.02), inset 0 1px 0 rgba(255,255,255,0.02)',
          borderRadius: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Glow Mesh background indicator */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: track === 'AI'
            ? 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: track === 'AI' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${track === 'AI' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: track === 'AI' ? '0 0 15px rgba(59, 130, 246, 0.15)' : '0 0 15px rgba(16, 185, 129, 0.15)'
          }}>
            {track === 'AI' ? (
              <Sparkles size={26} color="var(--track-ai-start)" />
            ) : (
              <Database size={26} color="var(--track-sd-start)" />
            )}
          </div>
          <div>
            <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: '1.2' }}>
              {track === 'AI' ? (
                <>
                  AI Learning <span style={{ background: 'linear-gradient(135deg, var(--track-ai-start), var(--track-ai-end))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Planner</span>
                </>
              ) : (
                <>
                  System Design <span style={{ background: 'linear-gradient(135deg, var(--track-sd-start), var(--track-sd-end))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Planner</span>
                </>
              )}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.9rem' }}>
              {track === 'AI' 
                ? 'High-intensity curriculum focused on LLM internals, evaluation, and fine-tuning' 
                : 'Master large-scale distributed systems, database internals, and architecture paradigms'}
            </p>
          </div>
        </div>

        <button 
          className="btn-glow-pomo btn-pill-gradient-pomo" 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ 
            padding: '0.75rem 1.75rem',
            borderRadius: '9999px',
            '--pomo-btn-bg': track === 'AI'
              ? 'linear-gradient(135deg, var(--track-ai-start), var(--track-ai-end))'
              : 'linear-gradient(135deg, var(--track-sd-start), var(--track-sd-end))',
            '--pomo-glow-color': track === 'AI'
              ? 'rgba(59, 130, 246, 0.35)'
              : 'rgba(6, 182, 212, 0.35)',
            zIndex: 2
          }}
        >
          <Plus size={18} style={{ marginRight: '4px' }} />
          <span style={{ fontWeight: 750 }}>Add Week</span>
        </button>
      </div>

      {error && <div className="text-error" style={{ fontSize: '1rem', textAlign: 'center' }}>{error}</div>}

      {/* Add Week Modal Form */}
      {showAddForm && (
        <div className="glass-card" style={{ padding: '2rem', border: `1px solid ${track === 'AI' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(6, 182, 212, 0.2)'}`, boxShadow: track === 'AI' ? '0 10px 30px rgba(59, 130, 246, 0.05)' : '0 10px 30px rgba(6, 182, 212, 0.05)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Create Study Week</h3>
          <form onSubmit={handleCreateWeek} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && <div className="text-error">{formError}</div>}
            
            <div className="grid-2">
              <div className="form-group">
                <label htmlFor="weekNum" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Week Number</label>
                <input
                  id="weekNum"
                  type="number"
                  className="input-control"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="startDate" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Start Date</label>
                <input
                  id="startDate"
                  type="date"
                  className="input-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="goalText" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Weekly Goal / Focus Target</label>
              <textarea
                id="goalText"
                rows="3"
                className="input-control"
                style={{ resize: 'vertical' }}
                placeholder="What is the key target for this week? (e.g. Master Transformers theory / Scale DB writes)"
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.7rem 1.6rem', borderRadius: '9999px' }} onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-glow-pomo btn-pill-gradient-pomo" 
                disabled={submitting}
                style={{ 
                  padding: '0.7rem 1.6rem',
                  borderRadius: '9999px',
                  '--pomo-btn-bg': track === 'AI'
                    ? 'linear-gradient(135deg, var(--track-ai-start), var(--track-ai-end))'
                    : 'linear-gradient(135deg, var(--track-sd-start), var(--track-sd-end))',
                  '--pomo-glow-color': track === 'AI'
                    ? 'rgba(59, 130, 246, 0.35)'
                    : 'rgba(6, 182, 212, 0.35)'
                }}
              >
                {submitting ? 'Creating...' : 'Create Week'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Weeks list Accordion */}
      {weeks.length === 0 ? (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: 'var(--text-muted)' }}>
          <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No study weeks created yet. Click "Add Week" to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {weeks.map(week => {
            const isExpanded = activeWeekId === week.id;
            const completedCount = week.planDays.filter(d => d.isDone).length;
            const completionPercent = Math.round((completedCount / week.planDays.length) * 100);

            return (
              <div 
                key={week.id} 
                className={`glass-card ${track === 'AI' ? 'glow-ai' : 'glow-sd'}`}
                style={{ padding: '0', overflow: 'hidden' }}
              >
                
                {/* Accordion Trigger Header */}
                <div 
                  onClick={() => setActiveWeekId(isExpanded ? null : week.id)}
                  style={{ 
                    padding: '1.25rem 1.5rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Week {week.weekNumber}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDateLabel(week.startDate)} - {formatDateLabel(week.endDate)}
                      </p>
                    </div>

                    <div style={{ flex: 1, maxWidth: '300px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="progress-bar-container" style={{ margin: '0' }}>
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: `${completionPercent}%`,
                            background: track === 'AI' 
                              ? 'linear-gradient(90deg, var(--track-ai-start), var(--track-ai-end))'
                              : 'linear-gradient(90deg, var(--track-sd-start), var(--track-sd-end))',
                            boxShadow: track === 'AI'
                              ? '0 0 8px rgba(59, 130, 246, 0.5)'
                              : '0 0 8px rgba(16, 185, 129, 0.5)'
                          }}
                        ></div>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{completionPercent}%</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleDeleteWeek(week.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s ease', padding: '4px' }}
                      className="btn-trash-hover"
                      title="Delete Week"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div onClick={() => setActiveWeekId(isExpanded ? null : week.id)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px' }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Accordion Content */}
                {isExpanded && (
                  <div style={{ padding: '1.5rem' }}>
                    
                    {/* Goal detail */}
                    <div style={{ 
                      marginBottom: '1.5rem', 
                      padding: '0.85rem 1.1rem', 
                      background: track === 'AI' ? 'rgba(59, 130, 246, 0.03)' : 'rgba(16, 185, 129, 0.03)', 
                      borderRadius: '8px', 
                      borderLeft: `3px solid ${track === 'AI' ? 'var(--track-ai-start)' : 'var(--track-sd-start)'}`,
                      borderTop: '1px solid rgba(255, 255, 255, 0.01)',
                      borderRight: '1px solid rgba(255, 255, 255, 0.01)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.01)'
                    }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>Weekly Target Goal</div>
                      <p style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>{week.goalText || 'No goal set for this week. Focus on daily tasks.'}</p>
                    </div>

                    {/* Days schedule grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {(track === 'AI' 
                        ? [...week.planDays].sort((a, b) => (a.isWeekend === b.isWeekend ? 0 : a.isWeekend ? -1 : 1))
                        : week.planDays
                      ).map(day => (
                        <div 
                          key={day.id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: '1rem', 
                            padding: '1.25rem', 
                            background: day.isDone ? 'rgba(255, 255, 255, 0.005)' : 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-light)',
                            position: 'relative'
                          }}
                        >
                          {/* Done Checkbox */}
                          <button
                            onClick={() => handleToggleDay(week.id, day.id, day.isDone)}
                            className={`mirror-checkbox ${day.isDone ? (track === 'AI' ? 'checked-ai' : 'checked-sd') : ''}`}
                            style={{ marginTop: '0.2rem' }}
                          >
                            {day.isDone ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <Circle size={16} style={{ opacity: 0.3 }} />
                            )}
                          </button>

                           {/* Day Details */}
                          <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '0.2rem', justifyContent: 'center' }}>
                            {track !== 'AI' && (
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{day.dayLabel}</div>
                            )}
                            {track === 'SD' && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDateLabel(day.date)}</div>
                            )}
                            <span 
                              className="badge" 
                              style={{ 
                                marginTop: '0.25rem', 
                                fontSize: '0.65rem',
                                padding: '0.15rem 0.45rem',
                                display: 'inline-block',
                                width: 'fit-content',
                                background: day.isWeekend ? 'rgba(255, 45, 85, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                                color: day.isWeekend ? '#ff2d55' : 'var(--accent-primary)',
                                borderColor: day.isWeekend ? 'rgba(255, 45, 85, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                fontWeight: 700
                              }}
                            >
                              {day.isWeekend ? 'Weekend' : 'Weekday'}
                            </span>
                            {track === 'AI' && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontWeight: 650 }}>
                                {day.isWeekend ? 'Sat & Sun (10h)' : 'Mon – Fri (10h)'}
                              </div>
                            )}
                          </div>

                          {/* Inputs: Topic */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {track === 'AI' ? (
                              <textarea
                                className="input-control"
                                rows="5"
                                placeholder={day.isWeekend ? "Enter weekend learning plan..." : "Enter weekday learning plan..."}
                                style={{ 
                                  fontSize: '0.925rem', 
                                  padding: '0.8rem', 
                                  lineHeight: '1.4',
                                  resize: 'vertical',
                                  textDecoration: day.isDone ? 'line-through' : 'none',
                                  color: day.isDone ? 'var(--text-muted)' : 'var(--text-primary)'
                                }}
                                defaultValue={day.topic}
                                onBlur={(e) => handleUpdateDayText(week.id, day.id, 'topic', e.target.value)}
                              />
                            ) : (
                              <input
                                type="text"
                                className="input-control"
                                placeholder="Enter daily learning topic..."
                                style={{ 
                                  fontSize: '0.925rem', 
                                  padding: '0.8rem 1rem',
                                  textDecoration: day.isDone ? 'line-through' : 'none',
                                  color: day.isDone ? 'var(--text-muted)' : 'var(--text-primary)'
                                }}
                                defaultValue={day.topic}
                                onBlur={(e) => handleUpdateDayText(week.id, day.id, 'topic', e.target.value)}
                              />
                            )}
                          </div>

                          {/* Autosave status indicator */}
                          <div style={{ width: '60px', textAlign: 'center', fontSize: '0.75rem', marginTop: '0.4rem' }}>
                            {savingStates[day.id] === 'saving' && <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Saving...</span>}
                            {savingStates[day.id] === 'saved' && <span style={{ color: '#30d158', fontWeight: 600 }}>Saved</span>}
                            {savingStates[day.id] === 'error' && <span style={{ color: '#ff2d55', fontWeight: 600 }}>Error</span>}
                          </div>

                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Plan;
