const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  try {
    res.json({ newMessages: [], foundItems: [], watchlistMatches: [], newClaims: [], timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Notifications poll error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
