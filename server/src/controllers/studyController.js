const prisma = require('../db');

async function updateStudyLog(req, res) {
  try {
    const { date, duration } = req.body;
    const userId = req.user.id;

    if (!date || duration === undefined || isNaN(duration)) {
      return res.status(400).json({ error: 'Date and valid duration (minutes) are required' });
    }

    const logDate = new Date(date);
    logDate.setHours(0, 0, 0, 0);

    const log = await prisma.dailyStudyLog.upsert({
      where: {
        userId_date: {
          userId,
          date: logDate,
        },
      },
      update: {
        duration: parseFloat(duration),
      },
      create: {
        userId,
        date: logDate,
        duration: parseFloat(duration),
      },
    });

    res.json(log);
  } catch (error) {
    console.error('Error updating study log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getStudyLogs(req, res) {
  try {
    const userId = req.user.id;
    
    const logs = await prisma.dailyStudyLog.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching study logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  updateStudyLog,
  getStudyLogs,
};
