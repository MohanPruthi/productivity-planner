const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pools, httpError } = require('./keys');
const { planCalls } = require('./llm');
const rules = require('./rules');
const { runCalls, holdForConfirm, takeConfirm, serverToday } = require('./actions');
const { isValidDate } = require('./dates');

const router = express.Router();
router.use(authenticateToken);

// ---- light per-user rate limit: 20 commands per minute, in memory ----
const RATE_LIMIT = 20;
const hits = new Map();
function limited(userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < 60 * 1000);
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < 60 * 1000)) hits.delete(k);
  return recent.length > RATE_LIMIT;
}

// ---- speech-to-text temp token ----
router.post('/stt-token', async (req, res) => {
  try {
    const expiresIn = 60;
    const token = await pools.assemblyai.run(async (key) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(`https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresIn}`, {
          headers: { Authorization: key },
          signal: ctrl.signal,
        });
        if (!r.ok) throw await httpError(r, 'assemblyai');
        const json = await r.json();
        if (!json.token) throw new Error('assemblyai: no token');
        return json.token;
      } finally {
        clearTimeout(timer);
      }
    });
    res.json({ provider: 'assemblyai', token, expiresIn, sampleRate: 16000, url: 'wss://streaming.assemblyai.com/v3/ws' });
  } catch (err) {
    if (!err.noKey && !err.quota) console.error('stt-token failed:', err.message);
    res.status(503).json({ error: 'stt_quota' });
  }
});

function buildResponse({ results, ui, held }, confirm) {
  const okCount = results.filter((r) => r.ok).length;
  let reply;
  if (confirm) reply = 'confirm';
  else if (results.length && okCount === results.length) reply = 'done';
  else if (okCount > 0) reply = 'partial';
  else reply = 'error';
  const body = { reply, results, ui };
  if (reply === 'error') body.errorKind = results.find((r) => r.errorKind)?.errorKind || 'bad_request';
  if (confirm) body.confirm = confirm;
  return body;
}

router.post('/command', async (req, res) => {
  const userId = req.user.id;
  try {
    if (limited(userId)) return res.status(429).json({ reply: 'error', errorKind: 'bad_request', results: [], ui: [], error: 'Too many commands, slow down a little' });

    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 500) : '';
    if (!text) return res.status(400).json({ reply: 'error', errorKind: 'bad_request', results: [], ui: [] });
    const today = isValidDate(req.body.today) ? req.body.today : serverToday();
    const route = typeof req.body.route === 'string' ? req.body.route.slice(0, 100) : '/';
    const ctx = { userId, today, privacyMode: req.body.privacyMode === true };

    let calls;
    try {
      ({ calls } = await planCalls(text, { today, route }));
      if (!calls.length) return res.json({ reply: 'confused', results: [], ui: [] });
    } catch (err) {
      // Every LLM key failed: try the offline rules before giving up
      calls = rules.parse(text, today);
      if (!calls) {
        return res.json({ reply: 'error', errorKind: err.kind === 'llm_down' ? 'llm_down' : 'llm_quota', results: [], ui: [] });
      }
    }

    const out = await runCalls(calls, ctx);
    const confirm = out.held.length ? await holdForConfirm(out.held, ctx) : null;
    res.json(buildResponse(out, confirm));
  } catch (err) {
    console.error('assistant command failed:', err.message);
    res.status(500).json({ reply: 'error', errorKind: 'llm_down', results: [], ui: [] });
  }
});

router.post('/confirm', async (req, res) => {
  const userId = req.user.id;
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const held = token ? takeConfirm(token, userId) : null;
    if (!held) return res.status(404).json({ reply: 'error', errorKind: 'not_found', results: [], ui: [] });
    const out = await runCalls(held.calls, { userId, today: held.today, privacyMode: held.privacyMode }, { skipConfirm: true });
    res.json(buildResponse(out, null));
  } catch (err) {
    console.error('assistant confirm failed:', err.message);
    res.status(500).json({ reply: 'error', errorKind: 'bad_request', results: [], ui: [] });
  }
});

module.exports = router;
