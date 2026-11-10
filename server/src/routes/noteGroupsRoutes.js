const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/noteGroupsController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', ctrl.getGroups);
router.post('/', ctrl.createGroup);
router.patch('/:id', ctrl.updateGroup);
router.delete('/:id', ctrl.deleteGroup);

module.exports = router;
