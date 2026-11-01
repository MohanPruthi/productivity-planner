const express = require('express');
const {
  getHrContacts,
  createHrContact,
  updateHrContact,
  deleteHrContact,
  bulkImportHrContacts
} = require('../controllers/hrController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getHrContacts);
router.post('/', createHrContact);
router.put('/:id', updateHrContact);
router.delete('/:id', deleteHrContact);
router.post('/bulk', bulkImportHrContacts);

module.exports = router;
