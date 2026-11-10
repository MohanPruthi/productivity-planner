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

// A cute little voiced hum ("hm-hmm?"): a soft buzzy tone with vibrato, shaped by a
// low nasal formant so it reads as humming rather than a beep.
const hum = (c, s, f0, f1, d, v = 1) => {
  const o = c.createOscillator();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  const nasal = c.createBiquadFilter();
  const soft = c.createBiquadFilter();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, s);
  o.frequency.exponentialRampToValueAtTime(f1, s + d);
  lfo.frequency.value = 7;
  lfoGain.gain.value = f0 * 0.02;
  lfo.connect(lfoGain).connect(o.frequency);
  nasal.type = 'bandpass';
  nasal.frequency.value = 280;
  nasal.Q.value = 1.4;
  soft.type = 'lowpass';
  soft.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(0.5 * v, s + 0.04);
  g.gain.setValueAtTime(0.5 * v, s + d * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, s + d);
  o.connect(nasal).connect(soft).connect(g).connect(c.destination);
  o.start(s);
  lfo.start(s);
  o.stop(s + d + 0.03);
  lfo.stop(s + d + 0.03);
};

// "hm" then a longer rising "hmm?" (about 0.6 s)
const HUM = [[330, 350, 0, 0.17, 0.9], [300, 400, 0.24, 0.34, 1]];

export const play = (name, delay = 0) => {
  if (muted || typeof document === 'undefined' || document.hidden) return;
  if (name === 'hum') {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    for (const [f0, f1, at, d, v] of HUM) hum(c, t0 + at, f0, f1, d, v);
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
