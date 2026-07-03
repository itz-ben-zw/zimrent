const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/conversations - Get user's conversations
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const user = req.user;

  let conversations;
  if (user.role === 'tenant') {
    conversations = await db.prepare(`
      SELECT c.*, p.title as propertyTitle, p.city as propertyCity, p.suburb as propertySuburb,
             u.fullName as landlordName
      FROM conversations c
      JOIN properties p ON c.propertyId = p.id
      JOIN users u ON c.landlordId = u.id
      WHERE c.tenantId = ?
      ORDER BY c.updatedAt DESC
    `).all(user.id);
  } else if (user.role === 'landlord') {
    conversations = await db.prepare(`
      SELECT c.*, p.title as propertyTitle, p.city as propertyCity, p.suburb as propertySuburb,
             u.fullName as tenantName
      FROM conversations c
      JOIN properties p ON c.propertyId = p.id
      JOIN users u ON c.tenantId = u.id
      WHERE c.landlordId = ?
      ORDER BY c.updatedAt DESC
    `).all(user.id);
  } else {
    return res.json({ conversations: [] });
  }

  // Get last message and unread count for each conversation
  const enriched = await Promise.all(conversations.map(async c => {
    const lastMsg = await db.prepare('SELECT text, createdAt FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT 1').get(c.id);
    const unread = await db.prepare('SELECT COUNT(*)::int as count FROM messages WHERE conversationId = ? AND senderId != ? AND read = 0').get(c.id, user.id);
    return { ...c, lastMessage: lastMsg?.text || '', lastMessageAt: lastMsg?.createdAt || c.createdAt, unreadCount: unread.count };
  }));

  res.json({ conversations: enriched });
});

// POST /api/conversations - Start or get conversation for a property
router.post('/', authenticate, async (req, res) => {
  const { propertyId, message } = req.body;
  const db = getDb();
  const user = req.user;

  if (!propertyId) {
    return res.status(400).json({ error: 'Property ID is required' });
  }

  const property = await db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  let conversation;
  if (user.role === 'tenant') {
    conversation = await db.prepare('SELECT * FROM conversations WHERE propertyId = ? AND tenantId = ?').get(propertyId, user.id);
  } else {
    return res.status(403).json({ error: 'Only tenants can start conversations' });
  }

  if (!conversation) {
    const convId = uuidv4();
    await db.prepare('INSERT INTO conversations (id, propertyId, landlordId, tenantId) VALUES (?, ?, ?, ?)').run(
      convId, propertyId, property.landlordId, user.id
    );
    conversation = { id: convId, propertyId, landlordId: property.landlordId, tenantId: user.id };

    // Send initial message if provided
    if (message) {
      await db.prepare('INSERT INTO messages (id, conversationId, senderId, text) VALUES (?, ?, ?, ?)').run(
        uuidv4(), convId, user.id, message
      );
    }
  } else if (message) {
    await db.prepare('INSERT INTO messages (id, conversationId, senderId, text) VALUES (?, ?, ?, ?)').run(
      uuidv4(), conversation.id, user.id, message
    );
    await db.prepare('UPDATE conversations SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(conversation.id);
  }

  res.status(201).json({ conversation });
});

// GET /api/conversations/:id/messages - Get messages for a conversation
router.get('/:id/messages', authenticate, async (req, res) => {
  const db = getDb();
  const user = req.user;
  const convId = req.params.id;

  const conversation = await db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Ensure user is part of this conversation
  if (conversation.landlordId !== user.id && conversation.tenantId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const messages = await db.prepare(`
    SELECT m.*, u.fullName as senderName
    FROM messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.conversationId = ?
    ORDER BY m.createdAt ASC
  `).all(convId);

  // Mark messages as read for current user
  await db.prepare('UPDATE messages SET read = 1 WHERE conversationId = ? AND senderId != ? AND read = 0').run(convId, user.id);

  res.json({ messages });
});

// POST /api/conversations/:id/messages - Send message
router.post('/:id/messages', authenticate, async (req, res) => {
  const { text } = req.body;
  const db = getDb();
  const user = req.user;
  const convId = req.params.id;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const conversation = await db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (conversation.landlordId !== user.id && conversation.tenantId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const msg = {
    id: uuidv4(),
    conversationId: convId,
    senderId: user.id,
    text: text.trim(),
    read: 0
  };

  await db.prepare('INSERT INTO messages (id, conversationId, senderId, text) VALUES (?, ?, ?, ?)').run(
    msg.id, msg.conversationId, msg.senderId, msg.text
  );

  await db.prepare('UPDATE conversations SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(convId);

  res.status(201).json({ message: msg });
});

module.exports = router;