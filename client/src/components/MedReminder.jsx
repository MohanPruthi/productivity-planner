import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { Pill, X, Check, Clock } from 'lucide-react';

const DURATION_MS = 5000; // 5-second countdown
const THROTTLE_MS = 40 * 60 * 1000; // 40 minutes

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMedWindow = () => {
  const now = new Date();
  const hour = now.getHours();

  // Morning window: 10:00 AM – 1:00 PM (10:00:00 to 12:59:59)
  if (hour >= 10 && hour < 13) {
    return {
      type: 'morning',
      label: 'Morning Pill',
      timeLabel: '10:00 AM – 1:00 PM',
      targetDateStr: getLocalDateString(now)
    };
  }

  // Night window: 9:00 PM – 1:00 AM (21:00:00 to 00:59:59)
  if (hour >= 21 || hour === 0) {
    let targetDate = now;
    if (hour === 0) {
      // Midnight 12:00 AM - 1:00 AM counts for the night course of the previous day
      targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    return {
      type: 'evening',
      label: 'Night Pill',
      timeLabel: '9:00 PM – 1:00 AM',
      targetDateStr: getLocalDateString(targetDate)
    };
  }

  return null;
};

const MedReminder = () => {
  const { user, getAuthHeaders } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [logs, setLogs] = useState([]);
  const [visible, setVisible] = useState(false);
  const [activeWindow, setActiveWindow] = useState(null);
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const remainingTimeRef = useRef(DURATION_MS);

  // Fetch schedule and logs from server
  const fetchMedData = useCallback(async () => {
    if (!user) return;
    try {
      const [schedRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/meds/schedule`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/meds/logs`, { headers: getAuthHeaders() })
      ]);

      if (schedRes.ok && logsRes.ok) {
        const schedData = await schedRes.json();
        const logsData = await logsRes.json();
        setSchedule(schedData);
        setLogs(logsData || []);
      }
    } catch (err) {
      console.error('Error fetching med reminder data:', err);
    }
  }, [user, getAuthHeaders]);

  useEffect(() => {
    fetchMedData();
  }, [fetchMedData]);

  // Check if reminder should trigger
  const checkReminderEligibility = useCallback(() => {
    if (!schedule || !schedule.startDate) return;

    const currentWin = getCurrentMedWindow();
    if (!currentWin) {
      if (visible) setVisible(false);
      return;
    }

    // Check if course is active
    const start = new Date(schedule.startDate);
    start.setHours(0, 0, 0, 0);
    const targetDate = new Date(currentWin.targetDateStr);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const isCourseActive = diffDays >= 1 && diffDays <= (schedule.durationDays || 60);
    if (!isCourseActive) return;

    // Check if pill is already logged for this window & date
    const log = logs.find(l => getLocalDateString(new Date(l.date)) === currentWin.targetDateStr);
    const isPillLogged = log ? Boolean(log[currentWin.type]) : false;

    if (isPillLogged) {
      if (visible) setVisible(false);
      return;
    }

    // Check 40-minute throttle
    const storageKey = `med_reminder_dismissed_${currentWin.type}_${currentWin.targetDateStr}`;
    const lastDismissedStr = localStorage.getItem(storageKey);
    const lastDismissed = lastDismissedStr ? parseInt(lastDismissedStr, 10) : 0;
    const now = Date.now();

    if (now - lastDismissed >= THROTTLE_MS) {
      if (!visible) {
        setActiveWindow(currentWin);
        remainingTimeRef.current = DURATION_MS;
        setProgress(100);
        setVisible(true);
      }
    }
  }, [schedule, logs, visible]);

  // Periodic check every 20s
  useEffect(() => {
    checkReminderEligibility();
    const interval = setInterval(checkReminderEligibility, 20000);
    return () => clearInterval(interval);
  }, [checkReminderEligibility]);

  // Dismiss handler (stores cooldown timestamp)
  const handleDismiss = useCallback(() => {
    if (activeWindow) {
      const storageKey = `med_reminder_dismissed_${activeWindow.type}_${activeWindow.targetDateStr}`;
      localStorage.setItem(storageKey, Date.now().toString());
    }
    setVisible(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [activeWindow]);

  // Handle Mark as Taken
  const handleMarkAsTaken = async () => {
    if (!activeWindow || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/api/meds/log`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: activeWindow.targetDateStr,
          [activeWindow.type]: true
        })
      });

      if (res.ok) {
        const updatedLog = await res.json();
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
            date: activeWindow.targetDateStr,
            type: activeWindow.type,
            value: true,
            log: updatedLog
          }
        }));

        setVisible(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch (err) {
      console.error('Failed to log pill from reminder:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5-second countdown timer management with hover pause
  useEffect(() => {
    if (!visible) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now();
    const initialRemaining = remainingTimeRef.current;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newRemaining = Math.max(0, initialRemaining - elapsed);
      remainingTimeRef.current = newRemaining;

      const pct = (newRemaining / DURATION_MS) * 100;
      setProgress(pct);

      if (newRemaining <= 0) {
        clearInterval(timerRef.current);
        handleDismiss();
      }
    }, 40);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, isHovered, handleDismiss]);

  // Listen for external med log updates
  useEffect(() => {
    const handleMedLogUpdated = (e) => {
      const { date, type, value, log } = e.detail || {};
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

      if (activeWindow && date === activeWindow.targetDateStr && type === activeWindow.type && value) {
        setVisible(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    window.addEventListener('med-log-updated', handleMedLogUpdated);
    return () => window.removeEventListener('med-log-updated', handleMedLogUpdated);
  }, [activeWindow]);

  if (!visible || !activeWindow) return null;

  return (
    <div
      className="med-reminder-toast"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        top: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        width: '380px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'rgba(17, 18, 25, 0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 45, 85, 0.18)',
        borderRadius: '14px',
        boxShadow: '0 12px 35px -5px rgba(0, 0, 0, 0.65), 0 0 16px rgba(255, 45, 85, 0.1)',
        overflow: 'hidden',
        animation: 'medToastSlideInTop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ padding: '0.95rem 1.15rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {/* Header with Icon, Title and Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255, 45, 85, 0.08)',
                border: '1px solid rgba(255, 45, 85, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Pill size={16} color="#ff2d55" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {schedule?.medName ? `${schedule.medName} Reminder` : 'Medication Reminder'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
                <Clock size={10} color="rgba(255, 45, 85, 0.75)" />
                <span style={{ fontSize: '0.68rem', color: '#ff2d55', fontWeight: 600, letterSpacing: '0.01em' }}>
                  {activeWindow.timeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Close 'X' Button */}
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '7px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            className="med-toast-close-btn"
            title="Dismiss reminder"
          >
            <X size={13} />
          </button>
        </div>

        {/* Message */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
          Time to take your <strong style={{ color: '#ff2d55', fontWeight: 600 }}>{activeWindow.label}</strong>! Stay on track with your course.
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.15rem' }}>
          <button
            onClick={handleMarkAsTaken}
            disabled={isSubmitting}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              background: 'rgba(255, 45, 85, 0.07)',
              border: '1px solid rgba(255, 45, 85, 0.25)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="med-toast-action-btn"
          >
            <Check size={13} strokeWidth={2.5} color="#ff2d55" />
            <span>{isSubmitting ? 'Logging...' : 'Mark as Taken'}</span>
          </button>
        </div>
      </div>

      {/* 5-Second Animated Timeout Progress Bar (Subtle Red) */}
      <div
        style={{
          width: '100%',
          height: '2.5px',
          background: 'rgba(255, 255, 255, 0.04)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#ff2d55',
            boxShadow: '0 0 6px rgba(255, 45, 85, 0.4)',
            transition: 'width 0.04s linear'
          }}
        />
      </div>
    </div>
  );
};

export default MedReminder;
