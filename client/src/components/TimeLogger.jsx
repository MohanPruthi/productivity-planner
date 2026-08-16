import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Settings, Play, Pause, RotateCcw, Timer, X, Flame, ChevronLeft, ChevronRight, Skull } from 'lucide-react';
import { API_BASE_URL } from '../config';

const TimeLogger = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAuthHeaders } = useAuth();
  
  // Settings States (stored in localStorage)
  const [weekdayTarget, setWeekdayTarget] = useState(() => {
    const saved = localStorage.getItem('target_weekday');
    return saved ? parseFloat(saved) : 2.0; // hours
  });
  const [weekendTarget, setWeekendTarget] = useState(() => {
    const saved = localStorage.getItem('target_weekend');
    return saved ? parseFloat(saved) : 6.0; // hours
  });
  const [pomoWorkMinutes, setPomoWorkMinutes] = useState(() => {
    const saved = localStorage.getItem('pomo_work');
    return saved ? parseInt(saved) : 25;
  });
  const [pomoShortMinutes, setPomoShortMinutes] = useState(() => {
    const saved = localStorage.getItem('pomo_short');
    return saved ? parseInt(saved) : 5;
  });
  const [pomoLongMinutes, setPomoLongMinutes] = useState(() => {
    const saved = localStorage.getItem('pomo_long');
    return saved ? parseInt(saved) : 15;
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Unified clock tracking states
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [isMainClockRunning, setIsMainClockRunning] = useState(false);
  const [lastSyncSeconds, setLastSyncSeconds] = useState(0);

  // Pomodoro States
  const [pomoMode, setPomoMode] = useState('work'); // 'work' | 'shortBreak' | 'longBreak'
  const [pomoSecondsRemaining, setPomoSecondsRemaining] = useState(pomoWorkMinutes * 60);
  const [isPomoActive, setIsPomoActive] = useState(false);
  const [pomoCycle, setPomoCycle] = useState(() => {
    const tested = localStorage.getItem('pomo_cycle_mimic_3');
    if (!tested) {
      localStorage.setItem('pomo_cycle_mimic_3', 'true');
      localStorage.setItem('pomo_cycle', '3');
      return 3;
    }
    return parseInt(localStorage.getItem('pomo_cycle') || '0', 10);
  });

  useEffect(() => {
    localStorage.setItem('pomo_cycle', pomoCycle);
  }, [pomoCycle]);

  // DB study log states
  const [studyLogs, setStudyLogs] = useState([]);
  const [currentDateString, setCurrentDateString] = useState('');

  // Calendar navigation states (fixed to 2026)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return today.getFullYear() === 2026 ? today.getMonth() : 6; // Default to July 2026
  });
  const [calendarYear] = useState(2026);

  const pomoStartTimeRef = useRef(null);
  const pomoSecondsAtStartRef = useRef(0);
  const trackingStartTimeRef = useRef(null);
  const secondsAtStartRef = useRef(0);

  // Normalize dates helper
  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDateStr = searchParams.get('date') || getLocalDateString(new Date());

  useEffect(() => {
    setCurrentDateString(getLocalDateString());
  }, []);

  const [plannedDates, setPlannedDates] = useState(new Set());

  const fetchPlannedDates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/history`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const groups = await res.json();
        const dates = new Set();
        groups.forEach(g => {
          if (g.planDays?.length > 0 || g.normalTasks?.length > 0) {
            dates.add(g.date);
          }
        });
        setPlannedDates(dates);
      }
    } catch (err) {
      console.error('Error fetching planned dates:', err);
    }
  };

  // Fetch study logs from backend
  const fetchStudyLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/study-logs`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const logs = await res.json();
        setStudyLogs(logs);

        // Find today's log
        const todayStr = getLocalDateString();
        const todayLog = logs.find(log => {
          const logDateStr = getLocalDateString(new Date(log.date));
          return logDateStr === todayStr;
        });

        if (todayLog) {
          const initialSecs = Math.round(todayLog.duration * 60);
          setTodaySeconds(initialSecs);
          setLastSyncSeconds(initialSecs);
        }
      }
    } catch (err) {
      console.error('Error fetching study logs:', err);
    }
  };

  useEffect(() => {
    fetchStudyLogs();
    fetchPlannedDates();
  }, [selectedDateStr]);

  // Save current duration to DB
  const syncStudyTime = async (secondsToSync) => {
    const minutes = parseFloat((secondsToSync / 60).toFixed(2));
    const todayStr = getLocalDateString();
    try {
      const res = await fetch(`${API_BASE_URL}/api/study-logs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: todayStr,
          duration: minutes,
        }),
      });
      if (res.ok) {
        setLastSyncSeconds(secondsToSync);
        // Refresh logs
        const logsRes = await fetch(`${API_BASE_URL}/api/study-logs`, {
          headers: getAuthHeaders(),
        });
        if (logsRes.ok) {
          const logs = await logsRes.json();
          setStudyLogs(logs);
        }
      }
    } catch (err) {
      console.error('Error syncing study time:', err);
    }
  };
  const isCurrentlyTracking = isMainClockRunning || (isPomoActive && pomoMode === 'work');

  // Sync start timestamps when tracking state changes
  useEffect(() => {
    if (isCurrentlyTracking) {
      trackingStartTimeRef.current = Date.now();
      secondsAtStartRef.current = todaySeconds;
    } else {
      trackingStartTimeRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentlyTracking]);

  // Sync start timestamps when Pomodoro state changes
  useEffect(() => {
    if (isPomoActive) {
      pomoStartTimeRef.current = Date.now();
      pomoSecondsAtStartRef.current = pomoSecondsRemaining;
    } else {
      pomoStartTimeRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPomoActive, pomoMode]);

  // Clock ticking logic using real system time (survives tab sleep/backgrounding)
  useEffect(() => {
    let interval = null;
    if (isCurrentlyTracking && trackingStartTimeRef.current) {
      interval = setInterval(() => {
        const elapsedMs = Date.now() - trackingStartTimeRef.current;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        const currentTotal = secondsAtStartRef.current + elapsedSecs;

        // Rollover check
        const nowStr = getLocalDateString();
        if (nowStr !== currentDateString) {
          syncStudyTime(currentTotal);
          trackingStartTimeRef.current = Date.now();
          secondsAtStartRef.current = 0;
          setTodaySeconds(0);
          setLastSyncSeconds(0);
          setCurrentDateString(nowStr);
          return;
        }

        // 30-sec sync to minimize error and reduce CPU load
        if (currentTotal - lastSyncSeconds >= 30) {
          syncStudyTime(currentTotal);
        }

        setTodaySeconds(currentTotal);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCurrentlyTracking, lastSyncSeconds, currentDateString]);

  // Sync on manual pause
  useEffect(() => {
    if (!isCurrentlyTracking && todaySeconds > 0 && todaySeconds !== lastSyncSeconds) {
      syncStudyTime(todaySeconds);
    }
  }, [isCurrentlyTracking]);

  // Pomodoro ticking logic using real system time
  useEffect(() => {
    let pomoInterval = null;
    if (isPomoActive && pomoStartTimeRef.current) {
      pomoInterval = setInterval(() => {
        const elapsedMs = Date.now() - pomoStartTimeRef.current;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        const remaining = Math.max(0, pomoSecondsAtStartRef.current - elapsedSecs);

        setPomoSecondsRemaining(remaining);

        if (remaining === 0) {
          setIsPomoActive(false);
          pomoStartTimeRef.current = null;
          handlePomoPeriodComplete();
        }
      }, 1000);
    } else if (isPomoActive && pomoSecondsRemaining === 0) {
      handlePomoPeriodComplete();
    }
    return () => clearInterval(pomoInterval);
  }, [isPomoActive]);

  // Handle tab focus events to catch up instantly
  useEffect(() => {
    const handleFocus = () => {
      // Catch up study timer
      if (isCurrentlyTracking && trackingStartTimeRef.current) {
        const elapsedMs = Date.now() - trackingStartTimeRef.current;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        const currentTotal = secondsAtStartRef.current + elapsedSecs;
        setTodaySeconds(currentTotal);
        syncStudyTime(currentTotal);
      }
      // Catch up Pomodoro timer
      if (isPomoActive && pomoStartTimeRef.current) {
        const elapsedMs = Date.now() - pomoStartTimeRef.current;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        const remaining = Math.max(0, pomoSecondsAtStartRef.current - elapsedSecs);
        setPomoSecondsRemaining(remaining);
        if (remaining === 0) {
          setIsPomoActive(false);
          pomoStartTimeRef.current = null;
          handlePomoPeriodComplete();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isCurrentlyTracking, isPomoActive, lastSyncSeconds]);

  const playPomoBell = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const playChime = (freq, time, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.start(time);
        osc.stop(time + duration);
      };

      playChime(659.25, ctx.currentTime, 0.3); // E5
      playChime(880, ctx.currentTime + 0.15, 0.5); // A5
    } catch (e) {
      console.warn('Audio feedback blocked by browser policies.', e);
    }
  };

  const handlePomoPeriodComplete = () => {
    setIsPomoActive(false);
    playPomoBell();

    if (pomoMode === 'work') {
      const nextCycle = pomoCycle + 1;
      setPomoCycle(nextCycle);

      if (nextCycle % 4 === 0) {
        setPomoMode('longBreak');
        setPomoSecondsRemaining(pomoLongMinutes * 60);
        alert('Focus block complete! Take a long break.');
      } else {
        setPomoMode('shortBreak');
        setPomoSecondsRemaining(pomoShortMinutes * 60);
        alert('Focus block complete! Take a short break.');
      }
    } else {
      if (pomoMode === 'longBreak') {
        setPomoCycle(0);
      }
      setPomoMode('work');
      setPomoSecondsRemaining(pomoWorkMinutes * 60);
      alert('Break finished! Let\'s focus again.');
    }
  };

  const startPomo = () => {
    if (!isPomoActive) {
      pomoStartTimeRef.current = new Date();
    }
    setIsPomoActive(true);
  };

  const resetPomo = (newMode = pomoMode) => {
    setIsPomoActive(false);
    setPomoMode(newMode);
    if (newMode === 'work') {
      setPomoSecondsRemaining(pomoWorkMinutes * 60);
    } else if (newMode === 'shortBreak') {
      setPomoSecondsRemaining(pomoShortMinutes * 60);
    } else if (newMode === 'longBreak') {
      setPomoSecondsRemaining(pomoLongMinutes * 60);
    }
  };

  // Save Settings
  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('target_weekday', weekdayTarget);
    localStorage.setItem('target_weekend', weekendTarget);
    localStorage.setItem('pomo_work', pomoWorkMinutes);
    localStorage.setItem('pomo_short', pomoShortMinutes);
    localStorage.setItem('pomo_long', pomoLongMinutes);
    
    if (!isPomoActive) {
      if (pomoMode === 'work') setPomoSecondsRemaining(pomoWorkMinutes * 60);
      else if (pomoMode === 'shortBreak') setPomoSecondsRemaining(pomoShortMinutes * 60);
      else if (pomoMode === 'longBreak') setPomoSecondsRemaining(pomoLongMinutes * 60);
    }
    
    setShowSettingsModal(false);
  };

  // Time Digit Renderer (Clean light-weight digits matching reference image)
  const renderReferenceDigits = (seconds, isTicking, activeColor) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontSize: '1.45rem', 
          fontWeight: 800, 
          fontFamily: 'var(--font-display)', 
          color: 'var(--text-primary)', 
          letterSpacing: '-0.03em',
          textShadow: isTicking ? `0 0 12px ${activeColor}70` : 'none',
          transition: 'text-shadow 0.3s ease, color 0.3s ease'
        }}
      >
        <span>{hrs}</span>
        <span className={isTicking ? 'timer-colon' : ''} style={{ margin: '0 1px', opacity: 0.85 }}>:</span>
        <span>{mins}</span>
        <span className={isTicking ? 'timer-colon' : ''} style={{ margin: '0 1px', opacity: 0.85 }}>:</span>
        <span>{secs}</span>
      </div>
    );
  };

  const renderPomoDigits = (seconds, isTicking) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>{mins}</span>
        <span className={isTicking ? 'timer-colon' : ''} style={{ margin: '0 2px' }}>:</span>
        <span>{secs}</span>
      </div>
    );
  };

  // Calendar rendering
  const renderCalendar = () => {
    const year = calendarYear;
    const month = calendarMonth;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const daysArray = [];
    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      daysArray.push(new Date(year, month, d));
    }

    const weekdaysHeader = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const handlePrevMonth = () => {
      if (calendarMonth > 0) {
        setCalendarMonth(prev => prev - 1);
      }
    };

    const handleNextMonth = () => {
      if (calendarMonth < 11) {
        setCalendarMonth(prev => prev + 1);
      }
    };

    return (
      <div className="calendar-widget" style={{ padding: '0' }}>
        <div className="calendar-header-title" style={{ 
          fontSize: '0.8rem', 
          fontWeight: 800, 
          color: 'var(--text-primary)', 
          marginBottom: '0.75rem', 
          textTransform: 'uppercase', 
          letterSpacing: '0.15em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '0 0.25rem'
        }}>
          <button 
            onClick={handlePrevMonth} 
            disabled={calendarMonth === 0}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: calendarMonth === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', opacity: calendarMonth === 0 ? 0.35 : 1, transition: 'color 0.2s' }}
            onMouseOver={(e) => { if (calendarMonth > 0) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <ChevronLeft size={16} />
          </button>
          <span>{monthNames[month]} {year}</span>
          <button 
            onClick={handleNextMonth} 
            disabled={calendarMonth === 11}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: calendarMonth === 11 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', opacity: calendarMonth === 11 ? 0.35 : 1, transition: 'color 0.2s' }}
            onMouseOver={(e) => { if (calendarMonth < 11) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', justifyItems: 'center' }}>
          {/* Header */}
          {weekdaysHeader.map((day, idx) => (
            <div key={idx} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', width: '44px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {day}
            </div>
          ))}
          
          {/* Days */}
          {daysArray.map((dateObj, idx) => {
            if (!dateObj) return <div key={idx} style={{ width: '44px', height: '60px' }} />;

            const dayNum = dateObj.getDate();
            const dateStr = getLocalDateString(dateObj);
            
            // Find study log
            const studyLog = studyLogs.find(l => getLocalDateString(new Date(l.date)) === dateStr);
            const loggedMinutes = studyLog ? studyLog.duration : 0;
            
            // target targetHours
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const targetHours = isWeekend ? weekendTarget : weekdayTarget;
            const targetMinutes = targetHours * 60;
            
            const rawPercentage = targetMinutes > 0 ? (loggedMinutes / targetMinutes) : 0;
            const percentage = Math.min(rawPercentage, 1.0);
            const hasExtra = loggedMinutes > targetMinutes;
            const extraPercentage = hasExtra ? Math.min((loggedMinutes - targetMinutes) / targetMinutes, 1.0) : 0;

            const isToday = dateStr === getLocalDateString(new Date());
            const isSelected = dateStr === selectedDateStr;

            // Determine if something was planned but the user didn't study at all (only for past days)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const isPastDay = dateObj < todayStart;
            const isPlanned = plannedDates.has(dateStr);
            const isSkullDay = isPlanned && loggedMinutes === 0 && isPastDay;

            // Activity colors (Dynamic color based on study completion percentage)
            let ringColor = 'var(--cal-ring-default, rgba(255,255,255,0.06))';
            let trackColor = 'var(--cal-track-default, rgba(255,255,255,0.04))';
            if (isSkullDay) {
              ringColor = 'var(--cal-ring-skull, rgba(255, 45, 85, 0.2))';
              trackColor = 'var(--cal-track-skull, rgba(255, 45, 85, 0.05))';
            } else if (loggedMinutes > 0) {
              if (loggedMinutes >= targetMinutes) {
                ringColor = '#30d158'; // Green for 100% or more target met
                trackColor = 'var(--cal-track-completed, rgba(48, 209, 88, 0.08))';
              } else if (rawPercentage <= 0.30) {
                ringColor = '#ff453a'; // Red for 30% or less
                trackColor = 'var(--cal-track-partial, rgba(255, 69, 58, 0.08))';
              } else {
                ringColor = '#ffd60a'; // Yellow for progress between 30% and 100%
                trackColor = 'var(--cal-track-yellow, rgba(255, 214, 10, 0.08))';
              }
            }

            // Calculate running head angle and coordinates for Apple Fitness style shadow
            let headX = 22;
            let headY = 4;
            let showHeadShadow = false;
            if (loggedMinutes > 0) {
              showHeadShadow = true;
              const shadowPercentage = hasExtra ? extraPercentage : percentage;
              const angle = -Math.PI / 2 + shadowPercentage * 2 * Math.PI;
              headX = 22 + 18 * Math.cos(angle);
              headY = 22 + 18 * Math.sin(angle);
            }

            const totalHrsDecimal = (loggedMinutes / 60).toFixed(1);

            return (
              <div 
                key={idx} 
                onClick={() => navigate(`/?date=${dateStr}`)}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '0.25rem',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                {/* Date above ring */}
                <span 
                  style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    color: isToday 
                      ? '#f97316' 
                      : isSelected 
                      ? 'var(--accent-primary)' 
                      : isSkullDay
                      ? '#ff453a'
                      : 'var(--text-secondary)',
                    opacity: (isToday || isSelected || isSkullDay) ? 1 : 0.8
                  }}
                >
                  {dayNum}
                </span>

                {/* Ring token containing ONLY the study time (e.g. 1.2h) */}
                <div 
                  className="calendar-day-cell" 
                  style={{ 
                    borderColor: isToday 
                      ? '#f97316' 
                      : isSelected 
                      ? 'var(--accent-primary)' 
                      : isSkullDay
                      ? 'rgba(255, 45, 85, 0.25)'
                      : 'rgba(255, 255, 255, 0.03)',
                    borderWidth: (isToday || isSelected) ? '1.5px' : '1px',
                    borderStyle: 'solid',
                    boxShadow: isToday 
                      ? '0 0 10px rgba(249, 115, 22, 0.4)' 
                      : isSelected 
                      ? '0 0 10px rgba(99, 102, 241, 0.4)' 
                      : isSkullDay
                      ? '0 0 8px rgba(255, 45, 85, 0.15)'
                      : 'none',
                    background: isSkullDay
                      ? 'rgba(255, 45, 85, 0.03)'
                      : isWeekend 
                      ? 'rgba(255, 45, 85, 0.05)' 
                      : 'rgba(255, 255, 255, 0.01)',
                    transition: 'all 0.2s ease'
                  }}
                  title={`${totalHrsDecimal} hrs studied / ${targetHours} hrs target`}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.borderColor = isToday 
                      ? '#f97316' 
                      : isSkullDay
                      ? '#ff2d55'
                      : 'var(--accent-primary)';
                    e.currentTarget.style.boxShadow = isToday 
                      ? '0 0 12px rgba(249, 115, 22, 0.45)' 
                      : isSkullDay
                      ? '0 0 12px rgba(255, 45, 85, 0.4)'
                      : '0 0 12px rgba(99, 102, 241, 0.35)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = isToday 
                      ? '#f97316' 
                      : isSelected 
                      ? 'var(--accent-primary)' 
                      : isSkullDay
                      ? 'rgba(255, 45, 85, 0.25)'
                      : 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.boxShadow = isToday 
                      ? '0 0 10px rgba(249, 115, 22, 0.4)' 
                      : isSelected 
                      ? '0 0 10px rgba(99, 102, 241, 0.4)' 
                      : isSkullDay
                      ? '0 0 8px rgba(255, 45, 85, 0.15)'
                      : 'none';
                  }}
                >
                  {/* SVG Ring */}
                  <svg width="44" height="44" style={{ display: 'block', pointerEvents: 'none' }}>
                    <defs>
                      <filter id="cap-shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="-0.4" dy="0.8" stdDeviation="0.8" floodColor="#000000" floodOpacity="0.85" />
                      </filter>
                    </defs>
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      stroke={trackColor}
                      strokeWidth="4.5"
                      fill="transparent"
                    />
                    {percentage > 0 && (
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        stroke={ringColor}
                        strokeWidth="4.5"
                        fill="transparent"
                        strokeDasharray="113.1"
                        strokeDashoffset={113.1 - (113.1 * percentage)}
                        strokeLinecap="round"
                        transform="rotate(-90 22 22)"
                        style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
                      />
                    )}
                    {hasExtra && (
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        stroke="#30d158" // Match base green color
                        strokeWidth="4.5" // Match base width
                        fill="transparent"
                        strokeDasharray="113.1"
                        strokeDashoffset={113.1 - (113.1 * extraPercentage)}
                        strokeLinecap="round"
                        transform="rotate(-90 22 22)"
                        style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
                      />
                    )}
                    {showHeadShadow && (
                      <circle
                        cx={headX}
                        cy={headY}
                        r="2.25"
                        fill={hasExtra ? '#30d158' : ringColor}
                        filter="url(#cap-shadow)"
                      />
                    )}
                  </svg>
                  
                  {/* Text overlay: ONLY study hours inside ring */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'none' }}>
                    {isSkullDay ? (
                      <div style={{ position: 'relative', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* Bones SVG in the background */}
                        <svg 
                          viewBox="0 0 24 24" 
                          width="22" 
                          height="22" 
                          style={{ 
                            position: 'absolute',
                            filter: 'drop-shadow(0 0 5px rgba(255, 45, 85, 0.85))',
                            display: 'block' 
                          }}
                        >
                          <defs>
                            <linearGradient id="boneRedGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ff453a" />
                              <stop offset="60%" stopColor="#ff2d55" />
                              <stop offset="100%" stopColor="#8b1e3f" />
                            </linearGradient>
                          </defs>
                          
                          {/* Bone 1 (TL to BR) */}
                          <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" stroke="url(#boneRedGrad)" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
                          <circle cx="4.25" cy="6.25" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />
                          <circle cx="6.25" cy="4.25" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />
                          <circle cx="17.75" cy="19.75" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />
                          <circle cx="19.75" cy="17.75" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />

                          {/* Bone 2 (TR to BL) */}
                          <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" stroke="url(#boneRedGrad)" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
                          <circle cx="19.75" cy="6.25" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />
                          <circle cx="17.75" cy="4.25" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />
                          <circle cx="6.25" cy="19.75" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />
                          <circle cx="4.25" cy="17.75" r="1.5" fill="url(#boneRedGrad)" opacity="0.65" />

                          {/* Mask shape to block out bone intersection under the skull */}
                          <circle cx="12" cy="11.5" r="5.5" fill="var(--bg-secondary)" />
                          <rect x="9" y="14.5" width="6" height="4.5" rx="1.2" fill="var(--bg-secondary)" />
                        </svg>
                        
                        {/* Lucide Skull (outlined skull we had earlier) */}
                        <Skull 
                          size={15} 
                          color="#ff2d55" 
                          style={{ 
                            zIndex: 2, 
                            filter: 'drop-shadow(0 0 3px rgba(255, 45, 85, 0.75))',
                            position: 'relative'
                          }} 
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: loggedMinutes > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {totalHrsDecimal}h
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const todayDateObj = new Date();
  const isWeekendToday = todayDateObj.getDay() === 0 || todayDateObj.getDay() === 6;
  const currentTodayTargetHours = isWeekendToday ? weekendTarget : weekdayTarget;

  // Retrieve active style variables for Pomodoro Start button
  const getPomoBtnStyles = () => {
    if (pomoMode === 'work') {
      return {
        '--pomo-btn-bg': 'linear-gradient(135deg, var(--track-dsa-start), var(--track-dsa-end), var(--track-dsa-start))',
        '--pomo-glow-color': 'rgba(249, 115, 22, 0.35)'
      };
    } else if (pomoMode === 'shortBreak') {
      return {
        '--pomo-btn-bg': 'linear-gradient(135deg, var(--track-sd-start), var(--track-sd-end), var(--track-sd-start))',
        '--pomo-glow-color': 'rgba(16, 185, 129, 0.35)'
      };
    } else {
      return {
        '--pomo-btn-bg': 'linear-gradient(135deg, var(--track-ai-start), var(--track-ai-end), var(--track-ai-start))',
        '--pomo-glow-color': 'rgba(59, 130, 246, 0.35)'
      };
    }
  };

  // Math coordinates for Daily Lock-In Progress Tip Dot (Center 90, Radius 72)
  const todayPercentage = Math.min(todaySeconds / (currentTodayTargetHours * 3600), 1.0);
  const angleDeg = (todayPercentage * 360) - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const lockinDotX = 90 + 72 * Math.cos(angleRad);
  const lockinDotY = 90 + 72 * Math.sin(angleRad);

  // Dynamic colors based on completion percentage (calendar rules)
  let activeRingColor = '#ff3b30'; // Pure Red default
  let activeGlowColor = 'rgba(255, 59, 48, 0.4)';
  let activeGradientStart = '#ff3b30';
  let activeGradientEnd = '#ff453a';
  let activeTrackColor = 'var(--timer-track-work, rgba(255, 59, 48, 0.04))';

  if (todaySeconds > 0) {
    if (todaySeconds >= currentTodayTargetHours * 3600) {
      activeRingColor = '#28cd41'; // Pure Green
      activeGlowColor = 'rgba(40, 205, 65, 0.4)';
      activeGradientStart = '#28cd41';
      activeGradientEnd = '#30d158';
      activeTrackColor = 'var(--timer-track-break, rgba(40, 205, 65, 0.04))';
    } else if (todayPercentage <= 0.3) {
      activeRingColor = '#ff3b30'; // Pure Red
      activeGlowColor = 'rgba(255, 59, 48, 0.4)';
      activeGradientStart = '#ff3b30';
      activeGradientEnd = '#ff453a';
      activeTrackColor = 'var(--timer-track-work, rgba(255, 59, 48, 0.04))';
    } else {
      activeRingColor = '#ffcc00'; // Pure Yellow
      activeGlowColor = 'rgba(255, 204, 0, 0.4)';
      activeGradientStart = '#ffcc00';
      activeGradientEnd = '#ffd60a';
      activeTrackColor = 'var(--timer-track-long, rgba(255, 204, 0, 0.04))';
    }
  } else {
    activeRingColor = '#ff3b30';
    activeGlowColor = 'rgba(255, 59, 48, 0.2)';
    activeGradientStart = '#ff3b30';
    activeGradientEnd = '#ff453a';
    activeTrackColor = 'var(--timer-track-default, rgba(255, 255, 255, 0.03))';
  }

  return (
    <aside className="timelogger-aside">
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="animated-gradient-orange" style={{ fontSize: '1.3rem', fontFamily: 'var(--font-display)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
          Zen Zone
        </h2>
        <button 
          onClick={() => setShowSettingsModal(true)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
          className="settings-gear-btn"
          title="Open settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* 1. Focus Logger */}
      <div 
        className="timelogger-card"
        style={{
          boxShadow: isCurrentlyTracking 
            ? `0 12px 30px rgba(0, 0, 0, 0.4), 0 0 20px ${activeRingColor}22` 
            : 'none',
          borderColor: isCurrentlyTracking 
            ? `${activeRingColor}30` 
            : 'rgba(255, 255, 255, 0.025)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Flame size={15} color={activeRingColor} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>Focus Logger</span>
              <span style={{ fontSize: '0.62rem', color: 'rgba(156, 163, 175, 0.65)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.08rem' }}>Target: {currentTodayTargetHours}h</span>
            </div>
          </div>
          {isCurrentlyTracking && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: `${activeRingColor}15`, padding: '0.2rem 0.6rem', borderRadius: '9999px', border: `1px solid ${activeRingColor}30` }}>
               <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: activeRingColor, boxShadow: `0 0 6px ${activeRingColor}` }} />
               <span style={{ fontSize: '0.65rem', fontWeight: 700, color: activeRingColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locked In</span>
             </div>
          )}
        </div>

        {/* Big visual timer & Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', margin: '1.5rem 0 0.5rem 0' }}>
          
          {/* Left Button: Start/Pause */}
          <div>
            {isCurrentlyTracking ? (
              <button 
                className="mirror-btn start-btn"
                onClick={() => {
                  setIsMainClockRunning(false);
                  setIsPomoActive(false);
                }}
                title="Pause Lock-In"
              >
                <Pause size={18} />
              </button>
            ) : (
              <button 
                className="mirror-btn start-btn" 
                onClick={() => setIsMainClockRunning(true)}
                title="Start Lock-In"
              >
                <Play size={18} fill="currentColor" style={{ marginRight: '-2px' }} />
              </button>
            )}
          </div>

          {/* Center: Main Ring */}
          <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg 
              width="180" height="180" 
              style={{ position: 'absolute', top: -10, left: -10, overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="lockinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={activeGradientStart} />
                  <stop offset="100%" stopColor={activeGradientEnd} />
                </linearGradient>
              </defs>
              {/* Background Track (Thick bubbly 3D base, r=72, center=90) */}
              <circle cx="90" cy="90" r="72" stroke={activeTrackColor} strokeWidth="12" fill="transparent" />
              
              {/* Active Progress */}
              <circle
                cx="90" cy="90" r="72"
                stroke="url(#lockinGrad)"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray="452.39"
                strokeDashoffset={452.39 - (452.39 * todayPercentage)}
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
                style={{ 
                  transition: 'stroke-dashoffset 0.4s ease-out',
                  filter: isCurrentlyTracking ? `drop-shadow(0 0 10px ${activeGlowColor})` : 'none'
                }}
              />

              {/* Neon Glowy Tail (larger stroke, blurred beneath progress) */}
              {isCurrentlyTracking && (
                <circle
                  cx="90" cy="90" r="72"
                  stroke="url(#lockinGrad)"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray="452.39"
                  strokeDashoffset={452.39 - (452.39 * todayPercentage)}
                  strokeLinecap="round"
                  transform="rotate(-90 90 90)"
                  style={{ 
                    transition: 'stroke-dashoffset 0.4s ease-out',
                    opacity: 0.35,
                    filter: 'blur(5px)',
                    pointerEvents: 'none'
                  }}
                />
              )}

              {/* 3D Glossy highlight stroke */}
              {todayPercentage > 0 && (
                <circle
                  cx="90" cy="90" r="72"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray="452.39"
                  strokeDashoffset={452.39 - (452.39 * todayPercentage)}
                  strokeLinecap="round"
                  transform="rotate(-90 90 90)"
                  style={{ 
                    transition: 'stroke-dashoffset 0.4s ease-out',
                    mixBlendMode: 'overlay',
                    pointerEvents: 'none'
                  }}
                />
              )}
              
              {/* Glowing Dot - stays mounted to transition back to 0 smoothly */}
              <circle
                cx={lockinDotX}
                cy={lockinDotY}
                r="5"
                fill="#ffffff"
                style={{ 
                  filter: `drop-shadow(0 0 6px ${activeRingColor}) drop-shadow(0 0 2px #ffffff)`,
                  transition: 'cx 0.4s ease-out, cy 0.4s ease-out, opacity 0.4s ease-out',
                  opacity: todaySeconds > 0 ? 1 : 0,
                  pointerEvents: 'none'
                }}
              />
            </svg>

            {/* Time digits inside ring (Only time!) */}
            <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
              {renderReferenceDigits(todaySeconds, isCurrentlyTracking, activeRingColor)}
            </div>
          </div>

          {/* Right Button: Reset */}
          <div>
            <button 
              className="mirror-btn reset-btn" 
              onClick={() => {
                if (window.confirm('Reset today\'s study tracker to 0?')) {
                  setIsMainClockRunning(false);
                  setTodaySeconds(0);
                  syncStudyTime(0);
                }
              }}
              title="Reset Lock-In"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Calendar Card */}
      <div className="timelogger-card calendar-card">
        {renderCalendar()}
      </div>

      {/* 3. Pomodoro Section Card */}
      <div className="timelogger-card">
        {/* Pomodoro Heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem' }}>
          <Timer size={15} color="#ff9500" />
          <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>Pomodoro Timer</span>
        </div>

        {/* Header Tabs: Focus, Short, Long */}
        <div className="pomo-tabs-grid">
          <button 
            className={`pomo-tab-col ${pomoMode === 'work' ? 'active-work' : ''}`}
            onClick={() => resetPomo('work')}
            style={{ border: 'none' }}
          >
            <span className="pomo-tab-label">Focus</span>
            <span className="pomo-tab-time">{pomoWorkMinutes}m</span>
          </button>
          
          <button 
            className={`pomo-tab-col ${pomoMode === 'shortBreak' ? 'active-short' : ''}`}
            onClick={() => resetPomo('shortBreak')}
            style={{ border: 'none' }}
          >
            <span className="pomo-tab-label">Short</span>
            <span className="pomo-tab-time">{pomoShortMinutes}m</span>
          </button>

          <button 
            className={`pomo-tab-col ${pomoMode === 'longBreak' ? 'active-long' : ''}`}
            onClick={() => resetPomo('longBreak')}
            style={{ 
              border: 'none',
              cursor: pomoCycle < 4 ? 'not-allowed' : 'pointer'
            }}
            disabled={pomoCycle < 4}
            title={pomoCycle < 4 ? `Complete ${4 - pomoCycle} more Focus session(s) to unlock Long Break` : 'Long Break'}
          >
            <span className="pomo-tab-label" style={{ opacity: pomoCycle < 4 ? 0.35 : 1 }}>Long</span>
            <span className="pomo-tab-time" style={{ opacity: pomoCycle < 4 ? 0.35 : 1 }}>{pomoLongMinutes}m</span>
            
            {/* Small dots inside the Long Break button itself */}
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '5px' }}>
              {[0, 1, 2, 3].map(index => {
                const isCompleted = pomoCycle > index;
                return (
                  <div 
                    key={index} 
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      border: '1px solid var(--text-secondary, #9ca3af)',
                      background: isCompleted ? '#30d158' : 'rgba(255, 255, 255, 0.05)',
                      boxShadow: isCompleted ? '0 0 5px #30d158' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                );
              })}
            </div>
          </button>
        </div>

        {/* Big visual timer & Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', margin: '0.75rem 0 0.5rem 0' }}>
          
          {/* Left Button: Start/Pause */}
          <div>
            {isPomoActive ? (
              <button 
                className={`mirror-btn pomo-start-btn ${pomoMode}`}
                onClick={() => setIsPomoActive(false)}
                title="Pause Pomodoro"
              >
                <Pause size={18} />
              </button>
            ) : (
              <button 
                className={`mirror-btn pomo-start-btn ${pomoMode}`} 
                onClick={startPomo}
                title="Start Focus"
              >
                <Play size={18} fill="currentColor" style={{ marginRight: '-2px' }} />
              </button>
            )}
          </div>

          {/* Center: Big visual timer */}
          <div className={`pomo-big-timer ${pomoMode === 'work' ? 'glow-work' : pomoMode === 'shortBreak' ? 'glow-short' : 'glow-long'}`} style={{ margin: 0 }}>
            {renderPomoDigits(pomoSecondsRemaining, isPomoActive)}
          </div>

          {/* Right Button: Reset */}
          <div>
            <button 
              className="mirror-btn reset-btn" 
              onClick={() => {
                resetPomo(pomoMode);
                setPomoCycle(0);
              }}
              title="Reset Timer & Cycles"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal (Overlay) */}
      {showSettingsModal && (
        <div className="modal-backdrop" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div 
            className="modal-content" 
            style={{ 
              position: 'relative', 
              maxWidth: '400px', 
              background: 'rgba(10, 10, 12, 0.9)',
              border: '1.5px solid rgba(255, 45, 85, 0.15)',
              boxShadow: '0 24px 50px rgba(0, 0, 0, 0.7), 0 0 20px rgba(255, 45, 85, 0.05)',
              padding: '1.75rem 1.5rem',
              borderRadius: '24px'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowSettingsModal(false)}
              style={{ 
                position: 'absolute', 
                top: '1.25rem', 
                right: '1.25rem', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)', 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#ff2d55'; e.currentTarget.style.background = 'rgba(255, 45, 85, 0.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              <X size={14} />
            </button>

            {/* Header: Shifting gradient title */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 
                style={{ 
                  fontSize: '1.35rem', 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  background: 'linear-gradient(to right, #ff453a, #ff9500, #ff2d55, #ff9f0a, #ff453a)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'flowingGradient 4s linear infinite',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Settings size={20} color="#ff453a" style={{ strokeWidth: 2.5 }} />
                <span>Zone Config</span>
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Tune your target hours and Pomodoro timers</p>
            </div>
            
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* TARGET HOURS SECTION */}
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#ff9500', fontWeight: 800, letterSpacing: '0.08em', display: 'block' }}>Daily Study Targets</span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {/* Weekdays Target */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Weekdays (Hrs)</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.15rem' }}>
                      <button 
                        type="button" 
                        onClick={() => setWeekdayTarget(prev => Math.max(0.5, prev - 0.5))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >-</button>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={weekdayTarget}
                        readOnly
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', textAlign: 'center', fontSize: '0.85rem', fontWeight: 750, outline: 'none', padding: 0 }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setWeekdayTarget(prev => prev + 0.5)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >+</button>
                    </div>
                  </div>

                  {/* Weekends Target */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Weekends (Hrs)</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.15rem' }}>
                      <button 
                        type="button" 
                        onClick={() => setWeekendTarget(prev => Math.max(0.5, prev - 0.5))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >-</button>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={weekendTarget}
                        readOnly
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', textAlign: 'center', fontSize: '0.85rem', fontWeight: 750, outline: 'none', padding: 0 }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setWeekendTarget(prev => prev + 0.5)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* POMODORO DURATIONS SECTION */}
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#ff2d55', fontWeight: 800, letterSpacing: '0.08em', display: 'block' }}>Pomodoro Durations (Min)</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Focus duration */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Focus Session</span>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.15rem', width: '100px' }}>
                      <button 
                        type="button" 
                        onClick={() => setPomoWorkMinutes(prev => Math.max(1, prev - 1))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >-</button>
                      <input
                        type="number"
                        min="1"
                        value={pomoWorkMinutes}
                        readOnly
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', textAlign: 'center', fontSize: '0.82rem', fontWeight: 750, outline: 'none', padding: 0 }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setPomoWorkMinutes(prev => prev + 1)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >+</button>
                    </div>
                  </div>

                  {/* Short Break */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Short Break</span>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.15rem', width: '100px' }}>
                      <button 
                        type="button" 
                        onClick={() => setPomoShortMinutes(prev => Math.max(1, prev - 1))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >-</button>
                      <input
                        type="number"
                        min="1"
                        value={pomoShortMinutes}
                        readOnly
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', textAlign: 'center', fontSize: '0.82rem', fontWeight: 750, outline: 'none', padding: 0 }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setPomoShortMinutes(prev => prev + 1)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >+</button>
                    </div>
                  </div>

                  {/* Long Break */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Long Break</span>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.15rem', width: '100px' }}>
                      <button 
                        type="button" 
                        onClick={() => setPomoLongMinutes(prev => Math.max(1, prev - 1))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >-</button>
                      <input
                        type="number"
                        min="1"
                        value={pomoLongMinutes}
                        readOnly
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', textAlign: 'center', fontSize: '0.82rem', fontWeight: 750, outline: 'none', padding: 0 }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setPomoLongMinutes(prev => prev + 1)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* APPLY BUTTON */}
              <button 
                type="submit" 
                style={{ 
                  marginTop: '0.5rem',
                  padding: '0.75rem 1.6rem',
                  borderRadius: '9999px',
                  background: 'var(--modal-btn-bg, rgba(255, 45, 85, 0.05))',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid var(--modal-btn-border, rgba(255, 45, 85, 0.25))',
                  boxShadow: 'var(--modal-btn-shadow, 0 4px 15px rgba(255, 45, 85, 0.1))',
                  color: '#ff2d55',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  width: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
                onMouseOver={(e) => { 
                  e.currentTarget.style.transform = 'translateY(-2px)'; 
                  e.currentTarget.style.background = 'var(--modal-btn-bg-hover, rgba(255, 45, 85, 0.15))';
                  e.currentTarget.style.borderColor = 'var(--modal-btn-border-hover, rgba(255, 45, 85, 0.4))';
                  e.currentTarget.style.boxShadow = 'var(--modal-btn-shadow-hover, 0 6px 20px rgba(255, 45, 85, 0.25))';
                  e.currentTarget.style.color = 'var(--modal-btn-color-hover, #ff3b30)';
                }}
                onMouseOut={(e) => { 
                  e.currentTarget.style.transform = 'translateY(0)'; 
                  e.currentTarget.style.background = 'var(--modal-btn-bg, rgba(255, 45, 85, 0.05))';
                  e.currentTarget.style.borderColor = 'var(--modal-btn-border, rgba(255, 45, 85, 0.25))';
                  e.currentTarget.style.boxShadow = 'var(--modal-btn-shadow, 0 4px 15px rgba(255, 45, 85, 0.1))';
                  e.currentTarget.style.color = '#ff2d55';
                }}
              >
                Apply
              </button>

            </form>
          </div>
        </div>
      )}

    </aside>
  );
};

export default TimeLogger;
