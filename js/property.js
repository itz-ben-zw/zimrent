/* ==========================================
   HOMIFY - Property Detail Page
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const listingId = sessionStorage.getItem('current_listing_id');
  if (!listingId) {
    window.location.href = 'listings.html';
    return;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    const session = getSession ? getSession() : null;
    if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;

    const res = await fetch(`/api/properties/${listingId}`, { headers });
    if (!res.ok) throw new Error('Property not found');
    const data = await res.json();
    const p = data.property;

    document.getElementById('breadcrumb-title').textContent = p.title;
    document.getElementById('detail-title').textContent = p.title;
    document.getElementById('detail-location').innerHTML = '<i class="fas fa-map-marker-alt" style="color:var(--text-muted);"></i> ' + escapeHtml(p.city) + ', ' + escapeHtml(p.suburb);
    document.getElementById('detail-price').innerHTML = '<span style="font-weight:700; color:var(--primary); font-size:1.3rem;">' + p.currency + ' ' + p.price.toLocaleString() + '</span><span style="color:var(--text-muted);">/month</span>';
    document.getElementById('detail-description').textContent = p.description || 'No description provided.';

    // Meta: beds/baths/type
    const meta = document.getElementById('detail-meta');
    meta.innerHTML = [
      '<span class="amenity-badge">Room for ' + p.bedrooms + '</span>',
      '<span class="amenity-badge">' + p.bathrooms + ' Bath' + (p.bathrooms !== 1 ? 's' : '') + '</span>',
      '<span class="amenity-badge">' + p.type + '</span>'
    ].join('');

    // Amenities
    const amenities = document.getElementById('detail-amenities');
    const amenityItems = [];
    if (p.wifi) amenityItems.push('<span class="amenity-badge yes"><i class="fas fa-wifi"></i> Wi-Fi</span>');
    if (p.electricStove) amenityItems.push('<span class="amenity-badge yes"><i class="fas fa-bolt"></i> Electric Stove</span>');
    if (p.gasStove) amenityItems.push('<span class="amenity-badge yes"><i class="fas fa-fire"></i> Gas Stove</span>');
    if (p.fridge) amenityItems.push('<span class="amenity-badge yes"><i class="fas fa-igloo"></i> Refrigerator</span>');
    if (p.solar) amenityItems.push('<span class="amenity-badge yes"><i class="fas fa-sun"></i> Solar Power</span>');
    if (p.borehole) amenityItems.push('<span class="amenity-badge yes"><i class="fas fa-tint"></i> Borehole Water</span>');
    if (p.fenced) amenityItems.push('<span class="amenity-badge yes"><i class="fas fa-lock"></i> Fenced</span>');
    amenities.innerHTML = amenityItems.join('') || '<span style="color:var(--text-muted);">No extra amenities listed</span>';

    // Date
    if (p.createdAt) {
      document.getElementById('detail-date').textContent = 'Listed on ' + new Date(p.createdAt).toLocaleDateString('en-ZW', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Custom additions
    if (p.customAdditions) {
      document.getElementById('detail-custom-section').style.display = 'block';
      document.getElementById('detail-custom').textContent = p.customAdditions;
    }

    // Location map
    initLocationMap(p);

    // Images
    const hero = document.getElementById('detail-hero');
    const thumbs = document.getElementById('thumbnail-container');
    if (p.images && p.images.length > 0) {
      hero.innerHTML = '<img src="' + p.images[0].data + '" alt="' + escapeHtml(p.title) + '">';
      thumbs.innerHTML = p.images.map((img, i) => `
        <img src="${img.data}" alt="Image ${i+1}" style="width:90px; height:65px; object-fit:cover; border-radius:6px; cursor:pointer; border:2px solid ${i===0?'var(--primary)':'transparent'};" onclick="document.getElementById('detail-hero').querySelector('img').src='${img.data}'; this.parentElement.querySelectorAll('img').forEach(el=>el.style.borderColor='transparent'); this.style.borderColor='var(--primary)';">
      `).join('');
    } else {
      hero.innerHTML = '<div class="detail-hero-placeholder"><i class="fas fa-home" style="font-size:5rem; color:#ccc;"></i></div>';
    }

    // Contact card
    const contact = document.getElementById('contact-card');
    let contactHTML = '<h3>Contact Landlord</h3>';
    if (p.phone) {
      contactHTML += '<a href="tel:' + escapeHtml(p.phone) + '" class="contact-item"><div class="contact-icon"><i class="fas fa-phone"></i></div><div><div class="contact-label">Phone</div><div class="contact-value">' + escapeHtml(p.phone) + '</div></div></a>';
    }
    if (p.whatsapp) {
      contactHTML += '<a href="' + getWhatsAppLink(p.whatsapp) + '" target="_blank" class="contact-item"><div class="contact-icon"><i class="fab fa-whatsapp"></i></div><div><div class="contact-label">WhatsApp</div><div class="contact-value">' + escapeHtml(p.whatsapp) + '</div></div></a>';
    }
    if (p.email) {
      contactHTML += '<a href="mailto:' + escapeHtml(p.email) + '" class="contact-item"><div class="contact-icon"><i class="fas fa-envelope"></i></div><div><div class="contact-label">Email</div><div class="contact-value">' + escapeHtml(p.email) + '</div></div></a>';
    }
    if (p.landlord && p.landlord.fullName) {
      contactHTML += '<div style="margin-top:1rem; padding-top:0.8rem; border-top:1px solid var(--border); font-size:0.85rem; color:var(--text-muted);">Listed by <strong style="color:var(--text-dark);">' + escapeHtml(p.landlord.fullName) + '</strong></div>';
    }
    contact.innerHTML = contactHTML;

    // Contact buttons for tenants
    if (session && session.user && session.user.role === 'tenant') {
      contactHTML += `
        <button id="apply-btn" class="btn btn-success btn-lg" style="width:100%; margin-top:1rem;">Apply for This Property</button>
        <button id="message-btn" class="btn btn-outline btn-lg" style="width:100%; margin-top:0.8rem;">Message Landlord</button>
      `;
      contact.innerHTML = contactHTML;

      document.getElementById('apply-btn').addEventListener('click', async () => {
        const message = prompt('Introduce yourself to the landlord (optional):', '');
        if (message === null) return;
        try {
          const applyRes = await fetch('/api/applications', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyId: p.id, message })
          });
          const applyData = await applyRes.json();
          if (!applyRes.ok) {
            if (window.toast) toast.error(applyData.error || 'Application failed');
            else alert(applyData.error || 'Application failed');
            return;
          }
          if (window.toast) toast.success('Application submitted successfully.');
          else alert('Application submitted successfully!');
        } catch (err) {
          if (window.toast) toast.error('Error submitting application: ' + err.message);
          else alert('Error submitting application: ' + err.message);
        }
      });

      document.getElementById('message-btn').addEventListener('click', async () => {
        const reply = prompt('Send a message to the landlord (optional):', '');
        if (reply === null) return;
        try {
          const convRes = await fetch('/api/conversations', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyId: p.id, message: reply })
          });
          const convData = await convRes.json();
          if (!convRes.ok) {
            if (window.toast) toast.error(convData.error || 'Failed to open conversation');
            else alert(convData.error || 'Failed to open conversation');
            return;
          }
          sessionStorage.setItem('current_conversation_id', convData.conversation.id);
          window.location.href = 'chat.html';
        } catch (err) {
          if (window.toast) toast.error('Error opening conversation: ' + err.message);
          else alert('Error opening conversation: ' + err.message);
        }
      });
    }
  } catch (err) {
    console.error(err);
    if (window.toast) toast.error('Failed to load property details.');
    else alert('Failed to load property details.');
    window.location.href = 'listings.html';
  }
});

function initLocationMap(p) {
  const section = document.getElementById('location-section');
  const mapEl = document.getElementById('location-map');
  if (!section || !mapEl) return;

  // Determine the pin. Use stored coords if present, otherwise
  // fall back to an approximate centre for the suburb.
  let coords = null;
  if (p.latitude !== null && p.latitude !== undefined &&
      p.longitude !== null && p.longitude !== undefined) {
    coords = { lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) };
  } else if (typeof getSuburbCoords === 'function') {
    coords = getSuburbCoords(p.suburb);
  }

  // Area label, e.g. "Selbourne Park, Bulawayo, Zimbabwe"
  const areaLabel = [p.suburb, p.city, 'Zimbabwe'].filter(Boolean).join(', ');
  document.getElementById('location-area').innerHTML =
    '<i class="fas fa-map-pin" style="color:var(--primary);"></i> ' + escapeHtml(areaLabel);

  if (!coords || typeof L === 'undefined') {
    // No coordinates or Leaflet failed to load - keep the label + note.
    mapEl.style.display = 'none';
    document.querySelector('.location-map-wrap').style.display = 'none';
    return;
  }

  // Wire up the "Open in Maps" deep link.
  document.getElementById('location-open-maps').href = googleMapsLink(coords.lat, coords.lng);

  const map = L.map('location-map', {
    scrollWheelZoom: false,
    zoomControl: false
  }).setView([coords.lat, coords.lng], 15);

  L.control.zoom({ position: 'topright' }).addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const marker = L.marker([coords.lat, coords.lng], { draggable: false }).addTo(map);
  marker.bindPopup('<strong>' + escapeHtml(p.title) + '</strong><br>' + escapeHtml(areaLabel)).openPopup();

  // Leaflet needs a nudge once the (previously hidden) map is laid out.
  setTimeout(() => map.invalidateSize(), 200);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getWhatsAppLink(phone) {
  const clean = phone.replace(/[^0-9+]/g, '');
  return 'https://wa.me/' + clean.replace('+', '');
}