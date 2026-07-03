const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/messages - Send a message
router.post('/', authenticate, async (req, res) => {
  const { receiverId, propertyId, message } = req.body;

  if (!receiverId || !message) {
    return res.status(400).json({ error: 'Receiver and message are required' });
  }

  const db = getDb();
  const msg = {
    id: uuidv4(),
    senderId: req.user.id,
    receiverId,
    propertyId: propertyId || null,
    message,
    read: 0
  };

  await db.prepare('INSERT INTO messages (id, senderId, receiverId, propertyId, message, read) VALUES (?, ?, ?, ?, ?, ?)').run(
    msg.id, msg.senderId, msg.receiverId, msg.propertyId, msg.message, msg.read
  );

  res.status(201).json({ message: msg });
});

// GET /api/messages - Get user's conversations
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  
  // Get messages where user is sender or receiver
  const messages = await db.prepare(`
    SELECT m.*, 
           s.fullName as senderName, s.email as senderEmail,
           r.fullName as receiverName, r.email as receiverEmail,
           p.title as propertyTitle
    FROM messages m
    LEFT JOIN users s ON m.senderId = s.id
    LEFT JOIN users r ON m.receiverId = r.id
    LEFT JOIN properties p ON m.propertyId = p.id
    WHERE m.senderId = ? OR m.receiverId = ?
    ORDER BY m.createdAt DESC
  `).all(req.user.id, req.user.id);

  res.json({ messages });
});

// GET /api/messages/conversation/:userId - Get conversation with specific user
router.get('/conversation/:userId', authenticate, async (req, res) => {
  const db = getDb();
  const messages = await db.prepare(`
    SELECT m.*,
           s.fullName as senderName,
           p.title as propertyTitle
    FROM messages m
    LEFT JOIN users s ON m.senderId = s.id
    LEFT JOIN properties p ON m.propertyId = p.id
    WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?)
    ORDER BY m.createdAt ASC
  `).all(req.user.id, req.params.userId, req.params.userId, req.user.id);

  // Mark messages as read
  await db.prepare('UPDATE messages SET read = 1 WHERE senderId = ? AND receiverId = ? AND read = 0').run(req.params.userId, req.user.id);

  res.json({ messages });
});

// GET /api/messages/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  const db = getDb();
  const count = await db.prepare('SELECT COUNT(*)::int as count FROM messages WHERE receiverId = ? AND read = 0').get(req.user.id);
  res.json({ unreadCount: count.count });
});

module.exports = router;