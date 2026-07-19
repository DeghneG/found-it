const express = require('express');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// System stats
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
  res.json({
    totalUsers: db.users.length,
    totalItems: db.items.length,
    activeLost: db.items.filter(i => i.type === 'lost' && i.status === 'lost').length,
    activeFound: db.items.filter(i => i.type === 'found' && i.status === 'found').length,
    returned: db.items.filter(i => i.status === 'returned').length,
    pendingClaims: db.claims.filter(c => c.status === 'pending').length,
    pendingReports: db.reports.filter(r => r.status === 'pending').length,
    totalMessages: db.messages.filter(m => !m.is_system).length
  });
});

// All items (admin view)
router.get('/items', requireAuth, requireAdmin, (req, res) => {
  const items = db.items.map(i => ({ ...i })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ items });
});

// Remove item (admin)
router.put('/items/:id/remove', requireAuth, requireAdmin, (req, res) => {
  const idx = db.items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  db.items[idx].status = 'archived';
  db.items[idx].updated_at = new Date().toISOString();
  res.json({ success: true });
});

// All claims (admin)
router.get('/claims', requireAuth, requireAdmin, (req, res) => {
  const claims = db.claims.map(c => {
    const claimer = db.users.find(u => u.id === c.claimer_id);
    const item = db.items.find(i => i.id === c.item_id);
    return { ...c, claimer: claimer ? { name: claimer.name, email: claimer.email } : null, item: item ? { title: item.title } : null };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ claims });
});

// All reports (admin)
router.get('/reports', requireAuth, requireAdmin, (req, res) => {
  const reports = db.reports.map(r => {
    const reporter = db.users.find(u => u.id === r.reporter_id);
    return { ...r, reporter: reporter ? { name: reporter.name } : null };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ reports });
});

// Resolve report
router.put('/reports/:id/resolve', requireAuth, requireAdmin, (req, res) => {
  const report = db.reports.find(r => r.id == req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  report.status = 'resolved';
  report.resolved_by = req.session.userId;
  report.resolved_at = new Date().toISOString();
  res.json({ success: true });
});

// All users (admin)
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.users.map(u => ({ id: u.id, name: u.name, email: u.email, is_admin: u.is_admin, created_at: u.created_at }));
  res.json({ users });
});

module.exports = router;
