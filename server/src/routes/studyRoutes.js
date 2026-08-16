const express = require('express');
const { updateStudyLog, getStudyLogs } = require('../controllers/studyController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', updateStudyLog);
router.get('/', getStudyLogs);

module.exports = router;
