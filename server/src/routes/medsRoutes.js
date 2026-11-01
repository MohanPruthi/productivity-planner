const express = require('express');
const { getMedSchedule, resetMedSchedule, updateMedSchedule, getMedLogs, toggleMedLog } = require('../controllers/medsController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/schedule', getMedSchedule);
router.post('/schedule/reset', resetMedSchedule);
router.patch('/schedule', updateMedSchedule);
router.get('/logs', getMedLogs);
router.post('/log', toggleMedLog);

module.exports = router;
