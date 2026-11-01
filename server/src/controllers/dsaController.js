const prisma = require('../db');
const { getProblem } = require('../leetcode');

// Helper to get start and end dates of the current week (Monday-Sunday or Sunday-Saturday)
// Let's use Monday-Sunday as standard week
function getStartAndEndOfWeek(date) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const startOfWeek = new Date(current.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}

async function createDsaLog(req, res) {
  try {
    const { date, questionNumber, difficulty, title, notes } = req.body;
    const userId = req.user.id;

    if (!questionNumber) {
      return res.status(400).json({ error: 'Question number is required' });
    }

    // Auto-enrich title and difficulty using cached LeetCode data if not provided or empty
    let finalTitle = title || '';
    let finalDifficulty = difficulty;

    const problem = await getProblem(questionNumber);
    if (problem) {
      if (!finalTitle) {
        finalTitle = problem.title;
      }
      // If difficulty is default (Medium) or empty, use LeetCode's
      if (!finalDifficulty || finalDifficulty === 'Medium') {
        finalDifficulty = problem.difficulty;
      }
    }

    if (!finalDifficulty || (finalDifficulty !== 'Easy' && finalDifficulty !== 'Medium' && finalDifficulty !== 'Hard')) {
      finalDifficulty = 'Medium'; // default fallback
    }

    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(0, 0, 0, 0); // normalize date

    const log = await prisma.dsaLog.create({
      data: {
        userId,
        date: logDate,
        questionNumber: String(questionNumber),
        difficulty: finalDifficulty,
        title: finalTitle,
        titleSlug: problem?.titleSlug || null,
        topics: problem?.topics || [],
        notes: notes || '',
      },
    });

    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating DSA log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getDsaLogs(req, res) {
  try {
    const userId = req.user.id;
    const { date, q, difficulty, topic, revisit } = req.query;

    await enrichMissingDetails(userId);

    let whereClause = { userId };

    // History filters
    if (q && q.trim()) {
      const term = q.trim().replace(/^#/, '');
      whereClause.OR = [
        { questionNumber: term },
        { title: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      whereClause.difficulty = difficulty;
    }
    if (topic) {
      whereClause.topics = { has: topic };
    }
    if (revisit === 'true') {
      whereClause.revisit = true;
    }

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(targetDate.getDate() + 1);

      whereClause.date = {
        gte: targetDate,
        lt: nextDate,
      };
    }

    const pageNum = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limitNum = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const skip = (pageNum - 1) * limitNum;

    const today = new Date();
    const { startOfWeek, endOfWeek } = getStartAndEndOfWeek(today);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Independent queries run together: each one is a network round trip to the DB
    const difficultyOnly = { difficulty: true };
    const [totalLogs, logs, weeklyLogs, monthlyLogs, overallLogs, dailyLogs] = await Promise.all([
      prisma.dsaLog.count({ where: whereClause }),
      prisma.dsaLog.findMany({
        where: whereClause,
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.dsaLog.findMany({
        where: { userId, date: { gte: startOfWeek, lte: endOfWeek } },
        select: difficultyOnly,
      }),
      prisma.dsaLog.findMany({
        where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
        select: difficultyOnly,
      }),
      prisma.dsaLog.findMany({
        where: { userId },
        select: difficultyOnly,
      }),
      prisma.dsaLog.findMany({
        where: { userId, date: { gte: todayStart, lte: todayEnd } },
        select: difficultyOnly,
      }),
    ]);
    const totalPages = Math.ceil(totalLogs / limitNum) || 1;

    const weeklyStats = {
      Easy: weeklyLogs.filter((l) => l.difficulty === 'Easy').length,
      Medium: weeklyLogs.filter((l) => l.difficulty === 'Medium').length,
      Hard: weeklyLogs.filter((l) => l.difficulty === 'Hard').length,
      total: weeklyLogs.length,
    };

    const monthlyStats = {
      Easy: monthlyLogs.filter((l) => l.difficulty === 'Easy').length,
      Medium: monthlyLogs.filter((l) => l.difficulty === 'Medium').length,
      Hard: monthlyLogs.filter((l) => l.difficulty === 'Hard').length,
      total: monthlyLogs.length,
    };

    const overallStats = {
      Easy: overallLogs.filter((l) => l.difficulty === 'Easy').length,
      Medium: overallLogs.filter((l) => l.difficulty === 'Medium').length,
      Hard: overallLogs.filter((l) => l.difficulty === 'Hard').length,
      total: overallLogs.length,
    };

    const dailyStats = {
      Easy: dailyLogs.filter((l) => l.difficulty === 'Easy').length,
      Medium: dailyLogs.filter((l) => l.difficulty === 'Medium').length,
      Hard: dailyLogs.filter((l) => l.difficulty === 'Hard').length,
      total: dailyLogs.length,
    };

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalLogs
      },
      weeklyStats,
      monthlyStats,
      overallStats,
      dailyStats,
    });
  } catch (error) {
    console.error('Error fetching DSA logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteDsaLog(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const log = await prisma.dsaLog.findFirst({
      where: { id, userId },
    });

    if (!log) {
      return res.status(404).json({ error: 'DSA Log not found' });
    }

    await prisma.dsaLog.delete({
      where: { id },
    });

    res.json({ message: 'DSA Log deleted successfully' });
  } catch (error) {
    console.error('Error deleting DSA log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Fills title/difficulty/topics for logs saved before LeetCode lookups worked
async function enrichMissingDetails(userId) {
  const missing = await prisma.dsaLog.findMany({
    where: { userId, titleSlug: null },
    select: { id: true, questionNumber: true, title: true },
  });
  for (const log of missing) {
    const problem = await getProblem(log.questionNumber);
    if (!problem) continue;
    await prisma.dsaLog.update({
      where: { id: log.id },
      data: {
        title: log.title || problem.title,
        difficulty: problem.difficulty,
        titleSlug: problem.titleSlug,
        topics: problem.topics,
      },
    });
  }
}

async function updateDsaLog(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { revisit, notes } = req.body;

    const log = await prisma.dsaLog.findFirst({ where: { id, userId } });
    if (!log) {
      return res.status(404).json({ error: 'DSA Log not found' });
    }

    const updated = await prisma.dsaLog.update({
      where: { id },
      data: {
        ...(revisit !== undefined && { revisit: Boolean(revisit) }),
        ...(notes !== undefined && { notes }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating DSA log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Heatmap (last 26 weeks), difficulty split and topic counts across all logs
async function getDsaInsights(req, res) {
  try {
    const userId = req.user.id;
    await enrichMissingDetails(userId);

    const logs = await prisma.dsaLog.findMany({
      where: { userId },
      select: { date: true, difficulty: true, topics: true, revisit: true },
    });

    const toLocalDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 26 * 7);

    const perDay = {};
    const difficulty = { Easy: 0, Medium: 0, Hard: 0 };
    const topicCounts = {};
    let revisitCount = 0;

    logs.forEach((log) => {
      if (log.date >= since) {
        const key = toLocalDateStr(log.date);
        perDay[key] = (perDay[key] || 0) + 1;
      }
      difficulty[log.difficulty] += 1;
      log.topics.forEach((t) => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
      if (log.revisit) revisitCount += 1;
    });

    const topics = Object.entries(topicCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ perDay, difficulty, topics, total: logs.length, revisitCount });
  } catch (error) {
    console.error('Error fetching DSA insights:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getQuestionDetails(req, res) {
  try {
    const problem = await getProblem(req.params.id);
    if (problem) {
      return res.json(problem);
    }
    return res.status(404).json({ error: 'Question not found' });
  } catch (error) {
    console.error('Error fetching question details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createDsaLog,
  getDsaLogs,
  deleteDsaLog,
  updateDsaLog,
  getDsaInsights,
  getQuestionDetails,
};
