const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/favorites - Get user's favorites
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const favorites = await db.prepare(`
    SELECT f.id as favId, f.createdAt as favoritedAt, p.*
    FROM favorites f
    JOIN properties p ON f.propertyId = p.id
    WHERE f.userId = ?
    ORDER BY f.createdAt DESC
  `).all(req.user.id);

  const parsed = favorites.map(f => ({
    ...f,
    images: JSON.parse(f.images || '[]'),
    solar: !!f.solar,
    borehole: !!f.borehole,
    fenced: !!f.fenced
  }));

  res.json({ favorites: parsed });
});

// POST /api/favorites - Add favorite
router.post('/', authenticate, async (req, res) => {
  const { propertyId } = req.body;

  if (!propertyId) {
    return res.status(400).json({ error: 'Property ID is required' });
  }

  const db = getDb();
  const property = await db.prepare('SELECT id FROM properties WHERE id = ?').get(propertyId);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const existing = await db.prepare('SELECT id FROM favorites WHERE userId = ? AND propertyId = ?').get(req.user.id, propertyId);
  if (existing) {
    return res.status(409).json({ error: 'Already favorited' });
  }

  const fav = { id: uuidv4(), userId: req.user.id, propertyId };
  await db.prepare('INSERT INTO favorites (id, userId, propertyId) VALUES (?, ?, ?)').run(fav.id, fav.userId, fav.propertyId);

  res.status(201).json({ favorite: fav });
});

// DELETE /api/favorites/:id - Remove favorite
router.delete('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const fav = await db.prepare('SELECT * FROM favorites WHERE id = ? AND userId = ?').get(req.params.id, req.user.id);
  
  if (!fav) {
    return res.status(404).json({ error: 'Favorite not found' });
  }

  await db.prepare('DELETE FROM favorites WHERE id = ?').run(req.params.id);
  res.json({ message: 'Favorite removed' });
});

// DELETE /api/favorites/property/:propertyId - Remove favorite by property
router.delete('/property/:propertyId', authenticate, async (req, res) => {
  const db = getDb();
  const fav = await db.prepare('SELECT * FROM favorites WHERE userId = ? AND propertyId = ?').get(req.user.id, req.params.propertyId);
  
  if (!fav) {
    return res.status(404).json({ error: 'Favorite not found' });
  }

  await db.prepare('DELETE FROM favorites WHERE id = ?').run(fav.id);
  res.json({ message: 'Favorite removed' });
});

module.exports = router;