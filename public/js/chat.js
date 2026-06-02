// Chat module
const Chat = {
  socket: null,
  currentChat: null,

  init() {
    this.socket = io();
    this.socket.on('new_message', (msg) => {
      if (this.currentChat && msg.item_id == this.currentChat.itemId && msg.sender_id == this.currentChat.otherUserId) {
        this.appendMessage(msg, false);
        this.markRead();
      }
      this.updateUnreadBadge();
      this.loadConversations();
    });
    this.socket.on('message_sent', (msg) => {
      this.appendMessage(msg, true);
    });
    this.updateUnreadBadge();

    // Chat input
    document.getElementById('chat-send-btn').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMessage(); });
    document.getElementById('chat-back-btn').addEventListener('click', () => {
      document.getElementById('chat-active').classList.add('hidden');
      document.querySelector('.chat-placeholder').classList.remove('hidden');
    });
  },

  async loadConversations() {
    try {
      const data = await apiRequest('/api/chat/conversations');
      const list = document.getElementById('conversations-list');
      if (!data.conversations || data.conversations.length === 0) {
        list.innerHTML = '<div class="empty-state small"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>No conversations yet</p></div>';
        return;
      }
      list.innerHTML = data.conversations.map(c => `
        <div class="conversation-item ${this.currentChat && this.currentChat.otherUserId == c.other_user_id && this.currentChat.itemId == c.item_id ? 'active' : ''}"
             data-user-id="${c.other_user_id}" data-item-id="${c.item_id}" data-user-name="${escapeHtml(c.other_user_name)}" data-item-title="${escapeHtml(c.item_title)}">
          <div class="conv-avatar">${(c.other_user_name || '?')[0].toUpperCase()}</div>
          <div class="conv-info">
            <div class="conv-name">${escapeHtml(c.other_user_name)}</div>
            <div class="conv-preview">${escapeHtml(c.item_title)} · ${escapeHtml(c.last_message || '')}</div>
          </div>
          <div class="conv-meta">
            <span class="conv-time">${timeAgo(c.last_message_time)}</span>
            ${c.unread_count > 0 ? `<span class="conv-unread">${c.unread_count}</span>` : ''}
          </div>
        </div>`).join('');

      list.querySelectorAll('.conversation-item').forEach(el => {
        el.addEventListener('click', () => {
          this.openChat(parseInt(el.dataset.itemId), parseInt(el.dataset.userId), el.dataset.userName, el.dataset.itemTitle);
        });
      });
    } catch (err) {
      console.error('Load conversations error:', err);
    }
  },

  startChat(itemId, userId, userName, itemTitle) {
    document.getElementById('item-modal').classList.add('hidden');
    App.switchView('chat');
    this.openChat(itemId, userId, userName, itemTitle);
  },

  async openChat(itemId, otherUserId, otherUserName, itemTitle) {
    this.currentChat = { itemId, otherUserId, otherUserName, itemTitle };
    document.getElementById('chat-partner-name').textContent = otherUserName;
    document.getElementById('chat-item-title').textContent = 'About: ' + itemTitle;
    document.querySelector('.chat-placeholder').classList.add('hidden');
    document.getElementById('chat-active').classList.remove('hidden');
    document.getElementById('chat-messages').innerHTML = '';

    // Highlight active conversation
    document.querySelectorAll('.conversation-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.userId) === otherUserId && parseInt(el.dataset.itemId) === itemId);
    });

    try {
      const data = await apiRequest(`/api/chat/messages/${itemId}/${otherUserId}`);
      const container = document.getElementById('chat-messages');
      if (data.messages) {
        data.messages.forEach(msg => {
          const isSent = msg.sender_id === Auth.currentUser.id;
          this.appendMessage(msg, isSent);
        });
      }
      this.updateUnreadBadge();
    } catch (err) {
      showToast('Failed to load messages', 'error');
    }
  },

  appendMessage(msg, isSent) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
    div.innerHTML = `${escapeHtml(msg.content)}<span class="message-time">${timeAgo(msg.created_at)}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !this.currentChat) return;

    this.socket.emit('send_message', {
      receiver_id: this.currentChat.otherUserId,
      item_id: this.currentChat.itemId,
      content
    });
    input.value = '';
  },

  async markRead() {
    if (!this.currentChat) return;
    try {
      await apiRequest(`/api/chat/messages/${this.currentChat.itemId}/${this.currentChat.otherUserId}`);
    } catch (e) {}
  },

  async updateUnreadBadge() {
    try {
      const data = await apiRequest('/api/chat/unread-count');
      const badge = document.getElementById('unread-badge');
      if (data.count > 0) {
        badge.textContent = data.count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch (e) {}
  }
};
