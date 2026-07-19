// Utility functions
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd';
  return formatDate(dateStr);
}

function daysAgo(dateStr) {
  if (!dateStr) return 0;
  const now = new Date();
  const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function getCategoryClass(category) {
  const map = {
    'Electronics & Gadgets': 'cat-electronics',
    'Bags & Accessories': 'cat-accessories',
    'Clothing & Wearables': 'cat-clothing',
    'Documents & IDs': 'cat-documents',
    'School Supplies': 'cat-books',
    'Personal Items': 'cat-other'
  };
  return map[category] || 'cat-other';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Toast notification system
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function showToast(message, type = 'info', options = {}) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} ${options.highlight ? 'toast-highlight' : ''}`;
  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  
  let closeBtn = '';
  if (options.autoClose === false) {
    closeBtn = '<button class="toast-close" title="Dismiss" style="background:transparent;border:none;color:currentColor;cursor:pointer;padding:4px;margin-left:auto;font-size:16px;">✕</button>';
  }

  toast.innerHTML = `<div class="toast-content" style="flex:1;display:flex;align-items:center;gap:12px;">${icons[type] || icons.info}<span>${escapeHtml(message)}</span></div>${closeBtn}`;
  
  if (options.onClick) {
    const content = toast.querySelector('.toast-content');
    content.style.cursor = 'pointer';
    content.addEventListener('click', () => {
      options.onClick();
      if (options.autoClose === false) closeToast(toast);
    });
  }

  if (options.autoClose === false) {
    toast.querySelector('.toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeToast(toast);
    });
  }

  toastContainer.appendChild(toast);
  
  if (options.autoClose !== false) {
    setTimeout(() => closeToast(toast), 3000);
  }
}

function closeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(40px)';
  setTimeout(() => toast.remove(), 300);
}

async function apiRequest(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    throw err;
  }
}
