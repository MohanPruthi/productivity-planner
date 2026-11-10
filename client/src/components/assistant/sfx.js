// Tiny synthesized Blipo sounds (Web Audio only, no assets).
const KEY = 'blipo_sfx_muted';
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }

export const isMuted = () => muted;
export const setMuted = (v) => {
  muted = !!v;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
};

const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

// [startHz, endHz, offsetSec, durSec, waveform, relVolume]
const n = (a, b, at, d, w = 'sine', v = 1) => [a, b, at, d, w, v];
const SOUNDS = {
  tap: [n(300, 640, 0, 0.12, 'sine', 1.2), n(640, 520, 0.08, 0.08, 'sine', 0.5)],
  listenStart: [n(520, 520, 0, 0.09, 'triangle'), n(780, 780, 0.09, 0.12, 'triangle')],
  listenStop: [n(780, 780, 0, 0.09, 'triangle'), n(520, 520, 0.09, 0.12, 'triangle')],
  thinking: [n(660, 700, 0, 0.07, 'sine', 0.6)],
  success: [n(523, 523, 0, 0.1, 'triangle'), n(659, 659, 0.09, 0.1, 'triangle'), n(784, 784, 0.18, 0.1, 'triangle'), n(1568, 1568, 0.2, 0.2, 'sine', 0.3)],
  error: [n(380, 120, 0, 0.38, 'sawtooth', 0.6), n(190, 60, 0, 0.38, 'sine', 0.8)],
  confirm: [n(440, 440, 0, 0.1, 'triangle'), n(587, 700, 0.14, 0.2, 'triangle')],
  cancel: [n(150, 70, 0, 0.1, 'square', 0.4), n(110, 60, 0, 0.12, 'sine', 1)],
};

// Tap sound: a soft water-drop "bloop" and a curious rising "bip?" (round sine
// tones, no voice imitation). If a real clip exists at /sfx/hum.mp3 it is used
// instead; the synth stays as the fallback.
const bloop = (c, s) => {
  const tone = (f0, f1, at, d, v) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, s + at);
    o.frequency.exponentialRampToValueAtTime(f1, s + at + d);
    g.gain.setValueAtTime(0.0001, s + at);
    g.gain.exponentialRampToValueAtTime(0.16 * v, s + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, s + at + d);
    o.connect(g).connect(c.destination);
    o.start(s + at);
    o.stop(s + at + d + 0.02);
  };
  tone(1200, 320, 0, 0.11, 1.1);   // bloop (drop)
  tone(380, 520, 0.09, 0.08, 0.6); // little bounce
  tone(620, 1180, 0.22, 0.16, 0.9); // bip? (rising, curious)
};

let clip = null;       // HTMLAudioElement once loaded
let clipState = 'unknown'; // 'unknown' | 'loading' | 'ok' | 'missing'
const loadClip = () => {
  if (clipState !== 'unknown' || typeof Audio === 'undefined') return;
  clipState = 'loading';
  const a = new Audio('/sfx/hum.mp3');
  a.preload = 'auto';
  a.volume = 0.6;
  a.addEventListener('canplaythrough', () => { clip = a; clipState = 'ok'; }, { once: true });
  a.addEventListener('error', () => { clipState = 'missing'; }, { once: true });
  a.load();
};

export const play = (name, delay = 0) => {
  if (muted || typeof document === 'undefined' || document.hidden) return;
  if (name === 'hum') {
    loadClip();
    if (clipState === 'ok' && clip) {
      try { clip.currentTime = 0; clip.play().catch(() => {}); return; } catch { /* fall back */ }
    }
    const c = getCtx();
    if (!c) return;
    bloop(c, c.currentTime + delay);
    return;
  }
  const notes = SOUNDS[name];
  const c = notes && getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  for (const [f0, f1, at, d, w, v] of notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    const s = t0 + at;
    o.type = w;
    o.frequency.setValueAtTime(f0, s);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, s + d);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.15 * v, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + d);
    o.connect(g).connect(c.destination);
    o.start(s);
    o.stop(s + d + 0.02);
  }
};
