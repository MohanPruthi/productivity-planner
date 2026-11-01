const prisma = require('../db');

// Get all notes for the authenticated user
async function getNotes(req, res) {
  try {
    const userId = req.user.id;
    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: [
        { isPinned: 'desc' },
        { pinnedAt: 'desc' },
        { updatedAt: 'desc' }
      ]
    });
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create a new note
async function createNote(req, res) {
  try {
    const userId = req.user.id;
    const { title, content, colorTag, isPersonal, isPinned, type, checklist } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Note title is required' });
    }

    if (isPinned) {
      const pinnedCount = await prisma.note.count({
        where: { userId, isPinned: true }
      });
      if (pinnedCount >= 3) {
        return res.status(400).json({ error: 'Cannot pin more than 3 notes to the top.' });
      }
    }

    let parsedChecklist = [];
    if (Array.isArray(checklist)) {
      parsedChecklist = checklist;
    } else if (typeof checklist === 'string' && checklist.trim()) {
      try {
        parsedChecklist = JSON.parse(checklist);
      } catch (e) {
        parsedChecklist = [];
      }
    }

    const note = await prisma.note.create({
      data: {
        userId,
        title: title.trim(),
        content: content ? content.trim() : '',
        type: type === 'todo' ? 'todo' : 'note',
        checklist: parsedChecklist,
        colorTag: colorTag || '#6366f1',
        isPersonal: Boolean(isPersonal),
        isPinned: Boolean(isPinned),
        pinnedAt: isPinned ? new Date() : null
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update an existing note
async function updateNote(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, content, colorTag, isPersonal, isPinned, type, checklist } = req.body;

    const existingNote = await prisma.note.findFirst({
      where: { id, userId }
    });

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check 3 pinned note limit if attempting to pin
    if (isPinned === true && !existingNote.isPinned) {
      const pinnedCount = await prisma.note.count({
        where: { userId, isPinned: true }
      });
      if (pinnedCount >= 3) {
        return res.status(400).json({ error: 'Cannot pin more than 3 notes to the top.' });
      }
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (type !== undefined) updateData.type = type === 'todo' ? 'todo' : 'note';
    if (checklist !== undefined) {
      if (Array.isArray(checklist)) {
        updateData.checklist = checklist;
      } else if (typeof checklist === 'string') {
        try {
          updateData.checklist = JSON.parse(checklist);
        } catch (e) {
          updateData.checklist = [];
        }
      } else {
        updateData.checklist = [];
      }
    }
    if (colorTag !== undefined) updateData.colorTag = colorTag;
    if (isPersonal !== undefined) updateData.isPersonal = Boolean(isPersonal);
    if (isPinned !== undefined) {
      updateData.isPinned = Boolean(isPinned);
      updateData.pinnedAt = isPinned ? (existingNote.isPinned ? existingNote.pinnedAt : new Date()) : null;
    }

    const updatedNote = await prisma.note.update({
      where: { id },
      data: updateData
    });

    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Toggle pin status on a note
async function togglePin(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existingNote = await prisma.note.findFirst({
      where: { id, userId }
    });

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const nextPinnedState = !existingNote.isPinned;

    if (nextPinnedState) {
      const pinnedCount = await prisma.note.count({
        where: { userId, isPinned: true }
      });
      if (pinnedCount >= 3) {
        return res.status(400).json({ error: 'Cannot pin more than 3 notes to the top.' });
      }
    }

    const updatedNote = await prisma.note.update({
      where: { id },
      data: {
        isPinned: nextPinnedState,
        pinnedAt: nextPinnedState ? new Date() : null
      }
    });

    res.json(updatedNote);
  } catch (error) {
    console.error('Error toggling note pin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete a note
async function deleteNote(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existingNote = await prisma.note.findFirst({
      where: { id, userId }
    });

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await prisma.note.delete({
      where: { id }
    });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get a single note by ID
async function getNoteById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const note = await prisma.note.findFirst({
      where: { id, userId }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json(note);
  } catch (error) {
    console.error('Error fetching note by id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  togglePin,
  deleteNote
};
