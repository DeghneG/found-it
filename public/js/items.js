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
    const isOwner = Auth.currentUser && Auth.currentUser.id === item.user_id;
    const isAdmin = Auth.currentUser && Auth.currentUser.isAdmin;

    // Age tier for lost items
    let ageRibbon = '';
    if (item.status === 'lost') {
      if (days <= 3) { ageRibbon = '<div class="age-ribbon ribbon-fresh">FRESH</div>'; }
      else if (days <= 7) { ageRibbon = '<div class="age-ribbon ribbon-recent">1 WEEK</div>'; }
      else if (days <= 14) { ageRibbon = `<div class="age-ribbon ribbon-warning">${days}d</div>`; }
      else { ageRibbon = `<div class="age-ribbon ribbon-overdue">OVERDUE</div>`; }
    }

    // Status badge text
    let statusText = item.status;
    let statusClass = `status-${item.status}`;
    if (item.status === 'returned') { statusText = '✓ Returned'; statusClass = 'status-returned'; }
    else if (item.status === 'found') { statusText = '✓ Found'; }
    else if (item.status === 'lost') { statusText = '○ Lost'; statusClass = 'status-lost'; }

    return `
      <div class="item-card" data-id="${item.id}">
        <div class="item-card-image-wrapper">
          ${ageRibbon}
          ${item.image_url
            ? `<img class="item-card-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">`
            : `<div class="item-card-image-placeholder"><span>${escapeHtml(item.title)}</span></div>`
          }
        </div>
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
          <div class="item-actions">
            ${item.status === 'lost' && isOwner ? `<button class="btn btn-sm btn-ghost" style="padding: 2px 6px; font-size: 0.7rem;" onclick="event.stopPropagation(); Items.bumpItem(${item.id})" title="Renew Listing">Renew</button>` : ''}
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <span class="item-poster"><strong>${isOwner ? 'You' : escapeHtml(item.user_name)}</strong> · ${timeAgo(item.created_at)}</span>
        </div>
      </div>`;
  },

  toggleFormType() {
    const type = document.querySelector('input[name="item-type"]:checked').value;
    const foundFields = document.getElementById('found-fields');
    const verificationGroup = document.getElementById('verification-group');
    const titleEl = document.getElementById('post-form-title');
    const subtitleEl = document.querySelector('#view-post-item .view-subtitle');
    const locLabel = document.getElementById('location-label');
    const dateLabel = document.getElementById('date-label');
    const submitBtn = document.getElementById('submit-post');
    const heldAt = document.getElementById('item-held-at');
    
    if (type === 'found') {
      foundFields.classList.remove('hidden');
      verificationGroup.classList.remove('hidden');
      titleEl.textContent = 'Report a Found Item';
      subtitleEl.textContent = 'Help reunite this item with its owner. Only share a photo if it does not give away identifying details.';
      locLabel.textContent = 'Where did you find it? *';
      dateLabel.textContent = 'Date Found *';
      submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Post Found Item';
      heldAt.required = true;
    } else {
      foundFields.classList.add('hidden');
      verificationGroup.classList.remove('hidden');
      titleEl.textContent = 'Report a Lost Item';
      subtitleEl.textContent = 'Provide details to help us match the item.';
      locLabel.textContent = 'Where did you lose it? *';
      dateLabel.textContent = 'Date Lost *';
      submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Post Lost Item';
      heldAt.required = false;
    }
  },

  async showItemDetail(itemId) {
    try {
      const data = await apiRequest(`/api/items/${itemId}`);
      const item = data.item;
      const isOwner = Auth.currentUser && Auth.currentUser.id === item.user_id;
      const isAdmin = Auth.currentUser && Auth.currentUser.isAdmin;
      const days = daysAgo(item.created_at);

      // Status display
      let statusBadge = '';
      if (item.status === 'returned') statusBadge = '<span class="status-badge status-returned modal-item-status">✓ Returned</span>';
      else if (item.status === 'found') statusBadge = '<span class="status-badge status-found modal-item-status">✓ Found</span>';
      else statusBadge = '<span class="status-badge status-lost modal-item-status">○ Lost</span>';

      const modal = document.getElementById('item-modal');
      const body = document.getElementById('modal-body');

      body.innerHTML = `
        ${item.image_url ? `<img class="modal-item-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}">` : ''}
        <h2 class="modal-item-title">${escapeHtml(item.title)}</h2>
        ${statusBadge}
        ${item.status === 'lost' && days >= 14 ? `<span class="long-lost-badge" style="position:static;display:inline-flex;margin-left:8px">⚠ ${days} days</span>` : ''}
        <p class="modal-item-desc">${escapeHtml(item.description)}</p>
        <div class="modal-item-details">
          <div class="detail-item"><div class="detail-label">Category</div><div class="detail-value">${escapeHtml(item.category)}</div></div>
          <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(item.location)}</div></div>
          <div class="detail-item"><div class="detail-label">Date Lost</div><div class="detail-value">${formatDate(item.date_lost)}</div></div>
          <div class="detail-item"><div class="detail-label">Posted by</div><div class="detail-value">${isOwner ? 'You' : escapeHtml(item.user_name)}</div></div>
          ${item.status === 'found' || item.status === 'returned' ? `<div class="detail-item"><div class="detail-label">Found by</div><div class="detail-value">${escapeHtml(item.found_by || 'N/A')}</div></div>
          <div class="detail-item"><div class="detail-label">Found date</div><div class="detail-value">${formatDate(item.found_date)}</div></div>` : ''}
        </div>
        </div>
        <div class="modal-item-actions">
          ${item.status === 'found' && !isOwner && Auth.currentUser ? `<button class="btn btn-success" onclick="Items.openClaimModal(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>I think this is mine — mark interest</button>` : ''}
          ${item.status === 'lost' && (isOwner || isAdmin) ? `<button class="btn btn-success" onclick="Items.markFound(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Mark as Found</button>` : ''}
          ${item.status === 'found' && (isOwner || isAdmin) ? `<button class="btn btn-success" onclick="Items.markReturned(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Mark as Returned</button>` : ''}
          ${(item.status === 'lost' || item.status === 'found') && (isOwner || isAdmin) ? `<button class="btn" style="background:var(--bg-glass);color:var(--text-primary);border:1px solid var(--border);" onclick="Items.viewClaims(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>View Claims</button>` : ''}
          ${(item.status === 'lost' || item.status === 'found') && isOwner ? `<button class="btn" style="background:var(--bg-glass);color:var(--text-primary);border:1px solid var(--border);" onclick="Items.bumpItem(${item.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>Renew Listing</button>` : ''}
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

  async bumpItem(itemId) {
    try {
      await apiRequest(`/api/items/${itemId}/bump`, { method: 'PUT' });
      showToast('Item bumped! It is now at the top.', 'success');
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

      // Handle location dropdown
      const locSelect = document.getElementById('item-location');
      const locOther = document.getElementById('item-location-other');
      const options = Array.from(locSelect.options).map(o => o.value);
      if (options.includes(item.location)) {
        locSelect.value = item.location;
        locOther.classList.add('hidden');
      } else {
        locSelect.value = 'Other';
        locOther.value = item.location;
        locOther.classList.remove('hidden');
      }

      if (item.type === 'found') {
        document.querySelector('input[name="item-type"][value="found"]').checked = true;
      } else {
        document.querySelector('input[name="item-type"][value="lost"]').checked = true;
      }
      this.toggleFormType();

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

    // Location "Other" toggle
    const locationSelect = document.getElementById('item-location');
    const locationOther = document.getElementById('item-location-other');
    locationSelect.addEventListener('change', () => {
      if (locationSelect.value === 'Other') {
        locationOther.classList.remove('hidden');
        locationOther.required = true;
      } else {
        locationOther.classList.add('hidden');
        locationOther.required = false;
        locationOther.value = '';
      }
    });

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
      const type = document.querySelector('input[name="item-type"]:checked').value;
      const locationVal = document.getElementById('item-location').value;
      
      const payload = {
        title: document.getElementById('item-title').value.trim(),
        description: document.getElementById('item-description').value.trim(),
        category: document.getElementById('item-category').value,
        location: locationVal === 'Other' ? document.getElementById('item-location-other').value.trim() : locationVal,
        date_lost: document.getElementById('item-date').value,
        image_url: document.getElementById('item-image-url').value || null,
        type: type
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
          showToast('Item posted! Remember to bump it within 2 months.', 'success');
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
    document.getElementById('item-location-other').classList.add('hidden');
    document.getElementById('post-form-title').textContent = 'Report a Lost Item';
    document.getElementById('submit-post').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Post Item';
  },

  setupFilters() {
    const searchInput = document.getElementById('search-input');
    let debounce;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.searchQuery = searchInput.value.trim();
          this.loadDashboard();
        }, 300);
      });
    }

    const filtersContainer = document.getElementById('category-filters');
    if (filtersContainer) {
      filtersContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.category;
        this.loadDashboard();
      });
    }

    const sortSelect = document.getElementById('sort-items');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.loadDashboard();
      });
    }
  },

  async loadDashboard() {
    const grid = document.getElementById('items-grid');
    try {
      const params = { status: 'lost' };
      if (this.searchQuery) params.search = this.searchQuery;
      const query = new URLSearchParams(params).toString();
      const data = await apiRequest(`/api/items?${query}`);
      let items = data.items || [];

      // Calculate and update category counts
      const counts = { all: items.length };
      items.forEach(item => {
        counts[item.category] = (counts[item.category] || 0) + 1;
      });
      
      document.querySelectorAll('.filter-count').forEach(el => {
        const cat = el.id.replace('count-', '');
        el.textContent = counts[cat] || 0;
      });

      // Apply local filtering
      if (this.currentFilter !== 'all') {
        items = items.filter(i => i.category === this.currentFilter);
      }

      // Apply local sorting
      const sortVal = document.getElementById('sort-items')?.value || 'newest';
      items.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortVal === 'newest' ? dateB - dateA : dateA - dateB;
      });

      this.renderGrid(grid, items, params);
    } catch (err) {
      grid.innerHTML = '<div class="empty-state"><h3>Error loading items</h3><p>' + escapeHtml(err.message) + '</p></div>';
    }
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
  },

  // Mark as returned (reunited)
  async markReturned(itemId) {
    try {
      await apiRequest(`/api/items/${itemId}/returned`, { method: 'PUT' });
      showToast('Item marked as returned! 🎉', 'success');
      document.getElementById('item-modal').classList.add('hidden');
      App.refreshCurrentView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // Claim workflow
  _claimItemId: null,

  openClaimModal(itemId) {
    if (!Auth.currentUser) {
      showToast('Please log in first', 'error');
      return;
    }
    
    document.getElementById('claim-submit-btn').onclick = () => this.submitClaim(itemId);
    
    document.getElementById('claim-modal').classList.remove('hidden');
    document.getElementById('claim-error').classList.add('hidden');
  },

  async submitClaim(itemId) {
    const errEl = document.getElementById('claim-error');
    try {
      await apiRequest('/api/claims', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId })
      });
      document.getElementById('claim-modal').classList.add('hidden');
      showToast('SAWO staff have been notified of your interest.', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  },

  async viewClaims(itemId) {
    try {
      const data = await apiRequest(`/api/claims/item/${itemId}`);
      const modal = document.getElementById('claims-list-modal');
      const body = document.getElementById('claims-list-body');

      if (!data.claims || data.claims.length === 0) {
        body.innerHTML = '<div class="empty-state small"><p>No interest marked yet.</p></div>';
      } else {
        body.innerHTML = data.claims.map(c => {
          const name = c.claimant_name || 'Unknown';
          let statusHtml = '';
          if (c.status === 'pending') statusHtml = `<span class="claim-status claim-pending">Pending</span>`;
          else if (c.status === 'approved') statusHtml = `<span class="claim-status claim-approved">Approved</span>`;
          else statusHtml = `<span class="claim-status claim-rejected">Rejected</span>`;

          return `
            <div class="claim-item">
              <div class="claim-header">
                <strong>${escapeHtml(name)}</strong>
                ${statusHtml}
              </div>
              <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">Notified at: ${formatDate(c.created_at)}</p>
            </div>
          `;
        }).join('');
      }
      modal.classList.remove('hidden');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async approveClaim(claimId) {
    try {
      await apiRequest(`/api/claims/${claimId}/approve`, { method: 'PUT' });
      showToast('Claim approved! Item marked as returned. 🎉', 'success');
      document.getElementById('claims-list-modal').classList.add('hidden');
      document.getElementById('item-modal').classList.add('hidden');
      App.refreshCurrentView();
    } catch (err) { showToast(err.message, 'error'); }
  },

  async rejectClaim(claimId) {
    try {
      await apiRequest(`/api/claims/${claimId}/reject`, { method: 'PUT' });
      showToast('Claim rejected', 'info');
      // Refresh claims list
      document.getElementById('claims-list-modal').classList.add('hidden');
    } catch (err) { showToast(err.message, 'error'); }
  }
};

// Wire up claim modal events
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('claim-submit-btn').addEventListener('click', () => Items.submitClaim());
  document.getElementById('claim-modal-close').addEventListener('click', () => document.getElementById('claim-modal').classList.add('hidden'));
  document.getElementById('claim-overlay').addEventListener('click', () => document.getElementById('claim-modal').classList.add('hidden'));
  document.getElementById('claims-list-close').addEventListener('click', () => document.getElementById('claims-list-modal').classList.add('hidden'));
  document.getElementById('claims-list-overlay').addEventListener('click', () => document.getElementById('claims-list-modal').classList.add('hidden'));
});
