require('dotenv').config();
const express = require('express');
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
const messageRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS - use FRONTEND_URL env var, default to * for dev
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
};
app.use(cors(corsOptions));

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
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/admin', adminRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// All other routes -> index.html for SPA-like fallback
app.get('*', async (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Initialize database and create admin user
async function initializeApp() {
  await initDb();
  await runMigration();
  
  const db = getDb();
  
  // Auto-create admin only if ADMIN_EMAIL env var is set
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      const existingAdmin = await db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
      if (!existingAdmin) {
        const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        await db.prepare('INSERT INTO users (id, fullName, email, passwordHash, role, phone) VALUES (?, ?, ?, ?, ?, ?)').run(
          uuidv4(), 'Admin', adminEmail, passwordHash, 'admin', '+263 77 000 0000'
        );
        console.log('✓ Admin created:', adminEmail);
      }
    } catch (err) {
      console.warn('Skipped admin creation:', err.message);
    }
  }
  
  // One-time cleanup: remove the sample/demo listings and demo landlord
  // account that used to be auto-seeded on every server start. Safe to run
  // repeatedly — it's a no-op once they're gone.
  try {
    const demoTitles = [
      'Modern 3-Bed House in Borrowdale',
      'Luxury Apartment with City View',
      'Family Townhouse in Burnside'
    ];
    const demoLandlordEmail = 'landlord@zimrent.com';
    const placeholders = demoTitles.map(() => '?').join(',');
    const removed = await db.prepare(
      `DELETE FROM properties WHERE title IN (${placeholders}) AND email = ?`
    ).run(...demoTitles, demoLandlordEmail);
    if (removed.changes > 0) {
      console.log(`✓ Removed ${removed.changes} legacy demo listing(s)`);
    }
    // Only remove the demo landlord account if it has no real listings left.
    const remaining = await db.prepare('SELECT COUNT(*)::int as count FROM properties WHERE email = ?').get(demoLandlordEmail);
    if (Number(remaining.count) === 0) {
      const deletedUser = await db.prepare('DELETE FROM users WHERE email = ?').run(demoLandlordEmail);
      if (deletedUser.changes > 0) {
        console.log('✓ Removed legacy demo landlord account');
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
    console.log(`\n  ZimRent Backend Server`);
    console.log(`  ─────────────────────`);
    console.log(`  Server:    http://localhost:${PORT}`);
    console.log(`  API:       http://localhost:${PORT}/api`);
    console.log(`  Frontend:  http://localhost:${PORT}/\n`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});