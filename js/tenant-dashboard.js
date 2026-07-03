/* ==========================================
   ZIMRENT — Tenant Dashboard
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin()) return;

  const user = getCurrentUser();
  if (user.role !== 'tenant') {
    window.location.href = 'dashboard.html';
    return;
  }

  document.getElementById('welcome-text').textContent = `Welcome back, ${user.username || user.fullName || user.email}!`;

  await Promise.all([
    loadFavorites(),
    loadApplications(),
    loadConversations()
  ]);
});

async function apiFetch(path) {
  const headers = { 'Content-Type': 'application/json' };
  const session = getSession ? getSession() : null;
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
  const res = await fetch(path, { headers });
  if (!res.ok) throw new Error('Request failed: ' + res.status);
  return res.json();
}

// ── Favorites ──

async function loadFavorites() {
  try {
    const data = await apiFetch('/api/favorites');
    const favs = data.favorites || [];
    document.getElementById('stat-favorites').textContent = favs.length;
    renderFavorites(favs);
  } catch (err) {
    console.error('Failed to load favorites:', err);
  }
}

function renderFavorites(favs) {
  const container = document.getElementById('favorites-list');
  if (favs.length === 0) return;

  container.innerHTML = favs.map(f => `
    <div class="property-card" style="cursor:pointer;" onclick="sessionStorage.setItem('current_listing_id','${escapeHtml(f.id)}'); window.location.href='property.html';">
      <div class="property-image">
        ${f.images && f.images.length > 0
          ? `<img src="${f.images[0].data}" alt="${escapeHtml(f.title)}">`
          : `<div style="height:160px; background:#e0e0e0; display:flex; align-items:center; justify-content:center;"><i class="fas fa-home" style="font-size:3rem; color:#999;"></i></div>`
        }
      </div>
      <div class="property-info">
        <div class="property-title">${escapeHtml(f.title)}</div>
        <div class="property-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(f.city)}, ${escapeHtml(f.suburb)}</div>
        <div class="property-price">${f.currency} ${f.price?.toLocaleString() || '0'}/month</div>
        <div style="display:flex; gap:0.3rem; margin-top:0.3rem; flex-wrap:wrap;">
          <span class="amenity-badge">${f.bedrooms} Bed${f.bedrooms !== 1 ? 's' : ''}</span>
          <span class="amenity-badge">${f.bathrooms} Bath${f.bathrooms !== 1 ? 's' : ''}</span>
          <span class="amenity-badge">${f.type}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Applications ──

async function loadApplications() {
  try {
    const data = await apiFetch('/api/applications/mine');
    const apps = data.applications || [];
    document.getElementById('stat-applications').textContent = apps.length;
    renderApplications(apps);
  } catch (err) {
    console.error('Failed to load applications:', err);
  }
}

function renderApplications(apps) {
  const container = document.getElementById('applications-list');
  if (apps.length === 0) return;

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8f9fa; text-align:left; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">
            <th style="padding:0.8rem 1rem;">Property</th>
            <th style="padding:0.8rem;">Location</th>
            <th style="padding:0.8rem;">Price</th>
            <th style="padding:0.8rem;">Status</th>
            <th style="padding:0.8rem;">Applied</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map(a => {
            let statusBadge, statusColor;
            if (a.status === 'pending') { statusBadge = '⏳ Pending'; statusColor = '#f0ad4e'; }
            else if (a.status === 'accepted') { statusBadge = '✅ Accepted'; statusColor = 'var(--accent)'; }
            else { statusBadge = '❌ Rejected'; statusColor = 'var(--danger)'; }

            return `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:0.8rem 1rem; font-weight:600;">${escapeHtml(a.propertyTitle)}</td>
                <td style="padding:0.8rem; color:var(--text-muted);">${escapeHtml(a.city)}, ${escapeHtml(a.suburb)}</td>
                <td style="padding:0.8rem; font-weight:600;">${a.currency} ${a.price?.toLocaleString() || '0'}</td>
                <td style="padding:0.8rem;"><span style="background:${statusColor}20; color:${statusColor}; padding:0.25rem 0.7rem; border-radius:50px; font-size:0.85rem; font-weight:600;">${statusBadge}</span></td>
                <td style="padding:0.8rem; color:var(--text-muted); font-size:0.9rem;">${new Date(a.createdAt).toLocaleDateString('en-ZW', { month: 'short', day: 'numeric' })}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Conversations / Messages Preview ──

async function loadConversations() {
  try {
    const data = await apiFetch('/api/conversations');
    const convs = data.conversations || [];
    const unread = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    document.getElementById('stat-messages').textContent = unread;
    renderMessagePreview(convs);
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

function renderMessagePreview(convs) {
  const container = document.getElementById('messages-preview');
  if (convs.length === 0) return;

  container.innerHTML = convs.slice(0, 5).map(c => `
    <div style="display:flex; align-items:center; gap:1rem; padding:0.8rem 1rem; border-bottom:1px solid var(--border); cursor:pointer; ${c.unreadCount > 0 ? 'background:#f0f7ff;' : ''}" onclick="sessionStorage.setItem('current_conversation_id','${c.id}'); window.location.href='chat.html';">
      <div style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; color:white; font-weight:700;">
        ${(c.landlordName || 'L')[0].toUpperCase()}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:${c.unreadCount > 0 ? '700' : '600'}; font-size:0.95rem;">
          ${escapeHtml(c.propertyTitle)}
          ${c.unreadCount > 0 ? `<span style="background:var(--primary); color:white; font-size:0.7rem; padding:0.15rem 0.5rem; border-radius:50px; margin-left:0.5rem;">${c.unreadCount} new</span>` : ''}
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${c.lastMessage || 'No messages yet'}
        </div>
      </div>
      <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">
        ${new Date(c.lastMessageAt || c.createdAt).toLocaleDateString('en-ZW', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}