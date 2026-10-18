/* ==========================================
   HOMIFY - Listings Page: Browse & Filter
   ========================================== */

/* Shared catalogs. `var` (not const) on purpose: add-listing.html loads both
   listings.js and dashboard.js as classic scripts, and two top-level `const`
   declarations with the same name throw "already been declared". `var` simply
   re-assigns the identical value — harmless. */
var ZIM_LOCATIONS = {
  'Bulawayo': [
    'Barbourfields', 'Bellevue', 'Belmont', 'Belmont East', 'Bon Accord', 'Boroughs', 'Bradfield', 'Burnside', 'Buena Vista', 'Caledonia',
    'Cement', 'Cowdray Park', 'Donnington', 'Douglasdale', 'Dromore',
    'Emakhandeni', 'Emganwini', 'Entumbane', 'Entumbane West', 'Essexvale',
    'Famona', 'Fortunes Gate', 'Glencoe', 'Glengarry', 'Greenhill', 'Greenvale', 'Gwabalanda',
    'Harrisvale', 'Helenvale', 'Hillcrest', 'Hillside', 'Hope Fountain', 'Hopley', 'Hyde Park',
    'Ilanda', 'Ilminster',
    'Jacobsville',
    'Kabanga', 'Kelvin', 'Khami', 'Khumalo', 'Killarney', 'Kingsdale', 'Kumalo',
    'Lakeview', 'Lobengula', 'Lobengula West', 'Lochview', 'Luveve', 'Luveve North',
    'Magwegwe', 'Magwegwe North', 'Magwegwe West', 'Mahatshula', 'Mahatshula North', 'Makokoba', 'Malindela', 'Manningdale', 'Matsheumhlope', 'Mbizo', 'Morningside', 'Montgomery', 'Montrose', 'Mpopoma', 'Mqabuko Heights', 'Msasa Industrial', 'Mzilikazi',
    'Newton', 'Newton West', 'Njube', 'Nketa', 'Nkulumane', 'Norwood', 'North End', 'North Lynne', 'North Trenance', 'Ntaba Moyo',
    'Paddonhurst', 'Parklands', 'Parkview', 'Pumula', 'Pumula South', 'Queens Park', 'Queens Park East', 'Queens Park West',
    'Rangemore', 'Richmond', 'Riverside', 'Riverside South', 'Romney Park', 'RoMich', 'Roslyn', 'Rugare',
    'Sauerstown', 'Selbourne Park', 'Selbourne Brooke', 'Sizinda', 'Southdale', 'Southlea Park', 'Southwold', 'Steeldale', 'Strathaven', 'Suburbs', 'Sunningdale', 'Sunnyside', 'Tafara', 'Tegela', 'The Jungle', 'Thorngrove', 'Thorngrove Industrial', 'Trenance', 'Tshabalala', 'Tshabalala Extension', 'Tynwald',
    'Upper Rangemore',
    'Vainona',
    'Warren Park', 'Waterfalls', 'Waterford', 'Waterlea', 'West Somerton', 'Westgate', 'Westlea', 'Westondale', 'Westondale Industrial', 'Whitestone', 'Willsgrove', 'Willsgrove Park', 'Windsor Park', 'Woodlands', 'Woodville', 'Woodville Park', 'Workington'
  ]
};

var PROPERTY_TYPES = ['House', 'Apartment', 'Cottage', 'Townhouse', 'Room'];

async function fetchListingsFromAPI() {
  const headers = { 'Content-Type': 'application/json' };
  const session = getSession ? getSession() : null;
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
  
  const res = await fetch('/api/properties', { headers });
  if (!res.ok) throw new Error('Failed to fetch listings');
  const data = await res.json();
  return data.properties || [];
}

function showListingSkeletons(count) {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  const n = count || 6;
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `
      <div class="skeleton-card" aria-hidden="true">
        <div class="sk-img skeleton"></div>
        <div class="sk-body">
          <div class="sk-line w40 skeleton"></div>
          <div class="sk-line w80 skeleton"></div>
          <div class="sk-line w60 skeleton"></div>
        </div>
      </div>`;
  }
  grid.innerHTML = html;
}

function initListingsPage() {
  // Show loading placeholders immediately, before data arrives.
  showListingSkeletons(6);
  fetchListingsFromAPI().then(listings => {
    populateSuburbs();
    populateBedrooms();
    populatePropertyTypes();
    populateCurrencies();
    renderListings(listings);
  }).catch(err => {
    console.error('Failed to load listings:', err);
  });
  
  document.getElementById('filter-suburb').addEventListener('change', applyFilters);
  document.getElementById('filter-bedrooms').addEventListener('change', applyFilters);
  document.getElementById('filter-type').addEventListener('change', applyFilters);
  document.getElementById('filter-currency').addEventListener('change', applyFilters);
  document.getElementById('filter-wifi').addEventListener('change', applyFilters);
  document.getElementById('filter-electric-stove').addEventListener('change', applyFilters);
  document.getElementById('filter-gas-stove').addEventListener('change', applyFilters);
  document.getElementById('filter-fridge').addEventListener('change', applyFilters);
  document.getElementById('filter-solar').addEventListener('change', applyFilters);
  document.getElementById('filter-borehole').addEventListener('change', applyFilters);
  document.getElementById('filter-fenced').addEventListener('change', applyFilters);
  document.getElementById('filter-min-price').addEventListener('input', debounce(applyFilters, 500));
  document.getElementById('filter-max-price').addEventListener('input', debounce(applyFilters, 500));
  
  document.getElementById('reset-filters').addEventListener('click', resetFilters);

  // Mobile: collapsible filters bar (panel flows horizontally when open)
  const filtersToggle = document.querySelector('.filters-toggle');
  const filtersPanel = document.getElementById('filters-panel');
  if (filtersToggle && filtersPanel) {
    filtersToggle.addEventListener('click', function () {
      const open = filtersPanel.classList.toggle('is-open');
      filtersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  
  const searchQuery = sessionStorage.getItem('homify_search');
  if (searchQuery) {
    sessionStorage.removeItem('homify_search');
    const query = JSON.parse(searchQuery);
    if (query.suburb) {
      // Match the typed suburb against known options (case-insensitive)
      const suburbSelect = document.getElementById('filter-suburb');
      const match = Array.from(suburbSelect.options).find(o => o.value && o.value.toLowerCase() === query.suburb.toLowerCase());
      if (match) suburbSelect.value = match.value;
    }
    document.getElementById('filter-bedrooms').value = query.bedrooms || '';
    applyFilters();
  }
}

function populateSuburbs() {
  const select = document.getElementById('filter-suburb');
  if (!select) return;
  select.innerHTML = '<option value="">All Suburbs</option>';
  const suburbs = Object.values(ZIM_LOCATIONS).flat().sort();
  suburbs.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub;
    opt.textContent = sub;
    select.appendChild(opt);
  });
}

function populateBedrooms() {
  const select = document.getElementById('filter-bedrooms');
  if (!select) return;
  for (let i = 1; i <= 4; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Room for ${i}`;
    select.appendChild(opt);
  }
}

function populatePropertyTypes() {
  const select = document.getElementById('filter-type');
  if (!select) return;
  select.innerHTML = '<option value="">All Types</option>';
  PROPERTY_TYPES.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
}

function populateCurrencies() {
  const select = document.getElementById('filter-currency');
  if (!select) return;
  select.innerHTML = '<option value="">All Currencies</option>';
  ['USD', 'ZAR', 'ZiG'].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

let currentListings = [];

function applyFilters() {
  const suburb = document.getElementById('filter-suburb').value;
  const bedrooms = document.getElementById('filter-bedrooms').value;
  const type = document.getElementById('filter-type').value;
  const currency = document.getElementById('filter-currency').value;
  const wifi = document.getElementById('filter-wifi').checked;
  const electricStove = document.getElementById('filter-electric-stove').checked;
  const gasStove = document.getElementById('filter-gas-stove').checked;
  const fridge = document.getElementById('filter-fridge').checked;
  const solar = document.getElementById('filter-solar').checked;
  const borehole = document.getElementById('filter-borehole').checked;
  const fenced = document.getElementById('filter-fenced').checked;
  const minPrice = parseFloat(document.getElementById('filter-min-price').value) || 0;
  const maxPrice = parseFloat(document.getElementById('filter-max-price').value) || Infinity;
  
  const filtered = currentListings.filter(l => {
    if (suburb && l.suburb !== suburb) return false;
    if (bedrooms && l.bedrooms < parseInt(bedrooms)) return false;
    if (type && l.type !== type) return false;
    if (currency && l.currency !== currency) return false;
    if (wifi && !l.wifi) return false;
    if (electricStove && !l.electricStove) return false;
    if (gasStove && !l.gasStove) return false;
    if (fridge && !l.fridge) return false;
    if (solar && !l.solar) return false;
    if (borehole && !l.borehole) return false;
    if (fenced && !l.fenced) return false;
    if (l.price < minPrice) return false;
    if (l.price > maxPrice) return false;
    return true;
  });
  
  renderListings(filtered);
  updateFilterCount();
}

// Update the mobile "Filters" badge with how many filters are active
function updateFilterCount() {
  const badge = document.getElementById('filters-count');
  if (!badge) return;
  let n = 0;
  ['filter-suburb', 'filter-bedrooms', 'filter-type', 'filter-currency'].forEach(id => {
    if (document.getElementById(id).value) n++;
  });
  ['filter-wifi', 'filter-electric-stove', 'filter-gas-stove', 'filter-fridge', 'filter-solar', 'filter-borehole', 'filter-fenced'].forEach(id => {
    if (document.getElementById(id).checked) n++;
  });
  if (document.getElementById('filter-min-price').value) n++;
  if (document.getElementById('filter-max-price').value) n++;
  badge.textContent = n;
  badge.hidden = n === 0;
}

function resetFilters() {
  document.getElementById('filter-suburb').value = '';
  document.getElementById('filter-bedrooms').value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-currency').value = '';
  ['filter-wifi', 'filter-electric-stove', 'filter-gas-stove', 'filter-fridge', 'filter-solar', 'filter-borehole', 'filter-fenced']
    .forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
  document.getElementById('filter-min-price').value = '';
  document.getElementById('filter-max-price').value = '';
  renderListings(currentListings);
  updateFilterCount();
}

function imgSrc(img) {
  if (!img) return '';
  return (typeof img === 'string') ? img : (img.data || '');
}

// If a listing image fails to load (bad URL, deleted object), swap in the
// generic placeholder instead of leaving a broken-image icon + alt text.
// Only the <img> is removed so the overlaid verified tag survives.
function cardImgFallback(el) {
  if (!el || !el.parentElement) return;
  const placeholder = document.createElement('div');
  placeholder.className = 'card-img-placeholder';
  placeholder.innerHTML = '<i class="fas fa-home" style="font-size:3rem; color:#ccc;"></i>';
  el.parentElement.insertBefore(placeholder, el);
  el.remove();
}

function renderListings(listings) {
  const grid = document.getElementById('listings-grid');
  const count = document.getElementById('listings-count');
  
  if (!grid) return;
  
  count.textContent = `${listings.length} listing${listings.length !== 1 ? 's' : ''} found`;
  
  if (listings.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 1rem;"><i class="fas fa-home" style="color:#ccc;"></i></div>
        <h3>No properties found</h3>
        <p>Try adjusting your filters or search criteria.</p>
      </div>
    `;
    return;
  }
  
  currentListings = listings;
  grid.innerHTML = listings.map(l => `
    <div class="property-card" role="button" tabindex="0" onclick="viewProperty('${l.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewProperty('${l.id}');}">
      <div class="card-img">
        ${l.images && l.images.length > 0 
          ? `<img src="${imgSrc(l.images[0])}" alt="${escapeHtml(l.title)}" loading="lazy" onerror="cardImgFallback(this)">` 
          : `<div class="card-img-placeholder"><i class="fas fa-home" style="font-size:3rem; color:#ccc;"></i></div>`
        }
        ${l.status === 'approved' ? '<span class="verified-tag"><i class="fas fa-circle-check"></i> Verified</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-price">
          <span class="currency">${l.currency}</span> ${l.price.toLocaleString()}<span style="font-size:0.8rem; color:var(--text-muted); font-weight:400">/mo</span>
        </div>
        <div class="card-title">${escapeHtml(l.title)}</div>
      <div class="card-location">
          <i class="fas fa-map-marker-alt" style="color:var(--text-muted);"></i> ${escapeHtml(l.city)}, ${escapeHtml(l.suburb)}
      </div>
      <div class="card-amenities">
          ${l.solar ? '<span class="amenity-badge yes">Solar</span>' : ''}
          ${l.borehole ? '<span class="amenity-badge yes">Borehole</span>' : ''}
          ${l.wifi ? '<span class="amenity-badge yes">Wi-Fi</span>' : ''}
          ${l.fenced ? '<span class="amenity-badge yes">Fenced</span>' : ''}
          <span class="amenity-badge">Room for ${l.bedrooms}</span>
          <span class="amenity-badge">${l.type}</span>
      </div>
        <span class="card-action" aria-hidden="true">View Details</span>
      </div>
    </div>
  `).join('');
}

function viewProperty(id) {
  sessionStorage.setItem('current_listing_id', id);
  window.location.href = 'property.html';
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  // Only initialise the browse/listings page. Running initListingsPage() on
  // other pages (e.g. add-listing.html) makes an unnecessary API call and can
  // reference elements that don't exist there.
  if (window.location.pathname.split('/').pop() !== 'listings.html') return;

  currentListings = [];
  initListingsPage();
});