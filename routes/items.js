const express = require('express');
const { supabase } = require('../database/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all lost items (with filters)
router.get('/', async (req, res) => {
  try {
    const { category, search, status, longLost } = req.query;

    let query = supabase
      .from('items')
      .select(`
        *,
        users:user_id (name, email)
      `);

    // Filter out items older than 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    query = query.gte('created_at', sixtyDaysAgo.toISOString());

    if (status) {
      query = query.eq('status', status);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
    }

    if (longLost === 'true') {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      query = query.eq('status', 'lost').lte('created_at', fourteenDaysAgo.toISOString());
    }

    query = query.order('created_at', { ascending: false });

    const { data: items, error } = await query;
    if (error) throw error;

    // Flatten the users object to match previous SQL structure
    const formattedItems = (items || []).map(item => ({
      ...item,
      user_name: item.users?.name,
      user_email: item.users?.email
    }));

    res.json({ items: formattedItems });
  } catch (err) {
    console.error('Get items error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's own items
router.get('/user/my-items', requireAuth, async (req, res) => {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: items, error } = await supabase
      .from('items')
      .select(`
        *,
        users:user_id (name, email)
      `)
      .eq('user_id', req.session.userId)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedItems = (items || []).map(item => ({
      ...item,
      user_name: item.users?.name,
      user_email: item.users?.email
    }));

    res.json({ items: formattedItems });
  } catch (err) {
    console.error('Get my items error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const { data: item, error } = await supabase
      .from('items')
      .select(`
        *,
        users:user_id (name, email)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const formattedItem = {
      ...item,
      user_name: item.users?.name,
      user_email: item.users?.email
    };

    res.json({ item: formattedItem });
  } catch (err) {
    console.error('Get item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create item
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, category, location, date_lost, image_url } = req.body;

    if (!title || !description || !category || !location || !date_lost) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    const { data, error } = await supabase
      .from('items')
      .insert([{
        user_id: req.session.userId,
        title,
        description,
        category,
        location,
        date_lost,
        image_url: image_url || null
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, itemId: data.id });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update item
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, description, category, location, date_lost, image_url } = req.body;

    // Check ownership or admin
    const { data: check, error: checkError } = await supabase
      .from('items')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (checkError || !check) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (check.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }

    const { error } = await supabase
      .from('items')
      .update({
        title,
        description,
        category,
        location,
        date_lost,
        image_url: image_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete item
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: check, error: checkError } = await supabase
      .from('items')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (checkError || !check) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (check.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    // Since we used ON DELETE CASCADE in Supabase schema for messages,
    // we only need to delete the item and messages will be auto-deleted.
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark item as found
router.put('/:id/found', requireAuth, async (req, res) => {
  try {
    const { data: check, error: checkError } = await supabase
      .from('items')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (checkError || !check) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (check.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster or admin can mark items as found' });
    }

    const { error } = await supabase
      .from('items')
      .update({
        status: 'found',
        found_by: req.session.userName,
        found_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Mark found error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bump item
router.put('/:id/bump', requireAuth, async (req, res) => {
  try {
    const { data: check, error: checkError } = await supabase
      .from('items')
      .select('user_id, created_at')
      .eq('id', req.params.id)
      .single();

    if (checkError || !check) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (check.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster can bump their item' });
    }

    const { error } = await supabase
      .from('items')
      .update({
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Bump item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
