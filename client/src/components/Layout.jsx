import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TimeLogger from './TimeLogger';
import QuickAdd from './QuickAdd';
import MedReminder from './MedReminder';
import AssistantButton from './assistant/AssistantButton';
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
  ['/themes', 'settings'],
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

  // Cards light up under the cursor: feed the pointer position to the hovered card.
  // At most one update per frame, and the card's rect is measured once per card
  // (again after a scroll, resize or the hover lift) instead of on every move.
  useEffect(() => {
    // No hover on touch screens, so nothing to light up
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let card = null;
    let rect = null;
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      if (!card) return;
      if (!rect) rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${x - rect.left}px`);
      card.style.setProperty('--my', `${y - rect.top}px`);
    };
    const onMove = (e) => {
      const next = e.target.closest?.('.main-content .glass-card') || null;
      if (next !== card) {
        card = next;
        rect = null;
      }
      if (!card) return;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const forget = () => { rect = null; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', forget, { passive: true, capture: true });
    window.addEventListener('resize', forget);
    window.addEventListener('transitionend', forget, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', forget, { capture: true });
      window.removeEventListener('resize', forget);
      window.removeEventListener('transitionend', forget, true);
    };
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
      <TimeLogger />
      <MedReminder />
      <QuickAdd />
      <AssistantButton />
    </div>
  );
};

export default Layout;
