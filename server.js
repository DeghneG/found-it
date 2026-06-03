const express = require('express');
const session = require('express-session');
const path = require('path');
const { supabase } = require('./database/supabase');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
  secret: 'usa-lost-and-found-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
});

app.use(sessionMiddleware);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.use('/api/claims', require('./routes/claims'));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For local development, listen on a port
// For Vercel (serverless), export the app
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🔍 USA Lost & Found System running at http://localhost:${PORT} (Powered by Supabase - Polling Mode)\n`);
  });
} else {
  module.exports = app;
}
