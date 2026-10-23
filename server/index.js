require('dotenv').config();
const express = require('express');

// Express 4 does not forward rejected async route handlers to error middleware.
// Wrap route callbacks on each router instance so async DB/network failures
// reach the final error handler instead of becoming unhandled rejections.
const OriginalRouter = express.Router;
express.Router = function (...args) {
  const router = OriginalRouter(...args);
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']) {
    const original = router[method];
    if (typeof original !== 'function' || original.__asyncWrapped) continue;
    const wrapped = function (...routeArgs) {
      return original.apply(this, routeArgs.map(handler => {
        if (typeof handler !== 'function') return handler;
        if (handler.length === 4) {
          return function (err, req, res, next) { return handler(err, req, res, next); };
        }
        return function (req, res, next) {
          return Promise.resolve(handler(req, res, next)).catch(next);
        };
      }));
    };
    wrapped.__asyncWrapped = true;
    router[method] = wrapped;
  }
  return router;
};
express.Router.prototype = OriginalRouter.prototype;
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { initDb, getDb } = require('./database/db');
const runMigration = require('./database/migrate');
const { authLimiter, registerLimiter, apiLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const applicationRoutes = require('./routes/applications');
const favoriteRoutes = require('./routes/favorites');
const conversationRoutes = require('./routes/conversations');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(morgan('dev'));
// Listing photos are resized in the browser, but base64 encoding adds overhead.
// Allow a reasonable multi-photo request while retaining a bounded request size.
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS - use FRONTEND_URL env var, default to * for dev
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
};
app.use(cors(corsOptions));

// Security headers (lightweight, no extra dependency).
// CSP allows our own origin + the CDNs we actually use (cdnjs for Font Awesome
// & three.js, unpkg for Leaflet, gstatic/accounts.google for Sign-In,
// tile.openstreetmap.org for map tiles, and data: for inline images).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://accounts.google.com https://apis.google.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://accounts.google.com https://fonts.googleapis.com",
      "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co https://*.tile.openstreetmap.org https://www.gstatic.com https://www.googletagmanager.com",
      "connect-src 'self' https://accounts.google.com https://www.google-analytics.com https://region1.google-analytics.com",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ')
  );
  next();
});

// Trust first proxy so rate limiter works behind Render's load balancer
app.set('trust proxy', 1);

// Rate limiting
// Registration gets its own, more generous limiter (see rateLimiter.js for why),
// applied first so it takes precedence over the stricter general auth limiter.
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/admin', adminRoutes);

// Clean home URL: internal links use relative "index.html" hrefs (so the site
// also works straight from disk), but when served we canonicalise
// /index.html → / so the address bar shows the bare domain. Registered before
// express.static, which would otherwise serve the file at the .html path.
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

// Serve static frontend files
// Do not expose backend source, configuration, or repository metadata through
// the frontend static-file handler.
app.use((req, res, next) => {
  if (/^\/(server|\.git|node_modules)(\/|$)/i.test(req.path) ||
      /^\/(\.env|package(-lock)?\.json|render\.yaml)$/i.test(req.path)) {
    return res.status(404).end();
  }
  next();
});
app.use(express.static(path.join(__dirname, '..')));

// Catch-all: real pages resolve above via express.static. Anything unmatched
// that isn't an API route gets our custom 404 page with a proper 404 status
// (better UX + correct signalling to crawlers than silently serving index).
app.get('*', async (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', '404.html'));
});

// Final error handler for rejected async routes and unexpected middleware errors.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Request failed:', err && err.message ? err.message : err);
  res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 500)
    .json({ error: 'An unexpected server error occurred. Please try again.' });
});

// Initialize database and optionally provision an admin user
async function initializeApp() {
  await initDb();
  await runMigration();

  const supabaseStorageConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const cloudinaryStorageConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  if (process.env.NODE_ENV === 'production' && !supabaseStorageConfigured && !cloudinaryStorageConfigured) {
    console.warn('[WARN] Persistent image storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY with a public Storage bucket, or configure all three CLOUDINARY_* variables.');
  }
  
  const db = getDb();
  
  // Preserve the original configured admin account. If it already exists,
  // ensure it remains an admin; do not change its password or other profile data.
  // A new admin is created only when both environment variables are configured.
  const adminEmail = String(process.env.ADMIN_EMAIL || 'chigodobenji@gmail.com').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  try {
    const existingAdmin = await db.prepare('SELECT id, role FROM users WHERE LOWER(email) = ?').get(adminEmail);
    if (existingAdmin) {
      if (existingAdmin.role !== 'admin') {
        await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existingAdmin.id);
        console.log('[OK] Configured admin account role restored');
      } else {
        console.log('[OK] Configured admin account exists');
      }
    } else if (adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await db.prepare('INSERT INTO users (id, fullName, email, passwordHash, role, phone) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(), 'Admin', adminEmail, passwordHash, 'admin', ''
      );
      console.log('[OK] Admin account provisioned from ADMIN_EMAIL');
    } else {
      console.warn('[WARN] Admin account not found; set ADMIN_PASSWORD to provision it safely');
    }
  } catch (err) {
    console.warn('Admin account initialization failed:', err.message);
  }

  // One-time cleanup: remove the sample/demo listings and demo landlord
  // account that used to be auto-seeded on every server start. Safe to run
  // repeatedly - it's a no-op once they're gone.
  try {
    const demoTitles = [
      'Modern 3-Bed House in Borrowdale',
      'Luxury Apartment with City View',
      'Family Townhouse in Burnside'
    ];
    const demoLandlordEmail = 'landlord@homify.com';
    const placeholders = demoTitles.map(() => '?').join(',');
    const removed = await db.prepare(
      `DELETE FROM properties WHERE title IN (${placeholders}) AND email = ?`
    ).run(...demoTitles, demoLandlordEmail);
    if (removed.changes > 0) {
      console.log(`[OK]  Removed ${removed.changes} legacy demo listing(s)`);
    }
    // Only remove the demo landlord account if it has no real listings left.
    const remaining = await db.prepare('SELECT COUNT(*)::int as count FROM properties WHERE email = ?').get(demoLandlordEmail);
    if (Number(remaining.count) === 0) {
      const deletedUser = await db.prepare('DELETE FROM users WHERE email = ?').run(demoLandlordEmail);
      if (deletedUser.changes > 0) {
        console.log('[OK]  Removed legacy demo landlord account');
      }
    }
  } catch (err) {
    console.warn('Skipped demo data cleanup:', err.message);
  }

  // NOTE: Demo/sample data seeding has been permanently removed (it used to
  // be opt-in via SEED_SAMPLE_DATA=true, but that's fragile if the DB is
  // ever wiped on deploy with the var still set). The cleanup step above
  // still runs to catch any pre-existing legacy demo rows.
}

// Start server
initializeApp().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Homify Backend Server`);
    console.log(`  ─────────────────────`);
    console.log(`  Server:    http://localhost:${PORT}`);
    console.log(`  API:       http://localhost:${PORT}/api`);
    console.log(`  Frontend:  http://localhost:${PORT}/\n`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});