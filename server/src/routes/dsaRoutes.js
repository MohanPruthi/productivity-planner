const express = require('express');
const { createDsaLog, getDsaLogs, deleteDsaLog, getQuestionDetails } = require('../controllers/dsaController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createDsaLog);
router.get('/', getDsaLogs);
router.get('/question/:id', getQuestionDetails);
router.delete('/:id', deleteDsaLog);

module.exports = router;
