/* ==========================================
   HOMIFY - Shared Utilities & Data Management
   ========================================== */

const STORAGE_KEY = 'homify_listings';

// No sample data - start with empty listings
const sampleListings = [];

// --- Initialize Data ---
function initData() {
  // Clear any existing data for fresh deployment
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleListings));
}

// --- CRUD Operations ---
function getAllListings() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function getListing(id) {
  return getAllListings().find(l => l.id === id);
}

function getLandlordListings(landlordId) {
  return getAllListings().filter(l => l.landlordId === landlordId);
}

function getCurrentUserId() {
  const user = getCurrentUser ? getCurrentUser() : null;
  return user ? user.id : null;
}

function saveListing(listing) {
  const listings = getAllListings();
  const index = listings.findIndex(l => l.id === listing.id);
  if (index >= 0) {
    listings[index] = listing;
  } else {
    listings.push(listing);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}

function deleteListing(id) {
  const listings = getAllListings().filter(l => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}

function generateId() {
  return 'listing-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// --- Utilities ---
function formatPrice(price, currency) {
  return `${price.toLocaleString()} ${currency}`;
}

function getWhatsAppLink(phone) {
  const clean = phone.replace(/[^0-9+]/g, '');
  return `https://wa.me/${clean.replace('+', '')}`;
}

function getCurrencySymbol(currency) {
  switch (currency) {
    case 'USD': return '$';
    case 'ZAR': return 'R';
    case 'ZiG': return 'ZWL';
    default: return currency;
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Navigation ---
function navigateTo(page) {
  const pages = {
    'home': 'index.html',
    'listings': 'listings.html',
    'dashboard': 'dashboard.html',
    'add-listing': 'add-listing.html'
  };
  if (pages[page]) {
    window.location.href = pages[page];
  }
}

// --- Image Helpers ---
// Read and resize images before sending them to the API. The previous
// implementation used a fixed 300ms timer, which could submit before large
// files had finished reading, and sent full-resolution originals as huge JSON.
async function processImages(fileInput) {
  const files = Array.from(fileInput && fileInput.files ? fileInput.files : []);
  if (!files.length) return [];

  if (files.length > 10) {
    throw new Error('Please select no more than 10 images at a time.');
  }

  return Promise.all(files.map(file => new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error(file.name + ' is not a supported image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read ' + file.name + '. Please try again.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not process ' + file.name + '. Try a JPG or PNG image.'));
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Your browser could not prepare the image. Please try another browser.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // JPEG gives predictable, substantially smaller uploads than raw camera images.
        const data = canvas.toDataURL('image/jpeg', 0.78);
        resolve({ data, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  })));
}

if (!localStorage.getItem(STORAGE_KEY)) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleListings));
}

// --- Init on page load ---
document.addEventListener('DOMContentLoaded', () => {
  // Don't clear existing data on every page load
});
