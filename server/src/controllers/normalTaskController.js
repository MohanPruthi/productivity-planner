const prisma = require('../db');

// Get normal tasks for a date
async function getNormalTasks(req, res) {
  try {
    const { date } = req.query; // YYYY-MM-DD
    const userId = req.user.id;

    if (!date) {
      return res.status(400).json({ error: 'Date query parameter is required' });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const tasks = await prisma.normalTask.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching normal tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create normal task
async function createNormalTask(req, res) {
  try {
    const { date, text } = req.body;
    const userId = req.user.id;

    if (!date || !text) {
      return res.status(400).json({ error: 'Date and text are required' });
    }

    const taskDate = new Date(date);
    taskDate.setHours(12, 0, 0, 0); // avoid timezone shifts

    const task = await prisma.normalTask.create({
      data: {
        userId,
        date: taskDate,
        text,
        isDone: false
      }
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating normal task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Toggle/update normal task
async function updateNormalTask(req, res) {
  try {
    const { id } = req.params;
    const { isDone, text, date } = req.body;
    const userId = req.user.id;

    // Verify ownership
    const task = await prisma.normalTask.findFirst({
      where: { id, userId }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated = await prisma.normalTask.update({
      where: { id },
      data: {
        ...(isDone !== undefined && { isDone }),
        ...(text !== undefined && { text }),
        ...(date !== undefined && { date: new Date(date) })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating normal task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete normal task
async function deleteNormalTask(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const task = await prisma.normalTask.findFirst({
      where: { id, userId }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.normalTask.delete({
      where: { id }
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting normal task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getNormalTasks,
  createNormalTask,
  updateNormalTask,
  deleteNormalTask
};
