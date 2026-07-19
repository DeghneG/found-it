const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// auto-archive expired items (60 days)
function autoArchive() {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  db.items.forEach(i => {
    if (i.status !== 'archived' && new Date(i.created_at) < sixtyDaysAgo) {
      i.status = 'archived';
    }
  });
}

// Get items (with filters)
router.get('/', (req, res) => {
  try {
    autoArchive();
    const { category, search, status, type, longLost } = req.query;
    let items = [...db.items].filter(i => i.status !== 'archived');

    if (type) items = items.filter(i => i.type === type);
    if (status) {
      if (status === 'found') items = items.filter(i => ['found', 'returned'].includes(i.status));
      else items = items.filter(i => i.status === status);
    }
    if (category && category !== 'all') items = items.filter(i => i.category === category);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(i =>
        (i.title && i.title.toLowerCase().includes(s)) ||
        (i.description && i.description.toLowerCase().includes(s)) ||
        (i.location && i.location.toLowerCase().includes(s))
      );
    }
    if (longLost === 'true') {
      const twoWeeks = new Date(); twoWeeks.setDate(twoWeeks.getDate() - 14);
      items = items.filter(i => i.status === 'lost' && new Date(i.created_at) <= twoWeeks);
    }
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ items });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// User's own items
router.get('/user/my-items', requireAuth, (req, res) => {
  try {
    autoArchive();
    let items = db.items.filter(i => i.user_id === req.session.userId && i.status !== 'archived');
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ items });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Single item
router.get('/:id', (req, res) => {
  const item = db.items.find(i => i.id == req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item });
});

// Create item (lost or found)
router.post('/', requireAuth, (req, res) => {
  try {
    const { title, description, category, location, date_lost, image_url, verification_question, type, held_at, finder_contact } = req.body;
    const itemType = type || 'lost';
    if (!title || !description || !category || !location || !date_lost) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }
    const item = {
      id: db.nextId('items'), user_id: req.session.userId, type: itemType, status: itemType === 'found' ? 'found' : 'lost',
      title, description, category, location, date_lost,
      image_url: image_url || null, verification_question: verification_question || null,
      held_at: held_at || null, finder_contact: finder_contact || null,
      user_name: req.session.userName, user_email: req.session.userEmail,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    db.items.push(item);

    // Auto-matching: if found item, notify owners of matching lost items
    if (itemType === 'found') {
      const keywords = title.toLowerCase().split(/\s+/);
      db.items.filter(i => i.type === 'lost' && i.status === 'lost' && i.user_id !== req.session.userId).forEach(lost => {
        const lTitle = lost.title.toLowerCase();
        const sameCategory = lost.category === category;
        const keywordMatch = keywords.some(kw => kw.length > 3 && lTitle.includes(kw));
        if (sameCategory || keywordMatch) {
          // Create a match notification (stored in-memory for polling)
          db.messages.push({
            id: db.nextId('messages'), sender_id: 0, receiver_id: lost.user_id,
            item_id: lost.id, content: `🔔 Potential match found: "${item.title}" was reported found at ${item.location}. This may be your "${lost.title}".`,
            is_read: false, is_system: true, created_at: new Date().toISOString()
          });
        }
      });
    }

    res.json({ success: true, itemId: item.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Update item
router.put('/:id', requireAuth, (req, res) => {
  try {
    const idx = db.items.findIndex(i => i.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    const item = db.items[idx];
    if (item.user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'You can only edit your own posts' });
    const { title, description, category, location, date_lost, image_url, verification_question, held_at, finder_contact } = req.body;
    Object.assign(item, { title, description, category, location, date_lost, image_url: image_url || null, verification_question: verification_question || null, held_at: held_at || item.held_at, finder_contact: finder_contact || item.finder_contact, updated_at: new Date().toISOString() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Delete item
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const idx = db.items.findIndex(i => i.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    if (db.items[idx].user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
    db.items.splice(idx, 1);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Mark as found
router.put('/:id/found', requireAuth, (req, res) => {
  const idx = db.items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  const item = db.items[idx];
  if (item.user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  Object.assign(item, { status: 'found', found_by: req.session.userName, found_date: new Date().toISOString(), updated_at: new Date().toISOString() });
  res.json({ success: true });
});

// Mark as returned
router.put('/:id/returned', requireAuth, (req, res) => {
  const idx = db.items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  const item = db.items[idx];
  if (item.user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  Object.assign(item, { status: 'returned', updated_at: new Date().toISOString() });
  res.json({ success: true });
});

// Renew listing (was "Bump")
router.put('/:id/bump', requireAuth, (req, res) => {
  const idx = db.items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  const item = db.items[idx];
  if (item.user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  Object.assign(item, { created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  res.json({ success: true });
});

// Stats
router.get('/stats/summary', (req, res) => {
  autoArchive();
  const now = new Date();
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
  const twoWeeks = new Date(); twoWeeks.setDate(now.getDate() - 14);
  const active = db.items.filter(i => i.status !== 'archived');
  res.json({
    activeLost: active.filter(i => i.type === 'lost' && i.status === 'lost').length,
    activeFound: active.filter(i => i.type === 'found' && i.status === 'found').length,
    resolvedMonth: active.filter(i => (i.status === 'returned') && new Date(i.updated_at) >= thirtyDaysAgo).length,
    overdue: active.filter(i => i.status === 'lost' && new Date(i.created_at) <= twoWeeks).length
  });
});

module.exports = router;
