const express = require('express');
const { getTodayDashboard, getWeeklyDashboard, getHistoryDashboard } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/today', getTodayDashboard);
router.get('/week', getWeeklyDashboard);
router.get('/history', getHistoryDashboard);

module.exports = router;
