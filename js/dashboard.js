/* ==========================================
   HOMIFY — Landlord Dashboard & Add Listing
   ========================================== */

let editingId = null;

function initDashboard() {
  if (!requireLogin()) return;
  
  const currentUserId = getCurrentUserId();
  
  fetchListings(currentUserId).then(listings => {
    renderStats(listings);
    renderListingsTable(listings);
  }).catch(err => {
    console.error('Failed to load listings:', err);
  });
  
  const addForm = document.getElementById('add-listing-form');
  if (addForm) {
    addForm.addEventListener('submit', handleListingSubmit);
  }
  
  document.getElementById('reset-form-btn')?.addEventListener('click', resetForm);
}

async function fetchListings(landlordId) {
  const headers = { 'Content-Type': 'application/json' };
  const session = getSession ? getSession() : null;
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
  
  const res = await fetch(`/api/properties?landlordId=${landlordId}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.properties;
}

function renderStats(listings) {
  const total = document.getElementById('stat-total');
  const houses = document.getElementById('stat-houses');
  const revenue = document.getElementById('stat-revenue');
  
  if (total) total.textContent = listings.length;
  
  if (houses) {
    const count = listings.filter(l => ['House', 'Townhouse', 'Cottage'].includes(l.type)).length;
    houses.textContent = count;
  }
  
  if (revenue) {
    const usdTotal = listings.reduce((sum, l) => {
      if (l.currency === 'USD') return sum + l.price;
      if (l.currency === 'ZAR') return sum + (l.price / 12);
      if (l.currency === 'ZiG') return sum + (l.price / 3600);
      return sum;
    }, 0);
    revenue.textContent = `~USD ${Math.round(usdTotal).toLocaleString()}/mo`;
  }
}

function renderListingsTable(listings) {
  const tbody = document.getElementById('dashboard-table-body');
  if (!tbody) return;
  
  if (listings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:0.5rem;"><i class="fas fa-folder-open" style="color:var(--text-muted);"></i></div>
          No listings yet. Add your first property!
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = listings.map(l => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:0.8rem;">
          ${l.images && l.images.length > 0 
            ? `<img src="${l.images[0].data}" style="width:50px; height:50px; border-radius:6px; object-fit:cover;">`
            : `<div style="width:50px; height:50px; background:#e0e0e0; border-radius:6px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-home" style="color:#999;"></i></div>`
          }
          <div>
            <div style="font-weight:600;">${escapeHtml(l.title)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);"><i class="fas fa-map-marker-alt" style="color:var(--text-muted);"></i> ${escapeHtml(l.city)}, ${escapeHtml(l.suburb)}</div>
          </div>
        </div>
      </td>
      <td>${l.type}</td>
      <td>${l.bedrooms}</td>
      <td>
        <span style="font-weight:600;">${l.currency} ${l.price.toLocaleString()}</span>
      </td>
      <td>
        ${l.wifi ? '<span style="color:var(--accent);"><i class="fas fa-wifi"></i></span>' : ''}
        ${l.electricStove ? '<span style="color:var(--accent);"><i class="fas fa-bolt"></i></span>' : ''}
        ${l.gasStove ? '<span style="color:var(--accent);"><i class="fas fa-fire"></i></span>' : ''}
        ${l.fridge ? '<span style="color:var(--accent);"><i class="fas fa-igloo"></i></span>' : ''}
        ${l.solar ? '<span style="color:var(--accent);"><i class="fas fa-sun"></i></span>' : ''}
        ${l.borehole ? '<span style="color:var(--accent);"><i class="fas fa-tint"></i></span>' : ''}
        ${l.fenced ? '<span style="color:var(--accent);"><i class="fas fa-lock"></i></span>' : ''}
      </td>
      <td>${new Date(l.createdAt).toLocaleDateString('en-ZW', { month: 'short', day: 'numeric' })}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-primary" onclick="editListing('${l.id}')">Edit</button>
          <button class="btn btn-sm btn-outline" onclick="viewListing('${l.id}')">View</button>
          <button class="btn btn-sm" style="background:var(--danger); color:white;" onclick="confirmDelete('${l.id}')" aria-label="Delete listing">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function handleListingSubmit(e) {
  e.preventDefault();
  
  const headers = { 'Content-Type': 'application/json' };
  const session = getSession ? getSession() : null;
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
  
  const url = editingId ? `/api/properties/${editingId}` : '/api/properties';
  const method = editingId ? 'PUT' : 'POST';
  
  const images = (window._tempImages || []).map(img => ({ data: img.data }));
  
  const body = {
    title: document.getElementById('inp-title').value,
    city: document.getElementById('inp-city').value,
    suburb: document.getElementById('inp-suburb').value,
    type: document.getElementById('inp-type').value,
    bedrooms: parseInt(document.getElementById('inp-bedrooms').value),
    bathrooms: parseFloat(document.getElementById('inp-bathrooms').value) || 1,
    price: parseFloat(document.getElementById('inp-price').value),
    currency: document.getElementById('inp-currency').value,
    wifi: document.getElementById('inp-wifi').checked,
    electricStove: document.getElementById('inp-electric-stove').checked,
    gasStove: document.getElementById('inp-gas-stove').checked,
    fridge: document.getElementById('inp-fridge').checked,
    solar: document.getElementById('inp-solar').checked,
    borehole: document.getElementById('inp-borehole').checked,
    fenced: document.getElementById('inp-fenced').checked,
    description: document.getElementById('inp-description').value,
    customAdditions: document.getElementById('inp-custom').value,
    images,
    phone: document.getElementById('inp-phone').value,
    email: document.getElementById('inp-email').value,
    whatsapp: document.getElementById('inp-whatsapp').value,
    latitude: document.getElementById('inp-latitude') ? document.getElementById('inp-latitude').value : null,
    longitude: document.getElementById('inp-longitude') ? document.getElementById('inp-longitude').value : null
  };
  
  try {
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (window.toast) toast.error('Failed to save listing: ' + (err.error || 'Unknown error'));
      else alert('Failed to save listing: ' + (err.error || 'Unknown error'));
      return;
    }

    window._tempImages = [];
    const btn = document.querySelector('.form-card button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saved';
    btn.style.background = 'var(--accent-dark)';

    if (window.toast) toast.success('Your listing has been submitted.');

    setTimeout(() => {
      window.location.href = 'thank-you.html';
    }, 900);
  } catch (err) {
    if (window.toast) toast.error('Error saving listing: ' + err.message);
    else alert('Error saving listing: ' + err.message);
  }
}

function resetForm() {
  editingId = null;
  document.getElementById('add-listing-form').reset();
  document.querySelector('.form-card h2').textContent = 'Add New Property';
  window._tempImages = [];
}

function editListing(id) {
  sessionStorage.setItem('edit_listing_id', id);
  window.location.href = 'add-listing.html';
}

function viewListing(id) {
  sessionStorage.setItem('current_listing_id', id);
  window.location.href = 'property.html';
}

async function confirmDelete(id) {
  if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) return;
  
  const headers = { 'Content-Type': 'application/json' };
  const session = getSession ? getSession() : null;
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
  
  const res = await fetch(`/api/properties/${id}`, { method: 'DELETE', headers });
  if (!res.ok) {
    if (window.toast) toast.error('Failed to delete listing');
    else alert('Failed to delete listing');
    return;
  }

  if (window.toast) toast.success('Listing deleted.');

  const currentUserId = getCurrentUserId();
  const listings = await fetchListings(currentUserId);
  renderStats(listings);
  renderListingsTable(listings);
}

async function initAddListing() {
  if (!requireLogin()) return;
  
  const editId = sessionStorage.getItem('edit_listing_id');
  
  populateAddFormHelpers();
  initImageUpload();
  initMapPicker();
  
  if (editId) {
    editingId = editId;
    try {
      const headers = { 'Content-Type': 'application/json' };
      const session = getSession ? getSession() : null;
      if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
      const res = await fetch(`/api/properties/${editId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.property) prefillForm(data.property);
      }
    } catch (err) {
      console.error('Failed to fetch property for edit:', err);
    }
    sessionStorage.removeItem('edit_listing_id');
  }
}

function populateAddFormHelpers() {
  const citySelect = document.getElementById('inp-city');
  const suburbSelect = document.getElementById('inp-suburb');
  
  if (citySelect) {
    citySelect.addEventListener('change', () => {
      if (!suburbSelect) return;
      suburbSelect.innerHTML = '<option value="">Select Suburb</option>';
      const subList = ZIM_LOCATIONS[citySelect.value] || [];
      subList.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        suburbSelect.appendChild(opt);
      });
    });
    
    if (citySelect.value && suburbSelect) {
      const subList = ZIM_LOCATIONS[citySelect.value] || [];
      suburbSelect.innerHTML = '<option value="">Select Suburb</option>';
      subList.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        suburbSelect.appendChild(opt);
      });
    }
  }
  
  const typeSelect = document.getElementById('inp-type');
  if (typeSelect && !typeSelect.options.length) {
    PROPERTY_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      typeSelect.appendChild(opt);
    });
  }
}

let _pickerMap = null;
let _pickerMarker = null;

// Initialise the Leaflet map picker on the add/edit listing form.
function initMapPicker() {
  const mapEl = document.getElementById('picker-map');
  if (!mapEl || typeof L === 'undefined') return;

  const suburbSelect = document.getElementById('inp-suburb');
  const startCoords = suburbSelect && suburbSelect.value && typeof getSuburbCoords === 'function'
    ? getSuburbCoords(suburbSelect.value)
    : (typeof DEFAULT_CITY_COORDS !== 'undefined' ? DEFAULT_CITY_COORDS : { lat: -20.15, lng: 28.58 });

  _pickerMap = L.map('picker-map').setView([startCoords.lat, startCoords.lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(_pickerMap);

  _pickerMarker = L.marker([startCoords.lat, startCoords.lng], { draggable: true }).addTo(_pickerMap);

  // Click anywhere to move the pin.
  _pickerMap.on('click', (e) => setPickerCoords(e.latlng.lat, e.latlng.lng));
  // Dragging the pin updates the coords too.
  _pickerMarker.on('dragend', (e) => {
    const ll = e.target.getLatLng();
    setPickerCoords(ll.lat, ll.lng);
  });

  // Re-centre the pin when the suburb changes.
  if (suburbSelect) {
    suburbSelect.addEventListener('change', () => {
      if (!suburbSelect.value || typeof getSuburbCoords !== 'function') return;
      const c = getSuburbCoords(suburbSelect.value);
      _pickerMap.setView([c.lat, c.lng], 15);
      setPickerCoords(c.lat, c.lng);
    });
  }

  // "Reset to suburb centre" button.
  const resetBtn = document.getElementById('reset-pin-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const suburb = suburbSelect ? suburbSelect.value : '';
      const c = typeof getSuburbCoords === 'function' ? getSuburbCoords(suburb) : DEFAULT_CITY_COORDS;
      _pickerMap.setView([c.lat, c.lng], 15);
      setPickerCoords(c.lat, c.lng);
    });
  }

  // Set the initial pin + hidden fields.
  setPickerCoords(startCoords.lat, startCoords.lng);

  setTimeout(() => _pickerMap && _pickerMap.invalidateSize(), 200);
}

// Move the picker pin to (lat, lng), update hidden inputs + readout.
function setPickerCoords(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return;

  if (_pickerMarker && _pickerMap) {
    _pickerMarker.setLatLng([latNum, lngNum]);
  }

  const latInput = document.getElementById('inp-latitude');
  const lngInput = document.getElementById('inp-longitude');
  if (latInput) latInput.value = latNum;
  if (lngInput) lngInput.value = lngNum;

  const readout = document.getElementById('picker-coords');
  if (readout) {
    readout.innerHTML = '<i class="fas fa-map-pin" style="color:var(--primary);"></i> ' +
      latNum.toFixed(5) + ', ' + lngNum.toFixed(5);
  }
}

function initImageUpload() {
  const dropArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('inp-images');
  
  if (!dropArea || !fileInput) return;
  
  dropArea.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', async (e) => {
    const images = await processImages(e.target);
    window._tempImages = [...(window._tempImages || []), ...images];
    renderUploadPreview();
  });
  
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = 'var(--primary)';
  });
  
  dropArea.addEventListener('dragleave', () => {
    dropArea.style.borderColor = 'var(--border)';
  });
  
  dropArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropArea.style.borderColor = 'var(--border)';
    fileInput.files = e.dataTransfer.files;
    const images = await processImages(fileInput);
    window._tempImages = [...(window._tempImages || []), ...images];
    renderUploadPreview();
  });
}

function renderUploadPreview() {
  const container = document.getElementById('upload-preview');
  if (!container) return;
  
  const images = window._tempImages || [];
  container.innerHTML = images.map((img, i) => `
    <div class="upload-thumb">
      <img src="${img.data}" alt="Preview ${i+1}">
      <button type="button" class="remove-img" onclick="removeImage(${i})" aria-label="Remove image ${i+1}">×</button>
    </div>
  `).join('');
}

function removeImage(index) {
  if (window._tempImages) {
    window._tempImages.splice(index, 1);
    renderUploadPreview();
  }
}

function prefillForm(listing) {
  document.querySelector('.form-card h2').textContent = 'Edit Property';
  document.getElementById('inp-title').value = listing.title;
  document.getElementById('inp-city').value = listing.city;
  document.getElementById('inp-suburb').value = listing.suburb;
  document.getElementById('inp-type').value = listing.type;
  document.getElementById('inp-bedrooms').value = listing.bedrooms;
  document.getElementById('inp-bathrooms').value = listing.bathrooms;
  document.getElementById('inp-price').value = listing.price;
  document.getElementById('inp-currency').value = listing.currency;
  document.getElementById('inp-wifi').checked = !!listing.wifi;
  document.getElementById('inp-electric-stove').checked = !!listing.electricStove;
  document.getElementById('inp-gas-stove').checked = !!listing.gasStove;
  document.getElementById('inp-fridge').checked = !!listing.fridge;
  document.getElementById('inp-solar').checked = listing.solar;
  document.getElementById('inp-borehole').checked = listing.borehole;
  document.getElementById('inp-fenced').checked = listing.fenced;
  document.getElementById('inp-description').value = listing.description;
  document.getElementById('inp-custom').value = listing.customAdditions || '';
  document.getElementById('inp-phone').value = listing.phone || '';
  document.getElementById('inp-email').value = listing.email || '';
  document.getElementById('inp-whatsapp').value = listing.whatsapp || '';
  window._tempImages = [...(listing.images || [])];
  renderUploadPreview();

  // Restore the map pin if the property already has coordinates.
  if (typeof setPickerCoords === 'function') {
    if (listing.latitude !== null && listing.latitude !== undefined &&
        listing.longitude !== null && listing.longitude !== undefined) {
      setPickerCoords(parseFloat(listing.latitude), parseFloat(listing.longitude));
    } else if (typeof getSuburbCoords === 'function') {
      const c = getSuburbCoords(listing.suburb);
      setPickerCoords(c.lat, c.lng);
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop();
  if (page === 'dashboard.html') initDashboard();
  else if (page === 'add-listing.html') initAddListing();
});