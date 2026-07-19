const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  try {
    const { since } = req.query;
    const uid = req.session.userId;
    let newMessages = [], foundItems = [], watchlistMatches = [], newClaims = [];

    if (since) {
      let sinceDate = new Date(since);
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (sinceDate < sevenDaysAgo) sinceDate = sevenDaysAgo;
      const sinceISO = sinceDate.toISOString();

      // New messages (including system notifications)
      newMessages = db.messages.filter(m => m.receiver_id === uid && !m.is_read && m.created_at > sinceISO).map(m => {
        const sender = db.users.find(u => u.id === m.sender_id);
        return { ...m, sender: sender ? { name: sender.name } : { name: 'System' } };
      });

      // Items marked as found
      foundItems = db.items.filter(i => i.user_id === uid && i.status === 'found' && i.updated_at > sinceISO);

      // Watchlist matches
      const userWatchlist = db.watchlist.filter(w => w.user_id === uid);
      if (userWatchlist.length > 0) {
        const recentItems = db.items.filter(i => i.created_at > sinceISO && i.user_id !== uid);
        userWatchlist.forEach(w => {
          const kw = w.keyword.toLowerCase();
          recentItems.forEach(item => {
            const match = item.title.toLowerCase().includes(kw) || item.description.toLowerCase().includes(kw);
            const catMatch = !w.category || item.category === w.category;
            if (match && catMatch) watchlistMatches.push({ keyword: w.keyword, item_title: item.title, item_id: item.id });
          });
        });
      }

      // New claims on user's items
      newClaims = db.claims.filter(c => c.status === 'pending' && c.created_at > sinceISO).filter(c => {
        const item = db.items.find(i => i.id === c.item_id);
        return item && item.user_id === uid;
      }).map(c => {
        const claimer = db.users.find(u => u.id === c.claimer_id);
        const item = db.items.find(i => i.id === c.item_id);
        return { ...c, claimer: claimer ? { name: claimer.name } : null, items: item ? { title: item.title, user_id: item.user_id } : null };
      });
    }
    res.json({ newMessages, foundItems, watchlistMatches, newClaims, timestamp: new Date().toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
