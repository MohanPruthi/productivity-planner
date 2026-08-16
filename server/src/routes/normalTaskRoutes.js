const express = require('express');
const { getNormalTasks, createNormalTask, updateNormalTask, deleteNormalTask } = require('../controllers/normalTaskController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getNormalTasks);
router.post('/', createNormalTask);
router.patch('/:id', updateNormalTask);
router.delete('/:id', deleteNormalTask);

module.exports = router;
