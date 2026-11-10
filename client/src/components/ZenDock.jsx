import React, { useEffect, useState } from 'react';
import { Timer, PanelRightClose } from 'lucide-react';

// The Zen Zone panel can fold into a slim dock on wide screens.
// TimeLogger stays mounted either way, so a running timer keeps running.
const STORAGE_KEY = 'zen_dock_open';

const readOpen = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

// While the focus clock runs, show its live time in the folded dock.
const readRunningSeconds = () => {
  try {
    const s = JSON.parse(localStorage.getItem('active_lockin_session') || 'null');
    if (!s?.isRunning || !s.startTime) return null;
    return (s.secondsAtStart || 0) + Math.floor((Date.now() - s.startTime) / 1000);
  } catch {
    return null;
  }
};

const formatClock = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

const ZenDock = ({ children }) => {
  const [open, setOpen] = useState(readOpen);
  const [running, setRunning] = useState(readRunningSeconds);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* storage unavailable: the choice just isn't remembered */
    }
  }, [open]);

  useEffect(() => {
    if (open) return undefined;
    const id = setInterval(() => setRunning(readRunningSeconds()), 15000);
    setRunning(readRunningSeconds());
    return () => clearInterval(id);
  }, [open]);

  return (
    <div className={`zen-dock ${open ? 'is-open' : 'is-folded'}`}>
      {open ? (
        <button
          type="button"
          className="zen-dock-fold"
          onClick={() => setOpen(false)}
          aria-label="Fold Zen Zone"
          title="Fold Zen Zone"
        >
          <PanelRightClose size={16} />
        </button>
      ) : (
        <button
          type="button"
          className="zen-dock-mini"
          onClick={() => setOpen(true)}
          aria-label="Open Zen Zone"
          title="Open Zen Zone"
        >
          <span className={`zen-dock-ring ${running != null ? 'running' : ''}`}>
            <Timer size={18} />
          </span>
          <span className="zen-dock-label">Zen</span>
          {running != null && <span className="zen-dock-time">{formatClock(running)}</span>}
        </button>
      )}
      <div className="zen-dock-panel">{children}</div>
    </div>
  );
};

export default ZenDock;
