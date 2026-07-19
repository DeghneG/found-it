const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    // Enforce @usa.edu.ph email
    if (!email.toLowerCase().endsWith('@usa.edu.ph')) {
      return res.status(400).json({ error: 'Please use your official @usa.edu.ph email address' });
    }

    const letterCount = (password.match(/[a-zA-Z]/g) || []).length;
    const numberCount = (password.match(/\d/g) || []).length;
    if (letterCount < 6 || numberCount < 1) {
      return res.status(400).json({ error: 'Password must contain at least 6 letters and at least 1 number' });
    }

    if (db.users.find(u => u.email === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: db.nextId('users'), name: name.trim(), email: email.toLowerCase(),
      password: hashed, is_admin: false, created_at: new Date().toISOString()
    };
    db.users.push(user);

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.isAdmin = false;

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: false } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = db.users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.isAdmin = !!user.is_admin;

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: !!user.is_admin } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

// Current user
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ user: { id: req.session.userId, name: req.session.userName, email: req.session.userEmail, isAdmin: req.session.isAdmin || false } });
  } else {
    res.json({ user: null });
  }
});

// Update profile
router.put('/profile', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'You must be logged in' });
  try {
    const { name, newPassword } = req.body;
    const user = db.users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name && name.trim()) { user.name = name.trim(); req.session.userName = name.trim(); }
    if (newPassword) {
      const lc = (newPassword.match(/[a-zA-Z]/g) || []).length;
      const nc = (newPassword.match(/\d/g) || []).length;
      if (lc < 6 || nc < 1) return res.status(400).json({ error: 'Password must contain at least 6 letters and at least 1 number' });
      user.password = bcrypt.hashSync(newPassword, 10);
    }
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: !!user.is_admin } });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Profile stats
router.get('/profile/stats', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'You must be logged in' });
  const uid = req.session.userId;
  const lostCount = db.items.filter(i => i.user_id === uid && i.status === 'lost').length;
  const foundCount = db.items.filter(i => i.user_id === uid && (i.status === 'found' || i.status === 'returned')).length;
  const msgCount = db.messages.filter(m => m.sender_id === uid || m.receiver_id === uid).length;
  const user = db.users.find(u => u.id === uid);
  res.json({ lostCount, foundCount, msgCount, joinedDate: user ? user.created_at : null });
});

module.exports = router;
