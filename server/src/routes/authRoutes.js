const express = require('express');
const { 
  signup, 
  login, 
  verifyWorkspacePin, 
  resetWorkspacePin, 
  forgotWorkspacePin 
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-pin', authenticateToken, verifyWorkspacePin);
router.post('/reset-pin', authenticateToken, resetWorkspacePin);
router.post('/forgot-pin', authenticateToken, forgotWorkspacePin);

module.exports = router;
