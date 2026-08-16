const express = require('express');
const { getWeeks, createWeek, getDaysInWeek, updateDay, deleteWeek } = require('../controllers/planController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/weeks', getWeeks);
router.post('/weeks', createWeek);
router.delete('/weeks/:id', deleteWeek);
router.get('/days', getDaysInWeek);
router.patch('/days/:id', updateDay);

module.exports = router;
