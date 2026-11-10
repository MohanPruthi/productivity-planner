import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TimeLogger from './TimeLogger';
import ZenDock from './ZenDock';
import QuickAdd from './QuickAdd';
import MedReminder from './MedReminder';
import { useAuth } from '../context/AuthContext';

// Which module color themes each route (see --mod-* in index.css)
const ROUTE_TONES = [
  ['/plans', 'plans'],
  ['/dsa-log', 'dsa'],
  ['/task-history', 'board'],
  ['/meds', 'meds'],
  ['/hr-directory', 'contacts'],
  ['/note', 'notes'],
  ['/settings', 'settings'],
];

const toneForPath = (path) => ROUTE_TONES.find(([prefix]) => path.startsWith(prefix))?.[1] || 'dashboard';

const Layout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const tone = toneForPath(location.pathname);

  // On <body> so dialogs rendered outside the page still get the page's color
  useEffect(() => {
    const cls = `tone-${tone}`;
    document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [tone]);

  // Cards light up under the cursor: feed the pointer position to the hovered card
  useEffect(() => {
    const onMove = (e) => {
      const card = e.target.closest?.('.main-content .glass-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {/* Keyed on the route so each page plays its entrance animation */}
        <div key={location.pathname} className="page-enter">
          {children}
        </div>
      </main>
      <ZenDock>
        <TimeLogger />
      </ZenDock>
      <MedReminder />
      <QuickAdd />
    </div>
  );
};

export default Layout;
