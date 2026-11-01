import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PinModal from './PinModal';
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
  Settings as SettingsIcon
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

// Same life-grid mark as the favicon. In personal space the top-left tile turns
// soft violet, echoing the sidebar lamp.
const LogoIcon = ({ personal }) => {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--accent-primary)" />
      <rect x="13" y="13" width="17" height="17" rx="4" fill={personal ? '#c4b5fd' : '#fff'} style={{ transition: 'fill 0.4s ease' }} />
      <rect x="34" y="13" width="17" height="17" rx="4" fill="#a5b4fc" />
      <rect x="13" y="34" width="17" height="17" rx="4" fill="#a5b4fc" />
      <rect x="34" y="34" width="17" height="17" rx="4" fill="#fff" />
    </svg>
  );
};

const Sidebar = () => {
  const { user, logout, privacyMode, togglePrivacyMode, workspaceVisibility } = useAuth();
  const location = useLocation();

  // Tab icon carries the same quiet workspace cue as the sidebar logo
  useEffect(() => {
    const icon = document.querySelector("link[rel='icon']");
    if (!icon) return;
    icon.href = privacyMode ? '/favicon.svg' : '/favicon-personal.svg';
    return () => {
      icon.href = '/favicon.svg';
    };
  }, [privacyMode]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Initialize theme from localStorage or default to dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
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

      <nav className="sidebar-nav">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/notes' && location.pathname.startsWith('/note'));
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-link ${isActive ? 'active' : ''}`}
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
        
        <button className="btn-logout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={logout}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
