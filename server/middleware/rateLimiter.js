const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

// Login/phone-verify: stricter, since these are the main brute-force targets.
// Only failed attempts count against the limit, so legitimate repeat users
// (or many different users sharing a carrier NAT IP) aren't penalized for
// each other's successful logins.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 100,
  skipSuccessfulRequests: true,
  message: { error: isProd ? 'Too many attempts. Please try again after 15 minutes.' : 'Too many attempts. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Registration: much less prone to brute-forcing (each attempt creates a
// unique account), and many distinct real users can share one public IP
// (mobile carrier NAT is common in Zimbabwe), so this needs a higher ceiling
// than login. Only failed attempts (validation errors, duplicate email, etc.)
// count against the limit.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 200,
  skipSuccessfulRequests: true,
  message: { error: isProd ? 'Too many registration attempts from this network. Please try again in 15 minutes.' : 'Too many attempts. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 200 : 500,
  message: { error: isProd ? 'Too many requests. Please try again later.' : 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, registerLimiter, apiLimiter };
