// State
let currentUser = null;
let currentWishlist = null;
let isGifterView = false;
let shareToken = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const wishlistDetailSection = document.getElementById('wishlist-detail-section');
const gifterSection = document.getElementById('gifter-section');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check if this is a shared link
  const path = window.location.pathname;
  if (path.startsWith('/gift/')) {
    shareToken = path.replace('/gift/', '');
    isGifterView = true;
    showGifterView();
    return;
  }

  // Check if user is logged in
  await checkAuth();

  // Home link - go back to dashboard
  document.getElementById('home-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser) {
      currentWishlist = null;
      showDashboard();
    }
  });
});

// Auth check
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();
      showDashboard();
    } else {
      showAuth();
    }
  } catch (err) {
    showAuth();
  }
}

// Show/Hide Sections
function hideAllSections() {
  authSection.style.display = 'none';
  dashboardSection.style.display = 'none';
  wishlistDetailSection.style.display = 'none';
  gifterSection.style.display = 'none';
}

function showAuth() {
  hideAllSections();
  authSection.style.display = 'block';
  document.getElementById('logout-btn').style.display = 'none';
  document.getElementById('user-info').textContent = '';
}

function showDashboard() {
  hideAllSections();
  dashboardSection.style.display = 'block';
  document.getElementById('logout-btn').style.display = 'block';
  document.getElementById('user-info').textContent = `Welcome, ${currentUser.name}`;
  loadWishlists();
}

function showWishlistDetail(wishlistId) {
  hideAllSections();
  wishlistDetailSection.style.display = 'block';
  loadWishlistDetail(wishlistId);
}

function showGifterView() {
  hideAllSections();
  gifterSection.style.display = 'block';
  document.getElementById('logout-btn').style.display = 'none';
  document.getElementById('user-info').textContent = '';
  loadGifterWishlist();
}

// Auth Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  });
});

// Login Form
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      currentUser = await res.json();
      showDashboard();
    } else {
      const data = await res.json();
      document.getElementById('login-error').textContent = data.error;
    }
  } catch (err) {
    document.getElementById('login-error').textContent = 'An error occurred';
  }
});

// Register Form
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (res.ok) {
      currentUser = await res.json();
      showDashboard();
    } else {
      const data = await res.json();
      document.getElementById('register-error').textContent = data.error;
    }
  } catch (err) {
    document.getElementById('register-error').textContent = 'An error occurred';
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  showAuth();
});

// Load Wishlists
async function loadWishlists() {
  const container = document.getElementById('wishlists-container');

  try {
    const res = await fetch('/api/wishlists');
    const wishlists = await res.json();

    if (wishlists.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>You haven't created any wishlists yet.</p>
          <p>Click "+ New Wishlist" to get started!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = wishlists.map(w => `
      <div class="wishlist-card">
        <div class="wishlist-card-content" onclick="showWishlistDetail('${w.id}')">
          <h3>${escapeHtml(w.title)}</h3>
          <div class="meta">
            <span>Ends: ${formatDate(w.end_date)}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteWishlist('${w.id}', '${escapeHtml(w.title).replace(/'/g, "\\'")}')">Delete</button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="error">Failed to load wishlists</p>';
  }
}

// Delete Wishlist
async function deleteWishlist(wishlistId, title) {
  if (!confirm(`Are you sure you want to delete "${title}"? This will delete all items and cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/wishlists/${wishlistId}`, { method: 'DELETE' });
    if (res.ok) {
      loadWishlists();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete wishlist');
    }
  } catch (err) {
    alert('Failed to delete wishlist');
  }
}

// New Wishlist
document.getElementById('new-wishlist-btn').addEventListener('click', () => {
  // Set default end date to Dec 25 of current year
  const year = new Date().getFullYear();
  document.getElementById('wishlist-end-date').value = `${year}-12-25`;
  document.getElementById('new-wishlist-modal').style.display = 'flex';
});

document.getElementById('new-wishlist-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('wishlist-title').value;
  const end_date = document.getElementById('wishlist-end-date').value;

  try {
    const res = await fetch('/api/wishlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, end_date })
    });

    if (res.ok) {
      closeModal('new-wishlist-modal');
      document.getElementById('wishlist-title').value = '';
      loadWishlists();
    }
  } catch (err) {
    alert('Failed to create wishlist');
  }
});

// Load Wishlist Detail
async function loadWishlistDetail(wishlistId) {
  try {
    const res = await fetch(`/api/wishlists/${wishlistId}`);
    const wishlist = await res.json();
    currentWishlist = wishlist;

    document.getElementById('wishlist-title-display').textContent = wishlist.title;
    document.getElementById('wishlist-end-date-display').textContent = `Ends: ${formatDate(wishlist.end_date)}`;

    // Share link
    const shareLink = `${window.location.origin}/gift/${wishlist.share_token}`;
    document.getElementById('share-link').value = shareLink;

    // Thank you section (only visible after end date)
    const thankYouSection = document.getElementById('thank-you-section');
    const itemsSection = document.getElementById('items-section');

    if (wishlist.past_end_date) {
      thankYouSection.style.display = 'block';
      loadThankYouList(wishlistId);
    } else {
      thankYouSection.style.display = 'none';
    }

    // Items
    const container = document.getElementById('items-container');
    if (wishlist.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No items yet. Add some items to your wishlist!</p>
        </div>
      `;
    } else {
      container.innerHTML = wishlist.items.map(item => {
        let claimHtml = '';
        if (wishlist.past_end_date && item.claim) {
          claimHtml = `<div class="claim-info">🎁 Claimed by ${escapeHtml(item.claim.gifter_name)}</div>`;
        }

        return `
          <div class="item-card ${(wishlist.past_end_date && item.claim) ? 'claimed' : ''}">
            <h4>${escapeHtml(item.name)}</h4>
            ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
            ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank">View Link →</a>` : ''}
            ${claimHtml}
            ${!wishlist.past_end_date ? `
              <div class="item-actions">
                <button class="btn btn-secondary" onclick="openEditItemModal('${item.id}', '${escapeHtml(item.name).replace(/'/g, "\\'")}', '${escapeHtml(item.description || '').replace(/'/g, "\\'")}', '${escapeHtml(item.link || '').replace(/'/g, "\\'")}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    // Hide add button after end date
    document.getElementById('add-item-btn').style.display = wishlist.past_end_date ? 'none' : 'block';

  } catch (err) {
    alert('Failed to load wishlist');
    showDashboard();
  }
}

// Edit Wishlist
document.getElementById('edit-wishlist-btn').addEventListener('click', () => {
  if (currentWishlist) {
    document.getElementById('edit-wishlist-title').value = currentWishlist.title;
    document.getElementById('edit-wishlist-end-date').value = currentWishlist.end_date;
    document.getElementById('edit-wishlist-modal').style.display = 'flex';
  }
});

document.getElementById('edit-wishlist-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('edit-wishlist-title').value;
  const end_date = document.getElementById('edit-wishlist-end-date').value;

  try {
    const res = await fetch(`/api/wishlists/${currentWishlist.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, end_date })
    });

    if (res.ok) {
      closeModal('edit-wishlist-modal');
      loadWishlistDetail(currentWishlist.id);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update wishlist');
    }
  } catch (err) {
    alert('Failed to update wishlist');
  }
});

// Thank You List
async function loadThankYouList(wishlistId) {
  try {
    const res = await fetch(`/api/wishlists/${wishlistId}/thankyou`);
    const data = await res.json();

    const container = document.getElementById('thank-you-list');
    const gifters = Object.entries(data.gifts);

    if (gifters.length === 0) {
      container.innerHTML = '<p>No gifts were claimed yet.</p>';
      return;
    }

    container.innerHTML = gifters.map(([gifter, items]) => `
      <div class="thank-you-gifter">
        <h4>${escapeHtml(gifter)}</h4>
        <ul>
          ${items.map(item => `<li>${escapeHtml(item.item_name)}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('thank-you-list').innerHTML = '<p class="error">Failed to load thank you list</p>';
  }
}

// Back to Dashboard
document.getElementById('back-to-dashboard').addEventListener('click', () => {
  currentWishlist = null;
  showDashboard();
});

// Copy Share Link
document.getElementById('copy-link-btn').addEventListener('click', () => {
  const input = document.getElementById('share-link');
  input.select();
  document.execCommand('copy');
  document.getElementById('copy-link-btn').textContent = 'Copied!';
  setTimeout(() => {
    document.getElementById('copy-link-btn').textContent = 'Copy';
  }, 2000);
});

// Add Item
document.getElementById('add-item-btn').addEventListener('click', () => {
  document.getElementById('add-item-modal').style.display = 'flex';
});

document.getElementById('add-item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('item-name').value;
  const description = document.getElementById('item-description').value;
  const link = document.getElementById('item-link').value;

  try {
    const res = await fetch(`/api/wishlists/${currentWishlist.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, link })
    });

    if (res.ok) {
      closeModal('add-item-modal');
      document.getElementById('item-name').value = '';
      document.getElementById('item-description').value = '';
      document.getElementById('item-link').value = '';
      loadWishlistDetail(currentWishlist.id);
    }
  } catch (err) {
    alert('Failed to add item');
  }
});

// Delete Item
async function deleteItem(itemId) {
  if (!confirm('Are you sure you want to delete this item?')) return;

  try {
    await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    loadWishlistDetail(currentWishlist.id);
  } catch (err) {
    alert('Failed to delete item');
  }
}

// Edit Item
function openEditItemModal(itemId, name, description, link) {
  document.getElementById('edit-item-id').value = itemId;
  document.getElementById('edit-item-name').value = name;
  document.getElementById('edit-item-description').value = description;
  document.getElementById('edit-item-link').value = link;
  document.getElementById('edit-item-modal').style.display = 'flex';
}

document.getElementById('edit-item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const itemId = document.getElementById('edit-item-id').value;
  const name = document.getElementById('edit-item-name').value;
  const description = document.getElementById('edit-item-description').value;
  const link = document.getElementById('edit-item-link').value;

  try {
    const res = await fetch(`/api/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, link })
    });

    if (res.ok) {
      closeModal('edit-item-modal');
      loadWishlistDetail(currentWishlist.id);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update item');
    }
  } catch (err) {
    alert('Failed to update item');
  }
});

// ============ GIFTER VIEW ============

async function loadGifterWishlist() {
  try {
    const res = await fetch(`/api/shared/${shareToken}`);
    if (!res.ok) {
      document.getElementById('gifter-header').innerHTML = '<h2>Wishlist not found</h2>';
      return;
    }

    const wishlist = await res.json();

    document.getElementById('gifter-wishlist-title').textContent = wishlist.title;
    document.getElementById('gifter-recipient-name').textContent = `For: ${wishlist.recipient_name}`;
    document.getElementById('gifter-end-date').textContent = `Gift by: ${formatDate(wishlist.end_date)}`;

    const expiredDiv = document.getElementById('gifter-expired');
    const itemsContainer = document.getElementById('gifter-items-container');

    if (wishlist.past_end_date) {
      expiredDiv.style.display = 'block';
      itemsContainer.innerHTML = '';
      return;
    }

    expiredDiv.style.display = 'none';

    if (wishlist.items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="empty-state">
          <p>No items on this wishlist yet.</p>
        </div>
      `;
      return;
    }

    // Get saved gifter info from localStorage
    const savedGifter = localStorage.getItem('gifter_info');
    let myName = null;
    let myEmail = null;
    if (savedGifter) {
      const parsed = JSON.parse(savedGifter);
      myName = parsed.name || null;
      myEmail = parsed.email || null;
    }

    const availableCount = wishlist.items.filter(i => !i.claimed).length;

    // Sort items: unclaimed first, then claimed
    const sortedItems = [...wishlist.items].sort((a, b) => {
      if (a.claimed === b.claimed) return 0;
      return a.claimed ? 1 : -1;
    });

    itemsContainer.innerHTML = `
      <div class="stats">
        <span>${availableCount} items still available</span>
        <span>${wishlist.claimed_count} already claimed</span>
      </div>
      ${sortedItems.map(item => {
        // Determine claim status for this gifter
        let claimStatus = 'available';
        if (item.claimed) {
          // Check if this gifter claimed it (match by name or email)
          const nameMatch = myName && item.claimed_by_name &&
            item.claimed_by_name.toLowerCase() === myName.toLowerCase();
          const emailMatch = myEmail && item.claimed_by_email &&
            item.claimed_by_email.toLowerCase() === myEmail.toLowerCase();

          if (nameMatch || emailMatch) {
            claimStatus = 'claimed_by_me';
          } else {
            claimStatus = 'claimed_by_other';
          }
        }

        let statusHtml = '';
        let buttonHtml = '';
        let cardClass = 'gifter-item-card';

        if (claimStatus === 'claimed_by_me') {
          cardClass += ' claimed-by-me';
          statusHtml = '<div class="claim-status claim-mine">✓ You\'re getting this!</div>';
        } else if (claimStatus === 'claimed_by_other') {
          cardClass += ' claimed-by-other';
          statusHtml = '<div class="claim-status claim-other">Already claimed by someone else</div>';
        } else {
          buttonHtml = `<button class="btn btn-success" onclick="openClaimModal('${item.id}', '${escapeHtml(item.name).replace(/'/g, "\\'")}')">
            I'll Get This
          </button>`;
        }

        return `
          <div class="${cardClass}">
            <div class="gifter-item-info">
              <h4>${escapeHtml(item.name)}</h4>
              ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
              ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank">View Link →</a>` : ''}
              ${statusHtml}
            </div>
            ${buttonHtml}
          </div>
        `;
      }).join('')}
    `;
  } catch (err) {
    document.getElementById('gifter-header').innerHTML = '<h2>Error loading wishlist</h2>';
  }
}

async function openClaimModal(itemId, itemName) {
  // Check if item is still available before opening modal
  try {
    const res = await fetch(`/api/shared/${shareToken}/check/${itemId}`);
    const data = await res.json();

    if (!data.available) {
      alert('Sorry, this item has already been claimed by someone else.');
      loadGifterWishlist();
      return;
    }
  } catch (err) {
    alert('Error checking item availability. Please refresh the page.');
    loadGifterWishlist();
    return;
  }

  document.getElementById('claim-item-id').value = itemId;
  document.getElementById('claim-item-name').textContent = `Claiming: ${itemName}`;

  // Pre-fill from localStorage
  const savedGifter = localStorage.getItem('gifter_info');
  if (savedGifter) {
    const { name, email } = JSON.parse(savedGifter);
    document.getElementById('gifter-name').value = name || '';
    document.getElementById('gifter-email').value = email || '';
  }

  document.getElementById('claim-modal').style.display = 'flex';
}

document.getElementById('claim-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const itemId = document.getElementById('claim-item-id').value;
  const gifter_name = document.getElementById('gifter-name').value;
  const gifter_email = document.getElementById('gifter-email').value;

  try {
    const res = await fetch(`/api/shared/${shareToken}/claim/${itemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifter_name, gifter_email })
    });

    if (res.ok) {
      // Save gifter info to localStorage
      localStorage.setItem('gifter_info', JSON.stringify({
        name: gifter_name,
        email: gifter_email
      }));

      closeModal('claim-modal');
      loadGifterWishlist();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  } catch (err) {
    alert('Failed to claim item');
  }
});

// ============ UTILITIES ============

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
