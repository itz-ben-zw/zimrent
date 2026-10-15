
const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
  const db = getDb();
  const users = await db.prepare('SELECT id, fullName, email, role, phone, profileImage, createdAt FROM users ORDER BY createdAt DESC').all();
  res.json({ users });
});

// DELETE /api/admin/users/:id - Remove user
router.delete('/users/:id', async (req, res) => {
  const db = getDb();
  const user = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Cannot delete admin users' });
  }

  await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// PUT /api/admin/users/:id/suspend - Suspend account (status flag; role untouched)
router.put('/users/:id/suspend', async (req, res) => {
  const db = getDb();
  const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (target.role === 'admin') {
    return res.status(400).json({ error: 'Cannot suspend admin users' });
  }
  await db.prepare("UPDATE users SET status = 'suspended', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  res.json({ message: 'Account suspended' });
});

// PUT /api/admin/users/:id/unsuspend - Restore a suspended account
router.put('/users/:id/unsuspend', async (req, res) => {
  const db = getDb();
  const target = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  await db.prepare("UPDATE users SET status = 'active', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  res.json({ message: 'Account restored' });
});

// GET /api/admin/properties - Get all properties (optional ?status=pending|approved|rejected|flagged)
router.get('/properties', async (req, res) => {
  const db = getDb();
  let query = `
    SELECT p.*, u.fullName as landlordName, u.email as landlordEmail
    FROM properties p
    JOIN users u ON p.landlordId = u.id
  `;
  const params = [];
  if (req.query.status) {
    query += ' WHERE p.status = ?';
    params.push(req.query.status);
  }
  query += ' ORDER BY p.createdAt DESC';
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

  res.json({ properties: parsed });
});

// PUT /api/admin/properties/:id/verify - Approve or reject a pending/flagged listing
router.put('/properties/:id/verify', async (req, res) => {
  const db = getDb();
  const { decision, notes } = req.body;

  if (!['approve', 'reject', 'restore'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve, reject or restore' });
  }

  const property = await db.prepare('SELECT id, status FROM properties WHERE id = ?').get(req.params.id);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  if (decision === 'approve') {
    await db.prepare(
      "UPDATE properties SET status = 'approved', rejectReason = '', verifiedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(req.params.id);
    res.json({ message: 'Listing verified and published' });
  } else if (decision === 'reject') {
    await db.prepare(
      "UPDATE properties SET status = 'rejected', rejectReason = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(notes || 'Could not verify ownership or listing details', req.params.id);
    res.json({ message: 'Listing rejected' });
  } else {
    // restore a flagged listing after reviewing reports
    await db.prepare(
      "UPDATE properties SET status = 'approved', rejectReason = '', updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(req.params.id);
    res.json({ message: 'Listing restored after review' });
  }
});

// GET /api/admin/reports - Open (or all) scam reports
router.get('/reports', async (req, res) => {
  const db = getDb();
  let query = `
    SELECT r.*, p.title as propertyTitle, p.status as propertyStatus, u.fullName as reporterName
    FROM reports r
    JOIN properties p ON r.propertyId = p.id
    JOIN users u ON r.reporterId = u.id
  `;
  const params = [];
  if (req.query.status) {
    query += ' WHERE r.status = ?';
    params.push(req.query.status);
  }
  query += ' ORDER BY r.createdAt DESC';
  const reports = await db.prepare(query).all(...params);
  res.json({ reports });
});

// PUT /api/admin/reports/:id/resolve - Close a report
router.put('/reports/:id/resolve', async (req, res) => {
  const db = getDb();
  const report = await db.prepare('SELECT id FROM reports WHERE id = ?').get(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  await db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Report marked as resolved' });
});

// DELETE /api/admin/properties/:id - Remove property
router.delete('/properties/:id', async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ message: 'Property deleted' });
});

// GET /api/admin/applications - Get all applications
router.get('/applications', async (req, res) => {
  const db = getDb();
  const applications = await db.prepare(`
    SELECT a.*, p.title as propertyTitle, u.fullName as tenantName, u.email as tenantEmail
    FROM applications a
    JOIN properties p ON a.propertyId = p.id
    JOIN users u ON a.tenantId = u.id
    ORDER BY a.createdAt DESC
  `).all();
  res.json({ applications });
});

// GET /api/admin/stats - Dashboard stats
router.get('/stats', async (req, res) => {
  const db = getDb();
  const totalUsers = await db.prepare('SELECT COUNT(*)::int as count FROM users').get();
  const totalLandlords = await db.prepare('SELECT COUNT(*)::int as count FROM users WHERE role = ?').get('landlord');
  const totalTenants = await db.prepare('SELECT COUNT(*)::int as count FROM users WHERE role = ?').get('tenant');
  const totalProperties = await db.prepare('SELECT COUNT(*)::int as count FROM properties').get();
  const pendingVerifications = await db.prepare("SELECT COUNT(*)::int as count FROM properties WHERE status = 'pending'").get();
  const flaggedListings = await db.prepare("SELECT COUNT(*)::int as count FROM properties WHERE status = 'flagged'").get();
  const openReports = await db.prepare("SELECT COUNT(*)::int as count FROM reports WHERE status = 'open'").get();
  const totalApplications = await db.prepare('SELECT COUNT(*)::int as count FROM applications').get();
  const pendingApplications = await db.prepare('SELECT COUNT(*)::int as count FROM applications WHERE status = ?').get('pending');

  res.json({
    stats: {
      totalUsers: totalUsers.count,
      totalLandlords: totalLandlords.count,
      totalTenants: totalTenants.count,
      totalProperties: totalProperties.count,
      pendingVerifications: pendingVerifications.count,
      flaggedListings: flaggedListings.count,
      openReports: openReports.count,
      totalApplications: totalApplications.count,
      pendingApplications: pendingApplications.count
    }
  });
});

module.exports = router;