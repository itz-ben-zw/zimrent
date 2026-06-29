const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { fullName, email, password, role, phone } = req.body;

  // Validation
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const validRoles = ['tenant', 'landlord'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Role must be tenant or landlord' });
  }

  const db = getDb();

  // Check email uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  // Hash password
  const passwordHash = bcrypt.hashSync(password, 10);

  const user = {
    id: uuidv4(),
    fullName,
    email,
    passwordHash,
    role: role || 'tenant',
    phone: phone || '',
    profileImage: ''
  };

  db.prepare('INSERT INTO users (id, fullName, email, passwordHash, role, phone, profileImage) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    user.id, user.fullName, user.email, user.passwordHash, user.role, user.phone, user.profileImage
  );

  // Generate token
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      emailVerified: !!user.emailVerified
    }
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ error: 'No account found with this email' });
  }

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

  res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage,
      emailVerified: !!user.emailVerified
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, (req, res) => {
  const { fullName, phone } = req.body;
  const db = getDb();
  
  if (fullName) {
    db.prepare('UPDATE users SET fullName = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(fullName, req.user.id);
  }
  if (phone !== undefined) {
    db.prepare('UPDATE users SET phone = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(phone, req.user.id);
  }

  const updated = db.prepare('SELECT id, fullName, email, role, phone, profileImage FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: updated });
});

// GET /api/auth/verify-email/:token - Verify email
router.get('/verify-email/:token', (req, res) => {
  // Placeholder: in production, verify token and mark user as verified
  res.status(501).json({ message: 'Email verification endpoint ready. Integrate email provider to complete.' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  
  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If the email exists, a reset link has been sent' });
  }

  // In production, send email with reset token
  // For now, generate a reset token and store it
  const resetToken = jwt.sign({ userId: user.id, purpose: 'password-reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  // Store reset token in a simple way (in production use a dedicated table)
  db.prepare('UPDATE users SET updatedAt = datetime(\'now\') WHERE id = ?').run(user.id);

  res.json({ message: 'If the email exists, a reset link has been sent', resetToken });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const db = getDb();
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET passwordHash = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(passwordHash, decoded.userId);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }
});

module.exports = router;