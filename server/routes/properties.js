const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, optionalAuth, authorize, requireVerifiedEmail } = require('../middleware/auth');
const { memoryUpload } = require('../middleware/upload');
const { storeImages } = require('../lib/images');

const router = express.Router();

// GET /api/properties - List all properties with filters + pagination
router.get('/', optionalAuth, async (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM properties WHERE 1=1';
  const params = [];
  let countQuery = 'SELECT COUNT(*)::int as total FROM properties WHERE 1=1';
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

  // Verification visibility: the public only ever sees approved listings.
  // A landlord viewing their own portfolio (or an admin) sees every status.
  const viewingOwn = req.user && req.query.landlordId && req.query.landlordId === req.user.id;
  const showAll = req.user && (req.user.role === 'admin' || viewingOwn);
  if (!showAll) {
    query += " AND status = 'approved'";
    countQuery += " AND status = 'approved'";
  }
  if (req.query.status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(req.query.status);
    countParams.push(req.query.status);
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
    wifi: !!p.wifi,
    electricStove: !!p.electricStove,
    gasStove: !!p.gasStove,
    fridge: !!p.fridge,
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

  // Non-approved listings are only visible to their landlord and admins.
  if (property.status !== 'approved') {
    const isOwner = req.user && req.user.id === property.landlordId;
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Property not found' });
    }
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
      wifi: !!property.wifi,
      electricStove: !!property.electricStove,
      gasStove: !!property.gasStove,
      fridge: !!property.fridge,
      solar: !!property.solar,
      borehole: !!property.borehole,
      fenced: !!property.fenced,
      landlord,
      isFavorited
    }
  });
});

// POST /api/properties - Create property (landlord/admin)
router.post('/', authenticate, requireVerifiedEmail, authorize('landlord', 'admin'), memoryUpload.array('images', 10), async (req, res) => {
  const { title, description, city, suburb, type, bedrooms, bathrooms, price, currency, wifi, electricStove, gasStove, fridge, solar, borehole, fenced, customAdditions, phone, email, whatsapp, latitude, longitude } = req.body;

  if (!title || !city || !suburb || !type || !price) {
    return res.status(400).json({ error: 'Title, city, suburb, type, and price are required' });
  }

  let images = [];
  if (req.files && req.files.length) {
    try {
      images = await storeImages(req.files, 'homify/properties');
    } catch (err) {
      console.error('Image upload failed:', err);
      if (err && err.message && err.message.includes('Image storage is not configured')) {
        return res.status(503).json({ error: 'Image uploads are temporarily unavailable (storage not configured). Please try again later.' });
      }
      return res.status(500).json({ error: 'Image upload failed. Please try again.' });
    }
  }

  // The browser sends resized image data URLs in JSON. Validate each image
  // before decoding so malformed payloads cannot silently become empty files.
  if (!images.length && Array.isArray(req.body.images) && req.body.images.length) {
    if (req.body.images.length > 10) {
      return res.status(400).json({ error: 'A listing can have a maximum of 10 images.' });
    }

    const fakeFiles = [];
    for (let i = 0; i < req.body.images.length; i++) {
      const dataUrl = req.body.images[i];
      if (typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'One of the listing images has an invalid format. Please remove it and upload it again.' });
      }
      const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i);
      if (!match) {
        return res.status(400).json({ error: 'One of the listing images could not be read. Please upload the image again.' });
      }
      const base64 = match[2].replace(/\s/g, '');
      if (base64.length > 7 * 1024 * 1024) {
        return res.status(413).json({ error: 'Each image must be smaller than 5 MB after processing. Please use a smaller image.' });
      }
      const buffer = Buffer.from(base64, 'base64');
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'One of the listing images is empty or too large. Please upload a smaller image.' });
      }
      fakeFiles.push({
        buffer,
        originalname: `image-${i}.${match[1].toLowerCase()}`
      });
    }

    try {
      images = await storeImages(fakeFiles, 'homify/properties');
    } catch (err) {
      console.error('Image upload failed:', err);
      if (err && err.message && err.message.includes('Image storage is not configured')) {
        return res.status(503).json({ error: 'Image uploads are temporarily unavailable because image storage is not configured. Please contact the site administrator.' });
      }
      return res.status(500).json({ error: 'Image upload failed. Please try again.' });
    }
  }

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
    wifi: wifi === 'true' || wifi === true ? 1 : 0,
    electricStove: electricStove === 'true' || electricStove === true ? 1 : 0,
    gasStove: gasStove === 'true' || gasStove === true ? 1 : 0,
    fridge: fridge === 'true' || fridge === true ? 1 : 0,
    solar: solar === 'true' || solar === true ? 1 : 0,
    borehole: borehole === 'true' || borehole === true ? 1 : 0,
    fenced: fenced === 'true' || fenced === true ? 1 : 0,
    customAdditions: customAdditions || '',
    images: JSON.stringify(images),
    phone: phone || '',
    email: email || '',
    whatsapp: whatsapp || '',
    latitude: latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null,
    longitude: longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null,
    status: 'pending'   // hidden from students until an admin verifies it
  };

  const db = getDb();
  await db.prepare(`INSERT INTO properties (id, landlordId, title, description, city, suburb, type, bedrooms, bathrooms, price, currency, wifi, electricStove, gasStove, fridge, solar, borehole, fenced, customAdditions, images, phone, email, whatsapp, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    property.id, property.landlordId, property.title, property.description, property.city, property.suburb, property.type,
    property.bedrooms, property.bathrooms, property.price, property.currency,
    property.wifi, property.electricStove, property.gasStove, property.fridge,
    property.solar, property.borehole, property.fenced,
    property.customAdditions, property.images, property.phone, property.email, property.whatsapp,
    property.latitude, property.longitude, property.status
  );

  res.status(201).json({
    property: {
      ...property,
      images: JSON.parse(property.images)
    },
    message: 'Listing submitted for verification. It will appear publicly once an admin approves it.'
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

  const { title, description, city, suburb, type, bedrooms, bathrooms, price, currency, wifi, electricStove, gasStove, fridge, solar, borehole, fenced, customAdditions, phone, email, whatsapp, latitude, longitude } = req.body;

  // Editing a rejected listing re-submits it for verification.
  const newStatus = existing.status === 'rejected' ? 'pending' : existing.status;
  const newRejectReason = existing.status === 'rejected' ? '' : existing.rejectReason;

  await db.prepare(`UPDATE properties SET title = ?, description = ?, city = ?, suburb = ?, type = ?, bedrooms = ?, bathrooms = ?, price = ?, currency = ?, wifi = ?, electricStove = ?, gasStove = ?, fridge = ?, solar = ?, borehole = ?, fenced = ?, customAdditions = ?, phone = ?, email = ?, whatsapp = ?, latitude = ?, longitude = ?, status = ?, rejectReason = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(
    title || existing.title,
    description !== undefined ? description : existing.description,
    city || existing.city,
    suburb || existing.suburb,
    type || existing.type,
    bedrooms ? parseInt(bedrooms) : existing.bedrooms,
    bathrooms ? parseFloat(bathrooms) : existing.bathrooms,
    price ? parseFloat(price) : existing.price,
    currency || existing.currency,
    wifi !== undefined ? (wifi === 'true' || wifi === true ? 1 : 0) : existing.wifi,
    electricStove !== undefined ? (electricStove === 'true' || electricStove === true ? 1 : 0) : existing.electricStove,
    gasStove !== undefined ? (gasStove === 'true' || gasStove === true ? 1 : 0) : existing.gasStove,
    fridge !== undefined ? (fridge === 'true' || fridge === true ? 1 : 0) : existing.fridge,
    solar !== undefined ? (solar === 'true' || solar === true ? 1 : 0) : existing.solar,
    borehole !== undefined ? (borehole === 'true' || borehole === true ? 1 : 0) : existing.borehole,
    fenced !== undefined ? (fenced === 'true' || fenced === true ? 1 : 0) : existing.fenced,
    customAdditions !== undefined ? customAdditions : existing.customAdditions,
    phone !== undefined ? phone : existing.phone,
    email !== undefined ? email : existing.email,
    whatsapp !== undefined ? whatsapp : existing.whatsapp,
    latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : existing.latitude,
    longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : existing.longitude,
    newStatus,
    newRejectReason,
    req.params.id
  );

  const updated = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json({
    property: {
      ...updated,
      images: JSON.parse(updated.images || '[]'),
      wifi: !!updated.wifi,
      electricStove: !!updated.electricStove,
      gasStove: !!updated.gasStove,
      fridge: !!updated.fridge,
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

// POST /api/properties/:id/report - Flag a listing as a suspected scam
router.post('/:id/report', authenticate, requireVerifiedEmail, async (req, res) => {
  const db = getDb();
  const { reason, evidence } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A reason is required' });
  }

  const property = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }
  if (property.landlordId === req.user.id) {
    return res.status(400).json({ error: 'You cannot report your own listing' });
  }

  const prior = await db.prepare(
    'SELECT id FROM reports WHERE propertyId = ? AND reporterId = ? AND status = ?'
  ).get(req.params.id, req.user.id, 'open');
  if (prior) {
    return res.status(409).json({ error: 'You have already reported this listing. The Homify team is reviewing it.' });
  }

  await db.prepare(
    'INSERT INTO reports (id, propertyId, reporterId, reason, evidence, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), property.id, req.user.id, reason.trim(), (evidence || '').trim(), 'open');

  // Count every open report, including this one. Hide the listing immediately
  // and auto-remove after 3 independent reports so one report alone cannot
  // permanently take down a listing, but a pattern does.
  const openCount = await db.prepare(
    "SELECT COUNT(*)::int AS count FROM reports WHERE propertyId = ? AND status = 'open'"
  ).get(property.id);
  const count = (openCount && openCount.count) || 1;

  if (property.status === 'approved') {
    await db.prepare(
      "UPDATE properties SET status = 'flagged', rejectReason = 'Under review following a user report', updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(property.id);
  }
  if (count >= 3 && property.status !== 'rejected') {
    await db.prepare(
      "UPDATE properties SET status = 'rejected', rejectReason = 'Removed after multiple scam reports', updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(property.id);
  }

  res.status(201).json({
    message: count >= 3
      ? 'Report received. Multiple reports were filed, so the listing has been removed pending review.'
      : 'Report received. The listing has been hidden while the Homify team reviews it.'
  });
});

// POST /api/properties/:id/images - Upload images to existing property
router.post('/:id/images', authenticate, authorize('landlord', 'admin'), memoryUpload.array('images', 10), async (req, res) => {
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }
  if (existing.landlordId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied' });
  }

  let newImages = [];
  if (req.files && req.files.length) {
    try {
      newImages = await storeImages(req.files, 'homify/properties');
    } catch (err) {
      console.error('Image upload failed:', err);
      if (err && err.message && err.message.includes('Image storage is not configured')) {
        return res.status(503).json({ error: 'Image uploads are temporarily unavailable (storage not configured). Please try again later.' });
      }
      return res.status(500).json({ error: 'Image upload failed. Please try again.' });
    }
  }
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