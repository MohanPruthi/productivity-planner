const express = require('express');
const { getTodayDashboard, getWeeklyDashboard, getHistoryDashboard, getPlannedDates } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/today', getTodayDashboard);
router.get('/week', getWeeklyDashboard);
router.get('/history', getHistoryDashboard);
router.get('/planned-dates', getPlannedDates);

module.exports = router;
