const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendVerificationCode } = require('../mailer');

async function signup(req, res) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
}

// Returns the signed-in user so clients can check a stored token is still valid
async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function verifyWorkspacePin(req, res) {
  try {
    const { pin } = req.body;
    const userId = req.user.id;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workspacePin: true },
    });

    const expectedPin = user?.workspacePin || '1234';

    if (pin === expectedPin) {
      return res.json({ valid: true });
    } else {
      return res.status(401).json({ valid: false, error: 'Incorrect 4-digit PIN' });
    }
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ error: 'Internal server error verifying PIN' });
  }
}

async function resetWorkspacePin(req, res) {
  try {
    const { currentPin, newPin } = req.body;
    const userId = req.user.id;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'Current PIN and new PIN are required' });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workspacePin: true },
    });

    const expectedPin = user?.workspacePin || '1234';

    if (currentPin !== expectedPin) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { workspacePin: newPin },
    });

    res.json({ message: 'Workspace PIN updated successfully' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Internal server error resetting PIN' });
  }
}

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function maskEmail(email) {
  const [localPart, domain] = email.split('@');
  const maskedLocal = localPart.length > 2
    ? localPart[0] + '***' + localPart[localPart.length - 1]
    : localPart[0] + '***';
  return `${maskedLocal}@${domain}`;
}

// Generates a numeric code, stores its hash on the user and emails it
async function issueResetCode(user, purpose, digits) {
  const code = String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetCodeHash: await bcrypt.hash(code, 10),
      resetPurpose: purpose,
      resetExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      resetAttempts: 0,
    },
  });
  await sendVerificationCode(user.email, code, purpose);
}

// Returns null when the code is valid, otherwise an error message
async function checkResetCode(user, purpose, code) {
  if (!user.resetCodeHash || user.resetPurpose !== purpose || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
    return 'Code expired or not requested. Please request a new one.';
  }
  if (user.resetAttempts >= MAX_CODE_ATTEMPTS) {
    return 'Too many wrong attempts. Please request a new code.';
  }
  const isMatch = await bcrypt.compare(String(code), user.resetCodeHash);
  if (!isMatch) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetAttempts: { increment: 1 } },
    });
    return 'Incorrect verification code';
  }
  return null;
}

const clearResetCode = {
  resetCodeHash: null,
  resetPurpose: null,
  resetExpiresAt: null,
  resetAttempts: 0,
};

async function forgotWorkspacePin(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await issueResetCode(user, 'pin', 4);

    res.json({
      message: 'A 4-digit verification code has been sent to your email.',
      maskedEmail: maskEmail(user.email),
    });
  } catch (error) {
    console.error('Forgot PIN error:', error);
    res.status(500).json({ error: 'Could not send verification code' });
  }
}

async function resetWorkspacePinWithCode(req, res) {
  try {
    const { code, newPin } = req.body;

    if (!code || !newPin) {
      return res.status(400).json({ error: 'Verification code and new PIN are required' });
    }
    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const codeError = await checkResetCode(user, 'pin', code);
    if (codeError) {
      return res.status(401).json({ error: codeError });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { workspacePin: newPin, ...clearResetCode },
    });

    res.json({ message: 'Workspace PIN updated successfully' });
  } catch (error) {
    console.error('Reset PIN with code error:', error);
    res.status(500).json({ error: 'Internal server error resetting PIN' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Same response whether or not the account exists
    if (user) {
      await issueResetCode(user, 'password', 6);
    }

    res.json({ message: 'If that email is registered, a 6-digit code has been sent to it.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Could not send verification code' });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Incorrect verification code' });
    }

    const codeError = await checkResetCode(user, 'password', code);
    if (codeError) {
      return res.status(401).json({ error: codeError });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10), ...clearResetCode },
    });

    res.json({ message: 'Password updated. You can sign in now.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error resetting password' });
  }
}

module.exports = {
  signup,
  login,
  getMe,
  verifyWorkspacePin,
  resetWorkspacePin,
  forgotWorkspacePin,
  resetWorkspacePinWithCode,
  forgotPassword,
  resetPassword,
};
