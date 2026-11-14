// Intent extraction: Gemini (REST, function calling) then Groq (OpenAI-compatible) as fallback.
const { pools, httpError } = require('./keys');
const { TOOLS } = require('./tools');

const GEMINI_MODELS = [
  { model: 'gemini-2.5-flash', pool: pools.gemini25 },
  { model: 'gemini-2.0-flash', pool: pools.gemini20 },
];
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 8000;
// Whole planning call, across every provider, model and key
const DEADLINE_MS = 15000;
const MAX_TOKENS = 400;

function systemPrompt({ today, route }) {
  const weekday = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return [
    'You turn a spoken command for a personal planner app into tool calls.',
    `Today is ${today} (${weekday}). The user is on the page "${route || '/'}".`,
    'Only act by calling the provided tools; never answer in prose. You may call several tools for one command.',
    'Resolve relative dates ("tomorrow", "next monday", "on 14th", "day after tomorrow") to YYYY-MM-DD using today. Omit the date when the user named none.',
    'Keep task text as the user said it, minus filler like "please", "add a task to", "remind me to".',
    'If the command is unclear or unrelated to the tools, call no tool.',
  ].join('\n');
}

async function fetchJson(url, init, label, deadline) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.any([ctrl.signal, deadline]) });
    if (!res.ok) throw await httpError(res, label);
    return await res.json();
  } catch (err) {
    // This key hung past its own timeout: rest it for a minute so the next command skips it
    if (ctrl.signal.aborted && !err.cooldown) err.cooldown = 'timeout';
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(entry, text, ctx, deadline) {
  return entry.pool.run(async (key) => {
    const json = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${entry.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          tools: [{ functionDeclarations: TOOLS }],
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0, maxOutputTokens: MAX_TOKENS },
        }),
      },
      'gemini',
      deadline
    );
    const parts = json.candidates?.[0]?.content?.parts || [];
    return parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
  }, deadline);
}

async function callGroq(text, ctx, deadline) {
  return pools.groq.run(async (key) => {
    const json = await fetchJson(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0,
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'system', content: systemPrompt(ctx) }, { role: 'user', content: text }],
          tools: TOOLS.map((t) => ({ type: 'function', function: t })),
          tool_choice: 'auto',
        }),
      },
      'groq',
      deadline
    );
    const calls = json.choices?.[0]?.message?.tool_calls || [];
    return calls.map((c) => {
      let args = {};
      try { args = JSON.parse(c.function?.arguments || '{}'); } catch (e) { /* ignore */ }
      return { name: c.function?.name, args };
    });
  }, deadline);
}

// Returns { calls, provider }. Throws an error with kind 'llm_quota' | 'llm_down' when every provider fails.
async function planCalls(text, ctx) {
  const deadline = AbortSignal.timeout(DEADLINE_MS);
  const attempts = [
    ...GEMINI_MODELS.map((m) => ({ provider: m.model, run: () => callGemini(m, text, ctx, deadline) })),
    { provider: 'groq', run: () => callGroq(text, ctx, deadline) },
  ];
  let sawDown = false;
  for (const a of attempts) {
    if (deadline.aborted) {
      sawDown = true;
      break;
    }
    try {
      const calls = await a.run();
      return { calls, provider: a.provider };
    } catch (err) {
      if (!err.noKey && !err.quota) sawDown = true;
    }
  }
  const e = new Error('all LLM providers failed');
  e.kind = sawDown ? 'llm_down' : 'llm_quota';
  throw e;
}

module.exports = { planCalls };
