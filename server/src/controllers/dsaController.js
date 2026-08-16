const prisma = require('../db');

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

    try {
      const problems = await fetchLeetCodeProblems();
      const problem = problems.find(p => String(p.stat.frontend_question_id) === String(questionNumber));
      if (problem) {
        if (!finalTitle) {
          finalTitle = problem.stat.question__title;
        }
        // If difficulty is default (Medium) or empty, grab the correct difficulty level
        const diffLevel = problem.difficulty.level;
        const realDifficulty = diffLevel === 1 ? 'Easy' : diffLevel === 2 ? 'Medium' : 'Hard';
        if (!finalDifficulty || finalDifficulty === 'Medium') {
          finalDifficulty = realDifficulty;
        }
      }
    } catch (err) {
      console.error('Error auto-enriching DSA details in backend createDsaLog:', err);
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
    const { date } = req.query;

    let whereClause = { userId };

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

    let logs = await prisma.dsaLog.findMany({
      where: whereClause,
      orderBy: {
        date: 'desc',
      },
    });

    // Auto-enrich any existing logs with empty titles on retrieval
    let problemsList = null;
    for (let i = 0; i < logs.length; i++) {
      if (!logs[i].title) {
        try {
          if (!problemsList) {
            problemsList = await fetchLeetCodeProblems();
          }
          const problem = problemsList.find(p => String(p.stat.frontend_question_id) === String(logs[i].questionNumber));
          if (problem) {
            logs[i].title = problem.stat.question__title;
            const diffLevel = problem.difficulty.level;
            logs[i].difficulty = diffLevel === 1 ? 'Easy' : diffLevel === 2 ? 'Medium' : 'Hard';
            
            // Asynchronously update in database so it is saved permanently
            prisma.dsaLog.update({
              where: { id: logs[i].id },
              data: { title: logs[i].title, difficulty: logs[i].difficulty }
            }).catch(err => console.error('Error updating empty title in DB:', err));
          }
        } catch (enrichErr) {
          console.error(`Error enriching historical DSA log ${logs[i].id}:`, enrichErr);
        }
      }
    }

    // Calculate weekly statistics
    const today = new Date();
    const { startOfWeek, endOfWeek } = getStartAndEndOfWeek(today);

    const weeklyLogs = await prisma.dsaLog.findMany({
      where: {
        userId,
        date: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
    });

    const weeklyStats = {
      Easy: weeklyLogs.filter((l) => l.difficulty === 'Easy').length,
      Medium: weeklyLogs.filter((l) => l.difficulty === 'Medium').length,
      Hard: weeklyLogs.filter((l) => l.difficulty === 'Hard').length,
      total: weeklyLogs.length,
    };

    // Calculate daily statistics
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const dailyLogs = await prisma.dsaLog.findMany({
      where: {
        userId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const dailyStats = {
      Easy: dailyLogs.filter((l) => l.difficulty === 'Easy').length,
      Medium: dailyLogs.filter((l) => l.difficulty === 'Medium').length,
      Hard: dailyLogs.filter((l) => l.difficulty === 'Hard').length,
      total: dailyLogs.length,
    };

    res.json({
      logs,
      weeklyStats,
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

let leetcodeCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function fetchLeetCodeProblems() {
  if (leetcodeCache && (Date.now() - lastFetchTime < CACHE_DURATION)) {
    return leetcodeCache;
  }

  try {
    console.log("Fetching fresh LeetCode problems list...");
    const res = await fetch('https://leetcode.com/api/problems/algorithms/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.stat_status_pairs) {
        leetcodeCache = data.stat_status_pairs;
        lastFetchTime = Date.now();
        console.log(`Successfully cached ${leetcodeCache.length} LeetCode problems.`);
        return leetcodeCache;
      }
    }
  } catch (err) {
    console.error("Error fetching LeetCode problems list:", err);
  }

  if (leetcodeCache) {
    return leetcodeCache;
  }
  return [];
}

async function getQuestionDetails(req, res) {
  try {
    const { id } = req.params;
    const problems = await fetchLeetCodeProblems();
    const problem = problems.find(p => String(p.stat.frontend_question_id) === String(id));
    
    if (problem) {
      const diffLevel = problem.difficulty.level;
      const difficulty = diffLevel === 1 ? 'Easy' : diffLevel === 2 ? 'Medium' : 'Hard';
      return res.json({
        title: problem.stat.question__title,
        difficulty
      });
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
  getQuestionDetails,
};
