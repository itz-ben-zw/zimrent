/* ==========================================
   ZIMRENT — Shared Utilities & Data Management
   ========================================== */

const STORAGE_KEY = 'zimrent_listings';

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
function processImages(fileInput) {
  return new Promise((resolve) => {
    const images = [];
    const files = fileInput.files;
    if (!files || files.length === 0) {
      resolve(images);
      return;
    }

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        images.push({
          data: e.target.result,
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    });

    // Small delay to ensure all readers complete
    setTimeout(() => resolve(images), 300);
  });
}

if (!localStorage.getItem(STORAGE_KEY)) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleListings));
}

// --- Init on page load ---
document.addEventListener('DOMContentLoaded', () => {
  // Don't clear existing data on every page load
});
