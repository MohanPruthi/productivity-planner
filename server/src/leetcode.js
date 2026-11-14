// Looks up LeetCode problems by their frontend number through LeetCode's GraphQL API.
// (The old /api/problems/algorithms/ endpoint now returns 403.)
const prisma = require('./db');

const cache = new Map(); // questionNumber -> problem | null
const MISS_RETRY_MS = 60 * 60 * 1000;
const missedAt = new Map();
// Numbers LeetCode answered for but did not list: no point asking again
const permanentMisses = new Set();

const QUERY = `query($k: String) {
  questionList(categorySlug: "", limit: 20, skip: 0, filters: { searchKeywords: $k }) {
    data { questionFrontendId title titleSlug difficulty topicTags { name } }
  }
}`;

async function getProblem(questionNumber) {
  const key = String(questionNumber).trim();
  if (cache.has(key)) return cache.get(key);
  if (permanentMisses.has(key)) return null;
  if (missedAt.has(key) && Date.now() - missedAt.get(key) < MISS_RETRY_MS) return null;

  // A question someone already logged is in the DB, so a cold start need not ask LeetCode again
  try {
    const known = await prisma.dsaLog.findFirst({
      where: { questionNumber: key, titleSlug: { not: null } },
      select: { title: true, titleSlug: true, difficulty: true, topics: true },
    });
    if (known) {
      cache.set(key, known);
      return known;
    }
  } catch (err) {
    console.error(`Stored problem lookup failed for #${key}:`, err.message);
  }

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
      body: JSON.stringify({ query: QUERY, variables: { k: key } }),
      // A slow LeetCode must not hang adding a log or the enrichment pass
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
    const json = await res.json();
    const match = json.data?.questionList?.data?.find((q) => q.questionFrontendId === key);
    if (!match) {
      permanentMisses.add(key);
      return null;
    }
    const problem = {
      title: match.title,
      titleSlug: match.titleSlug,
      difficulty: match.difficulty,
      topics: match.topicTags.map((t) => t.name),
    };
    cache.set(key, problem);
    return problem;
  } catch (err) {
    console.error(`LeetCode lookup failed for #${key}:`, err.message);
    missedAt.set(key, Date.now());
    return null;
  }
}

function isPermanentMiss(questionNumber) {
  return permanentMisses.has(String(questionNumber).trim());
}

module.exports = { getProblem, isPermanentMiss };
