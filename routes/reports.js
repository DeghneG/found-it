const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Report a post
router.post('/', requireAuth, (req, res) => {
  const { target_id, target_type, reason } = req.body;
  if (!target_id || !target_type || !reason) return res.status(400).json({ error: 'All fields required' });
  db.reports.push({
    id: db.nextId('reports'), reporter_id: req.session.userId,
    type: target_type, target_id: parseInt(target_id),
    reason, status: 'pending', created_at: new Date().toISOString()
  });
  res.json({ success: true });
});

module.exports = router;
