// Items module
const Items = {
  currentFilter: 'all',
  searchQuery: '',

  async loadItems(gridId, params = {}) {
    const grid = document.getElementById(gridId);
    try {
      const query = new URLSearchParams(params).toString();
      const data = await apiRequest(`/api/items?${query}`);
      this.renderGrid(grid, data.items, params);
    } catch (err) {
      grid.innerHTML = '<div class="empty-state"><h3>Error loading items</h3><p>' + escapeHtml(err.message) + '</p></div>';
    }
  },

  renderGrid(grid, items, params = {}) {
    if (!items || items.length === 0) {
      const isFound = params.status === 'found';
      const isLongLost = params.longLost === 'true';
      grid.innerHTML = `<div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          ${isFound ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'}
        </svg>
        <h3>${isFound ? 'No items found yet' : isLongLost ? 'No long-lost items' : 'No items to show'}</h3>
        <p>${isFound ? 'Recovered items will appear here' : isLongLost ? 'All items are less than 2 weeks old' : 'Try adjusting your search or filters'}</p>
      </div>`;
      return;
    }

    grid.innerHTML = items.map(item => this.renderCard(item)).join('');
    grid.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.item-actions')) return;
        this.showItemDetail(parseInt(card.dataset.id));
      });
    });
  },

  renderCard(item) {
    const days = daysAgo(item.created_at);
    const isLongLost = item.status === 'lost' && days >= 14;
    const isOwner = Auth.currentUser && Auth.currentUser.id === item.user_id;
    const isAdmin = Auth.currentUser && Auth.currentUser.isAdmin;

    return `
      <div class="item-card" data-id="${item.id}">
        ${isLongLost ? '<div class="long-lost-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${days}d</div>' : ''}
        ${item.image_url
          ? `<img class="item-card-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">`
          : `<div class="item-card-image-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
        }
        <div class="item-card-body">
          <div class="item-card-header">
            <span class="item-card-title">${escapeHtml(item.title)}</span>
            <span class="item-card-category ${getCategoryClass(item.category)}">${escapeHtml(item.category)}</span>
          </div>
          <p class="item-card-desc">${escapeHtml(item.description)}</p>
          <div class="item-card-meta">
            <span class="item-meta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(item.location)}</span>
            <span class="item-meta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Lost on ${formatDate(item.date_lost)}</span>
          </div>
        </div>
        <div class="item-card-footer">
          <span class="item-poster">by <strong>${escapeHtml(item.user_name)}</strong> · ${timeAgo(item.created_at)}</span>
          <div class="item-actions">
            <span class="status-badge status-${item.status}">${item.status}</span>
          </div>
        </div>
      </div>`;
  },

  async showItemDetail(itemId) {
    try {
      const data = await apiRequest(`/api/items/${itemId}`);
      const item = data.item;
      const isOwner = Auth.currentUser && Auth.currentUser.id === item.user_id;
      const isAdmin = Auth.currentUser && Auth.currentUser.isAdmin;
      const days = daysAgo(item.created_at);

      const modal = document.getElementById('item-modal');
      const body = document.getElementById('modal-body');

      body.innerHTML = `
        ${item.image_url ? `<img class="modal-item-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}">` : ''}
        <h2 class="modal-item-title">${escapeHtml(item.title)}</h2>
        <span class="status-badge status-${item.status} modal-item-status">${item.status === 'found' ? '✓ Found' : '○ Lost'}</span>
        ${item.status === 'lost' && days >= 14 ? `<span class="long-lost-badge" style="position:static;display:inline-flex;margin-left:8px">⚠ ${days} days</span>` : ''}
        <p class="modal-item-desc">${escapeHtml(item.description)}</p>
        <div class="modal-item-details">
          <div class="detail-item"><div class="detail-label">Category</div><div class="detail-value">${escapeHtml(item.category)}</div></div>
          <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value">${escapeHtml(item.location)}</div></div>
          <div class="detail-item"><div class="detail-label">Date Lost</div><div class="detail-value">${formatDate(item.date_lost)}</div></div>
          <div class="detail-item"><div class="detail-label">Posted by</div><div class="detail-value">${escapeHtml(item.user_name)}</div></div>
          ${item.status === 'found' ? `<div class="detail-item"><div class="detail-label">Found by</div><div class="detail-value">${escapeHtml(item.found_by || 'N/A')}</div></div>
          <div class="detail-item"><div class="detail-label">Found date</div><div class="detail-value">${formatDate(item.found_date)}</div></div>` : ''}
        </div>
        <div class="modal-item-actions">
          ${item.status === 'lost' && !isOwner && Auth.currentUser ? `<button class="btn btn-primary" onclick="Chat.startChat(${item.id}, ${item.user_id}, '${escapeHtml(item.user_name)}', '${escapeHtml(item.title)}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Message Poster</button>` : ''}
          ${item.status === 'lost' && (isOwner || isAdmin) ? `<button class="btn btn-success" onclick="Items.markFound(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Mark as Found</button>` : ''}
          ${isOwner || isAdmin ? `<button class="btn btn-ghost" onclick="Items.editItem(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button>` : ''}
          ${isOwner || isAdmin ? `<button class="btn btn-danger" onclick="Items.confirmDelete(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Delete</button>` : ''}
        </div>`;

      modal.classList.remove('hidden');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async markFound(itemId) {
    try {
      await apiRequest(`/api/items/${itemId}/found`, { method: 'PUT' });
      showToast('Item marked as found!', 'success');
      document.getElementById('item-modal').classList.add('hidden');
      App.refreshCurrentView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async editItem(itemId) {
    try {
      const data = await apiRequest(`/api/items/${itemId}`);
      const item = data.item;
      document.getElementById('item-modal').classList.add('hidden');
      document.getElementById('edit-item-id').value = item.id;
      document.getElementById('item-title').value = item.title;
      document.getElementById('item-description').value = item.description;
      document.getElementById('item-category').value = item.category;
      document.getElementById('item-location').value = item.location;
      document.getElementById('item-date').value = item.date_lost;
      document.getElementById('item-image-url').value = item.image_url || '';
      document.getElementById('post-form-title').textContent = 'Edit Item';
      document.getElementById('submit-post').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Save Changes';

      if (item.image_url) {
        document.getElementById('preview-img').src = item.image_url;
        document.getElementById('image-preview').classList.remove('hidden');
        document.getElementById('upload-area').classList.add('hidden');
      }

      App.switchView('post-item');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  confirmDelete(itemId) {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    document.getElementById('confirm-delete').onclick = async () => {
      try {
        await apiRequest(`/api/items/${itemId}`, { method: 'DELETE' });
        showToast('Post deleted', 'success');
        modal.classList.add('hidden');
        document.getElementById('item-modal').classList.add('hidden');
        App.refreshCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
    document.getElementById('confirm-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('confirm-overlay').onclick = () => modal.classList.add('hidden');
  },

  setupForm() {
    const form = document.getElementById('item-form');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('item-image');
    const previewContainer = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeBtn = document.getElementById('remove-image');
    const formError = document.getElementById('form-error');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFileSelect(e.dataTransfer.files[0]); }
    });
    fileInput.addEventListener('change', () => { if (fileInput.files.length) handleFileSelect(fileInput.files[0]); });

    async function handleFileSelect(file) {
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.imageUrl) {
          document.getElementById('item-image-url').value = data.imageUrl;
          previewImg.src = data.imageUrl;
          previewContainer.classList.remove('hidden');
          uploadArea.classList.add('hidden');
        }
      } catch (err) {
        showToast('Failed to upload image', 'error');
      }
    }

    removeBtn.addEventListener('click', () => {
      document.getElementById('item-image-url').value = '';
      previewContainer.classList.add('hidden');
      uploadArea.classList.remove('hidden');
      fileInput.value = '';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError.classList.add('hidden');
      const itemId = document.getElementById('edit-item-id').value;
      const payload = {
        title: document.getElementById('item-title').value.trim(),
        description: document.getElementById('item-description').value.trim(),
        category: document.getElementById('item-category').value,
        location: document.getElementById('item-location').value.trim(),
        date_lost: document.getElementById('item-date').value,
        image_url: document.getElementById('item-image-url').value || null
      };

      if (!payload.title || !payload.description || !payload.category || !payload.location || !payload.date_lost) {
        formError.textContent = 'Please fill in all required fields';
        formError.classList.remove('hidden');
        return;
      }

      try {
        if (itemId) {
          await apiRequest(`/api/items/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) });
          showToast('Item updated!', 'success');
        } else {
          await apiRequest('/api/items', { method: 'POST', body: JSON.stringify(payload) });
          showToast('Item posted!', 'success');
        }
        Items.resetForm();
        App.switchView('dashboard');
      } catch (err) {
        formError.textContent = err.message;
        formError.classList.remove('hidden');
      }
    });

    document.getElementById('cancel-post').addEventListener('click', () => {
      Items.resetForm();
      App.switchView('dashboard');
    });
  },

  resetForm() {
    document.getElementById('item-form').reset();
    document.getElementById('edit-item-id').value = '';
    document.getElementById('item-image-url').value = '';
    document.getElementById('image-preview').classList.add('hidden');
    document.getElementById('upload-area').classList.remove('hidden');
    document.getElementById('form-error').classList.add('hidden');
    document.getElementById('post-form-title').textContent = 'Report a Lost Item';
    document.getElementById('submit-post').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Post Item';
  },

  setupFilters() {
    const searchInput = document.getElementById('search-input');
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.searchQuery = searchInput.value.trim();
        this.loadDashboard();
      }, 300);
    });

    document.getElementById('category-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.currentFilter = btn.dataset.category;
      this.loadDashboard();
    });
  },

  async loadDashboard() {
    const params = { status: 'lost' };
    if (this.currentFilter !== 'all') params.category = this.currentFilter;
    if (this.searchQuery) params.search = this.searchQuery;
    await this.loadItems('items-grid', params);
  },

  async loadMyPosts() {
    try {
      const data = await apiRequest('/api/items/user/my-items');
      const grid = document.getElementById('my-posts-grid');
      this.renderGrid(grid, data.items);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async loadFoundItems() {
    await this.loadItems('found-items-grid', { status: 'found' });
  },

  async loadLongLost() {
    await this.loadItems('long-lost-grid', { longLost: 'true' });
  }
};
