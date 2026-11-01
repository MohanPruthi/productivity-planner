const express = require('express');
const { getPlans, createPlan, updatePlan, deletePlan, createPeriod, updatePeriod } = require('../controllers/plansController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getPlans);
router.post('/', createPlan);
router.patch('/:id', updatePlan);
router.delete('/:id', deletePlan);
router.post('/:id/periods', createPeriod);
router.patch('/periods/:periodId', updatePeriod);

module.exports = router;
