const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 50,
  message: { error: isProd ? 'Too many attempts. Please try again after 15 minutes.' : 'Too many attempts. Please wait a moment and try again.' },
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

module.exports = { authLimiter, apiLimiter };
