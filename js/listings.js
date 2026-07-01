/* ==========================================
   ZIMRENT — Listings Page: Browse & Filter
   ========================================== */

const ZIM_LOCATIONS = {
  'Harare': [
    'Alexandra Park', 'Amalinda', 'Amby', 'Arcadia', 'Arlington', 'Ashbrittle', 'Athlone', 'Avondale', 'Avondale West', 'Avonlea',
    'Ballantyne Park', 'Belgravia', 'Belvedere', 'Beverley', 'Beverley West', 'Bloomingdale', 'Borrowdale', 'Borrowdale Brooke', 'Borrowdale West', 'Braeside',
    'Budiriro', 'Caledonia', 'Chadcombe', 'Chikurubi', 'Chisipite', 'Chizhanje', 'Colne Valley', 'Colray', 'Coronation Park', 'Crowborough',
    'Dawn Hill', 'Donnybrook', 'Dzivarasekwa',
    'Eastlea', 'Eastview', 'Emerald Hill',
    'Glen Lorne', 'Glen Norah A', 'Glen Norah B', 'Glen Norah C', 'Glen View 1', 'Glen View 2', 'Glen View 3', 'Glen View 4', 'Glen View 5', 'Glen View 7', 'Glen View 8', 'Glenwood', 'Greencroft', 'Greendale', 'Greendale North', 'Green Grove', 'Greystone Park', 'Groombridge',
    'Hatcliffe', 'Hatcliffe Extension', 'Helensvale', 'Highlands', 'Hillside', 'Hogerty Hill', 'Hopley', 'Houghton Park',
    'Induna Park',
    'Kambanji', 'Kambuzuma', 'Kensington', 'Kuwadzana', 'Kuwadzana Extension',
    'Letombo Park', 'Lewisam', 'Lochinvar', 'Logan Park', 'Lorraine',
    'Mabvuku', 'Mainway Meadows', 'Malbereign', 'Malvern', 'Mandara', 'Manresa', 'Marlborough', 'Marlborough East', 'Mbare', 'Meyrick Park', 'Milton Park', 'Monavale', 'Montrose', 'Mount Hampden', 'Mount Pleasant', 'Mount Pleasant Heights', 'Msasa', 'Msasa Park',
    'Newlands', 'New Marlborough', 'New Alexandra Park', 'New Bluff Hill', 'Northwood',
    'Park Meadows', 'Parktown', 'Philadelphia', 'Pomona', 'Prospect',
    'Quinnington',
    'Rhodesville', 'Rietfontein', 'Rockview', 'Rolf Valley', 'Rugare', 'Runiville',
    'Sandton Park', 'Southerton', 'Shortstone', 'Strathaven', 'Sunningdale',
    'Tafara', 'Tynwald', 'Tynwald North', 'Tynwald South',
    'Umwinsdale', 'Uplands',
    'Vainona',
    'Warren Park', 'Warren Park D', 'Waterfalls', 'Westgate', 'Westlea', 'Willowvale', 'Workington'
  ],
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
  ],
  'Mutare': [
    'Alexander Park', 'Avenues',
    'Boulders',
    'Chikanga', 'Chikanga Phase 1', 'Chikanga Phase 2', 'Chikanga Phase 3', 'Darlington', 'Dangamvura',
    'Fairbridge Park', 'Fern Valley',
    'Gimboki', 'Greenside',
    'Hillcrest', 'Hobhouse', 'Hospital Hill',
    'Morningside', 'Murambi', 'Murambi Heights',
    'Natview',
    'Palmerston', 'Palmerston North', 'Penhalonga Road',
    'Riverside',
    'Sakubva', 'Springvale',
    "Tiger's Kloof",
    'Utopia',
    'Vumba Road',
    'Weirmouth',
    'Yeovil'
  ],
  'Gweru': [
    'Ascot', 'Ascot Extension', 'Athlone',
    'Belmont Industrial', 'CBC', 'Chicago', 'Clonsilla', 'Daylesford',
    'Eastview', 'Fairmile', 'Fairview', 'Garden Park', 'Grange',
    'Heavy Industrial Area', 'Hertfordshire', 'Hertslet', 'Ivene',
    'Kopje',
    'Light Industrial Area', 'Lundi Park',
    'Mambo', 'Midlands Industrial Park', 'Mkoba 1', 'Mkoba 2', 'Mkoba 3', 'Mkoba 4', 'Mkoba 5', 'Mkoba 6', 'Mkoba 7', 'Mkoba 8', 'Mkoba 9', 'Mkoba 10', 'Monomotapa', 'Mtapa',
    'New Christmas Gift',
    'Northgate Heights',
    'Ridgemont', 'Riverside',
    'Senga', 'Shamrock Park', 'Southdowns', 'Southdowns Industrial', 'Southview', 'Sunnyside',
    'Thornhill',
    'Westgate', 'Windsor Park', 'Woodlands'
  ],
  'Kwekwe': [
    'Amaveni', 'Amaveni East',
    'Broadlands',
    'CBD Residential', 'Chicago', 'Chicago Extension', 'Clonsilla',
    'Fitchlea',
    'Gaika', 'Globe and Phoenix Industrial Area', 'Golden Acres',
    'Hazeldene', 'Hillandale',
    'Kwekwe East', 'Kwekwe Industrial Area',
    'Mbizo 1', 'Mbizo 2', 'Mbizo 3', 'Mbizo 4', 'Mbizo 5', 'Mbizo 6', 'Mbizo 7', 'Mbizo 8', 'Mbizo 9', 'Mbizo 10', 'McMahon',
    'Newtown', 'Northlea',
    'Palm Grove',
    'Queens Park',
    'Redcliff', 'Redcliff Industrial Area', 'Riverside', 'Rutendo',
    'Southview', 'Steelworks Industrial Area',
    'Torwood',
    'ZISCO Industrial Area', 'Zhombe View'
  ],
  'Masvingo': [
    'Beitdale', 'Bushmead',
    'Chevron', 'Clipsham', 'Clipsham Views',
    'Eastvale', 'Eastvale Extension',
    'Garikai', 'Golf Course',
    'Heavy Industrial Area', 'Hillside',
    'Kelvin North Industrial Area',
    'Light Industrial Area',
    'Masvingo Industrial Area', 'Morning Side', 'Mucheke A', 'Mucheke B', 'Mucheke D', 'Morningside',
    'Ndarama',
    'Presidents Park',
    'Rhodene', 'Rhodene East', 'Rhodene North', 'Rhodene West', 'Rhodene Extension', 'Rujeko', 'Runyararo', 'Runyararo West',
    'Target Kop',
    'Victoria Ranch',
    'Zimre Park'
  ],
  'Chitungwiza': [
    'Chitungwiza Industrial Area',
    'Makoni Shopping Centre',
    'Manyame Park',
    'Seke Road',
    'Seke Unit A', 'Seke Unit B', 'Seke Unit C', 'Seke Unit D', 'Seke Unit E', 'Seke Unit F', 'Seke Unit G', 'Seke Unit H', 'Seke Unit J', 'Seke Unit K',
    'St Mary\'s',
    'Town Centre',
    'Unit L', 'Unit O',
    'Zengeza', 'Zengeza 1', 'Zengeza 2', 'Zengeza 3', 'Zengeza 4', 'Zengeza 5', 'Zengeza 6', 'Zengeza 7', 'Zengeza 8', 'Zengeza 9', 'Zengeza 10'
  ],
  'Marondera': [
    'Cherima', 'Cherutombo',
    'Dombotombo',
    'Harare-Mutare Road',
    'Kingsmead',
    'Mabvazuva',
    'Mahusekwa Road',
    'Nyameni',
    'Ratidzo',
    'Rujeko', 'Rusike', 'Ruzawi Park',
    'Waddilove'
  ],
  'Bindura': [
    'Bindura Industrial Area',
    'Chipadze',
    'Chiwaridzo',
    'Dombotombo',
    'Garikai',
    'Greenhill',
    'Mazowe Road',
    'Rushinga Road',
    'Trojan Mine',
    'University of Bindura'
  ],
  'Chegutu': [
    'Chegutu', 'Chegutu Industrial Area',
    'Chinengundu',
    'Hartley Avenue', 'Hartley Hills',
    'Hintonville',
    'Kaguvi',
    'Outskirts',
    'Pfupajena',
    'Railway Line',
    'Rifle Range',
    'Umvovo'
  ],
  'Kadoma': [
    'Chegutu Road', 'Davies Park',
    'Eastview', 'Eiffel Flats',
    'Gadzema',
    'Ingezi',
    'Kadoma Heights', 'Kadoma Industrial Area',
    'Overspill',
    'Rimuka',
    'Sanyati Road',
    'Waverly',
    'Westview'
  ],
  'Gwanda': [
    'CBD',
    'Filabusi Road', 'Filabusi Road estates',
    'Gwanda CBD', 'Gwanda Industrial Area',
    'Jahunda',
    'Makwe', 'Mining Service Zones',
    'Nkululeko',
    'Old Gwanda',
    'Phakama',
    'Railway Line', 'River Ranch',
    'Spitzkop',
    'West Nicholson Road'
  ],
  'Norton': [
    'Chikonohono',
    'Farm Residential',
    'Harare-Bulawayo Highway',
    'Katanga',
    'Knowe',
    'Londonderry',
    'Ngoni',
    'Norton Farm Estates', 'Norton Golf Course', 'Norton Industrial Area', 'Norton Town',
    'Railway Line',
    'Seki',
    'Trelawney Park', 'Trelawney Road'
  ],
  'Mazowe': [
    'Chiweshe',
    'Christon Bank',
    'Glendale',
    'Mazowe Bridge', 'Mazowe Citrus Estates', 'Mazowe Estates', 'Mazowe River', 'Mazowe Town', 'Mazowe Valley',
    'Mining Service Areas',
    'Mvurwi Road',
    'Rafingora'
  ],
  'Ruwa': [
    'Arcturus Road',
    'Damofalls',
    'Mabvazuva',
    'Ruwa Golf Course', 'Ruwa Industrial Area',
    'Springvale', 'Springfield Park',
    'Sunway City',
    'Timire Park',
    'Windsor Park'
  ],
  'Beitbridge': [
    'Basani',
    'Beitbridge Border Post',
    'Beitbridge CBD',
    'Beitbridge Industrial Area',
    'Beitbridge Town',
    'Border Post',
    'Dite',
    'Dulivhadzimu',
    'Freight Depots',
    'Highway Logistics Corridor',
    'Limpopo River',
    'Mahomva',
    'Mtetengwe',
    'River Ranch'
  ],
  'Victoria Falls': [
    'Aerodrome',
    'Baobab',
    'Chinotimba',
    'Golf Estate',
    'Kazungula Road',
    'Livingstone Way',
    'Mkhosana', 'Mkhosana Old',
    'Ndlovu Extension',
    'Riverside',
    'Victoria Falls CBD',
    'Victoria Falls Private Estates',
    'Wood Road',
    'Zambezi National Park area'
  ],
  'Rusape': [
    'Dangamvura Extension',
    'Nyanga Road', 'Nyazura Road',
    'Outskirts',
    'Rusape CBD', 'Rusape Industrial Area',
    'Tsanzaguru',
    'Vengere'
  ],
  'Other': ['Rural', 'Out of Town']
};

const PROPERTY_TYPES = ['House', 'Apartment', 'Townhouse', 'Cottage', 'Stand', 'Commercial'];

async function fetchListingsFromAPI() {
  const headers = { 'Content-Type': 'application/json' };
  const session = getSession ? getSession() : null;
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;
  
  const res = await fetch('/api/properties', { headers });
  if (!res.ok) throw new Error('Failed to fetch listings');
  const data = await res.json();
  return data.properties || [];
}

function initListingsPage() {
  fetchListingsFromAPI().then(listings => {
    populateCities();
    populateBedrooms();
    populatePropertyTypes();
    populateCurrencies();
    renderListings(listings);
  }).catch(err => {
    console.error('Failed to load listings:', err);
  });
  
  document.getElementById('filter-city').addEventListener('change', applyFilters);
  document.getElementById('filter-suburb').addEventListener('change', applyFilters);
  document.getElementById('filter-bedrooms').addEventListener('change', applyFilters);
  document.getElementById('filter-type').addEventListener('change', applyFilters);
  document.getElementById('filter-currency').addEventListener('change', applyFilters);
  document.getElementById('filter-solar').addEventListener('change', applyFilters);
  document.getElementById('filter-borehole').addEventListener('change', applyFilters);
  document.getElementById('filter-fenced').addEventListener('change', applyFilters);
  document.getElementById('filter-min-price').addEventListener('input', debounce(applyFilters, 500));
  document.getElementById('filter-max-price').addEventListener('input', debounce(applyFilters, 500));
  
  document.getElementById('reset-filters').addEventListener('click', resetFilters);
  
  const searchQuery = sessionStorage.getItem('zimrent_search');
  if (searchQuery) {
    sessionStorage.removeItem('zimrent_search');
    const query = JSON.parse(searchQuery);
    document.getElementById('filter-city').value = query.city || '';
    document.getElementById('filter-bedrooms').value = query.bedrooms || '';
    applyFilters();
  }
}

function populateCities() {
  const select = document.getElementById('filter-city');
  if (!select) return;
  const cities = ['All Cities', ...Object.keys(ZIM_LOCATIONS).sort()];
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city === 'All Cities' ? '' : city;
    opt.textContent = city;
    select.appendChild(opt);
  });
  
  select.addEventListener('change', () => {
    const city = select.value;
    const suburbSelect = document.getElementById('filter-suburb');
    suburbSelect.innerHTML = '<option value="">All Suburbs</option>';
    if (city && ZIM_LOCATIONS[city]) {
      const suburbs = ZIM_LOCATIONS[city].sort();
      suburbs.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        suburbSelect.appendChild(opt);
      });
    }
  });
}

function populateBedrooms() {
  const select = document.getElementById('filter-bedrooms');
  if (!select) return;
  for (let i = 1; i <= 6; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i}+ Bedrooms`;
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
  const city = document.getElementById('filter-city').value;
  const suburb = document.getElementById('filter-suburb').value;
  const bedrooms = document.getElementById('filter-bedrooms').value;
  const type = document.getElementById('filter-type').value;
  const currency = document.getElementById('filter-currency').value;
  const solar = document.getElementById('filter-solar').value;
  const borehole = document.getElementById('filter-borehole').value;
  const fenced = document.getElementById('filter-fenced').value;
  const minPrice = parseFloat(document.getElementById('filter-min-price').value) || 0;
  const maxPrice = parseFloat(document.getElementById('filter-max-price').value) || Infinity;
  
  const filtered = currentListings.filter(l => {
    if (city && l.city !== city) return false;
    if (suburb && l.suburb !== suburb) return false;
    if (bedrooms && l.bedrooms < parseInt(bedrooms)) return false;
    if (type && l.type !== type) return false;
    if (currency && l.currency !== currency) return false;
    if (solar === 'yes' && !l.solar) return false;
    if (solar === 'no' && l.solar) return false;
    if (borehole === 'yes' && !l.borehole) return false;
    if (borehole === 'no' && l.borehole) return false;
    if (fenced === 'yes' && !l.fenced) return false;
    if (fenced === 'no' && l.fenced) return false;
    if (l.price < minPrice) return false;
    if (l.price > maxPrice) return false;
    return true;
  });
  
  renderListings(filtered);
}

function resetFilters() {
  document.getElementById('filter-city').value = '';
  document.getElementById('filter-suburb').value = '';
  document.getElementById('filter-bedrooms').value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-currency').value = '';
  document.getElementById('filter-solar').value = '';
  document.getElementById('filter-borehole').value = '';
  document.getElementById('filter-fenced').value = '';
  document.getElementById('filter-min-price').value = '';
  document.getElementById('filter-max-price').value = '';
  renderListings(currentListings);
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
    <div class="property-card" onclick="viewProperty('${l.id}')">
      <div class="card-img">
        ${l.images && l.images.length > 0 
          ? `<img src="${l.images[0].data}" alt="${escapeHtml(l.title)}">` 
          : `<div class="card-img-placeholder"><i class="fas fa-home" style="font-size:3rem; color:#ccc;"></i></div>`
        }
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
          ${l.fenced ? '<span class="amenity-badge yes">Fenced</span>' : ''}
          <span class="amenity-badge">${l.bedrooms} Bed</span>
          <span class="amenity-badge">${l.type}</span>
      </div>
        <button class="card-action">View Details</button>
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
  currentListings = [];
  initListingsPage();
});