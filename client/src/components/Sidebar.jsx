import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import PinModal from './PinModal';
import { openQuickAdd } from './QuickAdd';
import { 
  LayoutDashboard, 
  Brain, 
  Layers, 
  Code2, 
  LogOut, 
  User,
  History,
  Pill,
  Compass,
  SlidersHorizontal,
  Phone,
  Briefcase,
  Laptop,
  StickyNote,
  Settings as SettingsIcon,
  Plus,
  Palette
} from 'lucide-react';

const renderThemeIcon = (currentTheme) => {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ transition: 'transform 0.4s ease' }}
    >
      {/* Base: Desk */}
      <line x1="2" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Base: Person Studying */}
      <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 20c0-3 2-4.5 4-4.5h0.5c2 0 3.5 1.5 3.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      
      {/* Base: Laptop */}
      <path d="M14 20l1-3.5h4.5l0.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M15 16.5l3.5-0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      
      {currentTheme === 'light' ? (
        /* Day Mode: Sun above laptop */
        <g style={{ animation: 'spinOrbit 12s linear infinite', transformOrigin: '18px 7px' }}>
          <circle cx="18" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="18" y1="3.5" x2="18" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="18" y1="9.5" x2="18" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14.5" y1="7" x2="15.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="20.5" y1="7" x2="21.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ) : (
        /* Night Mode: Crescent Moon & Star above laptop */
        <g style={{ animation: 'pulseText 2s infinite ease-in-out' }}>
          <path d="M19.5 5a3 3 0 0 0-3 3 3 3 0 0 0 2 2.8 2 2 0 1 1 1-5.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M14.5 4.5h.01M21.5 8.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
};

// Day ring logo: a ring three-quarters closed with a dot for today and a tick
// inside. Personal space lights it in the theme's accent (--cue); office space
// shows it as a quiet outline. Themes add small touches (see .brand-logo rules).
const RING_TICK_PATHS = {
  disc: 'M32 8a24 24 0 1 1 0 48a24 24 0 1 1 0-48z',
  ring: 'M32 8a24 24 0 1 1-24 24',
  echo: 'M32 2a30 30 0 1 1-30 30',
  tick: 'M23 33l6 6 12-13',
};

const LogoIcon = ({ personal }) => {
  return (
    <svg className={`brand-logo ${personal ? 'lit' : ''}`} width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path className="bl-disc" d={RING_TICK_PATHS.disc} />
      <path className="bl-echo" d={RING_TICK_PATHS.echo} />
      <g className="bl-ticks">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const r2 = i % 3 ? 29 : 27.5;
          return <line key={i} x1={32 + 30.5 * Math.cos(a)} y1={32 + 30.5 * Math.sin(a)} x2={32 + r2 * Math.cos(a)} y2={32 + r2 * Math.sin(a)} />;
        })}
      </g>
      <path className="bl-ring" d={RING_TICK_PATHS.ring} />
      <circle className="bl-dot" cx="32" cy="8" r="4.5" />
      <path className="bl-tick" d={RING_TICK_PATHS.tick} />
    </svg>
  );
};

// Tab icon: the same mark drawn with the current theme's colours
const faviconHref = (personal) => {
  const css = getComputedStyle(document.documentElement);
  const cue = css.getPropertyValue('--cue').trim() || '#6366f1';
  const ink = css.getPropertyValue('--cue-off').trim() || '#9ca3af';
  const c = personal ? cue : ink;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${personal ? `<circle cx="32" cy="32" r="24" fill="${c}" opacity=".2"/>` : ''}<path d="${RING_TICK_PATHS.ring}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="8" r="6" fill="${c}"/><path d="${RING_TICK_PATHS.tick}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const Sidebar = () => {
  const { user, logout, privacyMode, togglePrivacyMode, workspaceVisibility } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Active skin from the Theme factory; only Classic has its own light/dark switch
  const [skin, setSkin] = useState(getTheme);
  useEffect(() => {
    const onChange = (e) => setSkin(e.detail);
    window.addEventListener('ui-theme-changed', onChange);
    return () => window.removeEventListener('ui-theme-changed', onChange);
  }, []);

  // Tab icon carries the same quiet workspace cue as the sidebar logo, in the theme's colours
  useEffect(() => {
    const icon = document.querySelector("link[rel='icon']");
    if (!icon) return;
    icon.href = faviconHref(!privacyMode);
    return () => {
      icon.href = '/favicon.svg';
    };
  }, [privacyMode, skin]);


  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Initialize theme from localStorage or default to dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    const light = skin.mode === 'both' ? theme === 'light' : skin.mode === 'light';
    document.body.classList.toggle('light-theme', light);
    localStorage.setItem('theme', theme);
  }, [theme, skin]);

  const toggleTheme = () => {
    // Other themes come as light or dark already: send people to the Theme factory
    if (skin.mode !== 'both') {
      navigate('/themes');
      return;
    }
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handlePrivacyToggle = () => {
    if (privacyMode) {
      // Switching to Personal Workspace requires 4-digit PIN
      setIsPinModalOpen(true);
    } else {
      // Switching to Office Workspace (privacy mode) is instant
      togglePrivacyMode();
    }
  };

  const navItems = [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'var(--mod-dashboard)' },
    { id: 'plans', path: '/plans', label: 'Plans', icon: Layers, color: 'var(--mod-plans)' },
    { id: 'dsaLog', path: '/dsa-log', label: 'DSA Log', icon: Code2, color: 'var(--mod-dsa)' },
    { id: 'taskHistory', path: '/task-history', label: 'Work Board', icon: History, color: 'var(--mod-board)' },
    { id: 'meds', path: '/meds', label: 'Meds Tracker', icon: Pill, color: 'var(--mod-meds)' },
    { id: 'hrDirectory', path: '/hr-directory', label: 'Directory', icon: Phone, color: 'var(--mod-contacts)' },
    { id: 'notes', path: '/notes', label: 'Notes', icon: StickyNote, color: 'var(--mod-notes)' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (privacyMode) {
      const config = workspaceVisibility?.[item.id];
      if (config && config.showInOffice === false) {
        return false;
      }
    }
    return true;
  });

  return (
    <aside className={`sidebar-aside ${privacyMode ? '' : 'workspace-lamp'}`}>
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LogoIcon personal={!privacyMode} />
          <h2 className="brand-title animated-gradient-purple" style={{ margin: 0, fontSize: '1.45rem', fontWeight: 600 }}>Planner</h2>
        </div>
      </div>

      <button type="button" className="rail-quick-add" onClick={openQuickAdd} aria-label="Quick add (Ctrl K)" title="Quick add (Ctrl K)">
        <Plus size={18} />
        <span>Quick add</span>
      </button>

      <nav className="sidebar-nav">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/notes' && location.pathname.startsWith('/note'));
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-link ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              style={isActive ? { '--active-color': item.color } : {}}
            >
              <Icon size={20} className="nav-icon" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
        {/* Toggle buttons container */}
        <div style={{
          borderTop: '1px solid var(--border-light)',
          paddingTop: '1rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          width: '100%'
        }}>
          <button 
            onClick={toggleTheme}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.45rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              flexShrink: 0
            }}
            className="theme-toggle-btn"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to Dark Mode (Study at Night)' : 'Switch to Light Mode (Study in Day)'}
            onMouseOver={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'scale(1.12) rotate(8deg)';
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
            }}
          >
            {renderThemeIcon(theme)}
          </button>

          {/* Privacy Toggle Button */}
          <button 
            onClick={handlePrivacyToggle}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.45rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              flexShrink: 0
            }}
            className="privacy-toggle-btn"
            aria-label={privacyMode ? 'Switch to personal workspace' : 'Switch to office workspace'}
            title={privacyMode ? 'Switch to Personal Workspace' : 'Switch to Office Workspace'}
            onMouseOver={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'scale(1.12) rotate(-8deg)';
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
            }}
          >
            {privacyMode ? <Briefcase size={18} /> : <Laptop size={18} />}
          </button>

          {/* Settings Button */}
          <Link 
            to="/settings"
            style={{
              background: location.pathname === '/settings' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
              border: location.pathname === '/settings' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-light)',
              color: location.pathname === '/settings' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.45rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              flexShrink: 0,
              textDecoration: 'none'
            }}
            className="settings-toggle-btn"
            aria-label="Settings"
            title="Settings"
            onMouseOver={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'scale(1.12) rotate(15deg)';
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
            }}
            onMouseOut={(e) => {
              if (location.pathname !== '/settings') {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            }}
          >
            <SettingsIcon size={18} />
          </Link>

          {/* Theme factory */}
          <Link
            to="/themes"
            className={`themes-toggle-btn ${location.pathname === '/themes' ? 'active' : ''}`}
            aria-label="Themes"
            title="Themes"
          >
            <Palette size={18} />
          </Link>
        </div>

        <PinModal 
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={togglePrivacyMode}
        />

        <div className="user-profile" style={{
          borderTop: '1px solid var(--border-light)',
          paddingTop: '1rem',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          overflow: 'hidden'
        }}>
          <div className="user-avatar" style={{ flexShrink: 0 }}>
            <User size={18} />
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
        </div>
        
        <button className="btn-logout" aria-label="Sign out" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={logout}>
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
