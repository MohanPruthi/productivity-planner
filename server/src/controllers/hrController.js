const prisma = require('../db');

const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

// Get HR contacts
async function getHrContacts(req, res) {
  try {
    const userId = req.user.id;
    const contacts = await prisma.hrContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching HR contacts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create HR contact
async function createHrContact(req, res) {
  try {
    const userId = req.user.id;
    const { contactName, phoneNumber, email, status, isContacted, interviewDate, hrLinkedin, companyLinkedin, notes } = req.body;

    if (!contactName) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    const contact = await prisma.hrContact.create({
      data: {
        userId,
        contactName: toTitleCase(contactName.trim()),
        phoneNumber: phoneNumber || null,
        email: email || null,
        status: status || 'Not Contacted',
        isContacted: !!isContacted,
        interviewDate: interviewDate ? new Date(interviewDate) : null,
        hrLinkedin: hrLinkedin || null,
        companyLinkedin: companyLinkedin || null,
        notes: notes || ''
      }
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating HR contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update HR contact
async function updateHrContact(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { contactName, phoneNumber, email, status, isContacted, interviewDate, hrLinkedin, companyLinkedin, notes } = req.body;

    // Verify ownership
    const existing = await prisma.hrContact.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = await prisma.hrContact.update({
      where: { id },
      data: {
        ...(contactName !== undefined && { contactName: toTitleCase(contactName.trim()) }),
        ...(phoneNumber !== undefined && { phoneNumber: phoneNumber || null }),
        ...(email !== undefined && { email: email || null }),
        ...(status !== undefined && { status }),
        ...(isContacted !== undefined && { isContacted: !!isContacted }),
        ...(interviewDate !== undefined && { interviewDate: interviewDate ? new Date(interviewDate) : null }),
        ...(hrLinkedin !== undefined && { hrLinkedin: hrLinkedin || null }),
        ...(companyLinkedin !== undefined && { companyLinkedin: companyLinkedin || null }),
        ...(notes !== undefined && { notes: notes || '' })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating HR contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete HR contact
async function deleteHrContact(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const existing = await prisma.hrContact.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.hrContact.delete({
      where: { id }
    });

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting HR contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Bulk Import HR contacts
async function bulkImportHrContacts(req, res) {
  try {
    const userId = req.user.id;
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Raw text data is required' });
    }

    const lines = rawText.split('\n');
    const parsedContacts = [];

    const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4,6}/;

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      const match = cleanLine.match(phoneRegex);
      if (match) {
        const phoneNumber = match[0].trim();
        let namePart = cleanLine.replace(phoneNumber, '').trim();
        // Remove leading/trailing separator symbols like - : ,
        namePart = namePart.replace(/^[-:\s,]+|[-:\s,]+$/g, '').trim();
        parsedContacts.push({
          userId,
          contactName: toTitleCase(namePart || 'Unknown Contact'),
          phoneNumber,
          status: 'Not Contacted',
          isContacted: false,
          notes: ''
        });
      } else {
        parsedContacts.push({
          userId,
          contactName: toTitleCase(cleanLine),
          phoneNumber: null,
          status: 'Not Contacted',
          isContacted: false,
          notes: ''
        });
      }
    }

    if (parsedContacts.length === 0) {
      return res.status(400).json({ error: 'No valid contacts parsed from dump' });
    }

    // Insert contacts in bulk using createMany
    const result = await prisma.hrContact.createMany({
      data: parsedContacts
    });

    res.status(201).json({
      message: `${result.count} contacts imported successfully`,
      count: result.count
    });
  } catch (error) {
    console.error('Error bulk importing HR contacts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getHrContacts,
  createHrContact,
  updateHrContact,
  deleteHrContact,
  bulkImportHrContacts
};
