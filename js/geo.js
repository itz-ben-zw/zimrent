/* ==========================================
   HOMIFY — Shared geography helpers
   Approximate coordinates for Bulawayo/NUST
   suburbs so the map has a sensible starting
   pin even before a landlord fine-tunes it.
   ========================================== */

// Approximate centre points for common NUST-area suburbs.
// These are deliberately coarse ("approximate location") —
// landlords can drag the pin to the exact spot.
window.SUBURB_COORDS = {
  'Selbourne Park': { lat: -20.1667, lng: 28.5961 },
  'Riverside': { lat: -20.1611, lng: 28.5900 },
  'Matsheumhlophe': { lat: -20.1489, lng: 28.5599 },
  'Matsheumhlope': { lat: -20.1489, lng: 28.5599 },
  'Bellevue': { lat: -20.1533, lng: 28.5769 },
  'Burnside': { lat: -20.1522, lng: 28.5883 },
  'Hillside': { lat: -20.1589, lng: 28.5850 },
  'Famona': { lat: -20.1472, lng: 28.5778 },
  'Khumalo': { lat: -20.1694, lng: 28.5836 },
  'Nkulumane': { lat: -20.1797, lng: 28.5744 },
  'Pumula': { lat: -20.1267, lng: 28.7200 },
  'Suburbs': { lat: -20.1600, lng: 28.5800 }
};

// Fallback: Bulawayo city centre (used when a suburb has no
// known coordinates, e.g. a less-common suburb).
window.DEFAULT_CITY_COORDS = { lat: -20.1500, lng: 28.5800 };

// NUST main campus — handy reference point.
window.NUST_COORDS = { lat: -20.1489, lng: 28.5599 };

/**
 * Return the best-guess {lat, lng} for a suburb name.
 * Falls back to the Bulawayo city centre.
 */
window.getSuburbCoords = function (suburb) {
  if (suburb && window.SUBURB_COORDS[suburb]) {
    return window.SUBURB_COORDS[suburb];
  }
  return window.DEFAULT_CITY_COORDS;
};

/**
 * Build a Google Maps "Open in Maps" deep link for a coordinate pair.
 * This is just a plain hyperlink — no API key or billing required.
 */
window.googleMapsLink = function (lat, lng) {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
};
