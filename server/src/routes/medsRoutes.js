const express = require('express');
const { getMedSchedule, resetMedSchedule, getMedLogs, toggleMedLog } = require('../controllers/medsController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/schedule', getMedSchedule);
router.post('/schedule/reset', resetMedSchedule);
router.get('/logs', getMedLogs);
router.post('/log', toggleMedLog);

module.exports = router;
