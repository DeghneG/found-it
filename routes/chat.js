const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/conversations', requireAuth, (req, res) => {
  try {
    const uid = req.session.userId;
    const myMsgs = db.messages.filter(m => (m.sender_id === uid || m.receiver_id === uid) && !m.is_system);
    const convMap = new Map();
    // Sort newest first for picking the latest message per conversation
    myMsgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    myMsgs.forEach(m => {
      const otherUserId = m.sender_id === uid ? m.receiver_id : m.sender_id;
      const key = `${otherUserId}-${m.item_id}`;
      if (!convMap.has(key)) {
        const otherUser = db.users.find(u => u.id === otherUserId);
        const item = db.items.find(i => i.id === m.item_id);
        convMap.set(key, {
          other_user_id: otherUserId, item_id: m.item_id,
          item_title: item ? item.title : 'Unknown Item',
          other_user_name: otherUser ? otherUser.name : 'Unknown',
          last_message: m.attachment_url ? (m.content || '📎 Attachment') : m.content,
          last_message_time: m.created_at,
          unread_count: (m.receiver_id === uid && !m.is_read) ? 1 : 0
        });
      } else if (m.receiver_id === uid && !m.is_read) {
        convMap.get(key).unread_count++;
      }
    });
    res.json({ conversations: Array.from(convMap.values()).sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/messages/:itemId/:otherUserId', requireAuth, (req, res) => {
  try {
    const uid = req.session.userId;
    const { itemId, otherUserId } = req.params;
    // Mark as read
    db.messages.filter(m => m.sender_id == otherUserId && m.receiver_id === uid && m.item_id == itemId && !m.is_read).forEach(m => m.is_read = true);
    // Get messages
    const msgs = db.messages.filter(m =>
      m.item_id == itemId && !m.is_system &&
      ((m.sender_id === uid && m.receiver_id == otherUserId) || (m.sender_id == otherUserId && m.receiver_id === uid))
    ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    res.json({ messages: msgs });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/send', requireAuth, (req, res) => {
  try {
    const { receiver_id, item_id, content, attachment_url, attachment_type } = req.body;
    if (!receiver_id || !item_id || (!content && !attachment_url)) return res.status(400).json({ error: 'Message content or attachment is required' });
    // Verify the item exists and is active
    const item = db.items.find(i => i.id == item_id);
    if (!item) return res.status(400).json({ error: 'Item not found' });
    const msg = {
      id: db.nextId('messages'), sender_id: req.session.userId, receiver_id: parseInt(receiver_id),
      item_id: parseInt(item_id), content: content || '', attachment_url: attachment_url || null,
      attachment_type: attachment_type || null, is_read: false, is_system: false,
      created_at: new Date().toISOString()
    };
    db.messages.push(msg);
    res.json({ success: true, message: { ...msg, sender_name: req.session.userName } });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/unread-count', requireAuth, (req, res) => {
  const count = db.messages.filter(m => m.receiver_id === req.session.userId && !m.is_read && !m.is_system).length;
  res.json({ count });
});

// Report a message
router.post('/report', requireAuth, (req, res) => {
  const { message_id, reason } = req.body;
  if (!message_id || !reason) return res.status(400).json({ error: 'Message ID and reason required' });
  db.reports.push({
    id: db.nextId('reports'), reporter_id: req.session.userId, type: 'message',
    target_id: message_id, reason, status: 'pending', created_at: new Date().toISOString()
  });
  res.json({ success: true });
});

module.exports = router;
