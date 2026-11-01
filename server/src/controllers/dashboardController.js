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

// Local YYYY-MM-DD (toISOString would shift local-midnight dates to the previous UTC day)
function toLocalDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getTodayDashboard(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.query; // YYYY-MM-DD
    const today = date ? new Date(date) : new Date();
    
    // Normalize date range
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Active weeks (floating AI tasks), plan days dated today, DSA logs, pomodoros,
    // normal tasks and meds. Independent queries run together: each one is a network round trip to the DB
    const [
      activeWeeks,
      directPlanDays,
      dsaLogsToday,
      pomodorosToday,
      normalTasksToday,
      medSchedule,
      medLogToday,
    ] = await Promise.all([
      prisma.planWeek.findMany({
        where: {
          userId,
          startDate: { lte: endOfToday },
          endDate: { gte: startOfToday },
        },
        include: {
          planDays: {
            include: {
              planWeek: true
            }
          }
        }
      }),
      prisma.planDay.findMany({
        where: {
          userId,
          date: {
            gte: startOfToday,
            lte: endOfToday
          }
        },
        include: {
          planWeek: true
        }
      }),
      prisma.dsaLog.findMany({
        where: {
          userId,
          date: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
      prisma.pomodoroSession.findMany({
        where: {
          userId,
          completedAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
      prisma.normalTask.findMany({
        where: {
          userId,
          date: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      prisma.medSchedule.findUnique({
        where: { userId }
      }),
      prisma.medLog.findUnique({
        where: {
          userId_date: {
            userId,
            date: startOfToday
          }
        }
      }),
    ]);

    const planDaysToday = [];
    const seenDayIds = new Set();
    const isWeekend = today.getDay() === 0 || today.getDay() === 6;
    
    const getLocalDateString = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayDateStr = getLocalDateString(today);

    // Add direct matches first (rescheduled tasks or exact date matches)
    directPlanDays.forEach(day => {
      if (!seenDayIds.has(day.id)) {
        seenDayIds.add(day.id);
        planDaysToday.push(day);
      }
    });

    // Add floating tasks from currently active weeks
    activeWeeks.forEach(week => {
      if (week.track === 'AI') {
        const defaultWeekendStr = getLocalDateString(new Date(week.startDate));
        const defaultWeekdayDate = new Date(week.startDate);
        defaultWeekdayDate.setDate(defaultWeekdayDate.getDate() + 2);
        const defaultWeekdayStr = getLocalDateString(defaultWeekdayDate);

        week.planDays.forEach(day => {
          const dayDateStr = getLocalDateString(new Date(day.date));
          const isWeekendTask = day.dayLabel !== 'Weekday Plan';
          const defaultDateStr = isWeekendTask ? defaultWeekendStr : defaultWeekdayStr;
          const isPinned = dayDateStr !== defaultDateStr;

          // If it is not pinned (floating) and matches today's weekend/weekday status
          if (!isPinned && day.isWeekend === isWeekend) {
            if (!seenDayIds.has(day.id)) {
              seenDayIds.add(day.id);
              planDaysToday.push(day);
            }
          }
        });
      }
    });

    res.json({
      date: today,
      planDays: planDaysToday,
      dsaLogs: dsaLogsToday,
      normalTasks: normalTasksToday,
      pomodoros: {
        count: pomodorosToday.length,
        minutes: pomodorosToday.reduce((sum, s) => sum + s.durationMinutes, 0),
      },
      meds: {
        schedule: medSchedule,
        todayLog: medLogToday
      }
    });
  } catch (error) {
    console.error('Error fetching today dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getWeeklyDashboard(req, res) {
  try {
    const userId = req.user.id;
    const today = new Date();
    const { startOfWeek, endOfWeek } = getStartAndEndOfWeek(today);

    // 1. Find AI and SD plan weeks matching the current date
    const activeWeeks = await prisma.planWeek.findMany({
      where: {
        userId,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        planDays: true,
      },
    });

    // Fallback: if no active week matches current date, find the most recent week for both tracks
    const allActiveWeeks = [...activeWeeks];
    const tracks = ['AI', 'SD'];
    const missingTracks = tracks.filter((track) => !allActiveWeeks.some((w) => w.track === track));
    const latestWeeks = await Promise.all(missingTracks.map((track) =>
      prisma.planWeek.findFirst({
        where: { userId, track },
        orderBy: { weekNumber: 'desc' },
        include: { planDays: true },
      })
    ));
    latestWeeks.forEach((latestWeek) => {
      if (latestWeek) {
        allActiveWeeks.push(latestWeek);
      }
    });

    const [
      dsaLogsThisWeek,
      completedDays,
      dsaDays,
    ] = await Promise.all([
      prisma.dsaLog.findMany({
        where: {
          userId,
          date: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
        },
      }),
      prisma.planDay.findMany({
        where: { userId, isDone: true },
        select: { date: true },
      }),
      prisma.dsaLog.findMany({
        where: { userId },
        select: { date: true },
      }),
    ]);

    const weeklyProgress = allActiveWeeks.map((week) => {
      const totalDays = week.planDays.length;
      const completedDays = week.planDays.filter((d) => d.isDone).length;
      const completionPercentage = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

      return {
        id: week.id,
        track: week.track,
        weekNumber: week.weekNumber,
        goalText: week.goalText,
        startDate: week.startDate,
        endDate: week.endDate,
        totalDays,
        completedDays,
        completionPercentage,
      };
    });

    const dsaStats = {
      Easy: dsaLogsThisWeek.filter((l) => l.difficulty === 'Easy').length,
      Medium: dsaLogsThisWeek.filter((l) => l.difficulty === 'Medium').length,
      Hard: dsaLogsThisWeek.filter((l) => l.difficulty === 'Hard').length,
      total: dsaLogsThisWeek.length,
    };

    // 3. Calculate Streak
    // Streak: Consecutive days with at least 1 completed task (planDay.isDone) or 1 DSA question
    // Extract unique dates as YYYY-MM-DD
    const activityDates = new Set();
    completedDays.forEach((d) => activityDates.add(toLocalDateStr(d.date)));
    dsaDays.forEach((d) => activityDates.add(toLocalDateStr(d.date)));

    let streak = 0;
    const checkDate = new Date(today);
    checkDate.setHours(0, 0, 0, 0);

    const todayStr = toLocalDateStr(checkDate);
    
    // Check yesterday's date
    const yesterday = new Date(checkDate);
    yesterday.setDate(checkDate.getDate() - 1);
    const yesterdayStr = toLocalDateStr(yesterday);

    // Determine starting point for checking streak:
    // If there is activity today, start checking from today.
    // If no activity today, but activity yesterday, start checking from yesterday.
    // Otherwise, streak is 0.
    let currentCheck = checkDate;
    if (activityDates.has(todayStr)) {
      currentCheck = checkDate;
    } else if (activityDates.has(yesterdayStr)) {
      currentCheck = yesterday;
    } else {
      currentCheck = null;
    }

    if (currentCheck) {
      while (true) {
        const dateStr = toLocalDateStr(currentCheck);
        if (activityDates.has(dateStr)) {
          streak++;
          currentCheck.setDate(currentCheck.getDate() - 1);
        } else {
          break;
        }
      }
    }

    res.json({
      weeklyProgress,
      dsaStats,
      streak,
    });
  } catch (error) {
    console.error('Error fetching weekly dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getHistoryDashboard(req, res) {
  try {
    const userId = req.user.id;

    // 1. Get all plan days
    const planDays = await prisma.planDay.findMany({
      where: { userId },
      include: { planWeek: true },
      orderBy: { date: 'desc' }
    });

    // 2. Get all normal tasks
    const normalTasks = await prisma.normalTask.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });

    // Group items by local date string YYYY-MM-DD
    const groups = {};

    const getLocalDateString = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    planDays.forEach(day => {
      const dateStr = getLocalDateString(day.date);
      if (!groups[dateStr]) {
        groups[dateStr] = { date: dateStr, planDays: [], normalTasks: [] };
      }
      groups[dateStr].planDays.push(day);
    });

    normalTasks.forEach(task => {
      const dateStr = getLocalDateString(task.date);
      if (!groups[dateStr]) {
        groups[dateStr] = { date: dateStr, planDays: [], normalTasks: [] };
      }
      groups[dateStr].normalTasks.push(task);
    });

    // Sort groups descending by date
    const sortedGroups = Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(sortedGroups);
  } catch (error) {
    console.error('Error fetching history dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getTodayDashboard,
  getWeeklyDashboard,
  getHistoryDashboard
};
