// Fuzzy matching for note / plan / task names: token overlap + character bigram similarity.
const STOP = new Set(['the', 'a', 'an', 'my', 'note', 'notes', 'plan', 'task', 'to', 'of', 'in', 'on', 'for']);

function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  const all = normalise(s).split(' ').filter(Boolean);
  const kept = all.filter((t) => !STOP.has(t));
  return kept.length ? kept : all;
}

function bigrams(s) {
  const t = normalise(s).replace(/ /g, '');
  if (t.length < 2) return t ? [t] : [];
  const out = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

function dice(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const counts = new Map();
  for (const g of A) counts.set(g, (counts.get(g) || 0) + 1);
  let hit = 0;
  for (const g of B) {
    const c = counts.get(g);
    if (c > 0) { hit++; counts.set(g, c - 1); }
  }
  return (2 * hit) / (A.length + B.length);
}

function score(query, candidate) {
  const q = normalise(query);
  const c = normalise(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  const qt = tokens(query);
  const ct = tokens(candidate);
  // A query token matches a candidate token when equal, or one is a prefix of the other (min 3 chars)
  let overlap = 0;
  for (const t of qt) {
    if (ct.some((x) => x === t || (t.length >= 3 && x.startsWith(t)) || (x.length >= 3 && t.startsWith(x)))) overlap++;
  }
  const tokenScore = qt.length ? overlap / qt.length : 0;
  const contains = c.includes(q) ? 0.15 : 0;
  return Math.min(1, 0.6 * tokenScore + 0.4 * dice(q, c) + contains);
}

// items: any array; getText(item) -> string. Returns { item, score } or null under the threshold.
function bestMatch(query, items, getText = (x) => x.title, threshold = 0.45) {
  let best = null;
  for (const item of items) {
    const s = score(query, getText(item));
    if (!best || s > best.score) best = { item, score: s };
  }
  return best && best.score >= threshold ? best : null;
}

module.exports = { normalise, score, bestMatch };
