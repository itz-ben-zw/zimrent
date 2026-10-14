/* ==========================================
   HOMIFY - Cookie / Privacy Notice Consent
   ------------------------------------------------------------
   No advertising or analytics trackers are used. The only
   storage we set is:
     • sessionStorage / localStorage for login + your UI
       preferences (strictly necessary for the site to work)
     • Third-party services (CDNs, map tiles, Google Sign-In)
       that may set their own cookies - disclosed in cookies.html

   This bar collects a single record of whether the visitor
   acknowledged our notice (Cyber & Data Protection Act §10/§15).
   It is non-blocking: the site works fully whether accepted
   or declined.
   ========================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'homify_consent_v1';

  function readConsent() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function writeConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  function buildBanner() {
    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie notice');
    banner.innerHTML =
      '<p>We use essential cookies and similar technologies to run Homify and ' +
      'to load maps and sign-in. We do not run advertising trackers. ' +
      'See our <a href="cookies.html">Cookie Policy</a> and ' +
      '<a href="privacy.html">Privacy Policy</a>.</p>' +
      '<div class="cookie-actions">' +
      '<button type="button" class="cookie-btn cookie-accept" data-consent="accepted">Accept</button>' +
      '<button type="button" class="cookie-btn cookie-decline" data-consent="declined">Decline</button>' +
      '</div>';
    return banner;
  }

  function closeBanner(banner, value) {
    writeConsent(value);
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }

  function init() {
    if (readConsent()) return; // already acknowledged

    var banner = buildBanner();
    document.body.appendChild(banner);

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (btn) closeBanner(banner, btn.getAttribute('data-consent'));
    });
  }

  // Keep the copyright year current in every footer (.js-year spans).
  function initYear() {
    var year = String(new Date().getFullYear());
    var spans = document.querySelectorAll('.js-year');
    for (var i = 0; i < spans.length; i++) {
      spans[i].textContent = year;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initYear(); init(); });
  } else {
    initYear();
    init();
  }
})();
