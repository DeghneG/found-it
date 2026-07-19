const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Create claim (Mark Interest)
router.post('/', requireAuth, (req, res) => {
  try {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: 'Item ID required' });
    const item = db.items.find(i => i.id == item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.user_id === req.session.userId) return res.status(400).json({ error: 'Cannot claim your own item' });
    // Check if already claimed
    if (db.claims.some(c => c.item_id == item_id && c.claimant_id === req.session.userId && c.status !== 'rejected')) {
      return res.status(400).json({ error: 'You have already marked interest for this item' });
    }
    const claim = {
      id: db.nextId('claims'), item_id: parseInt(item_id), claimant_id: req.session.userId,
      claimant_name: req.session.userName, claimant_email: req.session.userEmail,
      status: 'pending', created_at: new Date().toISOString()
    };
    db.claims.push(claim);
    res.json({ success: true, claimId: claim.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/item/:itemId', requireAuth, (req, res) => {
  try {
    const item = db.items.find(i => i.id == req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'Only the poster can view claims' });
    const claims = db.claims.filter(c => c.item_id == req.params.itemId).map(c => {
      const claimer = db.users.find(u => u.id === c.claimer_id);
      return { ...c, claimer: claimer ? { name: claimer.name, email: claimer.email } : null };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ claims });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/count/:itemId', (req, res) => {
  const count = db.claims.filter(c => c.item_id == req.params.itemId && c.status === 'pending').length;
  res.json({ count });
});

router.put('/:id/approve', requireAuth, (req, res) => {
  try {
    const claim = db.claims.find(c => c.id == req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    const item = db.items.find(i => i.id === claim.item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
    claim.status = 'approved'; claim.reviewed_by = req.session.userId; claim.reviewed_at = new Date().toISOString();
    // Reject other pending claims
    db.claims.filter(c => c.item_id === claim.item_id && c.status === 'pending').forEach(c => { c.status = 'rejected'; c.reviewed_by = req.session.userId; c.reviewed_at = new Date().toISOString(); });
    item.status = 'returned'; item.updated_at = new Date().toISOString();
    // Audit
    db.claimAudit.push({ id: db.nextId('audit'), claim_id: claim.id, action: 'approved', actor_id: req.session.userId, timestamp: new Date().toISOString(), notes: `Approved by ${req.session.userName}` });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id/reject', requireAuth, (req, res) => {
  try {
    const claim = db.claims.find(c => c.id == req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    const item = db.items.find(i => i.id === claim.item_id);
    if (item.user_id !== req.session.userId && !req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
    claim.status = 'rejected'; claim.reviewed_by = req.session.userId; claim.reviewed_at = new Date().toISOString();
    db.claimAudit.push({ id: db.nextId('audit'), claim_id: claim.id, action: 'rejected', actor_id: req.session.userId, timestamp: new Date().toISOString(), notes: `Rejected by ${req.session.userName}` });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
