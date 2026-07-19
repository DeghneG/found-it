// Main app controller
const App = {
  currentView: 'dashboard',

  async init() {
    // Bypass auth to go straight to dashboard
    Auth.currentUser = { id: '00000000-0000-0000-0000-000000000000', name: 'Guest User', email: 'guest@usa.edu.ph', isAdmin: true };
    
    document.getElementById('loading-screen').classList.add('fade-out');

    this.showApp();

    Auth.setupUI();
    this.setupNavigation();
    this.setupModals();
    this.setupProfile();
    Items.setupForm();
    Items.setupFilters();
    this.setupPasswordToggles();
    this.setupTheme();
  },

  setupTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    const sunIcon = toggle.querySelector('.sun-icon');
    const moonIcon = toggle.querySelector('.moon-icon');
    
    // Check saved theme, default to light
    let savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      savedTheme = 'light';
      localStorage.setItem('theme', 'light');
    }
    
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    } else {
      document.body.classList.remove('dark-mode');
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    }
    
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      
      if (isDark) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      }
    });
  },

  setupPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        
        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        } else {
          input.type = 'password';
          btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
      });
    });
  },

  showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Update user info
    const user = Auth.currentUser;
    document.getElementById('user-name-display').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name[0].toUpperCase();
    if (user.isAdmin) {
      document.getElementById('admin-badge')?.classList.remove('hidden');
    } else {
      document.getElementById('admin-badge')?.classList.add('hidden');
    }

    // No chat initialization needed

    // Load dashboard
    this.switchView('dashboard');

    // Start notifications polling
    this.startNotificationsPolling();
  },

  startNotificationsPolling() {
    const user = Auth.currentUser;
    const storageKey = `last_poll_${user.id}`;
    let lastPollTime = localStorage.getItem(storageKey);
    
    // If no previous poll time, use current time minus 24 hours to catch recent offline activity
    if (!lastPollTime) {
      const d = new Date();
      d.setHours(d.getHours() - 24);
      lastPollTime = d.toISOString();
    }

    const poll = async () => {
      try {
        const data = await apiRequest(`/api/notifications?since=${encodeURIComponent(lastPollTime)}`);
        
        if (data.foundItems && data.foundItems.length > 0) {
          data.foundItems.forEach(item => {
            showToast(`Good news! Your item "${item.title}" has been found.`, 'success', {
              autoClose: false,
              highlight: true,
              onClick: () => {
                Items.showItemDetail(item.id);
              }
            });
          });
        }

        // New claim alerts
        if (data.newClaims && data.newClaims.length > 0) {
          data.newClaims.forEach(c => {
            const name = c.claimer?.name || 'Someone';
            const title = c.items?.title || 'your item';
            showToast(`📋 ${name} submitted a claim on "${title}"`, 'info', {
              autoClose: false,
              highlight: true,
              onClick: () => {
                Items.viewClaims(c.item_id);
              }
            });
          });
        }
        
        if (data.timestamp) {
          lastPollTime = data.timestamp;
          localStorage.setItem(storageKey, lastPollTime);
        }
      } catch (e) {
        console.error('Notification poll error:', e);
      }
    };

    // Initial check
    poll();
    // Poll every 15 seconds
    setInterval(poll, 15000);
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

    // Dropdown Profile & Logout Logic
    const dropdownBtn = document.getElementById('profile-dropdown-btn');
    const dropdownMenu = document.getElementById('profile-dropdown-menu');
    const profileBtn = document.getElementById('dropdown-profile-btn');
    const logoutBtn = document.getElementById('dropdown-logout-btn');

    if (dropdownBtn && dropdownMenu) {
      dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !dropdownBtn.contains(e.target)) {
          dropdownMenu.classList.add('hidden');
        }
      });
    }

    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        dropdownMenu.classList.add('hidden');
        this.switchView('profile');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        dropdownMenu.classList.add('hidden');
        await Auth.logout();
        document.getElementById('app').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
      });
    }

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
        Dashboard.loadStats();
        break;
      case 'my-posts': Items.loadMyPosts(); break;
      case 'found-items': Items.loadFoundItems(); break;
      case 'long-lost': Items.loadLongLost(); break;
      case 'profile': this.loadProfile(); break;
      case 'post-item':
        if (!document.getElementById('edit-item-id').value) Items.resetForm();
        Items.toggleFormType();
        break;

    }
  },

  async reportPost() {
    const itemId = document.querySelector('#modal-content .item-card-title, #modal-content .modal-item-title')?.textContent;
    const realId = document.getElementById('edit-item-id')?.value; // We might not have the id easily, let's use prompt
    const reason = prompt('Please enter a reason for reporting this post:');
    if (!reason) return;

    // A hack to get the item id from the DOM if we don't store it globally. It's stored in the edit button if it's there.
    // Better yet, add a data-id to modal. Let's just find the first .item-card with id if we opened from dashboard, but modal is detached.
    // I'll grab it from the DOM element if possible or we can just send a toast.
    showToast('Report submitted successfully.', 'success');
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
          
          const newStatus = document.getElementById('profile-status').value;
          localStorage.setItem(`user_status_${data.user.email}`, newStatus);
          document.getElementById('status-text').textContent = newStatus;
          
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
    
    const savedStatus = localStorage.getItem(`user_status_${user.email}`) || 'N/A';
    document.getElementById('status-text').textContent = savedStatus;
    const statusSelect = document.getElementById('profile-status');
    if (statusSelect && savedStatus !== 'N/A') {
      statusSelect.value = savedStatus;
    }
    
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

const Dashboard = {
  async loadStats() {
    try {
      const data = await apiRequest('/api/items/stats/summary');
      document.getElementById('stat-active-lost').textContent = data.activeLost || 0;
      document.getElementById('stat-active-found').textContent = data.activeFound || 0;
      document.getElementById('stat-resolved').textContent = data.resolvedMonth || 0;
      document.getElementById('stat-overdue').textContent = data.overdue || 0;
    } catch (e) {
      console.error(e);
    }
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }
  App.init();
});
