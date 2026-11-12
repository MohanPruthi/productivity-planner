// Date helpers. All "YYYY-MM-DD" arithmetic is done in UTC so server timezone never shifts a day.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && fmt(d) === s;
}

function addDays(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

function serverToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Parse a date phrase relative to `today`. Returns a YYYY-MM-DD string or null.
function parseDatePhrase(phrase, today) {
  const p = String(phrase || '').toLowerCase().trim().replace(/^on\s+/, '').replace(/^the\s+/, '');
  if (!p) return null;
  if (isValidDate(p)) return p;
  if (p === 'today' || p === 'tonight') return today;
  if (p === 'tomorrow' || p === 'tmrw' || p === 'tmr') return addDays(today, 1);
  if (p === 'yesterday') return addDays(today, -1);
  if (p === 'day after tomorrow') return addDays(today, 2);

  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const wd = p.match(/^(next|this|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    let diff = (target - dow + 7) % 7;
    if (wd[1] === 'next' && diff === 0) diff = 7;
    if (!wd[1] && diff === 0) diff = 7; // bare weekday = the upcoming one
    return addDays(today, diff);
  }
  if (p === 'next week') return addDays(today, 7);

  const [ty, tm, td] = today.split('-').map(Number);
  const build = (day, monthIdx, year) => {
    const s = `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
    return isValidDate(s) ? s : null;
  };
  // 14th | 14
  const dayOnly = p.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    let s = build(day, tm - 1, ty);
    if (s && s < today) { // already passed this month: next month
      s = build(day, tm % 12, tm === 12 ? ty + 1 : ty);
    }
    return s;
  }
  // 14 nov | 14th of november | nov 14
  const m1 = p.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?([a-z]{3,9})$/);
  const m2 = p.match(/^([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  const hit = m1 ? { day: m1[1], mon: m1[2] } : m2 ? { day: m2[2], mon: m2[1] } : null;
  if (hit) {
    const mi = MONTHS.indexOf(hit.mon.slice(0, 3));
    if (mi < 0) return null;
    let s = build(Number(hit.day), mi, ty);
    if (s && s < today) s = build(Number(hit.day), mi, ty + 1);
    return s;
  }
  return null;
}

// Replicates what the controllers do with a "YYYY-MM-DD" input (new Date(str) = UTC midnight, then setHours in server local time).
function dateAtHour(dateStr, hour) {
  const d = new Date(dateStr);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function dayRange(dateStr) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

module.exports = { isValidDate, addDays, serverToday, parseDatePhrase, dateAtHour, dayRange, fmt };
