require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { initDb, getDb } = require('./database/db');
const runMigration = require('./database/migrate');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

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

// Rate limiting
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
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Initialize database and create admin user
async function initializeApp() {
  await initDb();
  runMigration();
  
  const db = getDb();
  
  // Auto-create admin only if ADMIN_EMAIL env var is set
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
      if (!existingAdmin) {
        const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        db.prepare('INSERT INTO users (id, fullName, email, passwordHash, role, phone) VALUES (?, ?, ?, ?, ?, ?)').run(
          uuidv4(), 'Admin', adminEmail, passwordHash, 'admin', '+263 77 000 0000'
        );
        console.log('✓ Admin created:', adminEmail);
      }
    } catch (err) {
      console.warn('Skipped admin creation:', err.message);
    }
  }
  
  // Create sample landlord if none exist
  try {
    const propertyCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
    const propCount = propertyCount ? (propertyCount.count ?? propertyCount['COUNT(*)'] ?? 0) : 0;
    console.log('DB status: properties =', propCount);
    if (!propCount) {
    const landlordEmail = 'landlord@zimrent.com';
    let landlord = db.prepare('SELECT id FROM users WHERE email = ?').get(landlordEmail);
    
    if (!landlord) {
      const passwordHash = bcrypt.hashSync('landlord123', 10);
      db.prepare('INSERT INTO users (id, fullName, email, passwordHash, role, phone) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(), 'John Landlord', landlordEmail, passwordHash, 'landlord', '+263 00 000 0000'
      );
      landlord = db.prepare('SELECT id FROM users WHERE email = ?').get(landlordEmail);
    }

    const sampleProperties = [
      {
        title: 'Modern 3-Bed House in Borrowdale',
        description: 'Beautiful family home with solar power, borehole water, and a spacious garden. Located in a quiet cul-de-sac in Borrowdale.',
        city: 'Harare', suburb: 'Borrowdale', type: 'House', bedrooms: 3, bathrooms: 2,
        price: 850, currency: 'USD', solar: 1, borehole: 1, fenced: 1
      },
      {
        title: 'Luxury Apartment with City View',
        description: 'Stunning 2-bed apartment in Avondale with modern finishes, secure parking, and backup power.',
        city: 'Harare', suburb: 'Avondale', type: 'Apartment', bedrooms: 2, bathrooms: 2,
        price: 650, currency: 'USD', solar: 1, borehole: 0, fenced: 0
      },
      {
        title: 'Family Townhouse in Burnside',
        description: 'Spacious 4-bed townhouse with borehole water and a large yard. Perfect for families.',
        city: 'Bulawayo', suburb: 'Burnside', type: 'Townhouse', bedrooms: 4, bathrooms: 2,
        price: 500, currency: 'USD', solar: 1, borehole: 1, fenced: 1
      }
    ];

    const insert = db.prepare(`INSERT INTO properties (id, landlordId, title, description, city, suburb, type, bedrooms, bathrooms, price, currency, solar, borehole, fenced, images, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    for (const prop of sampleProperties) {
      insert.run(
        uuidv4(), landlord.id, prop.title, prop.description, prop.city, prop.suburb, prop.type,
        prop.bedrooms, prop.bathrooms, prop.price, prop.currency, prop.solar, prop.borehole, prop.fenced,
        '[]', '+263 00 000 0000', landlordEmail
      );
    }
      console.log('✓ Sample properties created');
    }
  } catch (err) {
    console.warn('Skipped sample data creation:', err.message);
  }
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