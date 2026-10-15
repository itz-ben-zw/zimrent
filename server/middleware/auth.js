const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');

async function authenticate(req, res, next) {
  // Check for token in Authorization header or cookies
  let token = null;
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = await db.prepare('SELECT id, fullName, email, role, phone, profileImage, emailVerified, status FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact Homify support.' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function optionalAuth(req, res, next) {
  let token = null;
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const db = getDb();
      const user = await db.prepare('SELECT id, fullName, email, role, phone, profileImage, emailVerified, status FROM users WHERE id = ?').get(decoded.userId);
      if (user && user.status !== 'suspended') {
        req.user = user;
      }
    } catch (err) {
      // Token invalid, continue without user
    }
  }
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Airbnb-style trust gate: browsing is open to everyone, but anything that
// creates trust between strangers (posting, applying, messaging, reporting)
// requires a verified email. The auth middleware already loads emailVerified
// onto req.user, and admins are exempt so moderation never deadlocks.
function requireVerifiedEmail(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role === 'admin') {
    return next();
  }
  if (!req.user.emailVerified) {
    return res.status(403).json({
      error: 'Please verify your email before doing that. Check your inbox for the verification link, or request a new one from your profile.',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
}

function csrfProtection(req, res, next) {
  const method = req.method.toLowerCase();
  if (['get', 'head', 'options'].includes(method)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies && req.cookies['csrf_token'];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

module.exports = { authenticate, optionalAuth, authorize, requireVerifiedEmail, csrfProtection };
