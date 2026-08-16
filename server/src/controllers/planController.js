const prisma = require('../db');

// Helper to get day name
function getDayLabel(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// Helper to check if weekend
function checkIfWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

async function getWeeks(req, res) {
  try {
    const { track } = req.query;
    const userId = req.user.id;

    if (!track || (track !== 'AI' && track !== 'SD')) {
      return res.status(400).json({ error: 'Track must be either AI or SD' });
    }

    const weeks = await prisma.planWeek.findMany({
      where: {
        userId,
        track,
      },
      orderBy: {
        weekNumber: 'asc',
      },
      include: {
        planDays: {
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    res.json(weeks);
  } catch (error) {
    console.error('Error fetching weeks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createWeek(req, res) {
  try {
    const { track, weekNumber, startDate, goalText } = req.body;
    const userId = req.user.id;

    if (!track || (track !== 'AI' && track !== 'SD')) {
      return res.status(400).json({ error: 'Track must be either AI or SD' });
    }
    if (!weekNumber || isNaN(weekNumber)) {
      return res.status(400).json({ error: 'Valid week number is required' });
    }
    if (!startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    const start = new Date(startDate);
    // Calculate end date (6 days after start date)
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    // Check if week already exists
    const existingWeek = await prisma.planWeek.findFirst({
      where: {
        userId,
        track,
        weekNumber: parseInt(weekNumber),
      },
    });

    if (existingWeek) {
      return res.status(400).json({ error: `Week ${weekNumber} already exists for track ${track}` });
    }

    // Create week and auto-generate the 7 plan days
    const result = await prisma.$transaction(async (tx) => {
      const week = await tx.planWeek.create({
        data: {
          userId,
          track,
          weekNumber: parseInt(weekNumber),
          startDate: start,
          endDate: end,
          goalText: goalText || '',
        },
      });

      const daysData = [];
      if (track === 'AI') {
        // Create Weekend Plan (Saturday - Sunday) - starts first on weekend
        daysData.push({
          userId,
          planWeekId: week.id,
          track,
          date: start,
          dayLabel: 'Weekend Plan',
          isWeekend: true,
          topic: '',
          discussionNote: '',
          isDone: false,
        });

        // Create Weekday Plan (Monday - Friday) - starts second on Monday
        const monDate = new Date(start);
        monDate.setDate(start.getDate() + 2); // Monday
        daysData.push({
          userId,
          planWeekId: week.id,
          track,
          date: monDate,
          dayLabel: 'Weekday Plan',
          isWeekend: false,
          topic: '',
          discussionNote: '',
          isDone: false,
        });
      } else {
        // Create 7 records for SD track
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(start);
          currentDate.setDate(start.getDate() + i);

          daysData.push({
            userId,
            planWeekId: week.id,
            track,
            date: currentDate,
            dayLabel: getDayLabel(currentDate),
            isWeekend: checkIfWeekend(currentDate),
            topic: '',
            discussionNote: '',
            isDone: false,
          });
        }
      }

      await tx.planDay.createMany({
        data: daysData,
      });

      return tx.planWeek.findUnique({
        where: { id: week.id },
        include: {
          planDays: {
            orderBy: {
              date: 'asc',
            },
          },
        },
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating week:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getDaysInWeek(req, res) {
  try {
    const { week_id } = req.query;
    const userId = req.user.id;

    if (!week_id) {
      return res.status(400).json({ error: 'week_id query parameter is required' });
    }

    const days = await prisma.planDay.findMany({
      where: {
        userId,
        planWeekId: week_id,
      },
      orderBy: {
        date: 'asc',
      },
    });

    res.json(days);
  } catch (error) {
    console.error('Error fetching days:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateDay(req, res) {
  try {
    const { id } = req.params;
    const { topic, discussionNote, isDone, date } = req.body;
    const userId = req.user.id;

    // Verify ownership
    const day = await prisma.planDay.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!day) {
      return res.status(404).json({ error: 'Plan day not found' });
    }

    let updateData = {
      ...(topic !== undefined && { topic }),
      ...(discussionNote !== undefined && { discussionNote }),
      ...(isDone !== undefined && { isDone }),
    };

    if (date) {
      const newDate = new Date(date);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      updateData.date = newDate;
      updateData.dayLabel = days[newDate.getDay()];
      updateData.isWeekend = newDate.getDay() === 0 || newDate.getDay() === 6;
    }

    const updated = await prisma.planDay.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating day:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteWeek(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const week = await prisma.planWeek.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }

    await prisma.planWeek.delete({
      where: { id },
    });

    res.json({ message: 'Week deleted successfully' });
  } catch (error) {
    console.error('Error deleting week:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getWeeks,
  createWeek,
  getDaysInWeek,
  updateDay,
  deleteWeek,
};
