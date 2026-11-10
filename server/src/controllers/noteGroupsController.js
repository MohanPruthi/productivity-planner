const prisma = require('../db');

const cleanName = (name) => {
  const n = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  return n || 'New group';
};

async function getGroups(req, res) {
  try {
    const groups = await prisma.noteGroup.findMany({
      where: { userId: req.user.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(groups);
  } catch (error) {
    console.error('Error fetching note groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create a group and optionally move notes into it
async function createGroup(req, res) {
  try {
    const userId = req.user.id;
    const { name, noteIds } = req.body;
    const ids = Array.isArray(noteIds) ? noteIds.filter((i) => typeof i === 'string') : [];

    if (ids.length) {
      const owned = await prisma.note.count({ where: { id: { in: ids }, userId } });
      if (owned !== new Set(ids).size) {
        return res.status(404).json({ error: 'Note not found' });
      }
    }

    const last = await prisma.noteGroup.findFirst({
      where: { userId },
      orderBy: { sortOrder: 'desc' }
    });

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.noteGroup.create({
        data: { userId, name: cleanName(name), sortOrder: last ? last.sortOrder + 1 : 0 }
      });
      if (ids.length) {
        await tx.note.updateMany({
          where: { id: { in: ids }, userId },
          data: { groupId: created.id }
        });
      }
      return created;
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating note group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateGroup(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, sortOrder } = req.body;

    const existing = await prisma.noteGroup.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Group not found' });

    const data = {};
    if (name !== undefined) data.name = cleanName(name);
    if (sortOrder !== undefined) {
      const n = Number(sortOrder);
      if (!Number.isInteger(n)) return res.status(400).json({ error: 'sortOrder must be an integer' });
      data.sortOrder = n;
    }

    const group = await prisma.noteGroup.update({ where: { id }, data });
    res.json(group);
  } catch (error) {
    console.error('Error updating note group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Notes fall back to ungrouped (groupId SetNull)
async function deleteGroup(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.noteGroup.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Group not found' });

    await prisma.$transaction([
      prisma.note.updateMany({ where: { groupId: id, userId }, data: { groupId: null } }),
      prisma.noteGroup.delete({ where: { id } })
    ]);
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting note group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getGroups, createGroup, updateGroup, deleteGroup };
