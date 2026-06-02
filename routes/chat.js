const express = require('express');
const { supabase } = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get conversations for the current user
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Supabase JS doesn't support complex GROUP BY out of the box nicely,
    // so we fetch all relevant messages and process them in JS
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        items:item_id (title),
        sender:sender_id (name),
        receiver:receiver_id (name)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!messages || messages.length === 0) {
      return res.json({ conversations: [] });
    }

    const convMap = new Map();

    messages.forEach(m => {
      const isSender = m.sender_id === userId;
      const otherUserId = isSender ? m.receiver_id : m.sender_id;
      const otherUserName = isSender ? m.receiver?.name : m.sender?.name;
      const itemId = m.item_id;
      
      const key = `${otherUserId}-${itemId}`;

      if (!convMap.has(key)) {
        convMap.set(key, {
          other_user_id: otherUserId,
          item_id: itemId,
          item_title: m.items?.title || 'Unknown Item',
          other_user_name: otherUserName || 'Unknown User',
          last_message: m.content,
          last_message_time: m.created_at,
          unread_count: (!isSender && !m.is_read) ? 1 : 0
        });
      } else {
        if (!isSender && !m.is_read) {
          convMap.get(key).unread_count += 1;
        }
      }
    });

    const conversations = Array.from(convMap.values())
      .sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

    res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a specific conversation
router.get('/messages/:itemId/:otherUserId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { itemId, otherUserId } = req.params;

    // Mark messages as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', userId)
      .eq('item_id', itemId)
      .eq('is_read', false);

    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id (name)
      `)
      .eq('item_id', itemId)
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const formattedMessages = (messages || []).map(m => ({
      ...m,
      sender_name: m.sender?.name
    }));

    res.json({ messages: formattedMessages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { receiver_id, item_id, content } = req.body;

    if (!receiver_id || !item_id || !content) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: req.session.userId,
        receiver_id,
        item_id,
        content
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: {
        id: data.id,
        sender_id: req.session.userId,
        sender_name: req.session.userName,
        receiver_id,
        item_id,
        content,
        created_at: data.created_at
      }
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get unread message count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', req.session.userId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ count: count || 0 });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
