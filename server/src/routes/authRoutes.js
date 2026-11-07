const express = require('express');
const { 
  signup, 
  login, 
  getMe,
  verifyWorkspacePin, 
  resetWorkspacePin, 
  forgotWorkspacePin,
  resetWorkspacePinWithCode,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-pin', authenticateToken, verifyWorkspacePin);
router.post('/reset-pin', authenticateToken, resetWorkspacePin);
router.post('/forgot-pin', authenticateToken, forgotWorkspacePin);
router.post('/reset-pin-with-code', authenticateToken, resetWorkspacePinWithCode);

module.exports = router;
