import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import { Pill, Check, RotateCcw, Edit2, Calendar, AlertCircle } from 'lucide-react';

const Meds = () => {
  const { getAuthHeaders } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [medNameInput, setMedNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const formatDayName = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return weekdays[d.getDay()];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [schedRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/meds/schedule`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/meds/logs`, { headers: getAuthHeaders() })
      ]);

      if (!schedRes.ok || !logsRes.ok) {
        throw new Error('Failed to load medication details');
      }

      const schedData = await schedRes.json();
      const logsData = await logsRes.json();

      setSchedule(schedData);
      setMedNameInput(schedData.medName);
      setLogs(logsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTogglePill = async (dateStr, type, currentValue) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meds/log`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: dateStr,
          [type]: !currentValue
        })
      });

      if (!res.ok) throw new Error('Failed to update medication log');
      const updatedLog = await res.json();

      // Update local state
      setLogs(prev => {
        const normalizedDateStr = getLocalDateString(new Date(updatedLog.date));
        const exists = prev.some(l => getLocalDateString(new Date(l.date)) === normalizedDateStr);
        if (exists) {
          return prev.map(l => getLocalDateString(new Date(l.date)) === normalizedDateStr ? updatedLog : l);
        } else {
          return [...prev, updatedLog];
        }
      });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleResetCourse = async () => {
    const duration = schedule?.durationDays || 30;
    if (!window.confirm(`Are you sure you want to reset your ${duration}-day medication course? This will clear all logging history.`)) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/api/meds/schedule/reset`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          medName: medNameInput
        })
      });

      if (!res.ok) throw new Error('Failed to reset course');
      const data = await res.json();
      setSchedule(data);
      setLogs([]);
      setEditingName(false);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMedName = async (e) => {
    e.preventDefault();
    if (!medNameInput.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/api/meds/schedule/reset`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          medName: medNameInput.trim(),
          startDate: schedule.startDate
        })
      });

      if (!res.ok) throw new Error('Failed to update medication name');
      const data = await res.json();
      setSchedule(data);
      setEditingName(false);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader text="Loading Meds Tracker..." />;
  }

  if (error) {
    return <div className="error-state">Error: {error}</div>;
  }

  // Calculate day index (1-30)
  const start = new Date(schedule.startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const currentDayNum = diffDays;

  // Build grid data for the course duration
  const gridDays = [];
  const todayStr = getLocalDateString(today);

  for (let i = 0; i < (schedule?.durationDays || 30); i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dStr = getLocalDateString(d);
    const log = logs.find(l => getLocalDateString(new Date(l.date)) === dStr);

    const morning = log ? log.morning : false;
    const evening = log ? log.evening : false;
    let status = 'future'; // completed, partial, pending, future

    if (d < today) {
      if (morning && evening) status = 'completed';
      else if (morning || evening) status = 'partial';
      else status = 'pending';
    } else if (dStr === todayStr) {
      if (morning && evening) status = 'completed';
      else if (morning || evening) status = 'partial';
      else status = 'pending';
    }

    gridDays.push({
      dayNum: i + 1,
      dateStr: dStr,
      morning,
      evening,
      status,
      isToday: dStr === todayStr
    });
  }

  const todayLog = gridDays.find(d => d.isToday) || { morning: false, evening: false, dateStr: todayStr };
  const completedDaysCount = gridDays.filter(d => d.status === 'completed').length;
  const completionPercentage = Math.round((completedDaysCount / 29) * 100);

  return (
    <div className="meds-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minHeight: 'calc(100vh - 8rem)' }}>
      
      {/* Banner / Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(255, 45, 85, 0.08)',
            border: '1px solid rgba(255, 45, 85, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(255, 45, 85, 0.15)'
          }}>
            <Pill size={22} color="#ff2d55" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {editingName ? (
                <form onSubmit={handleUpdateMedName} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={medNameInput}
                    onChange={(e) => setMedNameInput(e.target.value)}
                    className="input-control"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '1rem', width: '220px' }}
                    autoFocus
                  />
                  <button type="submit" className="mirror-btn-pill dsa-submit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={submitting}>
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingName(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <h1 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    {schedule.medName} <span className="gradient-text" style={{ background: 'linear-gradient(135deg, #ff2d55, #ff9500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Course</span>
                  </h1>
                  <button 
                    onClick={() => setEditingName(true)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
                    title="Rename Medication"
                  >
                    <Edit2 size={13} />
                  </button>
                </>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', fontSize: '0.8rem' }}>
              Course schedule: 2 pills daily for {schedule?.durationDays || 30} days (Morning & After Dinner)
            </p>
          </div>
        </div>

        <button 
          onClick={handleResetCourse}
          style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', transition: 'all 0.2s ease' }}
          className="btn-trash-hover"
          title="Reset Medication Course"
          disabled={submitting}
        >
          <RotateCcw size={14} />
          <span>Reset Course</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
        
        {/* Left Side: Check-in & Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Daily Tracker check-in card */}
          <div className="glass-card glow-med" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 850, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <Calendar size={18} color="#ff2d55" />
              <span>Today's Log</span>
              {currentDayNum >= 1 && currentDayNum <= (schedule?.durationDays || 30) ? (
                <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(255, 45, 85, 0.08)', color: '#ff2d55', borderColor: 'rgba(255, 45, 85, 0.15)' }}>
                  Day {currentDayNum} of {schedule?.durationDays || 30}
                </span>
              ) : currentDayNum > (schedule?.durationDays || 30) ? (
                <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(48, 209, 88, 0.08)', color: '#30d158', borderColor: 'rgba(48, 209, 88, 0.15)' }}>
                  Course Completed!
                </span>
              ) : (
                <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(255, 204, 0, 0.08)', color: '#ffcc00', borderColor: 'rgba(255, 204, 0, 0.15)' }}>
                  Scheduled
                </span>
              )}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
              
              {/* Morning Pill Button */}
              <button
                onClick={() => handleTogglePill(todayStr, 'morning', todayLog.morning)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: todayLog.morning ? 'rgba(48, 209, 88, 0.25)' : 'var(--med-btn-uncompleted-border, rgba(255, 255, 255, 0.03))',
                  background: todayLog.morning ? 'rgba(48, 209, 88, 0.05)' : 'var(--med-btn-uncompleted-bg, rgba(255, 255, 255, 0.01))',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%'
                }}
              >
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  border: '1.5px solid',
                  borderColor: todayLog.morning ? '#30d158' : 'var(--med-circle-uncompleted-border, rgba(255,255,255,0.15))',
                  background: todayLog.morning ? '#30d158' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: todayLog.morning ? '0 0 10px rgba(48, 209, 88, 0.3)' : 'none',
                  color: '#ffffff',
                  transition: 'all 0.2s ease'
                }}>
                  {todayLog.morning && <Check size={14} strokeWidth={3} />}
                </div>
                <div>
                  <div style={{ fontWeight: 750, fontSize: '0.9rem', color: todayLog.morning ? '#30d158' : 'var(--text-primary)' }}>Morning Pill</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Take before 12:00 PM</div>
                </div>
              </button>

              {/* Dinner Pill Button */}
              <button
                onClick={() => handleTogglePill(todayStr, 'evening', todayLog.evening)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: todayLog.evening ? 'rgba(48, 209, 88, 0.25)' : 'var(--med-btn-uncompleted-border, rgba(255, 255, 255, 0.03))',
                  background: todayLog.evening ? 'rgba(48, 209, 88, 0.05)' : 'var(--med-btn-uncompleted-bg, rgba(255, 255, 255, 0.01))',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%'
                }}
              >
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  border: '1.5px solid',
                  borderColor: todayLog.evening ? '#30d158' : 'var(--med-circle-uncompleted-border, rgba(255,255,255,0.15))',
                  background: todayLog.evening ? '#30d158' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: todayLog.evening ? '0 0 10px rgba(48, 209, 88, 0.3)' : 'none',
                  color: '#ffffff',
                  transition: 'all 0.2s ease'
                }}>
                  {todayLog.evening && <Check size={14} strokeWidth={3} />}
                </div>
                <div>
                  <div style={{ fontWeight: 750, fontSize: '0.9rem', color: todayLog.evening ? '#30d158' : 'var(--text-primary)' }}>Dinner Pill</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Take after 8:00 PM</div>
                </div>
              </button>

            </div>
          </div>

          {/* Stats Card */}
          <div className="glass-card glow-med" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: 'var(--text-secondary)' }}>
              Course Statistics
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Perfect Days</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem', color: '#30d158' }}>{completedDaysCount}</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Completion</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--text-primary)' }}>{completionPercentage}%</div>
              </div>
            </div>

            {/* Course limits message */}
            {currentDayNum > (schedule?.durationDays || 30) && (
              <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(48, 209, 88, 0.08)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(48, 209, 88, 0.15)', marginTop: '0.25rem', alignItems: 'center' }}>
                <Check size={16} color="#30d158" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', color: '#30d158', fontWeight: 600 }}>Your {schedule?.durationDays || 30}-day course is successfully completed! Click Reset Course to start a new one.</span>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Timeline Grid */}
        <div className="glass-card glow-med" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 850, fontFamily: 'var(--font-display)', margin: 0 }}>
            Course Timeline ({schedule?.durationDays || 30} Days)
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
            gap: '0.85rem',
            marginTop: '0.5rem'
          }}>
            {gridDays.map((day) => {
              // Custom borders and glows based on status
              let bg = 'var(--med-bg-future, rgba(255, 255, 255, 0.01))';
              let border = '1px solid var(--med-border-future, rgba(255, 255, 255, 0.03))';
              let textColor = 'var(--text-secondary)';
              let glow = 'none';

              if (day.status === 'completed') {
                bg = 'var(--med-bg-completed, rgba(48, 209, 88, 0.08))';
                border = '1px solid var(--med-border-completed, rgba(48, 209, 88, 0.3))';
                textColor = 'var(--med-color-completed, #30d158)';
                glow = '0 0 10px rgba(48, 209, 88, 0.15)';
              } else if (day.status === 'partial') {
                bg = 'var(--med-bg-partial, rgba(249, 115, 22, 0.08))';
                border = '1px solid var(--med-border-partial, rgba(249, 115, 22, 0.3))';
                textColor = 'var(--med-color-partial, #f97316)';
                glow = '0 0 10px rgba(249, 115, 22, 0.15)';
              } else if (day.status === 'pending') {
                bg = 'var(--med-bg-pending, rgba(255, 59, 48, 0.05))';
                border = '1px solid var(--med-border-pending, rgba(255, 59, 48, 0.25))';
                textColor = 'var(--med-color-pending, #ff3b30)';
              }

              if (day.isToday) {
                border = '1.5px solid var(--accent-primary)';
                glow = '0 0 15px rgba(99, 102, 241, 0.25)';
              }

              return (
                <div
                  key={day.dayNum}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.85rem 0.5rem',
                    borderRadius: '12px',
                    background: bg,
                    border,
                    boxShadow: glow,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    transform: day.isToday ? 'scale(1.05)' : 'none',
                    zIndex: day.isToday ? 2 : 1
                  }}
                  title={`Date: ${day.dateStr}`}
                >
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Day</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.1rem 0 0 0', color: textColor, lineHeight: 1.1 }}>{day.dayNum}</div>
                  
                  {/* Small Date and Day name */}
                  <div style={{ fontSize: '0.52rem', color: 'var(--text-muted)', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', marginTop: '0.05rem', letterSpacing: '0.01em', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                    <span>{formatDateLabel(day.dateStr)}</span>
                    <span style={{ fontSize: '0.48rem', opacity: 0.7, fontWeight: 500 }}>{formatDayName(day.dateStr)}</span>
                  </div>
                  
                  {/* Visual pill completion indicators */}
                  <div style={{ display: 'flex', gap: '3px', marginTop: '0.25rem' }}>
                    <div style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: day.morning ? 'var(--med-color-completed, #30d158)' : 'var(--med-dot-empty, rgba(255,255,255,0.1))'
                    }} title="Morning Pill" />
                    <div style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: day.evening ? 'var(--med-color-completed, #30d158)' : 'var(--med-dot-empty, rgba(255,255,255,0.1))'
                    }} title="Dinner Pill" />
                  </div>

                  {day.isToday && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-4px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                      border: '1.5px solid #000000',
                      boxShadow: '0 0 8px var(--accent-primary)'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Meds;
