const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { memoryUpload } = require('../middleware/upload');
const { storeImage } = require('../lib/images');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

const router = express.Router();

// Ensure handlers can safely validate requests with missing or non-object bodies.
router.use((req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  next();
});

// In-memory OTP store (in production, use database/Redis)
const otpStore = new Map();
function generateOTP() { return crypto.randomInt(100000, 1000000).toString(); }

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
router.post('/register', memoryUpload.single('profileImage'), async (req, res) => {
  const { fullName, email, password, role, phone, username } = req.body;

  const cleanName = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Please enter your real full name' });
  }
  // Normalize so You@Gmail.com and you@gmail.com cannot become two accounts.
  const cleanEmail = String(email || '').trim().toLowerCase();
  // Phone is optional, but if given it must look like a real number so
  // listings cannot carry garbage contact details.
  const cleanPhone = phone ? String(phone).trim().replace(/[\s\-().]/g, '') : '';
  if (cleanPhone && !/^\+?\d{7,15}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'Phone number looks invalid. Use digits with optional leading +, e.g. +263 71 234 5678' });
  }
  let profileImage = req.body.profileImage || '';
  if (req.file) {
    try {
      profileImage = await storeImage(req.file, 'homify/profile');
    } catch (err) {
      console.error('Image upload failed:', err);
      if (err && err.message && err.message.includes('Image storage is not configured')) {
        return res.status(503).json({ error: 'Image uploads are temporarily unavailable (storage not configured). Please try again later.' });
      }
      return res.status(500).json({ error: 'Profile image upload failed. Please try again.' });
    }
  }

  // Validation
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
  const existing = await db.prepare('SELECT id, status FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    if (existing.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended. Contact homify.online@gmail.com for help.' });
    }
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  // Check username uniqueness if provided
  if (username) {
    const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }
  }

  // Hash password
  const passwordHash = bcrypt.hashSync(password, 10);

  const id = uuidv4();
  const user = {
    id,
    fullName: cleanName,
    email: cleanEmail,
    passwordHash,
    role: role || 'tenant',
    phone: cleanPhone || '',
    username: username || null,
    profileImage,
    authProvider: 'email',
    providerId: ''
  };

  await db.prepare(`INSERT INTO users (id, fullName, email, passwordHash, role, phone, username, profileImage, authProvider, providerId) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    user.id, user.fullName, user.email, user.passwordHash, user.role, user.phone, user.username, user.profileImage, user.authProvider, user.providerId
  );

  // Issue verification email token
  const verifyToken = uuidv4();
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO email_verifications (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)').run(uuidv4(), user.id, verifyToken, verifyExpires);

  // Send the verification email for real (non-fatal if delivery fails; the
  // user can resend later). emailVerificationSent tells the frontend whether
  // a mail actually went out, so we never silently pretend it did.
  const emailVerificationSent = await emailService.sendVerificationEmail(email, fullName, verifyToken);

  const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });
  const refreshToken = await issueRefreshToken(id, req);

  const responseBody = { token: accessToken, refreshToken, user: userResponse(user), emailVerificationSent };
  // Dev only: return the raw token so automated tests can exercise the
  // verify-email flow without SMTP. Never returned in production, where it
  // would let anyone "verify" without receiving the email.
  if (process.env.NODE_ENV !== 'production') {
    responseBody.verifyToken = verifyToken;
  }
  res.status(201).json(responseBody);
});

async function issueRefreshToken(userId, req) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const db = getDb();
  await db.prepare('INSERT INTO refresh_tokens (id, userId, token, userAgent, ip, expiresAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(), userId, token, (req.headers['user-agent'] || '').substring(0, 255), (req.ip || req.socket.remoteAddress || '').substring(0, 64), expiresAt
  );
  return token;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDb();
  const cleanLoginEmail = String(email || '').trim().toLowerCase();
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(cleanLoginEmail);

  if (!user || !user.passwordHash) {
    bcrypt.compareSync(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalid12');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended. Contact homify.online@gmail.com for help.' });
  }

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });
  const refreshToken = await issueRefreshToken(user.id, req);

  res.json({ token, refreshToken, user: userResponse(user) });
});

// POST /api/auth/google - Google Sign-In
// The client sends the Google access token from Google Identity Services;
// the server verifies it with Google and trusts ONLY that result. Accepting
// email/googleId posted by the browser would let anyone sign in as any user.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
// Reserved admin address - Google sign-in as this email always resolves to
// the admin account and never downgrades it to tenant.

router.post('/google', async (req, res) => {
  const { accessToken } = req.body;
  const requestedRole = req.body.role === 'landlord' ? 'landlord' : 'tenant';

  if (!accessToken || typeof accessToken !== 'string') {
    return res.status(400).json({ error: 'Google access token is required' });
  }

  let googleUser;
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!resp.ok) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }
    const info = await resp.json();
    // Token must have been issued for OUR client ID, not another app's.
    if (!GOOGLE_CLIENT_ID || (info.issued_to !== GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID)) {
      return res.status(401).json({ error: 'Google token was issued for a different app' });
    }
    if (!info.sub || !info.email || String(info.email_verified ?? info.verified_email).toLowerCase() !== 'true') {
      return res.status(401).json({ error: 'Google account is missing an email address' });
    }
    googleUser = { sub: info.sub, email: info.email, name: info.name || '', picture: info.picture || '' };
  } catch (err) {
    console.warn('Google token verification failed:', err.message);
    return res.status(502).json({ error: 'Could not verify Google sign-in. Please try again.' });
  }

  const db = getDb();
  let user = await db.prepare('SELECT * FROM users WHERE providerId = ? AND authProvider = ?').get(googleUser.sub, 'google');

  if (!user) {
    // Check if email already registered
    const existing = await db.prepare('SELECT * FROM users WHERE email = ?').get(googleUser.email);
    if (existing) {
      // Link Google account to existing user. Google verified this address,
      // so it is safe to mark the email verified.
      await db.prepare(`UPDATE users SET authProvider = 'google', providerId = ?, emailVerified = 1, profileImage = COALESCE(NULLIF(?, ''), profileImage), updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(googleUser.sub, googleUser.picture || '', existing.id);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    } else {
      // Create new user with Google (email already verified by Google)
      const id = uuidv4();
      await db.prepare(`INSERT INTO users (id, fullName, email, passwordHash, role, username, profileImage, authProvider, providerId, emailVerified) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(
        id, googleUser.name || googleUser.email.split('@')[0], googleUser.email, bcrypt.hashSync(uuidv4(), 10), requestedRole, null, googleUser.picture || '', 'google', googleUser.sub
      );
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
  }

  // Allow a signed-in tenant to opt into landlord features explicitly.
  // Never change an administrator's role, and never downgrade an existing landlord.
  if (user.role === 'tenant' && requestedRole === 'landlord') {
    await db.prepare("UPDATE users SET role = 'landlord', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended. Contact support for help.' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });
  const refreshToken = await issueRefreshToken(user.id, req);
  res.json({ token, refreshToken, user: userResponse(user) });
});

// POST /api/auth/phone/send-otp - Send OTP to phone number
router.post('/phone/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (typeof phone !== 'string' || !/^\+?[\d\s().-]{7,24}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }

  const cleanPhone = phone.replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }

  const otp = generateOTP();

  const isProd = process.env.NODE_ENV === 'production';

  // On production, silently pretending an SMS was sent is worse than
  // failing: users wait forever for a code that never arrives. Until a real
  // provider (twilio / africastalking) is configured, fail loudly.
  if (isProd && !smsService.isRealProvider()) {
    return res.status(503).json({
      error: 'Phone sign-in is not available yet. Please sign in with email or Google instead.'
    });
  }

  // Store OTP with 5-minute expiry
  otpStore.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });

  let sent = false;
  try {
    sent = await smsService.sendSMS(cleanPhone, otp);
  } catch (err) {
    console.warn('SMS send failed:', err.message);
  }
  if (!sent) {
    otpStore.delete(cleanPhone);
    return res.status(502).json({ error: 'Could not send the verification SMS. Please try again in a moment.' });
  }

  res.json({
    message: 'OTP sent',
    phone: cleanPhone,
    // Dev convenience with the console provider only: surface the code so
    // local testing works without a real SMS gateway. Never in production.
    debug: !isProd && !smsService.isRealProvider() ? otp : undefined
  });
});

// POST /api/auth/phone/verify - Verify OTP and login/register
router.post('/phone/verify', async (req, res) => {
  const { phone, otp, fullName } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  // Use the same canonical format as /phone/send-otp, including dots and parentheses.
  if (typeof phone !== 'string' || !/^\+?[\d\s().-]{7,24}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }
  const cleanPhone = phone.replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }
  if (typeof otp !== 'string' && typeof otp !== 'number') {
    return res.status(400).json({ error: 'Valid OTP is required' });
  }
  const stored = otpStore.get(cleanPhone);
  if (!stored) {
    return res.status(400).json({ error: 'No OTP sent to this number. Request a new OTP.' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(cleanPhone);
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }
  if (stored.attempts >= 5) {
    otpStore.delete(cleanPhone);
    return res.status(429).json({ error: 'Too many incorrect attempts. Request a new OTP.' });
  }
  if (stored.otp !== String(otp)) {
    stored.attempts += 1;
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  // OTP verified - clear it
  otpStore.delete(cleanPhone);

  const db = getDb();
  let user = await db.prepare('SELECT * FROM users WHERE phone = ? AND phone != \'\'').get(cleanPhone);

  if (!user) {
    // Auto-register with phone
    const id = uuidv4();
    const email = `user_${cleanPhone.replace(/[^0-9]/g, '')}@homify.phone`;
    await db.prepare(`INSERT INTO users (id, fullName, email, passwordHash, role, phone, username, profileImage, authProvider, phoneVerified) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, fullName || 'User', email, bcrypt.hashSync(uuidv4(), 10), 'tenant', cleanPhone, null, '', 'phone', 1
    );
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (!user.phoneVerified) {
    await db.prepare('UPDATE users SET phoneVerified = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    user.phoneVerified = 1;
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended. Contact support for help.' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });
  const refreshToken = await issueRefreshToken(user.id, req);
  res.json({ token, refreshToken, user: userResponse(user) });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  const db = getDb();
  const row = await db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0 AND expiresAt::timestamptz > CURRENT_TIMESTAMP').get(refreshToken);
  if (!row) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const token = jwt.sign({ userId: row.userId }, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn() });
  res.json({ token });
});

// POST /api/auth/csrf
router.post('/csrf', authenticate, async (req, res) => {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const db = getDb();
  await db.prepare('INSERT INTO csrf_tokens (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, token, expiresAt);
  res.json({ token });
});

// PUT /api/auth/profile - Update profile with image upload
router.put('/profile', authenticate, memoryUpload.single('profileImage'), async (req, res) => {
  const { fullName, phone, username } = req.body;
  const db = getDb();

  // Check username uniqueness if changed
  if (username) {
    const existing = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    await db.prepare('UPDATE users SET username = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(username, req.user.id);
  }

  if (fullName) {
    await db.prepare('UPDATE users SET fullName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(fullName, req.user.id);
  }
  if (phone !== undefined) {
    await db.prepare('UPDATE users SET phone = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(phone, req.user.id);
  }

  // Handle profile image upload
  if (req.file) {
    try {
      const imagePath = await storeImage(req.file, 'homify/profile');
      await db.prepare('UPDATE users SET profileImage = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(imagePath, req.user.id);
    } catch (err) {
      console.error('Image upload failed:', err);
      if (err && err.message && String(err.message).includes('Image storage is not configured')) {
        return res.status(503).json({ error: 'Image uploads are temporarily unavailable (storage not configured). Please try again later.' });
      }
      return res.status(500).json({ error: 'Profile image upload failed. Please try again.' });
    }
  } else if (req.body.profileImage && req.body.profileImage.startsWith('data:')) {
    // base64 image from file input
    await db.prepare('UPDATE users SET profileImage = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.profileImage, req.user.id);
  }

  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: userResponse(updated) });
});

// POST /api/auth/verify-email/:token// Shared handler so both the API client and a plain email link work.
async function verifyEmailToken(req, res) {
  const token = req.params.token;
  const db = getDb();
  const row = await db.prepare('SELECT * FROM email_verifications WHERE token = ? AND verified = 0 AND expiresAt::timestamptz > CURRENT_TIMESTAMP').get(token);
  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }
  await db.prepare('UPDATE users SET emailVerified = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(row.userId);
  await db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(row.id);
  res.json({ message: 'Email verified successfully' });
}
router.post('/verify-email/:token', verifyEmailToken);
router.get('/verify-email/:token', verifyEmailToken);

// POST /api/auth/resend-verification - send a fresh verification link.
// Authenticated: user requests a new link from their profile/dashboard.
router.post('/resend-verification', authenticate, async (req, res) => {
  const db = getDb();
  const user = await db.prepare('SELECT id, fullName, email, emailVerified FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }
  if (user.emailVerified) {
    return res.json({ message: 'Your email is already verified', emailVerified: true });
  }
  const verifyToken = uuidv4();
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO email_verifications (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)').run(
    uuidv4(), user.id, verifyToken, verifyExpires
  );
  const sent = await emailService.sendVerificationEmail(user.email, user.fullName, verifyToken);
  if (!sent) {
    return res.status(503).json({
      error: 'Verification emails are not available right now. Please sign in with Google instead, or try again later.'
    });
  }
  res.json({ message: 'Verification link sent. Please check your inbox.', emailVerificationSent: true });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const db = getDb();
  const cleanEmail = email.trim().toLowerCase();
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);

  if (!user) {
    return res.json({ message: 'If the email exists, a reset link has been sent' });
  }

  const resetToken = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO password_resets (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)').run(uuidv4(), user.id, resetToken, expiresAt);

  await emailService.sendPasswordResetEmail(cleanEmail, resetToken);

  const responseBody = { message: 'If the email exists, a reset link has been sent' };
  // Dev only: expose the token so the automated test suite can exercise the
  // reset flow without SMTP. Never returned in production, where it would
  // allow taking over ANY account by requesting a reset for the victim's
  // email address.
  if (process.env.NODE_ENV !== 'production') {
    responseBody.resetToken = resetToken;
  }
  res.json(responseBody);
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const db = getDb();
  const reset = await db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expiresAt::timestamptz > CURRENT_TIMESTAMP').get(token);
  if (!reset) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await db.prepare('UPDATE users SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, reset.userId);
  await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);
  // Revoke all existing sessions after a password reset.
  await db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE userId = ?').run(reset.userId);

  res.json({ message: 'Password reset successfully' });
});

module.exports = router;