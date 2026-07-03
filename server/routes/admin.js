
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

// PUT /api/admin/users/:id/suspend - Suspend account (marks as suspended)
router.put('/users/:id/suspend', async (req, res) => {
  const db = getDb();
  await db.prepare('UPDATE users SET role = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run('suspended', req.params.id);
  res.json({ message: 'Account suspended' });
});

// GET /api/admin/properties - Get all properties
router.get('/properties', async (req, res) => {
  const db = getDb();
  const properties = await db.prepare(`
    SELECT p.*, u.fullName as landlordName, u.email as landlordEmail
    FROM properties p
    JOIN users u ON p.landlordId = u.id
    ORDER BY p.createdAt DESC
  `).all();

  const parsed = properties.map(p => ({
    ...p,
    images: JSON.parse(p.images || '[]'),
    solar: !!p.solar,
    borehole: !!p.borehole,
    fenced: !!p.fenced
  }));

  res.json({ properties: parsed });
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
  const totalApplications = await db.prepare('SELECT COUNT(*)::int as count FROM applications').get();
  const pendingApplications = await db.prepare('SELECT COUNT(*)::int as count FROM applications WHERE status = ?').get('pending');

  res.json({
    stats: {
      totalUsers: totalUsers.count,
      totalLandlords: totalLandlords.count,
      totalTenants: totalTenants.count,
      totalProperties: totalProperties.count,
      totalApplications: totalApplications.count,
      pendingApplications: pendingApplications.count
    }
  });
});

module.exports = router;