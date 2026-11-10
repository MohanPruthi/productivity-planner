// Voice engine for Blipo. Loaded lazily (dynamic import on the first tap) so the VAD library and
// the ONNX runtime never touch the initial bundle.
//
// Flow: mic -> Silero VAD (@ricky0123/vad-web) detects the end of speech; the VAD's own 16 kHz frames
// are streamed as PCM16 to AssemblyAI v3 streaming with a short-lived token from /api/assistant/stt-token.
// If AssemblyAI is unavailable the browser's Web Speech API is used instead.
//
// VAD assets (worklet + silero onnx + onnxruntime wasm) are fetched from jsdelivr with pinned versions
// at the moment the engine starts, so Vite does not have to copy anything into public/. If you would
// rather self-host them, copy node_modules/@ricky0123/vad-web/dist/{vad.worklet.bundle.min.js,silero_vad_v5.onnx}
// and node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{mjs,wasm} into client/public/vad/ and
// point the two paths below at '/vad/'.
import { MicVAD } from '@ricky0123/vad-web';
import { API_BASE_URL } from '../../config';

const VAD_BASE = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.31/dist/';
const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';

const NO_SPEECH_MS = 12000;   // auto-stop when nobody says anything
const MAX_TOTAL_MS = 45000;   // hard cap for one utterance
const FORCE_END_WAIT_MS = 1500;
const SEND_SAMPLES = 1600;    // 100 ms of 16 kHz audio per websocket message
const MAX_QUEUED_FRAMES = 100;

const toPcm16 = (floats) => {
  const out = new Int16Array(floats.length);
  for (let i = 0; i < floats.length; i++) {
    const s = Math.max(-1, Math.min(1, floats[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

/**
 * Starts listening. Callbacks: onPartial(text), onLevel(0..1), onFinal(text), onIdle(), onError('mic' | 'stt').
 * Returns { cancel() } immediately; startup continues in the background.
 */
export const startListening = ({ getAuthHeaders, onPartial, onLevel, onFinal, onIdle, onError }) => {
  let done = false;
  let finishing = false;
  let ws = null;
  let vad = null;
  let stream = null;
  let recog = null;
  let idleTimer = null;
  let maxTimer = null;
  let transcript = '';
  let turnResolve = null;
  let queue = [];
  let pending = new Float32Array(0);

  const cleanup = () => {
    clearTimeout(idleTimer);
    clearTimeout(maxTimer);
    try { ws?.close(); } catch { /* already closed */ }
    ws = null;
    try { recog?.abort(); } catch { /* not running */ }
    recog = null;
    vad?.destroy().catch(() => {});
    vad = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };
  const end = (fn) => {
    if (done) return;
    done = true;
    cleanup();
    fn?.();
  };
  const deliver = (text) => end(() => onFinal((text || '').trim()));

  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => end(onIdle), NO_SPEECH_MS);
  };

  // ---- Web Speech API fallback ----
  const fallbackToWebSpeech = () => {
    if (done) return;
    const SR = getSpeechRecognition();
    // release the VAD/mic/socket before the browser's recognizer grabs the microphone
    try { ws?.close(); } catch { /* ignore */ }
    ws = null;
    vad?.destroy().catch(() => {});
    vad = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (!SR) { end(() => onError('stt')); return; }
    transcript = '';
    recog = new SR();
    recog.lang = navigator.language || 'en-US';
    recog.interimResults = true;
    recog.continuous = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e) => {
      clearTimeout(idleTimer);
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      transcript = text;
      onPartial(text);
    };
    recog.onerror = (e) => {
      if (e.error === 'no-speech') { end(onIdle); return; }
      if (e.error === 'aborted') return;
      end(() => onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'mic' : 'stt'));
    };
    recog.onend = () => { if (!done) deliver(transcript); };
    armIdle();
    try { recog.start(); } catch { end(() => onError('stt')); }
  };

  // ---- AssemblyAI streaming ----
  const flush = () => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    for (const frame of queue) {
      const merged = new Float32Array(pending.length + frame.length);
      merged.set(pending);
      merged.set(frame, pending.length);
      pending = merged;
      while (pending.length >= SEND_SAMPLES) {
        ws.send(toPcm16(pending.subarray(0, SEND_SAMPLES)).buffer);
        pending = pending.slice(SEND_SAMPLES);
      }
    }
    queue = [];
  };
  const onFrame = (probs, frame) => {
    onLevel?.(probs.isSpeech);
    queue.push(frame);
    if (ws?.readyState === WebSocket.OPEN) flush();
    else if (queue.length > MAX_QUEUED_FRAMES) queue.shift();
  };

  const finishFromSpeech = async () => {
    if (finishing || done) return;
    finishing = true;
    clearTimeout(idleTimer);
    if (ws?.readyState === WebSocket.OPEN) {
      flush();
      if (pending.length) { ws.send(toPcm16(pending).buffer); pending = new Float32Array(0); }
      ws.send(JSON.stringify({ type: 'ForceEndpoint' }));
      await new Promise((resolve) => {
        turnResolve = resolve;
        setTimeout(resolve, FORCE_END_WAIT_MS);
      });
      try { ws?.send(JSON.stringify({ type: 'Terminate' })); } catch { /* ignore */ }
    }
    if (!transcript.trim()) {
      // socket never produced words: try the browser recognizer only if we have nothing at all
      deliver('');
      return;
    }
    deliver(transcript);
  };

  const openSocket = (info) => {
    const params = new URLSearchParams({ sample_rate: String(info.sampleRate || 16000), encoding: 'pcm_s16le', token: info.token });
    ws = new WebSocket(`${info.url}?${params}`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = flush;
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type !== 'Turn') return;
      if (msg.transcript) {
        transcript = msg.transcript;
        onPartial(transcript);
      }
      if (msg.end_of_turn && transcript.trim()) {
        if (turnResolve) turnResolve();
        else finishFromSpeech();
      }
    };
    ws.onerror = () => { if (!finishing) fallbackToWebSpeech(); };
    ws.onclose = () => { if (!finishing && !done) fallbackToWebSpeech(); };
  };

  // ---- startup (runs in the background so cancel() works at any point) ----
  const startup = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      end(() => onError('mic'));
      return;
    }
    if (done) { cleanup(); return; }

    const tokenPromise = fetch(`${API_BASE_URL}/api/assistant/stt-token`, { method: 'POST', headers: getAuthHeaders() })
      .then(async (res) => (res.ok ? res.json() : null))
      .catch(() => null);
    maxTimer = setTimeout(() => end(onIdle), MAX_TOTAL_MS);

    try {
      vad = await MicVAD.new({
        model: 'v5',
        baseAssetPath: VAD_BASE,
        onnxWASMBasePath: ORT_BASE,
        startOnLoad: false,
        redemptionMs: 900,
        getStream: async () => stream,
        pauseStream: async () => {},
        resumeStream: async () => stream,
        onFrameProcessed: onFrame,
        onSpeechStart: () => { clearTimeout(idleTimer); },
        onSpeechEnd: () => { finishFromSpeech(); },
      });
    } catch (err) {
      console.error('VAD failed to load', err);
      vad = null;
      await tokenPromise;
      fallbackToWebSpeech();
      return;
    }
    if (done) { cleanup(); return; }

    const info = await tokenPromise;
    if (done) { cleanup(); return; }
    if (info?.token && info.url) {
      openSocket(info);
      await vad.start();
      armIdle();
    } else {
      fallbackToWebSpeech();
    }
  };
  startup().catch(() => end(() => onError('stt')));

  return { cancel: () => end() };
};

// ---- Command API ----
const post = async (path, body, getAuthHeaders) => {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!data || (!res.ok && !data.reply)) return { reply: 'error', errorKind: res.status >= 500 ? 'llm_down' : 'bad_request', results: [], ui: [] };
    return data;
  } catch {
    return { reply: 'error', errorKind: 'network', results: [], ui: [] };
  }
};

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const sendCommand = (text, route, privacyMode, getAuthHeaders) =>
  post('/api/assistant/command', { text, today: localDate(), route, privacyMode }, getAuthHeaders);

export const sendConfirm = (token, getAuthHeaders) => post('/api/assistant/confirm', { token }, getAuthHeaders);
