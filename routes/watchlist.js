const express = require('express');
const { supabase } = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get user's watchlist
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', req.session.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ watchlist: data || [] });
  } catch (err) {
    console.error('Get watchlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add watchlist keyword
router.post('/', requireAuth, async (req, res) => {
  try {
    const { keyword, category } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const { data, error } = await supabase
      .from('watchlist')
      .insert([{
        user_id: req.session.userId,
        keyword: keyword.trim(),
        category: category || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, item: data });
  } catch (err) {
    console.error('Add watchlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete watchlist entry
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.session.userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete watchlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
