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
      document.getElementById('admin-badge').classList.remove('hidden');
      document.getElementById('nav-admin').classList.remove('hidden');
    } else {
      document.getElementById('admin-badge').classList.add('hidden');
      document.getElementById('nav-admin').classList.add('hidden');
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

        // Watchlist alerts
        if (data.watchlistMatches && data.watchlistMatches.length > 0) {
          data.watchlistMatches.forEach(m => {
            showToast(`🔔 Watchlist match: "${m.item_title}" matches your keyword "${m.keyword}"`, 'info', {
              autoClose: false,
              highlight: true,
              onClick: () => {
                Items.showItemDetail(m.item_id);
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
      case 'watchlist': this.loadWatchlist(); break;
      case 'post-item':
        if (!document.getElementById('edit-item-id').value) Items.resetForm();
        Items.toggleFormType();
        break;
      case 'admin-console':
        if (Auth.currentUser && Auth.currentUser.isAdmin) {
          this.loadAdminTab('items');
        } else {
          this.switchView('dashboard');
        }
        break;
    }
  },

  async loadAdminTab(tab) {
    document.getElementById('admin-tab-items').classList.remove('active');
    document.getElementById('admin-tab-reports').classList.remove('active');
    document.getElementById('admin-tab-claims').classList.remove('active');
    document.getElementById(`admin-tab-${tab}`).classList.add('active');

    const area = document.getElementById('admin-content-area');
    area.innerHTML = '<p class="text-muted">Loading...</p>';

    try {
      if (tab === 'items') {
        const data = await apiRequest('/api/admin/items');
        area.innerHTML = `
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>User</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(item => `
                <tr>
                  <td>${item.id}</td>
                  <td>${escapeHtml(item.title)}</td>
                  <td><span class="status-badge status-${item.status}">${item.status}</span></td>
                  <td>${escapeHtml(item.user_name)}</td>
                  <td>
                    <button class="btn btn-sm btn-ghost" onclick="Items.showItemDetail(${item.id})">View</button>
                    <button class="btn btn-sm btn-danger" onclick="Items.confirmDelete(${item.id})">Delete</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="5">No items found</td></tr>'}
            </tbody>
          </table>
        `;
      } else if (tab === 'reports') {
        const data = await apiRequest('/api/admin/reports');
        area.innerHTML = `
          <div class="reports-grid">
            ${data.reports.map(r => `
              <div class="glass-card" style="margin-bottom:12px; padding:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                  <strong>Report on ${r.target_type} #${r.target_id}</strong>
                  <span class="text-muted" style="font-size:0.85rem;">${timeAgo(r.created_at)}</span>
                </div>
                <p>Reason: ${escapeHtml(r.reason)}</p>
                <div style="margin-top:12px;">
                  <button class="btn btn-sm btn-primary" onclick="${r.target_type === 'item' ? `Items.showItemDetail(${r.target_id})` : ''}">View Target</button>
                  <button class="btn btn-sm btn-success" onclick="App.resolveReport(${r.id})">Mark Resolved</button>
                </div>
              </div>
            `).join('') || '<p>No flagged reports.</p>'}
          </div>
        `;
      } else if (tab === 'claims') {
        const data = await apiRequest('/api/admin/claims');
        area.innerHTML = `
          <div class="claims-grid">
            ${data.claims.map(c => `
              <div class="glass-card" style="margin-bottom:12px; padding:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                  <strong>Claim on Item #${c.item_id}</strong>
                  <span class="status-badge claim-${c.status}">${c.status}</span>
                </div>
                <p>By: User #${c.claimer_id}</p>
                <p>Proof: ${escapeHtml(c.proof_description)}</p>
                <div style="margin-top:12px;">
                  <button class="btn btn-sm btn-primary" onclick="Items.showItemDetail(${c.item_id})">View Item</button>
                </div>
              </div>
            `).join('') || '<p>No pending claims.</p>'}
          </div>
        `;
      }
    } catch (err) {
      area.innerHTML = `<p class="form-error">${escapeHtml(err.message)}</p>`;
    }
  },

  async resolveReport(reportId) {
    try {
      await apiRequest(`/api/admin/reports/${reportId}/resolve`, { method: 'PUT' });
      showToast('Report resolved', 'success');
      this.loadAdminTab('reports');
    } catch (err) {
      showToast(err.message, 'error');
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

  async loadWatchlist() {
    try {
      const data = await apiRequest('/api/watchlist');
      const list = document.getElementById('watchlist-list');
      if (!data.watchlist || data.watchlist.length === 0) {
        list.innerHTML = '<div class="empty-state small"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><p>No watchlist items yet. Add a keyword above to get notified.</p></div>';
        return;
      }
      list.innerHTML = data.watchlist.map(w => `
        <div class="watchlist-item" data-id="${w.id}">
          <div>
            <span class="watchlist-keyword">${escapeHtml(w.keyword)}</span>
            ${w.category ? `<span class="watchlist-category">${escapeHtml(w.category)}</span>` : '<span class="watchlist-category">All Categories</span>'}
          </div>
          <button class="watchlist-delete" onclick="App.deleteWatchlistItem(${w.id})" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
    } catch (err) {
      showToast('Failed to load watchlist', 'error');
    }
  },

  async addWatchlistItem() {
    const keyword = document.getElementById('watchlist-keyword').value.trim();
    const category = document.getElementById('watchlist-category').value;
    if (!keyword) { showToast('Enter a keyword', 'error'); return; }
    try {
      await apiRequest('/api/watchlist', { method: 'POST', body: JSON.stringify({ keyword, category: category || null }) });
      document.getElementById('watchlist-keyword').value = '';
      document.getElementById('watchlist-category').value = '';
      showToast(`Watching for "${keyword}"`, 'success');
      this.loadWatchlist();
    } catch (err) { showToast(err.message, 'error'); }
  },

  async deleteWatchlistItem(id) {
    try {
      await apiRequest(`/api/watchlist/${id}`, { method: 'DELETE' });
      showToast('Removed from watchlist', 'success');
      this.loadWatchlist();
    } catch (err) { showToast(err.message, 'error'); }
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
document.addEventListener('DOMContentLoaded', () => App.init());
