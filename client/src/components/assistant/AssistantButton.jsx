import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bubbleForResponse, confusedLine, errorLine } from './lines';
import { runUiActions } from './actions';
import { play } from './sfx';
import '../../styles/assistant.css';

const BUBBLE_MS = 3500;

// Blipo from public/mascot-demos.html (colours come from CSS variables, see assistant.css)
const Blipo = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <g className="rig">
      <g className="perk"><path className="s2" d="M32 15V6" /><circle className="f2" cx="32" cy="5" r="4" /></g>
      <path className="f1" d="M10 40c0-16 9-26 22-26s22 10 22 26c0 9-9 15-22 15S10 49 10 40z" />
      <ellipse cx="22" cy="23" rx="6" ry="2.8" fill="#fff" opacity=".28" transform="rotate(-25 22 23)" />
      <g className="eyes">
        <circle className="fw" cx="24" cy="36" r="8" /><circle className="fw" cx="40" cy="36" r="8" />
        <circle className="fi" cx="26" cy="37" r="4" /><circle className="fi" cx="42" cy="37" r="4" />
        <circle className="fw" cx="27.4" cy="35.4" r="1.3" /><circle className="fw" cx="43.4" cy="35.4" r="1.3" />
      </g>
      <g className="xeyes si"><path d="M20.8 32.8l6.4 6.4M27.2 32.8l-6.4 6.4" /><path d="M36.8 32.8l6.4 6.4M43.2 32.8l-6.4 6.4" /></g>
      <path className="si" d="M27 47q5 4.5 10 0" />
    </g>
  </svg>
);

const AssistantButton = () => {
  const { getAuthHeaders, privacyMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState('idle'); // idle | listening | thinking | done | error
  const [heard, setHeard] = useState('');
  const [bubble, setBubble] = useState(null); // { kind: reply|error|confirm, text, sub?, token? }
  const sessionRef = useRef(null);
  const engineRef = useRef(null);
  const hideTimer = useRef(null);
  const rootRef = useRef(null);
  const busyRef = useRef(false);
  const latest = useRef({});
  latest.current = { getAuthHeaders, privacyMode, navigate, route: location.pathname };

  const clearBubbleTimer = () => clearTimeout(hideTimer.current);
  const showBubble = useCallback((b) => {
    clearBubbleTimer();
    setBubble(b);
    if (b.kind !== 'confirm') hideTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  const settle = useCallback((next) => {
    setState(next);
    if (next === 'done' || next === 'error') setTimeout(() => setState((s) => (s === next ? 'idle' : s)), 1400);
  }, []);

  const handleResponse = useCallback((res) => {
    const b = bubbleForResponse(res);
    showBubble(b);
    play(b.kind === 'error' ? 'error' : b.kind === 'confirm' ? 'confirm' : 'success');
    settle(b.kind === 'error' ? 'error' : b.kind === 'confirm' ? 'idle' : 'done');
    runUiActions(res.ui, latest.current.navigate);
  }, [showBubble, settle]);

  const cancel = useCallback(() => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    busyRef.current = false;
    play('cancel');
    setHeard('');
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    play('tap');
    play('listenStart', 0.12);
    clearBubbleTimer();
    setBubble(null);
    setHeard('');
    setState('listening');
    try {
      // First tap: pull in the voice engine (VAD + ONNX runtime). Not part of the initial bundle.
      engineRef.current ||= await import('./voiceEngine');
    } catch {
      busyRef.current = false;
      play('error');
      showBubble({ kind: 'error', text: errorLine('network') });
      settle('error');
      return;
    }
    const engine = engineRef.current;
    sessionRef.current = engine.startListening({
      getAuthHeaders: () => latest.current.getAuthHeaders(),
      onPartial: setHeard,
      onLevel: (v) => rootRef.current?.style.setProperty('--lvl', String(v)),
      onIdle: () => { play('listenStop'); sessionRef.current = null; busyRef.current = false; setHeard(''); setState('idle'); },
      onError: (kind) => {
        sessionRef.current = null;
        busyRef.current = false;
        setHeard('');
        play('error');
        showBubble({ kind: 'error', text: errorLine(kind) });
        settle('error');
      },
      onFinal: async (text) => {
        sessionRef.current = null;
        setHeard('');
        if (!text) {
          busyRef.current = false;
          play('listenStop');
          play('error', 0.2);
          showBubble({ kind: 'reply', text: confusedLine() });
          settle('idle');
          return;
        }
        setState('thinking');
        play('listenStop');
        play('thinking', 0.25);
        const { getAuthHeaders: gh, privacyMode: pm, route } = latest.current;
        const res = await engine.sendCommand(text, route, pm, gh);
        busyRef.current = false;
        handleResponse(res);
      },
    });
  }, [handleResponse, settle, showBubble]);

  const onClick = () => {
    if (state === 'listening') cancel();
    else if (state === 'idle' || state === 'done' || state === 'error') start();
  };

  const confirm = async (token) => {
    setBubble(null);
    setState('thinking');
    play('thinking');
    const res = await engineRef.current.sendConfirm(token, latest.current.getAuthHeaders);
    handleResponse(res);
  };
  const dismissConfirm = useCallback(() => { play('cancel'); setBubble(null); settle('idle'); }, [settle]);

  // Escape: cancel listening, or dismiss a pending confirmation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (state === 'listening') cancel();
      else if (bubble?.kind === 'confirm') dismissConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, bubble, cancel, dismissConfirm]);

  useEffect(() => () => { clearBubbleTimer(); sessionRef.current?.cancel(); }, []);

  return (
    <>
      {state === 'listening' && (
        <div className="blipo-chip" role="status" aria-live="polite">
          <i />
          <span>{heard ? <>{heard}<span className="caret" /></> : <span className="hint">Listening...</span>}</span>
        </div>
      )}
      {bubble && state !== 'listening' && (
        <div className={`blipo-bubble ${bubble.kind === 'error' ? 'err' : ''}`} role="status" aria-live="polite">
          <div>{bubble.text}</div>
          {bubble.sub ? <div className="blipo-sub">{bubble.sub}</div> : null}
          {bubble.kind === 'confirm' && (
            <div className="blipo-actions">
              <button type="button" className="primary" onClick={() => confirm(bubble.token)}>Confirm</button>
              <button type="button" onClick={dismissConfirm}>Cancel</button>
            </div>
          )}
        </div>
      )}
      <div className="blipo" data-state={state} ref={rootRef}>
        <i className="blipo-ring" /><i className="blipo-ring r2" />
        <button
          type="button"
          className="blipo-btn"
          aria-label="Talk to Blipo"
          aria-pressed={state === 'listening'}
          onClick={onClick}
          disabled={state === 'thinking'}
        >
          <Blipo />
        </button>
        <span className="blipo-dots" aria-hidden="true"><b /><b /><b /></span>
      </div>
    </>
  );
};

export default AssistantButton;
