const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// POST /api/applications - Apply for a property (tenant)
router.post('/', authenticate, authorize('tenant'), (req, res) => {
  const { propertyId, message } = req.body;

  if (!propertyId) {
    return res.status(400).json({ error: 'Property ID is required' });
  }

  const db = getDb();
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Check if already applied
  const existing = db.prepare('SELECT id FROM applications WHERE propertyId = ? AND tenantId = ?').get(propertyId, req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'You have already applied for this property' });
  }

  const application = {
    id: uuidv4(),
    propertyId,
    tenantId: req.user.id,
    message: message || '',
    status: 'pending'
  };

  db.prepare('INSERT INTO applications (id, propertyId, tenantId, message, status) VALUES (?, ?, ?, ?, ?)').run(
    application.id, application.propertyId, application.tenantId, application.message, application.status
  );

  // Create notification for landlord
  db.prepare('INSERT INTO notifications (id, userId, type, message) VALUES (?, ?, ?, ?)').run(
    uuidv4(), property.landlordId, 'new_application', `New application received for "${property.title}"`
  );

  res.status(201).json({ application });
});

// GET /api/applications/mine - Get tenant's applications
router.get('/mine', authenticate, authorize('tenant'), (req, res) => {
  const db = getDb();
  const applications = db.prepare(`
    SELECT a.*, p.title as propertyTitle, p.city, p.suburb, p.price, p.currency
    FROM applications a
    JOIN properties p ON a.propertyId = p.id
    WHERE a.tenantId = ?
    ORDER BY a.createdAt DESC
  `).all(req.user.id);

  res.json({ applications });
});

// GET /api/applications/landlord - Get applications for landlord's properties
router.get('/landlord', authenticate, authorize('landlord', 'admin'), (req, res) => {
  const db = getDb();
  let applications;
  
  if (req.user.role === 'admin') {
    applications = db.prepare(`
      SELECT a.*, p.title as propertyTitle, p.city, p.suburb, p.price, p.currency,
             u.fullName as tenantName, u.email as tenantEmail, u.phone as tenantPhone
      FROM applications a
      JOIN properties p ON a.propertyId = p.id
      JOIN users u ON a.tenantId = u.id
      ORDER BY a.createdAt DESC
    `).all();
  } else {
    applications = db.prepare(`
      SELECT a.*, p.title as propertyTitle, p.city, p.suburb, p.price, p.currency,
             u.fullName as tenantName, u.email as tenantEmail, u.phone as tenantPhone
      FROM applications a
      JOIN properties p ON a.propertyId = p.id
      JOIN users u ON a.tenantId = u.id
      WHERE p.landlordId = ?
      ORDER BY a.createdAt DESC
    `).all(req.user.id);
  }

  res.json({ applications });
});

// PUT /api/applications/:id/status - Accept/reject application
router.put('/:id/status', authenticate, authorize('landlord', 'admin'), (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be accepted or rejected' });
  }

  const db = getDb();
  const application = db.prepare(`
    SELECT a.*, p.landlordId, p.title as propertyTitle, p.landlordId
    FROM applications a
    JOIN properties p ON a.propertyId = p.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.landlordId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied' });
  }

  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, req.params.id);

  // Notify tenant
  db.prepare('INSERT INTO notifications (id, userId, type, message) VALUES (?, ?, ?, ?)').run(
    uuidv4(), application.tenantId, 'application_status',
    `Your application for "${application.propertyTitle}" has been ${status}`
  );

  res.json({ message: `Application ${status}`, status });
});

module.exports = router;