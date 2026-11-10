import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import { Pill, Check, RotateCcw, Edit2, Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 30;

const Meds = () => {
  const { getAuthHeaders } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [medNameInput, setMedNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

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

  // Automatically navigate to the page containing today
  useEffect(() => {
    if (schedule?.startDate) {
      const start = new Date(schedule.startDate);
      start.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const totalCourseDays = schedule?.durationDays || 60;
      if (diffDays >= 1 && diffDays <= totalCourseDays) {
        setCurrentPage(Math.floor((diffDays - 1) / PAGE_SIZE));
      }
    }
  }, [schedule]);

  useEffect(() => {
    const handleMedLogUpdated = (e) => {
      const { log } = e.detail || {};
      if (log) {
        setLogs(prev => {
          const normalizedDateStr = getLocalDateString(new Date(log.date));
          const exists = prev.some(l => getLocalDateString(new Date(l.date)) === normalizedDateStr);
          if (exists) {
            return prev.map(l => getLocalDateString(new Date(l.date)) === normalizedDateStr ? log : l);
          } else {
            return [...prev, log];
          }
        });
      }
    };
    window.addEventListener('med-log-updated', handleMedLogUpdated);
    return () => window.removeEventListener('med-log-updated', handleMedLogUpdated);
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

      window.dispatchEvent(new CustomEvent('med-log-updated', {
        detail: {
          date: dateStr,
          type,
          value: !currentValue,
          log: updatedLog
        }
      }));
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleResetCourse = async () => {
    const duration = schedule?.durationDays || 60;
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
          medName: medNameInput,
          durationDays: 60
        })
      });

      if (!res.ok) throw new Error('Failed to reset course');
      const data = await res.json();
      setSchedule(data);
      setLogs([]);
      setEditingName(false);
      setCurrentPage(0);
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
      const res = await fetch(`${API_BASE_URL}/api/meds/schedule`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          medName: medNameInput.trim()
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

  // Calculate day index (1-60)
  const totalDuration = schedule?.durationDays || 60;
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

  for (let i = 0; i < totalDuration; i++) {
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
  const completionPercentage = Math.round((completedDaysCount / totalDuration) * 100);

  // Pagination calculations (30 days per page)
  const totalPages = Math.ceil(totalDuration / PAGE_SIZE);
  const validPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const startIndex = validPage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalDuration);
  const displayedGridDays = gridDays.slice(startIndex, endIndex);

  return (
    <div className="meds-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minHeight: 'calc(100vh - 8rem)' }}>
      
      {/* Banner / Header */}
      <header className="page-header tone-meds">
        <div className="page-header-main">
          <div className="page-header-icon">
            <Pill size={20} />
          </div>
          <div>
            {editingName ? (
              <form onSubmit={handleUpdateMedName} className="page-header-rename">
                <input
                  type="text"
                  value={medNameInput}
                  onChange={(e) => setMedNameInput(e.target.value)}
                  className="input-control"
                  autoFocus
                />
                <button type="submit" className="ui-btn ui-btn-primary" disabled={submitting}>Save</button>
                <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setEditingName(false)}>Cancel</button>
              </form>
            ) : (
              <div className="page-header-title-row">
                <h1 className="page-header-title">{schedule.medName}</h1>
                <button className="ui-icon-btn" onClick={() => setEditingName(true)} title="Rename medication">
                  <Edit2 size={14} />
                </button>
              </div>
            )}
            <p className="page-header-subtitle">2 pills a day for {totalDuration} days, morning and after dinner</p>
          </div>
        </div>

        <button 
          onClick={handleResetCourse}
          className="ui-btn ui-btn-secondary"
          title="Restart the course from today"
          disabled={submitting}
        >
          <RotateCcw size={14} />
          <span>Reset course</span>
        </button>
      </header>

      <div className="meds-layout">
        
        {/* Left Side: Check-in & Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Daily Tracker check-in card */}
          <div className="glass-card glow-med" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <Calendar size={18} color="#ff2d55" />
              <span>Today's log</span>
              {currentDayNum >= 1 && currentDayNum <= totalDuration ? (
                <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(255, 45, 85, 0.08)', color: '#ff2d55', borderColor: 'rgba(255, 45, 85, 0.15)' }}>
                  Day {currentDayNum} of {totalDuration}
                </span>
              ) : currentDayNum > totalDuration ? (
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
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: todayLog.morning ? '#30d158' : 'var(--text-primary)' }}>Morning pill</div>
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
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: todayLog.evening ? '#30d158' : 'var(--text-primary)' }}>Dinner pill</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Take after 8:00 PM</div>
                </div>
              </button>

            </div>
          </div>

          {/* Stats Card */}
          <div className="glass-card glow-med" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-secondary)' }}>
              Course stats
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Perfect days</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 600, marginTop: '0.2rem', color: '#30d158' }}>{completedDaysCount}</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completion</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 600, marginTop: '0.2rem', color: 'var(--text-primary)' }}>{completionPercentage}%</div>
              </div>
            </div>

            {/* Course limits message */}
            {currentDayNum > totalDuration && (
              <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(48, 209, 88, 0.08)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(48, 209, 88, 0.15)', marginTop: '0.25rem', alignItems: 'center' }}>
                <Check size={16} color="#30d158" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', color: '#30d158', fontWeight: 600 }}>Your {totalDuration}-day course is successfully completed! Click Reset Course to start a new one.</span>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Timeline Grid with Pagination */}
        <div className="glass-card glow-med" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header with Timeline Title and Back / Forward Page Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'var(--font-display)', margin: 0 }}>
                Course timeline
              </h2>
              <span className="badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Days {startIndex + 1}–{endIndex} of {totalDuration}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={validPage === 0}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: validPage === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: validPage === 0 ? 'not-allowed' : 'pointer',
                  opacity: validPage === 0 ? 0.35 : 1,
                  transition: 'all 0.2s ease'
                }}
                className="btn-trash-hover"
                title="Previous 30 Days"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, padding: '0 0.25rem' }}>
                {validPage + 1} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={validPage >= totalPages - 1}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: validPage >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: validPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  opacity: validPage >= totalPages - 1 ? 0.35 : 1,
                  transition: 'all 0.2s ease'
                }}
                className="btn-trash-hover"
                title="Next 30 Days"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* 30-Day Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
            gap: '0.85rem',
            marginTop: '0.25rem'
          }}>
            {displayedGridDays.map((day) => {
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
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600 }}>Day</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.1rem 0 0 0', color: textColor, lineHeight: 1.1 }}>{day.dayNum}</div>
                  
                  {/* Small Date and Day name */}
                  <div style={{ fontSize: '0.52rem', color: 'var(--text-muted)', opacity: 0.85, fontWeight: 600, marginTop: '0.05rem', letterSpacing: '0.01em', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
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
