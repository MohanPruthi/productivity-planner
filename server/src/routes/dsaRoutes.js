const express = require('express');
const { createDsaLog, getDsaLogs, deleteDsaLog, updateDsaLog, getDsaInsights, getQuestionDetails } = require('../controllers/dsaController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createDsaLog);
router.get('/', getDsaLogs);
router.get('/insights', getDsaInsights);
router.get('/question/:id', getQuestionDetails);
router.patch('/:id', updateDsaLog);
router.delete('/:id', deleteDsaLog);

module.exports = router;
