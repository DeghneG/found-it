const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ watchlist: db.watchlist.filter(w => w.user_id === req.session.userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
});

router.post('/', requireAuth, (req, res) => {
  const { keyword, category } = req.body;
  if (!keyword || !keyword.trim()) return res.status(400).json({ error: 'Keyword is required' });
  const item = { id: db.nextId('watchlist'), user_id: req.session.userId, keyword: keyword.trim(), category: category || null, created_at: new Date().toISOString() };
  db.watchlist.push(item);
  res.json({ success: true, item });
});

router.delete('/:id', requireAuth, (req, res) => {
  const idx = db.watchlist.findIndex(w => w.id == req.params.id && w.user_id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.watchlist.splice(idx, 1);
  res.json({ success: true });
});

module.exports = router;
