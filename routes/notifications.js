const express = require('express');
const { supabase } = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { since } = req.query;
    const userId = req.session.userId;
    
    let newMessages = [];
    let foundItems = [];
    let watchlistMatches = [];
    let newClaims = [];
    
    if (since) {
      // Ensure since is not too old (max 7 days)
      let sinceDate = new Date(since);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (sinceDate < sevenDaysAgo) {
        sinceDate = sevenDaysAgo;
      }
      const sinceISO = sinceDate.toISOString();

      // Check for new messages
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          item_id,
          sender:sender_id (name)
        `)
        .eq('receiver_id', userId)
        .eq('is_read', false)
        .gt('created_at', sinceISO);
        
      if (!msgError && messages) {
        newMessages = messages;
      }
      
      // Check for items that were marked as found recently
      const { data: items, error: itemError } = await supabase
        .from('items')
        .select('id, title, updated_at, status')
        .eq('user_id', userId)
        .eq('status', 'found')
        .gt('updated_at', sinceISO);
        
      if (!itemError && items) {
        foundItems = items;
      }

      // Check watchlist matches
      try {
        const { data: watchlist } = await supabase
          .from('watchlist')
          .select('keyword, category')
          .eq('user_id', userId);

        if (watchlist && watchlist.length > 0) {
          const { data: recentItems } = await supabase
            .from('items')
            .select('id, title, description, category')
            .gt('created_at', sinceISO)
            .neq('user_id', userId);

          if (recentItems && recentItems.length > 0) {
            watchlist.forEach(w => {
              const kw = w.keyword.toLowerCase();
              recentItems.forEach(item => {
                const titleMatch = item.title.toLowerCase().includes(kw);
                const descMatch = item.description.toLowerCase().includes(kw);
                const catMatch = !w.category || item.category === w.category;
                if ((titleMatch || descMatch) && catMatch) {
                  watchlistMatches.push({ keyword: w.keyword, item_title: item.title, item_id: item.id });
                }
              });
            });
          }
        }
      } catch (e) { /* watchlist table may not exist yet */ }

      // Check for new claims on user's items
      try {
        const { data: claims } = await supabase
          .from('claims')
          .select(`
            id, item_id, status, created_at,
            claimer:claimer_id (name),
            items:item_id (title, user_id)
          `)
          .eq('status', 'pending')
          .gt('created_at', sinceISO);

        if (claims) {
          newClaims = claims.filter(c => c.items && c.items.user_id === userId);
        }
      } catch (e) { /* claims table may not exist yet */ }
    }
    
    res.json({ newMessages, foundItems, watchlistMatches, newClaims, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Notifications poll error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
