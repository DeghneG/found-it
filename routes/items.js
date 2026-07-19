const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// In-memory store to replace Supabase (fixes connection error & clears items)
let itemsDb = [];
let nextId = 1;

// Get all lost items (with filters)
router.get('/', (req, res) => {
  try {
    const { category, search, status, longLost } = req.query;

    let filteredItems = [...itemsDb];

    if (status) {
      if (status === 'found') {
        filteredItems = filteredItems.filter(i => ['found', 'returned'].includes(i.status));
      } else {
        filteredItems = filteredItems.filter(i => i.status === status);
      }
    }

    if (category && category !== 'all') {
      filteredItems = filteredItems.filter(i => i.category === category);
    }

    if (search) {
      const s = search.toLowerCase();
      filteredItems = filteredItems.filter(i => 
        (i.title && i.title.toLowerCase().includes(s)) || 
        (i.description && i.description.toLowerCase().includes(s)) ||
        (i.location && i.location.toLowerCase().includes(s))
      );
    }

    if (longLost === 'true') {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      filteredItems = filteredItems.filter(i => 
        i.status === 'lost' && new Date(i.created_at) <= fourteenDaysAgo
      );
    }

    // Sort by created_at descending
    filteredItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ items: filteredItems });
  } catch (err) {
    console.error('Get items error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's own items
router.get('/user/my-items', requireAuth, (req, res) => {
  try {
    let filteredItems = itemsDb.filter(i => i.user_id === req.session.userId);
    filteredItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ items: filteredItems });
  } catch (err) {
    console.error('Get my items error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single item
router.get('/:id', (req, res) => {
  try {
    const item = itemsDb.find(i => i.id == req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ item });
  } catch (err) {
    console.error('Get item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create item
router.post('/', requireAuth, (req, res) => {
  try {
    const { title, description, category, location, date_lost, image_url, verification_question } = req.body;

    if (!title || !description || !category || !location || !date_lost) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    const newItem = {
      id: nextId++,
      user_id: req.session.userId,
      user_name: req.session.userName,
      user_email: req.session.userEmail,
      title,
      description,
      category,
      location,
      date_lost,
      image_url: image_url || null,
      verification_question: verification_question || null,
      status: 'lost',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    itemsDb.push(newItem);

    res.json({ success: true, itemId: newItem.id });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update item
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { title, description, category, location, date_lost, image_url, verification_question } = req.body;
    
    const itemIndex = itemsDb.findIndex(i => i.id == req.params.id);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemsDb[itemIndex];

    if (item.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }

    itemsDb[itemIndex] = {
      ...item,
      title,
      description,
      category,
      location,
      date_lost,
      image_url: image_url || null,
      verification_question: verification_question || null,
      updated_at: new Date().toISOString()
    };

    res.json({ success: true });
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete item
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const itemIndex = itemsDb.findIndex(i => i.id == req.params.id);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemsDb[itemIndex];

    if (item.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    itemsDb.splice(itemIndex, 1);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark item as found
router.put('/:id/found', requireAuth, (req, res) => {
  try {
    const itemIndex = itemsDb.findIndex(i => i.id == req.params.id);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemsDb[itemIndex];

    if (item.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster or admin can mark items as found' });
    }

    itemsDb[itemIndex] = {
      ...item,
      status: 'found',
      found_by: req.session.userName,
      found_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json({ success: true });
  } catch (err) {
    console.error('Mark found error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bump item
router.put('/:id/bump', requireAuth, (req, res) => {
  try {
    const itemIndex = itemsDb.findIndex(i => i.id == req.params.id);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemsDb[itemIndex];

    if (item.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster can bump their item' });
    }

    itemsDb[itemIndex] = {
      ...item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json({ success: true });
  } catch (err) {
    console.error('Bump item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark item as returned (reunited)
router.put('/:id/returned', requireAuth, (req, res) => {
  try {
    const itemIndex = itemsDb.findIndex(i => i.id == req.params.id);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemsDb[itemIndex];

    if (item.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster or admin can mark items as returned' });
    }

    itemsDb[itemIndex] = {
      ...item,
      status: 'returned',
      updated_at: new Date().toISOString()
    };

    res.json({ success: true });
  } catch (err) {
    console.error('Mark returned error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
