const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/properties - List all properties with filters + pagination
router.get('/', optionalAuth, async (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM properties WHERE 1=1';
  const params = [];
  const countQuery = 'SELECT COUNT(*)::int as total FROM properties WHERE 1=1';
  const countParams = [];

  if (req.query.city) {
    query += ' AND city = ?';
    countQuery += ' AND city = ?';
    params.push(req.query.city);
    countParams.push(req.query.city);
  }
  if (req.query.suburb) {
    query += ' AND suburb = ?';
    countQuery += ' AND suburb = ?';
    params.push(req.query.suburb);
    countParams.push(req.query.suburb);
  }
  if (req.query.bedrooms) {
    query += ' AND bedrooms >= ?';
    countQuery += ' AND bedrooms >= ?';
    params.push(parseInt(req.query.bedrooms));
    countParams.push(parseInt(req.query.bedrooms));
  }
  if (req.query.type) {
    query += ' AND type = ?';
    countQuery += ' AND type = ?';
    params.push(req.query.type);
    countParams.push(req.query.type);
  }
  if (req.query.currency) {
    query += ' AND currency = ?';
    countQuery += ' AND currency = ?';
    params.push(req.query.currency);
    countParams.push(req.query.currency);
  }
  if (req.query.minPrice) {
    query += ' AND price >= ?';
    countQuery += ' AND price >= ?';
    params.push(parseFloat(req.query.minPrice));
    countParams.push(parseFloat(req.query.minPrice));
  }
  if (req.query.maxPrice) {
    query += ' AND price <= ?';
    countQuery += ' AND price <= ?';
    params.push(parseFloat(req.query.maxPrice));
    countParams.push(parseFloat(req.query.maxPrice));
  }
  if (req.query.solar === 'yes') {
    query += ' AND solar = 1';
    countQuery += ' AND solar = 1';
  }
  if (req.query.borehole === 'yes') {
    query += ' AND borehole = 1';
    countQuery += ' AND borehole = 1';
  }
  if (req.query.fenced === 'yes') {
    query += ' AND fenced = 1';
    countQuery += ' AND fenced = 1';
  }
  if (req.query.landlordId) {
    query += ' AND landlordId = ?';
    countQuery += ' AND landlordId = ?';
    params.push(req.query.landlordId);
    countParams.push(req.query.landlordId);
  }

  query += ' ORDER BY createdAt DESC';

  const totalRow = await db.prepare(countQuery).get(...countParams);
  const total = totalRow.total;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const properties = await db.prepare(query).all(...params);
  
  const parsed = properties.map(p => ({
    ...p,
    images: JSON.parse(p.images || '[]'),
    solar: !!p.solar,
    borehole: !!p.borehole,
    fenced: !!p.fenced
  }));

  res.json({
    properties: parsed,
    total,
    page,
    pages: Math.ceil(total / limit)
  });
});

// GET /api/properties/:id - Get single property
router.get('/:id', optionalAuth, async (req, res) => {
  const db = getDb();
  const property = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const landlord = await db.prepare('SELECT id, fullName, email, phone, profileImage FROM users WHERE id = ?').get(property.landlordId);

  // Check if user has favorited
  let isFavorited = false;
  if (req.user) {
    const fav = await db.prepare('SELECT id FROM favorites WHERE userId = ? AND propertyId = ?').get(req.user.id, property.id);
    isFavorited = !!fav;
  }

  res.json({
    property: {
      ...property,
      images: JSON.parse(property.images || '[]'),
      solar: !!property.solar,
      borehole: !!property.borehole,
      fenced: !!property.fenced,
      landlord,
      isFavorited
    }
  });
});

// POST /api/properties - Create property (landlord/admin)
router.post('/', authenticate, authorize('landlord', 'admin'), upload.array('images', 10), async (req, res) => {
  const { title, description, city, suburb, type, bedrooms, bathrooms, price, currency, solar, borehole, fenced, customAdditions, phone, email, whatsapp } = req.body;

  if (!title || !city || !suburb || !type || !price) {
    return res.status(400).json({ error: 'Title, city, suburb, type, and price are required' });
  }

  const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

  const property = {
    id: uuidv4(),
    landlordId: req.user.id,
    title,
    description: description || '',
    city,
    suburb,
    type,
    bedrooms: parseInt(bedrooms) || 1,
    bathrooms: parseFloat(bathrooms) || 1,
    price: parseFloat(price) || 0,
    currency: currency || 'USD',
    solar: solar === 'true' || solar === true ? 1 : 0,
    borehole: borehole === 'true' || borehole === true ? 1 : 0,
    fenced: fenced === 'true' || fenced === true ? 1 : 0,
    customAdditions: customAdditions || '',
    images: JSON.stringify(images),
    phone: phone || '',
    email: email || '',
    whatsapp: whatsapp || ''
  };

  const db = getDb();
  await db.prepare(`INSERT INTO properties (id, landlordId, title, description, city, suburb, type, bedrooms, bathrooms, price, currency, solar, borehole, fenced, customAdditions, images, phone, email, whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    property.id, property.landlordId, property.title, property.description, property.city, property.suburb, property.type,
    property.bedrooms, property.bathrooms, property.price, property.currency, property.solar, property.borehole, property.fenced,
    property.customAdditions, property.images, property.phone, property.email, property.whatsapp
  );

  res.status(201).json({
    property: {
      ...property,
      images: JSON.parse(property.images)
    }
  });
});

// PUT /api/properties/:id - Update property (owner or admin)
router.put('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }

  if (existing.landlordId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only edit your own properties' });
  }

  const { title, description, city, suburb, type, bedrooms, bathrooms, price, currency, solar, borehole, fenced, customAdditions, phone, email, whatsapp } = req.body;

  await db.prepare(`UPDATE properties SET title = ?, description = ?, city = ?, suburb = ?, type = ?, bedrooms = ?, bathrooms = ?, price = ?, currency = ?, solar = ?, borehole = ?, fenced = ?, customAdditions = ?, phone = ?, email = ?, whatsapp = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(
    title || existing.title,
    description !== undefined ? description : existing.description,
    city || existing.city,
    suburb || existing.suburb,
    type || existing.type,
    bedrooms ? parseInt(bedrooms) : existing.bedrooms,
    bathrooms ? parseFloat(bathrooms) : existing.bathrooms,
    price ? parseFloat(price) : existing.price,
    currency || existing.currency,
    solar !== undefined ? (solar === 'true' || solar === true ? 1 : 0) : existing.solar,
    borehole !== undefined ? (borehole === 'true' || borehole === true ? 1 : 0) : existing.borehole,
    fenced !== undefined ? (fenced === 'true' || fenced === true ? 1 : 0) : existing.fenced,
    customAdditions !== undefined ? customAdditions : existing.customAdditions,
    phone !== undefined ? phone : existing.phone,
    email !== undefined ? email : existing.email,
    whatsapp !== undefined ? whatsapp : existing.whatsapp,
    req.params.id
  );

  const updated = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json({
    property: {
      ...updated,
      images: JSON.parse(updated.images || '[]'),
      solar: !!updated.solar,
      borehole: !!updated.borehole,
      fenced: !!updated.fenced
    }
  });
});

// DELETE /api/properties/:id - Delete property (owner or admin)
router.delete('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }

  if (existing.landlordId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only delete your own properties' });
  }

  await db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ message: 'Property deleted successfully' });
});

// POST /api/properties/:id/images - Upload images to existing property
router.post('/:id/images', authenticate, authorize('landlord', 'admin'), upload.array('images', 10), async (req, res) => {
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }
  if (existing.landlordId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const newImages = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
  const currentImages = JSON.parse(existing.images || '[]');
  const allImages = [...currentImages, ...newImages];

  await db.prepare('UPDATE properties SET images = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(allImages), req.params.id);
  res.json({ images: allImages });
});

// GET /api/cities - Get all cities with properties
router.get('/meta/cities', async (req, res) => {
  const db = getDb();
  const cities = await db.prepare('SELECT DISTINCT city FROM properties ORDER BY city').all();
  res.json({ cities: cities.map(c => c.city) });
});

module.exports = router;