const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../database/supabase');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, is_admin: false }])
      .select()
      .single();

    if (error) throw error;

    const userId = data.id;

    req.session.userId = userId;
    req.session.userName = name;
    req.session.userEmail = email;
    req.session.isAdmin = false;

    res.json({ success: true, user: { id: userId, name, email, isAdmin: false } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password, is_admin')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

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
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      user: {
        id: req.session.userId,
        name: req.session.userName,
        email: req.session.userEmail,
        isAdmin: req.session.isAdmin || false
      }
    });
  } else {
    res.json({ user: null });
  }
});

// Update profile
router.put('/profile', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in' });
  }

  try {
    const { name, newPassword } = req.body;
    const updates = {};

    if (name && name.trim()) {
      updates.name = name.trim();
      req.session.userName = name.trim();
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updates.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', req.session.userId);
        
      if (error) throw error;
    }

    res.json({ success: true, user: { id: req.session.userId, name: req.session.userName, email: req.session.userEmail, isAdmin: req.session.isAdmin } });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get profile stats
router.get('/profile/stats', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in' });
  }

  try {
    const userId = req.session.userId;

    const { count: lostCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'lost');

    const { count: foundCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'found');

    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    const { data: user } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single();

    res.json({
      lostCount: lostCount || 0,
      foundCount: foundCount || 0,
      msgCount: msgCount || 0,
      joinedDate: user ? user.created_at : null
    });
  } catch (err) {
    console.error('Profile stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
