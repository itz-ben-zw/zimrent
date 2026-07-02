const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// In-memory OTP store (in production, use database/Redis)
const otpStore = new Map();
function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function jwtExpiresIn() {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw) return '24h';
  const trimmed = String(raw).trim();
  if (/^[0-9]+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return trimmed;
}

// Helper: generate user response
function userResponse(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phone: user.phone,
    username: user.username || '',
    profileImage: user.profileImage || '',
    emailVerified: !!user.emailVerified,
    phoneVerified: !!user.phoneVerified,
    authProvider: user.authProvider || 'email'
  };
}

// POST /api/auth/register
router.post('/register', upload.single('profileImage'), (req, res) => {
  const { fullName, email, password, role, phone, username } = req.body;
  const profileImage = req.file ? `/uploads/${req.file.filename}` : (req.body.profileImage || '');

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

  // Check username uniqueness if provided
  if (username) {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }
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
    username: username || '',
    profileImage,
    authProvider: 'email',
    providerId: ''
  };

  db.prepare(`INSERT INTO users (id, fullName, email, passwordHash, role, phone, username, profileImage, authProvider, providerId) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    user.id, user.fullName, user.email, user.passwordHash, user.role, user.phone, user.username, user.profileImage, user.authProvider, user.providerId
  );

  // Generate token
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });

  res.status(201).json({ token, user: userResponse(user) });
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

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });

  res.json({ token, user: userResponse(user) });
});

// POST /api/auth/google - Google Sign-In
router.post('/google', (req, res) => {
  const { email, fullName, googleId, profileImage } = req.body;

  if (!email || !googleId) {
    return res.status(400).json({ error: 'Email and Google ID are required' });
  }

  const db = getDb();
  let user = db.prepare('SELECT * FROM users WHERE providerId = ? AND authProvider = ?').get(googleId, 'google');

  if (!user) {
    // Check if email already registered
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      // Link Google account to existing user
      db.prepare('UPDATE users SET authProvider = ?, providerId = ?, profileImage = COALESCE(NULLIF(?, \'\'), profileImage), updatedAt = datetime(\'now\') WHERE id = ?').run('google', googleId, profileImage || '', existing.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    } else {
      // Create new user with Google
      const id = uuidv4();
      db.prepare(`INSERT INTO users (id, fullName, email, passwordHash, role, username, profileImage, authProvider, providerId) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, fullName || email.split('@')[0], email, bcrypt.hashSync(uuidv4(), 10), 'tenant', '', profileImage || '', 'google', googleId
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });
  res.json({ token, user: userResponse(user) });
});

// POST /api/auth/phone/send-otp - Send OTP to phone number
router.post('/phone/send-otp', (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^\+?[\d\s\-]{7,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }

  const cleanPhone = phone.replace(/[\s\-]/g, '');
  const otp = generateOTP();
  
  // Store OTP with 5-minute expiry
  otpStore.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  sendSMS(cleanPhone, otp).catch(err => {
    console.warn('SMS send failed:', err.message);
  });

  res.json({ message: 'OTP sent', phone: cleanPhone, debug: process.env.NODE_ENV !== 'production' ? otp : undefined });
});

async function sendSMS(to, otp) {
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase();
  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) {
      throw new Error('Missing Twilio env vars');
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', from);
    params.append('Body', `Your ZimRent verification code is ${otp}`);
    const base64 = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${base64}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Twilio error ${resp.status}: ${body}`);
    }
    return;
  }

  if (provider === 'africastalking') {
    const username = process.env.AFRICASTALKING_USERNAME;
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const senderId = process.env.AFRICASTALKING_SENDER_ID || 'ZimRent';
    if (!username || !apiKey) {
      throw new Error('Missing Africa\'s Talking env vars');
    }
    const url = 'https://api.africastalking.com/restless/send';
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', to);
    params.append('message', `Your ZimRent verification code is ${otp}`);
    params.append('senderId', senderId);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'apiKey': apiKey },
      body: params
    });
    const data = await resp.json();
    if (data.SMSMessageData && data.SMSMessageData.Recipients && data.SMSMessageData.Recipients.length > 0) {
      const rec = data.SMSMessageData.Recipients[0];
      if (rec.status !== 'Success' && rec.statusCode !== 100) {
        throw new Error(`AfricaTalking status ${rec.status}`);
      }
      return;
    }
    if (data.SMSMessageData && data.SMSMessageData.Message) {
      return;
    }
    throw new Error(`AfricaTalking unexpected response: ${JSON.stringify(data)}`);
  }

  // Default dev fallback
  console.log(`📱 OTP for ${to}: ${otp}`);
}

// POST /api/auth/phone/verify - Verify OTP and login/register
router.post('/phone/verify', (req, res) => {
  const { phone, otp, fullName, role } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  const stored = otpStore.get(phone);
  if (!stored) {
    return res.status(400).json({ error: 'No OTP sent to this number. Request a new OTP.' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }
  if (stored.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  // OTP verified - clear it
  otpStore.delete(phone);

  const db = getDb();
  let user = db.prepare('SELECT * FROM users WHERE phone = ? AND phone != \'\'').get(phone);

  if (!user) {
    // Auto-register with phone
    const id = uuidv4();
    const email = `user_${phone.replace(/[^0-9]/g, '')}@zimrent.phone`;
    db.prepare(`INSERT INTO users (id, fullName, email, passwordHash, role, phone, username, profileImage, authProvider, phoneVerified) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, fullName || 'User', email, bcrypt.hashSync(uuidv4(), 10), role || 'tenant', phone, '', '', 'phone', 1
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (!user.phoneVerified) {
    db.prepare('UPDATE users SET phoneVerified = 1, updatedAt = datetime(\'now\') WHERE id = ?').run(user.id);
    user.phoneVerified = 1;
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  res.json({ token, user: userResponse(user) });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile - Update profile with image upload
router.put('/profile', authenticate, upload.single('profileImage'), (req, res) => {
  const { fullName, phone, username } = req.body;
  const db = getDb();

  // Check username uniqueness if changed
  if (username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    db.prepare('UPDATE users SET username = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(username, req.user.id);
  }

  if (fullName) {
    db.prepare('UPDATE users SET fullName = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(fullName, req.user.id);
  }
  if (phone !== undefined) {
    db.prepare('UPDATE users SET phone = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(phone, req.user.id);
  }

  // Handle profile image upload
  if (req.file) {
    const imagePath = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET profileImage = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(imagePath, req.user.id);
  } else if (req.body.profileImage && req.body.profileImage.startsWith('data:')) {
    // base64 image from file input
    db.prepare('UPDATE users SET profileImage = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(req.body.profileImage, req.user.id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: userResponse(updated) });
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', (req, res) => {
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
  
  if (!user) {
    return res.json({ message: 'If the email exists, a reset link has been sent' });
  }

  const resetToken = jwt.sign({ userId: user.id, purpose: 'password-reset' }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });
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