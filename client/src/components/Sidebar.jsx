import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Brain, 
  Layers, 
  Code2, 
  LogOut, 
  User,
  History,
  Pill,
  Compass
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

const LogoIcon = () => {
  return (
    <svg 
      width="28" 
      height="28" 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))' }}
    >
      <defs>
        <linearGradient id="logoGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      
      {/* Outer Classic Outline Ring */}
      <circle cx="16" cy="16" r="14" stroke="url(#logoGlowGrad)" strokeWidth="1.75" strokeLinecap="round" />
      
      {/* Inner Dash Alignment Ring */}
      <circle cx="16" cy="16" r="11" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2,3" opacity="0.5" />
      
      {/* Compass Needle / Star Core */}
      <path 
        d="M16 6 L20 14 L28 16 L20 18 L16 26 L12 18 L4 16 L12 14 Z" 
        stroke="url(#logoGlowGrad)" 
        strokeWidth="1.75" 
        strokeLinejoin="round" 
        fill="rgba(99, 102, 241, 0.05)" 
      />
      
      {/* Center Pivot Point */}
      <circle cx="16" cy="16" r="2" fill="var(--text-primary)" />
    </svg>
  );
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

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

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'var(--accent-primary)' },
    { path: '/ai-plan', label: 'AI Plan', icon: Brain, color: 'var(--track-ai-start)' },
    { path: '/sd-plan', label: 'SD Plan', icon: Layers, color: 'var(--track-sd-start)' },
    { path: '/dsa-log', label: 'DSA Log', icon: Code2, color: '#ffa116' },
    { path: '/task-history', label: 'Work Board', icon: History, color: 'var(--accent-secondary)' },
    { path: '/meds', label: 'Meds Tracker', icon: Pill, color: '#ff2d55' },
  ];

  return (
    <aside className="sidebar-aside">
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LogoIcon />
          <h2 className="brand-title animated-gradient-purple" style={{ margin: 0, fontSize: '1.45rem', letterSpacing: '0.08em', fontWeight: 900, textTransform: 'uppercase' }}>PLANNER</h2>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
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

      <div className="sidebar-footer">
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
            <div className="user-avatar" style={{ flexShrink: 0 }}>
              <User size={18} />
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>
          
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
