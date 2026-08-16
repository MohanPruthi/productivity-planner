const express = require('express');
const { createPomodoroSession, getPomodoroSessions } = require('../controllers/pomodoroController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createPomodoroSession);
router.get('/', getPomodoroSessions);

module.exports = router;
