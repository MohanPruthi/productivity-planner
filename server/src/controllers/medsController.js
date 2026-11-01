const prisma = require('../db');

// Retrieve or auto-create the active 30-day schedule
async function getMedSchedule(req, res) {
  try {
    const userId = req.user.id;
    let schedule = await prisma.medSchedule.findUnique({
      where: { userId }
    });

    // If no schedule exists, let's create a default one starting today!
    if (!schedule) {
      schedule = await prisma.medSchedule.create({
        data: {
          userId,
          medName: "Daily Medication",
          startDate: new Date(),
          durationDays: 60
        }
      });
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching meds schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Reset/restart the 60-day course
async function resetMedSchedule(req, res) {
  try {
    const userId = req.user.id;
    const { medName, durationDays } = req.body;

    const schedule = await prisma.medSchedule.upsert({
      where: { userId },
      update: {
        medName: medName || "Daily Medication",
        startDate: new Date(),
        durationDays: durationDays || 60
      },
      create: {
        userId,
        medName: medName || "Daily Medication",
        startDate: new Date(),
        durationDays: durationDays || 60
      }
    });

    // Clear previous logs so the new course starts completely fresh
    await prisma.medLog.deleteMany({
      where: { userId }
    });

    res.json(schedule);
  } catch (error) {
    console.error('Error resetting meds schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Rename the medication without restarting the course or clearing logs
async function updateMedSchedule(req, res) {
  try {
    const userId = req.user.id;
    const { medName } = req.body;

    if (!medName || !medName.trim()) {
      return res.status(400).json({ error: 'Medication name is required' });
    }

    const schedule = await prisma.medSchedule.update({
      where: { userId },
      data: { medName: medName.trim() }
    });

    res.json(schedule);
  } catch (error) {
    console.error('Error updating meds schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get all meds logs
async function getMedLogs(req, res) {
  try {
    const userId = req.user.id;
    const logs = await prisma.medLog.findMany({
      where: { userId },
      orderBy: { date: 'asc' }
    });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching meds logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Toggle morning or evening pill completion for a specific date
async function toggleMedLog(req, res) {
  try {
    const userId = req.user.id;
    const { date, morning, evening } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Normalize date to midnight YYYY-MM-DD
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const log = await prisma.medLog.upsert({
      where: {
        userId_date: {
          userId,
          date: targetDate
        }
      },
      update: {
        ...(morning !== undefined && { morning }),
        ...(evening !== undefined && { evening })
      },
      create: {
        userId,
        date: targetDate,
        morning: morning || false,
        evening: evening || false
      }
    });

    res.json(log);
  } catch (error) {
    console.error('Error toggling med log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getMedSchedule,
  resetMedSchedule,
  updateMedSchedule,
  getMedLogs,
  toggleMedLog
};
