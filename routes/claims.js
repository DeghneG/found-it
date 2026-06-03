const express = require('express');
const { supabase } = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Submit a claim
router.post('/', requireAuth, async (req, res) => {
  try {
    const { item_id, proof_description } = req.body;
    if (!item_id || !proof_description || !proof_description.trim()) {
      return res.status(400).json({ error: 'Item ID and proof description are required' });
    }

    // Check item exists
    const { data: item, error: itemErr } = await supabase
      .from('items')
      .select('id, user_id')
      .eq('id', item_id)
      .single();

    if (itemErr || !item) return res.status(404).json({ error: 'Item not found' });
    if (item.user_id === req.session.userId) return res.status(400).json({ error: 'You cannot claim your own item' });

    // Prevent duplicate pending claims
    const { data: existing } = await supabase
      .from('claims')
      .select('id')
      .eq('item_id', item_id)
      .eq('claimer_id', req.session.userId)
      .eq('status', 'pending')
      .single();

    if (existing) return res.status(400).json({ error: 'You already have a pending claim on this item' });

    const { data, error } = await supabase
      .from('claims')
      .insert([{
        item_id,
        claimer_id: req.session.userId,
        proof_description: proof_description.trim()
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, claim: data });
  } catch (err) {
    console.error('Submit claim error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get claims for an item (poster/admin only)
router.get('/item/:itemId', requireAuth, async (req, res) => {
  try {
    // Verify ownership
    const { data: item } = await supabase
      .from('items')
      .select('user_id')
      .eq('id', req.params.itemId)
      .single();

    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster can view claims' });
    }

    const { data: claims, error } = await supabase
      .from('claims')
      .select(`
        *,
        claimer:claimer_id (name, email)
      `)
      .eq('item_id', req.params.itemId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ claims: claims || [] });
  } catch (err) {
    console.error('Get claims error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get count of pending claims for an item (public for badge display)
router.get('/count/:itemId', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', req.params.itemId)
      .eq('status', 'pending');

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve a claim
router.put('/:id/approve', requireAuth, async (req, res) => {
  try {
    const { data: claim, error: claimErr } = await supabase
      .from('claims')
      .select('*, items:item_id (user_id)')
      .eq('id', req.params.id)
      .single();

    if (claimErr || !claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.items.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster can approve claims' });
    }

    // Approve the claim
    await supabase.from('claims').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.params.id);

    // Reject all other pending claims for this item
    await supabase.from('claims').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('item_id', claim.item_id).eq('status', 'pending');

    // Mark item as returned
    await supabase.from('items').update({ status: 'returned', updated_at: new Date().toISOString() }).eq('id', claim.item_id);

    res.json({ success: true });
  } catch (err) {
    console.error('Approve claim error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject a claim
router.put('/:id/reject', requireAuth, async (req, res) => {
  try {
    const { data: claim, error: claimErr } = await supabase
      .from('claims')
      .select('*, items:item_id (user_id)')
      .eq('id', req.params.id)
      .single();

    if (claimErr || !claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.items.user_id !== req.session.userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Only the poster can reject claims' });
    }

    const { error } = await supabase
      .from('claims')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Reject claim error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
