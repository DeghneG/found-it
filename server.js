const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { supabase } = require('./database/supabase');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

// Share session with Socket.IO
io.engine.use(sessionMiddleware);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/upload', require('./routes/upload'));

// Socket.IO for real-time chat
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const session = socket.request.session;
  if (session && session.userId) {
    onlineUsers.set(session.userId, socket.id);

    socket.on('send_message', async (data) => {
      try {
        const { receiver_id, item_id, content } = data;
        
        const { data: insertedMsg, error } = await supabase
          .from('messages')
          .insert([{
            sender_id: session.userId,
            receiver_id,
            item_id,
            content
          }])
          .select()
          .single();

        if (error) throw error;

        const message = {
          id: insertedMsg.id,
          sender_id: session.userId,
          sender_name: session.userName,
          receiver_id,
          item_id,
          content,
          created_at: insertedMsg.created_at
        };

        // Send to receiver if online
        const receiverSocket = onlineUsers.get(receiver_id);
        if (receiverSocket) {
          io.to(receiverSocket).emit('new_message', message);
        }

        // Confirm to sender
        socket.emit('message_sent', message);
      } catch (err) {
        console.error('Socket message error:', err);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(session.userId);
    });
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`\n🔍 USA Lost & Found System running at http://localhost:${PORT} (Powered by Supabase)\n`);
});
