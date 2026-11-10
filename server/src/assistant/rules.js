// Offline rule-based parser used when every LLM key fails. Returns an array of { name, args } or null.
const { parseDatePhrase } = require('./dates');

const PAGES = {
  dashboard: 'dashboard', home: 'dashboard', plans: 'plans', plan: 'plans', dsa: 'dsa', leetcode: 'dsa',
  board: 'board', 'work board': 'board', tasks: 'board', task: 'board', meds: 'meds', medicine: 'meds', medication: 'meds',
  contacts: 'contacts', hr: 'contacts', notes: 'notes', settings: 'settings', themes: 'themes', theme: 'themes',
};

const WD = '(?:next |this |coming )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
const DATE_RE = new RegExp(
  `\\s+(?:on\\s+)?(day after tomorrow|today|tonight|tomorrow|tmrw|yesterday|${WD}|(?:the\\s+)?\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}|${MON}\\s+\\d{1,2}(?:st|nd|rd|th)?|(?:the\\s+)?\\d{1,2}(?:st|nd|rd|th))\\s*$`,
  'i'
);
const LEADING_DATE_RE = new RegExp(`^(day after tomorrow|today|tomorrow|tmrw|yesterday|${WD})\\s*[,:]?\\s+`, 'i');

// Split a trailing (or leading) date phrase off `s`
function takeDate(s, today) {
  let m = s.match(DATE_RE);
  if (m) {
    const date = parseDatePhrase(m[1], today);
    // Drop a dangling connector left before the date ("call mom for tomorrow")
    if (date) return { rest: s.slice(0, m.index).replace(/\s+(?:for|on|by|at|due)\s*$/i, '').trim(), date };
  }
  m = s.match(LEADING_DATE_RE);
  if (m) {
    const date = parseDatePhrase(m[1], today);
    if (date) return { rest: s.slice(m[0].length).trim(), date };
  }
  return { rest: s.trim(), date: undefined };
}

function clean(s) {
  return s.replace(/^(please|pls|can you|could you|hey|ok|okay)[, ]+/i, '').replace(/[.!?]+$/, '').trim();
}

function parseOne(raw, today) {
  const t = clean(raw);
  let m;

  // zen / timer
  if ((m = t.match(/^(start|begin|resume)\s+(?:the\s+)?(?:zen(?:\s+zone)?|focus(?:\s+timer)?|timer|pomodoro)/i))) return { name: 'zen', args: { op: 'start' } };
  if ((m = t.match(/^(pause|stop)\s+(?:the\s+)?(?:zen(?:\s+zone)?|focus(?:\s+timer)?|timer|pomodoro)/i))) return { name: 'zen', args: { op: 'pause' } };
  if ((m = t.match(/^reset\s+(?:the\s+)?(?:zen(?:\s+zone)?|focus(?:\s+timer)?|timer|pomodoro)/i))) return { name: 'zen', args: { op: 'reset' } };
  if (/^(?:start|switch to|take|go to)\s+(?:a\s+)?short break/i.test(t)) return { name: 'zen', args: { op: 'mode', mode: 'short' } };
  if (/^(?:start|switch to|take|go to)\s+(?:a\s+)?long break/i.test(t)) return { name: 'zen', args: { op: 'mode', mode: 'long' } };

  // pending
  if (/^move\s+(?:all\s+)?(?:the\s+)?pending(?:\s+tasks?)?\s+to\s+today/i.test(t)) return { name: 'move_pending_to_today', args: {} };
  if (/^(?:show|open|view|see)\s+(?:my\s+|the\s+)?pending/i.test(t)) return { name: 'show_pending', args: {} };

  // dsa
  if ((m = t.match(/^(?:log|add|record|mark)\s+(?:dsa|leetcode|lc)(?:\s+(?:problem|question))?\s+#?(\d{1,5})(?:\s+(?:as\s+)?(?:done|solved))?(.*)$/i))
    || (m = t.match(/^(?:i\s+)?(?:solved|did|finished|completed)\s+(?:dsa|leetcode|lc)?\s*(?:problem|question)?\s*#?(\d{1,5})(.*)$/i))
    || (m = t.match(/^(?:dsa|leetcode)\s+#?(\d{1,5})(?:\s+(?:done|solved))?(.*)$/i))) {
    const { date } = takeDate(' ' + (m[2] || '').trim(), today);
    return { name: 'log_dsa', args: { number: m[1], ...(date && { date }) } };
  }

  // meds
  if ((m = t.match(/^(?:log|mark|record|i\s+took|took)\s+(?:my\s+|the\s+)?(morning|evening|night)\s+(?:med(?:s|ication|icine)?|pill|dose)(.*)$/i))
    || (m = t.match(/^(?:log|mark|record)\s+(?:my\s+)?(?:med(?:s|ication|icine)?|pill)\s+(morning|evening|night)(.*)$/i))) {
    const { date } = takeDate(' ' + (m[2] || '').trim(), today);
    return { name: 'log_med', args: { slot: /^morning/i.test(m[1]) ? 'morning' : 'evening', ...(date && { date }) } };
  }

  // tasks: complete
  if ((m = t.match(/^(?:complete|finish|mark)\s+(?:the\s+)?(?:task\s+)?(.+?)(?:\s+(?:as\s+)?(?:done|complete|completed|finished))?$/i)) && !/^(?:med|dsa|note)/i.test(m[1])) {
    const { rest, date } = takeDate(m[1], today);
    if (rest) return { name: 'complete_task', args: { query: rest, ...(date && { date }) } };
  }

  // tasks: add
  if ((m = t.match(/^(?:add|create|new|make)\s+(?:a\s+|an\s+|some\s+)?(tasks?|to-?dos?)\s*(?:to\s+|for\s+|called\s+|:)?\s*(.+)$/i))
    || (m = t.match(/^(?:remind me to|i need to|i have to)\s+()(.+)$/i))) {
    const plural = /s$/i.test(m[1] || '') && !/^to-?do$/i.test(m[1]);
    const { rest, date } = takeDate(m[2], today);
    let parts = rest.split(/\s*,\s*|\s*;\s*/);
    if (plural) parts = parts.flatMap((p) => p.split(/\s+and\s+/i));
    else if (parts.length === 1) parts = [rest];
    parts = parts.map((p) => p.replace(/^and\s+/i, '').trim()).filter(Boolean);
    if (!parts.length) return null;
    return { name: 'create_tasks', args: { items: parts.map((text) => ({ text, ...(date && { date }) })) } };
  }

  // notes
  if ((m = t.match(/^(?:create|new|add|make)\s+(?:a\s+)?note\s+(?:called\s+|named\s+|titled\s+)?(.+)$/i))) return { name: 'create_note', args: { title: m[1].trim() } };
  if ((m = t.match(/^(?:add|append)\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(.+?)\s+note$/i))) return { name: 'append_to_note', args: { query: m[2].trim(), text: m[1].trim() } };
  if ((m = t.match(/^open\s+(?:my\s+|the\s+)?(.+?)\s+note$/i)) || (m = t.match(/^open\s+note\s+(.+)$/i))) return { name: 'open_note', args: { query: m[1].trim() } };

  // plans
  if ((m = t.match(/^(?:create|new|add|make)\s+(?:a\s+)?(weekly|monthly)?\s*plan\s+(?:called\s+|named\s+)?(.+)$/i))) {
    return { name: 'create_plan', args: { name: m[2].trim(), cadence: (m[1] || 'weekly').toLowerCase() } };
  }

  // navigation
  if ((m = t.match(/^(?:open|go to|goto|show|take me to|navigate to|switch to)\s+(?:the\s+|my\s+)?(.+?)(?:\s+page)?$/i))) {
    const key = m[1].toLowerCase().trim();
    if (PAGES[key]) return { name: 'navigate', args: { page: PAGES[key] } };
  }
  return null;
}

// Commands joined with "and then" / "then" / ";" are split; "add tasks a and b" is kept whole.
function parse(text, today) {
  const s = String(text || '').trim();
  if (!s) return null;
  const pieces = s.split(/\s*(?:;|\band then\b|\bthen\b)\s*/i).filter(Boolean);
  const calls = [];
  for (const piece of pieces) {
    const c = parseOne(piece, today);
    if (!c) return null; // be conservative: partial parses of unclear text become "confused"
    calls.push(c);
  }
  return calls.length ? calls : null;
}

module.exports = { parse };
