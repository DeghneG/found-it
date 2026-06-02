// Main app controller
const App = {
  currentView: 'dashboard',

  async init() {
    // Check auth
    const isLoggedIn = await Auth.init();
    document.getElementById('loading-screen').classList.add('fade-out');

    if (isLoggedIn) {
      this.showApp();
    } else {
      document.getElementById('auth-screen').classList.remove('hidden');
    }

    Auth.setupUI();
    this.setupNavigation();
    this.setupModals();
    this.setupProfile();
    Items.setupForm();
    Items.setupFilters();
    Calendar.init();
  },

  showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Update user info
    const user = Auth.currentUser;
    document.getElementById('user-name-display').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name[0].toUpperCase();
    if (user.isAdmin) {
      document.getElementById('admin-badge').classList.remove('hidden');
    }

    // Initialize chat
    Chat.init();

    // Load dashboard
    this.switchView('dashboard');

    // Poll unread messages
    setInterval(() => Chat.updateUnreadBadge(), 30000);
  },

  setupNavigation() {
    // Nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) this.switchView(view);
      });
    });

    // Dashboard post button
    document.getElementById('dashboard-post-btn').addEventListener('click', () => this.switchView('post-item'));
    document.getElementById('nav-brand').addEventListener('click', () => this.switchView('dashboard'));

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await Auth.logout();
      document.getElementById('app').classList.add('hidden');
      document.getElementById('auth-screen').classList.remove('hidden');
    });

    // Profile button (clickable user area)
    document.getElementById('user-profile-btn').addEventListener('click', () => {
      this.switchView('profile');
    });

    // Mobile nav
    const toggle = document.getElementById('mobile-nav-toggle');
    const nav = document.getElementById('main-nav');
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove('open');
      }
    });
  },

  switchView(viewName) {
    this.currentView = viewName;
    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === viewName));
    // Switch views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`view-${viewName}`);
    if (viewEl) viewEl.classList.add('active');

    // Close mobile nav
    document.getElementById('main-nav').classList.remove('open');

    // Load data
    switch (viewName) {
      case 'dashboard':
        Items.loadDashboard();
        Calendar.render();
        Calendar.loadStats();
        break;
      case 'my-posts': Items.loadMyPosts(); break;
      case 'found-items': Items.loadFoundItems(); break;
      case 'long-lost': Items.loadLongLost(); break;
      case 'chat': Chat.loadConversations(); break;
      case 'profile': this.loadProfile(); break;
      case 'post-item':
        if (!document.getElementById('edit-item-id').value) Items.resetForm();
        break;
    }
  },

  refreshCurrentView() {
    this.switchView(this.currentView);
  },

  setupModals() {
    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('item-modal').classList.add('hidden');
    });
    document.getElementById('modal-overlay').addEventListener('click', () => {
      document.getElementById('item-modal').classList.add('hidden');
    });
  },

  setupProfile() {
    const form = document.getElementById('profile-form');
    const profileError = document.getElementById('profile-error');
    const profileSuccess = document.getElementById('profile-success');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      profileError.classList.add('hidden');
      profileSuccess.classList.add('hidden');

      const name = document.getElementById('profile-name').value.trim();
      const newPassword = document.getElementById('profile-new-password').value;

      if (!name) {
        profileError.textContent = 'Name is required';
        profileError.classList.remove('hidden');
        return;
      }

      try {
        const data = await apiRequest('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name, newPassword: newPassword || undefined })
        });

        if (data.success) {
          Auth.currentUser = data.user;
          document.getElementById('user-name-display').textContent = data.user.name;
          document.getElementById('user-avatar').textContent = data.user.name[0].toUpperCase();
          document.getElementById('profile-display-name').textContent = data.user.name;
          document.getElementById('profile-avatar-large').textContent = data.user.name[0].toUpperCase();
          document.getElementById('profile-new-password').value = '';
          profileSuccess.textContent = 'Profile updated successfully!';
          profileSuccess.classList.remove('hidden');
          showToast('Profile updated!', 'success');
        }
      } catch (err) {
        profileError.textContent = err.message;
        profileError.classList.remove('hidden');
      }
    });

    document.getElementById('profile-cancel').addEventListener('click', () => {
      this.switchView('dashboard');
    });
  },

  async loadProfile() {
    const user = Auth.currentUser;
    document.getElementById('profile-display-name').textContent = user.name;
    document.getElementById('profile-display-email').textContent = user.email;
    document.getElementById('profile-avatar-large').textContent = user.name[0].toUpperCase();
    document.getElementById('profile-name').value = user.name;
    document.getElementById('profile-email').value = user.email;
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-error').classList.add('hidden');
    document.getElementById('profile-success').classList.add('hidden');

    if (user.isAdmin) {
      document.getElementById('profile-admin-tag').classList.remove('hidden');
    } else {
      document.getElementById('profile-admin-tag').classList.add('hidden');
    }

    // Load stats
    try {
      const data = await apiRequest('/api/auth/profile/stats');
      document.getElementById('profile-lost-count').textContent = data.lostCount;
      document.getElementById('profile-found-count').textContent = data.foundCount;
      document.getElementById('profile-msg-count').textContent = data.msgCount;
      document.getElementById('profile-joined-date').textContent = 'Joined: ' + (data.joinedDate ? formatDate(data.joinedDate) : 'N/A');
    } catch (e) {}
  }
};

// Calendar widget
const Calendar = {
  currentDate: new Date(),

  init() {
    document.getElementById('cal-prev').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });
  },

  render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('cal-month-year').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();

    let html = '';

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month">${daysInPrevMonth - i}</div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      html += `<div class="cal-day${isToday ? ' today' : ''}">${d}</div>`;
    }

    // Next month days to fill grid
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-day other-month">${i}</div>`;
    }

    document.getElementById('cal-days').innerHTML = html;
  },

  async loadStats() {
    try {
      const [lostData, foundData, longData] = await Promise.all([
        apiRequest('/api/items?status=lost'),
        apiRequest('/api/items?status=found'),
        apiRequest('/api/items?longLost=true')
      ]);
      document.getElementById('cal-stat-lost').textContent = lostData.items ? lostData.items.length : 0;
      document.getElementById('cal-stat-found').textContent = foundData.items ? foundData.items.length : 0;
      document.getElementById('cal-stat-overdue').textContent = longData.items ? longData.items.length : 0;
    } catch (e) {}
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
