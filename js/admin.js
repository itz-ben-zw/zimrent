/* ==========================================
   HOMIFY - Admin Console (verification + reports)
   ========================================== */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function authHeaders(extra) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  const session = getSession ? getSession() : null;
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
  return headers;
}

function apiError(res, fallback) {
  return res.json()
    .then(d => (d && d.error) || fallback)
    .catch(() => fallback);
}

function notify(msg, ok) {
  if (window.toast) {
    ok ? toast.success(msg) : toast.error(msg);
  } else {
    alert(msg);
  }
}

// --- Stats ---
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: authHeaders() });
    if (!res.ok) return;
    const { stats } = await res.json();
    document.getElementById('stat-pending').textContent = stats.pendingVerifications;
    document.getElementById('stat-flagged').textContent = stats.flaggedListings;
    document.getElementById('stat-reports').textContent = stats.openReports;
    document.getElementById('stat-listings').textContent = stats.totalProperties;
    document.getElementById('stat-users').textContent = stats.totalUsers;
  } catch (e) { /* stats are non-critical */ }
}

// --- Pending verification queue ---
async function loadPending() {
  const tbody = document.getElementById('admin-pending-body');
  try {
    const res = await fetch('/api/admin/properties?status=pending', { headers: authHeaders() });
    if (!res.ok) throw new Error(await apiError(res, 'Failed to load queue'));
    const { properties } = await res.json();

    if (!properties.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Queue is clear - nothing pending.</td></tr>';
      return;
    }

    tbody.innerHTML = properties.map(p => `
      <tr>
        <td style="padding:1rem 1.5rem;">
          <div style="font-weight:600;">${escapeHtml(p.title)}</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(p.city)}, ${escapeHtml(p.suburb)} - ${escapeHtml(p.type)} - ${p.bedrooms} bed</div>
        </td>
        <td style="padding:1rem;">
          <div>${escapeHtml(p.landlordName)}</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(p.landlordEmail)}</div>
        </td>
        <td style="padding:1rem; font-weight:600;">${escapeHtml(p.currency)} ${p.price.toLocaleString()}</td>
        <td style="padding:1rem; font-size:0.9rem; color:var(--text-muted);">${new Date(p.createdAt).toLocaleDateString('en-ZW', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td style="padding:1rem;">
          <div class="btn-group">
            <button class="btn btn-sm btn-success" onclick="verifyProperty('${p.id}', 'approve')">Approve</button>
            <button class="btn btn-sm" style="background:#e05252; color:#fff;" onclick="rejectProperty('${p.id}')">Reject</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:1rem; color:#e05252;">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function verifyProperty(id, decision, notes) {
  try {
    const res = await fetch(`/api/admin/properties/${id}/verify`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ decision, notes })
    });
    if (!res.ok) throw new Error(await apiError(res, 'Action failed'));
    const data = await res.json();
    notify(data.message || 'Done', true);
    refreshAdmin();
  } catch (e) {
    notify(e.message, false);
  }
}


function rejectProperty(id) {
  const notes = window.prompt(
    'Reason for rejection (shown to the landlord):',
    'Could not verify ownership or listing details'
  );
  if (notes === null) return;
  verifyProperty(id, 'reject', notes);
}

// --- Flagged listings ---
async function loadFlagged() {
  const tbody = document.getElementById('admin-flagged-body');
  try {
    const res = await fetch('/api/admin/properties?status=flagged', { headers: authHeaders() });
    if (!res.ok) throw new Error(await apiError(res, 'Failed to load flagged listings'));
    const { properties } = await res.json();

    if (!properties.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">No flagged listings.</td></tr>';
      return;
    }

    tbody.innerHTML = properties.map(p => `
      <tr>
        <td style="padding:1rem 1.5rem;">
          <div style="font-weight:600;">${escapeHtml(p.title)}</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(p.city)}, ${escapeHtml(p.suburb)} - ${escapeHtml(p.currency)} ${p.price.toLocaleString()}</div>
        </td>
        <td style="padding:1rem;">${escapeHtml(p.landlordName)}</td>
        <td style="padding:1rem;">
          <div class="btn-group">
            <button class="btn btn-sm btn-success" onclick="verifyProperty('${p.id}', 'restore')">Restore</button>
            <button class="btn btn-sm" style="background:#e05252; color:#fff;" onclick="verifyProperty('${p.id}', 'reject', 'Removed after scam report review')">Remove</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding:1rem; color:#e05252;">${escapeHtml(e.message)}</td></tr>`;
  }
}

// --- Scam reports ---
async function loadReports() {
  const box = document.getElementById('admin-reports-body');
  try {
    const res = await fetch('/api/admin/reports?status=open', { headers: authHeaders() });
    if (!res.ok) throw new Error(await apiError(res, 'Failed to load reports'));
    const { reports } = await res.json();

    if (!reports.length) {
      box.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1.5rem;">No open reports.</p>';
      return;
    }

    box.innerHTML = reports.map(r => `
      <div style="border-bottom:1px solid var(--border); padding:0.9rem 0;">
        <div style="display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; align-items:center;">
          <div>
            <strong>${escapeHtml(r.propertyTitle)}</strong>
            <span style="color:var(--text-muted); font-size:0.88rem;"> - reported by ${escapeHtml(r.reporterName)} on ${new Date(r.createdAt).toLocaleDateString('en-ZW')}</span>
            <div style="font-size:0.92rem; margin-top:0.25rem;">${escapeHtml(r.reason)}</div>
            ${r.evidence ? `<div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(r.evidence)}</div>` : ''}
          </div>
          <button class="btn btn-sm btn-outline" onclick="resolveReport('${r.id}')">Mark resolved</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    box.innerHTML = `<p style="color:#e05252;">${escapeHtml(e.message)}</p>`;
  }
}

async function resolveReport(id) {
  try {
    const res = await fetch(`/api/admin/reports/${id}/resolve`, {
      method: 'PUT',
      headers: authHeaders()
    });
    if (!res.ok) throw new Error(await apiError(res, 'Action failed'));
    notify('Report marked as resolved', true);
    refreshAdmin();
  } catch (e) {
    notify(e.message, false);
  }
}

// --- Users ---
async function loadUsers() {
  const tbody = document.getElementById('admin-users-body');
  try {
    const res = await fetch('/api/admin/users', { headers: authHeaders() });
    if (!res.ok) throw new Error(await apiError(res, 'Failed to load users'));
    const { users } = await res.json();
    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="padding:1rem 1.5rem;">${escapeHtml(u.fullName)}</td>
        <td style="padding:1rem;">${escapeHtml(u.email)}</td>
        <td style="padding:1rem;"><span class="amenity-badge">${escapeHtml(u.role)}</span></td>
        <td style="padding:1rem; font-size:0.9rem; color:var(--text-muted);">${new Date(u.createdAt).toLocaleDateString('en-ZW')}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:1rem; color:#e05252;">${escapeHtml(e.message)}</td></tr>`;
  }
}

function refreshAdmin() {
  loadStats();
  loadPending();
  loadFlagged();
  loadReports();
  loadUsers();
}

document.addEventListener('DOMContentLoaded', () => {
  const user = getCurrentUser ? getCurrentUser() : null;
  if (user && user.role === 'admin') refreshAdmin();
});
