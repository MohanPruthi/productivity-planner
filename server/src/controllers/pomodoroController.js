const prisma = require('../db');

function getStartAndEndOfWeek(date) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(current.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}

async function createPomodoroSession(req, res) {
  try {
    const { track, durationMinutes, startedAt, completedAt } = req.body;
    const userId = req.user.id;

    if (!durationMinutes || isNaN(durationMinutes)) {
      return res.status(400).json({ error: 'Duration in minutes is required' });
    }
    if (!startedAt || !completedAt) {
      return res.status(400).json({ error: 'Start and completion times are required' });
    }
    if (track && track !== 'AI' && track !== 'SD' && track !== 'DSA') {
      return res.status(400).json({ error: 'Invalid track type. Allowed values: AI, SD, DSA, or null' });
    }

    const session = await prisma.pomodoroSession.create({
      data: {
        userId,
        track: track || null,
        durationMinutes: parseInt(durationMinutes),
        startedAt: new Date(startedAt),
        completedAt: new Date(completedAt),
        isCompleted: true,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error logging Pomodoro session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPomodoroSessions(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    let whereClause = { userId };

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(targetDate.getDate() + 1);

      whereClause.completedAt = {
        gte: targetDate,
        lt: nextDate,
      };
    }

    const sessions = await prisma.pomodoroSession.findMany({
      where: whereClause,
      orderBy: {
        completedAt: 'desc',
      },
    });

    // Calculate weekly statistics
    const today = new Date();
    const { startOfWeek, endOfWeek } = getStartAndEndOfWeek(today);

    const weeklySessions = await prisma.pomodoroSession.findMany({
      where: {
        userId,
        completedAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
    });

    const weeklyStats = {
      totalCount: weeklySessions.length,
      totalMinutes: weeklySessions.reduce((acc, s) => acc + s.durationMinutes, 0),
      byTrack: {
        AI: weeklySessions.filter((s) => s.track === 'AI').length,
        SD: weeklySessions.filter((s) => s.track === 'SD').length,
        DSA: weeklySessions.filter((s) => s.track === 'DSA').length,
        Uncategorized: weeklySessions.filter((s) => !s.track).length,
      },
    };

    // Calculate daily statistics
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const dailySessions = await prisma.pomodoroSession.findMany({
      where: {
        userId,
        completedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const dailyStats = {
      totalCount: dailySessions.length,
      totalMinutes: dailySessions.reduce((acc, s) => acc + s.durationMinutes, 0),
      byTrack: {
        AI: dailySessions.filter((s) => s.track === 'AI').length,
        SD: dailySessions.filter((s) => s.track === 'SD').length,
        DSA: dailySessions.filter((s) => s.track === 'DSA').length,
        Uncategorized: dailySessions.filter((s) => !s.track).length,
      },
    };

    res.json({
      sessions,
      weeklyStats,
      dailyStats,
    });
  } catch (error) {
    console.error('Error fetching Pomodoro sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createPomodoroSession,
  getPomodoroSessions,
};
