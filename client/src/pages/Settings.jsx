import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  KeyRound, 
  LayoutDashboard, 
  Brain, 
  Layers, 
  Code2, 
  History, 
  Pill, 
  Phone, 
  StickyNote,
  Lock, 
  Unlock, 
  CheckCircle2, 
  Sliders, 
  ChevronRight,
  ChevronDown,
  Flame,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import PinModal from '../components/PinModal';

const Settings = () => {
  const { privacyMode, togglePrivacyMode, getAuthHeaders, workspaceVisibility, updateWorkspaceVisibility } = useAuth();
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Accordion open/collapse states for sections (closed by default)
  const [isZenSectionOpen, setIsZenSectionOpen] = useState(false);
  const [isVisibilitySectionOpen, setIsVisibilitySectionOpen] = useState(false);
  const [isPinSectionOpen, setIsPinSectionOpen] = useState(false);

  // 1. ZEN ZONE SETTINGS STATES
  const [weekdayTarget, setWeekdayTarget] = useState(() => {
    const saved = localStorage.getItem('target_weekday');
    return saved ? parseFloat(saved) : 2.0;
  });
  const [weekendTarget, setWeekendTarget] = useState(() => {
    const saved = localStorage.getItem('target_weekend');
    return saved ? parseFloat(saved) : 6.0;
  });
  const [pomoWorkMinutes, setPomoWorkMinutes] = useState(() => {
    const saved = localStorage.getItem('pomo_work');
    return saved ? parseInt(saved, 10) : 25;
  });
  const [pomoShortMinutes, setPomoShortMinutes] = useState(() => {
    const saved = localStorage.getItem('pomo_short');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [pomoLongMinutes, setPomoLongMinutes] = useState(() => {
    const saved = localStorage.getItem('pomo_long');
    return saved ? parseInt(saved, 10) : 15;
  });
  const [zenSuccessMsg, setZenSuccessMsg] = useState('');

  const handleSaveZenZoneSettings = (e) => {
    if (e) e.preventDefault();
    localStorage.setItem('target_weekday', String(weekdayTarget));
    localStorage.setItem('target_weekend', String(weekendTarget));
    localStorage.setItem('pomo_work', String(pomoWorkMinutes));
    localStorage.setItem('pomo_short', String(pomoShortMinutes));
    localStorage.setItem('pomo_long', String(pomoLongMinutes));

    // Update target history
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    let history = [];
    const savedHist = localStorage.getItem('target_history');
    if (savedHist) {
      try {
        history = JSON.parse(savedHist);
      } catch (err) {
        history = [];
      }
    }
    history = history.filter(h => h.startDate !== todayStr);
    history.push({
      startDate: todayStr,
      weekday: weekdayTarget,
      weekend: weekendTarget
    });
    localStorage.setItem('target_history', JSON.stringify(history));

    window.dispatchEvent(new Event('zen_zone_settings_updated'));
    setZenSuccessMsg('Settings applied successfully!');
    setTimeout(() => setZenSuccessMsg(''), 2500);
  };

  // 2. CHANGE SECURITY PIN STATES
  const [currentPin, setCurrentPin] = useState(['', '', '', '']);
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  const currentRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const newRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const confirmRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const handleDigitChange = (index, value, stateArray, setStateArray, refsArray) => {
    if (value && !/^\d$/.test(value)) return;
    const updated = [...stateArray];
    updated[index] = value;
    setStateArray(updated);
    setPinError('');

    if (value && index < 3 && refsArray[index + 1]?.current) {
      refsArray[index + 1].current.focus();
    }
  };

  const handleDigitKeyDown = (index, e, stateArray, refsArray) => {
    if (e.key === 'Backspace' && !stateArray[index] && index > 0 && refsArray[index - 1]?.current) {
      refsArray[index - 1].current.focus();
    }
  };

  const handleResetPinSubmit = async (e) => {
    if (e) e.preventDefault();
    const currStr = currentPin.join('');
    const newStr = newPin.join('');
    const confirmStr = confirmPin.join('');

    if (currStr.length !== 4) {
      setPinError('Enter current 4-digit PIN.');
      return;
    }
    if (newStr.length !== 4) {
      setPinError('Enter new 4-digit PIN.');
      return;
    }
    if (newStr !== confirmStr) {
      setPinError('New PINs do not match.');
      return;
    }

    try {
      setPinLoading(true);
      setPinError('');
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-pin`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPin: currStr,
          newPin: newStr
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update PIN');
      }

      setPinSuccess('PIN updated successfully!');
      setCurrentPin(['', '', '', '']);
      setNewPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setTimeout(() => setPinSuccess(''), 3000);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinLoading(false);
    }
  };

  // 3. SYSTEMS DEFINITION FOR OFFICE VISIBILITY
  const systems = [
    {
      id: 'dashboard',
      name: 'Dashboard Overview',
      icon: LayoutDashboard,
      color: 'var(--accent-primary)',
      canHideFromDashboard: false
    },
    {
      id: 'aiPlan',
      name: 'AI Study Plan',
      icon: Brain,
      color: 'var(--track-ai-start)',
      canHideFromDashboard: true
    },
    {
      id: 'sdPlan',
      name: 'System Design Plan',
      icon: Layers,
      color: 'var(--track-sd-start)',
      canHideFromDashboard: true
    },
    {
      id: 'dsaLog',
      name: 'DSA Problem Log',
      icon: Code2,
      color: '#ffa116',
      canHideFromDashboard: true
    },
    {
      id: 'taskHistory',
      name: 'Work Board (Kanban)',
      icon: History,
      color: 'var(--accent-secondary)',
      canHideFromDashboard: false
    },
    {
      id: 'meds',
      name: 'Meds Tracker',
      icon: Pill,
      color: '#ff2d55',
      canHideFromDashboard: true
    },
    {
      id: 'hrDirectory',
      name: 'Company Directory',
      icon: Phone,
      color: '#007aff',
      canHideFromDashboard: false
    },
    {
      id: 'notes',
      name: 'Notes & Memos',
      icon: StickyNote,
      color: '#eab308',
      canHideFromDashboard: false
    }
  ];

  return (
    <div className="settings-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%', paddingBottom: '3rem' }}>
      
      {/* Top Header Banner */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '1.5rem 2rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          boxShadow: '0 10px 30px rgba(255,255,255,0.01), inset 0 1px 0 rgba(255,255,255,0.02)',
          borderRadius: '20px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.18)'
          }}>
            <SettingsIcon size={22} color="var(--accent-primary)" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            System <span className="gradient-text">Settings</span>
          </h1>
        </div>

        {/* Current Workspace Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.45rem 0.9rem',
          borderRadius: '12px',
          background: privacyMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(99, 102, 241, 0.08)',
          border: privacyMode ? '1px solid var(--border-light)' : '1px solid rgba(99, 102, 241, 0.25)'
        }}>
          {privacyMode ? <Lock size={15} color="var(--text-muted)" /> : <Unlock size={15} color="var(--accent-primary)" />}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Active Mode
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: privacyMode ? 'var(--text-secondary)' : 'var(--accent-primary)' }}>
              {privacyMode ? 'Office Workspace' : 'Personal Workspace'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. ZEN ZONE TARGETS CARD (Accordion Dropdown)             */}
      {/* ========================================================= */}
      <div 
        className="glass-card" 
        style={{ 
          borderRadius: '20px', 
          overflow: 'hidden',
          border: '1px solid var(--border-light)',
          transition: 'all 0.25s ease'
        }}
      >
        {/* Accordion Header */}
        <div 
          onClick={() => setIsZenSectionOpen(prev => !prev)}
          style={{ 
            padding: '1.25rem 1.75rem',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            userSelect: 'none',
            background: isZenSectionOpen ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
            transition: 'background 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Flame size={18} color="#ff9500" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              Zen Zone Targets
            </h2>
          </div>

          <div 
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isZenSectionOpen ? '#ff9500' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
          >
            {isZenSectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>

        {/* Inner Form: rendered when open */}
        {isZenSectionOpen && (
          <form 
            onSubmit={handleSaveZenZoneSettings} 
            style={{ 
              padding: '1.5rem 1.75rem 1.75rem 1.75rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Daily Study Targets */}
            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#ff9500', fontWeight: 800, letterSpacing: '0.06em', display: 'block', marginBottom: '0.75rem' }}>
                Daily Study Targets
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Weekdays */}
                <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Weekdays</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '0.15rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setWeekdayTarget(prev => Math.max(0, prev - 0.5))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
                    >-</button>
                    <span style={{ width: '38px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800 }}>{weekdayTarget}h</span>
                    <button 
                      type="button" 
                      onClick={() => setWeekdayTarget(prev => prev + 0.5)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
                    >+</button>
                  </div>
                </div>

                {/* Weekends */}
                <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Weekends</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '0.15rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setWeekendTarget(prev => Math.max(0, prev - 0.5))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
                    >-</button>
                    <span style={{ width: '38px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800 }}>{weekendTarget}h</span>
                    <button 
                      type="button" 
                      onClick={() => setWeekendTarget(prev => prev + 0.5)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pomodoro Durations */}
            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#ff2d55', fontWeight: 800, letterSpacing: '0.06em', display: 'block', marginBottom: '0.75rem' }}>
                Pomodoro Durations
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Focus */}
                <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Focus Session</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '0.15rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setPomoWorkMinutes(prev => Math.max(1, prev - 1))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800 }}
                    >-</button>
                    <span style={{ width: '38px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800 }}>{pomoWorkMinutes}m</span>
                    <button 
                      type="button" 
                      onClick={() => setPomoWorkMinutes(prev => prev + 1)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800 }}
                    >+</button>
                  </div>
                </div>

                {/* Short Break */}
                <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Short Break</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '0.15rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setPomoShortMinutes(prev => Math.max(1, prev - 1))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800 }}
                    >-</button>
                    <span style={{ width: '38px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800 }}>{pomoShortMinutes}m</span>
                    <button 
                      type="button" 
                      onClick={() => setPomoShortMinutes(prev => prev + 1)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800 }}
                    >+</button>
                  </div>
                </div>

                {/* Long Break */}
                <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Long Break</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '0.15rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setPomoLongMinutes(prev => Math.max(1, prev - 1))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800 }}
                    >-</button>
                    <span style={{ width: '38px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800 }}>{pomoLongMinutes}m</span>
                    <button 
                      type="button" 
                      onClick={() => setPomoLongMinutes(prev => prev + 1)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 800 }}
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              {zenSuccessMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.82rem', fontWeight: 700 }}>
                  <CheckCircle2 size={16} />
                  <span>{zenSuccessMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="mirror-btn-pill tracker-submit"
                style={{
                  padding: '0.65rem 1.8rem',
                  fontSize: '0.85rem',
                  fontWeight: 750,
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                Apply
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. OFFICE WORKSPACE VISIBILITY (Only in Personal Mode)     */}
      {/* ========================================================= */}
      {!privacyMode && (
        <div 
          className="glass-card" 
          style={{ 
            borderRadius: '20px', 
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
            transition: 'all 0.25s ease'
          }}
        >
          {/* Accordion Header */}
          <div 
            onClick={() => setIsVisibilitySectionOpen(prev => !prev)}
            style={{ 
              padding: '1.25rem 1.75rem',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none',
              background: isVisibilitySectionOpen ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
              transition: 'background 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Sliders size={18} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Office Workspace Visibility
              </h2>
            </div>

            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isVisibilitySectionOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
                transition: 'all 0.2s ease'
              }}
            >
              {isVisibilitySectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </div>

          {/* Inner Content: rendered when open */}
          {isVisibilitySectionOpen && (
            <div 
              style={{ 
                padding: '1.5rem 1.75rem 1.75rem 1.75rem',
                borderTop: '1px solid var(--border-light)',
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem',
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              {systems.map((sys) => {
                const Icon = sys.icon;
                const sysConfig = workspaceVisibility?.[sys.id] || { showInOffice: true, showOnDashboard: true };
                const isShownInOffice = sysConfig.showInOffice !== false;
                const isShownOnDashboard = sysConfig.showOnDashboard !== false;

                return (
                  <div 
                    key={sys.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.015)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '14px',
                      padding: '0.9rem 1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Main Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: sys.color
                        }}>
                          <Icon size={18} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 750 }}>
                            {sys.name}
                          </span>
                          {!isShownInOffice && (
                            <span className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', background: 'rgba(239, 68, 68, 0.08)', color: '#f43f5e', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                              Hidden
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => updateWorkspaceVisibility(sys.id, { showInOffice: !isShownInOffice })}
                        style={{
                          width: '44px',
                          height: '24px',
                          borderRadius: '9999px',
                          background: isShownInOffice ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: isShownInOffice ? 'flex-end' : 'flex-start',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isShownInOffice ? '0 0 10px rgba(99, 102, 241, 0.35)' : 'none'
                        }}
                        title={isShownInOffice ? 'Visible in Office Workspace' : 'Hidden from Office Workspace'}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          transition: 'all 0.25s ease'
                        }} />
                      </button>
                    </div>

                    {/* Sub Option: When showInOffice is FALSE and canHideFromDashboard is TRUE */}
                    {!isShownInOffice && sys.canHideFromDashboard && (
                      <div 
                        style={{
                          marginLeft: '3.1rem',
                          paddingTop: '0.65rem',
                          borderTop: '1px dashed var(--border-light)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          animation: 'fadeIn 0.2s ease-out'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <ChevronRight size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-primary)' }}>
                            Show on Dashboard
                          </span>
                        </div>

                        {/* Sub Toggle */}
                        <button
                          type="button"
                          onClick={() => updateWorkspaceVisibility(sys.id, { showOnDashboard: !isShownOnDashboard })}
                          style={{
                            width: '38px',
                            height: '20px',
                            borderRadius: '9999px',
                            background: isShownOnDashboard ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isShownOnDashboard ? 'flex-end' : 'flex-start',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isShownOnDashboard ? '0 0 8px rgba(99, 102, 241, 0.35)' : 'none'
                          }}
                          title={isShownOnDashboard ? 'Visible on Dashboard' : 'Hidden from Dashboard'}
                        >
                          <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            transition: 'all 0.25s ease'
                          }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CHANGE SECURITY PIN (At Bottom with Accordion)        */}
      {/* ========================================================= */}
      <div 
        className="glass-card" 
        style={{ 
          borderRadius: '20px', 
          overflow: 'hidden',
          border: '1px solid var(--border-light)',
          transition: 'all 0.25s ease'
        }}
      >
        {/* Accordion Header */}
        <div 
          onClick={() => setIsPinSectionOpen(prev => !prev)}
          style={{ 
            padding: '1.25rem 1.75rem',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            userSelect: 'none',
            background: isPinSectionOpen ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
            transition: 'background 0.2s ease'
          }}
        >
          {/* Left Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <KeyRound size={18} color="#007aff" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              Change Security PIN
            </h2>
          </div>

          {/* Right Chevron Icon */}
          <div 
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isPinSectionOpen ? '#007aff' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
          >
            {isPinSectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>

        {/* Inner Form: ONLY rendered while open */}
        {isPinSectionOpen && (
          <form 
            onSubmit={handleResetPinSubmit} 
            style={{ 
              padding: '1.5rem 1.75rem 1.75rem 1.75rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              background: 'rgba(255, 255, 255, 0.008)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
              
              {/* 1. Current PIN */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '1rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
                  Current PIN
                </label>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  {currentPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={currentRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, currentPin, setCurrentPin, currentRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, currentPin, currentRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        borderRadius: '10px',
                        background: digit ? 'rgba(0, 122, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid #007aff' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 2. New PIN */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '1rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
                  New PIN
                </label>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  {newPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={newRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, newPin, setNewPin, newRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, newPin, newRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        borderRadius: '10px',
                        background: digit ? 'rgba(0, 122, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid #007aff' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 3. Confirm New PIN */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '1rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
                  Confirm PIN
                </label>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  {confirmPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={confirmRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, confirmPin, setConfirmPin, confirmRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, confirmPin, confirmRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        borderRadius: '10px',
                        background: digit ? 'rgba(0, 122, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid #007aff' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

            </div>

            {/* Right-aligned Button and Message container */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              {pinError && (
                <p style={{ color: '#ff2d55', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>
                  {pinError}
                </p>
              )}

              {pinSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.8rem', fontWeight: 700 }}>
                  <CheckCircle2 size={16} />
                  <span>{pinSuccess}</span>
                </div>
              )}

              {/* Save Pin Button with exact same UI styling as Apply button */}
              <button
                type="submit"
                disabled={pinLoading}
                className="mirror-btn-pill tracker-submit"
                style={{
                  padding: '0.65rem 1.8rem',
                  fontSize: '0.85rem',
                  fontWeight: 750,
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                {pinLoading ? 'Saving...' : 'Save Pin'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* When NOT in Personal Space: Yellow Glass Unlock Button */}
      {privacyMode && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setIsPinModalOpen(true)}
            className="mirror-btn-pill"
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#fbbf24',
              padding: '0.7rem 1.75rem',
              fontSize: '0.85rem',
              fontWeight: 750,
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25), 0 0 15px rgba(245, 158, 11, 0.1)',
              transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.65)';
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.16)';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)';
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
              e.currentTarget.style.color = '#fbbf24';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.25), 0 0 15px rgba(245, 158, 11, 0.1)';
            }}
          >
            <Unlock size={15} />
            <span>Personal Workspace Settings</span>
          </button>
        </div>
      )}

      {/* PinModal for Unlocking if in Office Mode */}
      <PinModal 
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={togglePrivacyMode}
      />

    </div>
  );
};

export default Settings;
