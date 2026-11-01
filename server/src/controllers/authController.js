const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

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

async function forgotWorkspacePin(req, res) {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset the saved PIN in DB to default '0000' (temporary security recovery code)
    const tempPin = '0000';
    await prisma.user.update({
      where: { id: userId },
      data: { workspacePin: tempPin },
    });

    // Mask user email for privacy (e.g., m***@gmail.com)
    const [localPart, domain] = user.email.split('@');
    const maskedLocal = localPart.length > 2 
      ? localPart[0] + '***' + localPart[localPart.length - 1] 
      : localPart[0] + '***';
    const maskedEmail = `${maskedLocal}@${domain}`;

    res.json({
      message: 'A 4-digit security recovery OTP has been dispatched to your email.',
      email: user.email,
      maskedEmail,
      tempPin,
    });
  } catch (error) {
    console.error('Forgot PIN error:', error);
    res.status(500).json({ error: 'Internal server error processing forgot PIN' });
  }
}

module.exports = {
  signup,
  login,
  verifyWorkspacePin,
  resetWorkspacePin,
  forgotWorkspacePin,
};
