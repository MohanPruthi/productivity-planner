// API key pools with in-memory rotation and cooldowns. Missing env vars just give an empty pool.

function parseKeys(envName) {
  return String(process.env[envName] || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function nextUtcMidnight() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

function createPool(envName) {
  const state = new Map(); // key -> { until: ms (Infinity = disabled) }

  function keys() {
    return parseKeys(envName);
  }

  function usable() {
    const now = Date.now();
    return keys().filter((k) => {
      const s = state.get(k);
      return !s || s.until <= now;
    });
  }

  // kind: 'rate' (429), 'daily' (quota per day), 'auth' (401/403)
  function cool(key, kind, retryAfterSec) {
    let until;
    if (kind === 'auth') until = Infinity;
    else if (kind === 'daily') until = nextUtcMidnight();
    else until = Date.now() + (retryAfterSec > 0 ? Math.min(retryAfterSec, 3600) * 1000 : 60 * 1000);
    state.set(key, { until });
  }

  // Runs fn(key) over usable keys in order. fn throws an error shaped
  // { status, cooldown: 'rate'|'daily'|'auth', retryAfter } for key problems; other errors are rethrown
  // after trying the next key and surface as the last error if every key fails.
  async function run(fn) {
    const list = usable();
    if (!list.length) {
      const e = new Error('no usable key');
      e.noKey = true;
      throw e;
    }
    let lastErr;
    for (const key of list) {
      try {
        return await fn(key);
      } catch (err) {
        lastErr = err;
        if (err && err.cooldown) cool(key, err.cooldown, err.retryAfter);
      }
    }
    throw lastErr;
  }

  return { usable, cool, run, hasKeys: () => keys().length > 0 };
}

const pools = {
  assemblyai: createPool('ASSEMBLYAI_API_KEYS'),
  gemini25: createPool('GEMINI_API_KEYS'),
  gemini20: createPool('GEMINI_API_KEYS'),
  groq: createPool('GROQ_API_KEYS'),
};

// Turn an HTTP failure into an error carrying the cooldown rule from the contract.
async function httpError(res, label) {
  let body = '';
  try { body = (await res.text()).slice(0, 600); } catch (e) { /* ignore */ }
  const err = new Error(`${label} ${res.status}`);
  err.status = res.status;
  if (res.status === 429) {
    const lower = body.toLowerCase();
    if (/per ?day|daily/.test(lower)) err.cooldown = 'daily';
    else {
      err.cooldown = 'rate';
      const ra = parseFloat(res.headers.get('retry-after'));
      if (ra > 0) err.retryAfter = ra;
    }
    err.quota = true;
  } else if (res.status === 401 || res.status === 403) {
    err.cooldown = 'auth';
    err.quota = true;
  } else if (res.status === 400 && /api key|api_key/i.test(body)) {
    err.cooldown = 'auth';
    err.quota = true;
  }
  return err;
}

module.exports = { pools, createPool, httpError };
