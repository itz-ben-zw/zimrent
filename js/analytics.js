/* ==========================================
   HOMIFY - Analytics (opt-in, privacy-aware)
   --------------------------------------------------
   Google Analytics is DISABLED by default. To turn it on:

   1. Create a GA4 property at https://analytics.google.com
      and copy its Measurement ID (looks like "G-XXXXXXXXXX").
   2. Add this line in the <head> of your pages, BEFORE this script:
        <script>window.HOMIFY_GA_ID = 'G-XXXXXXXXXX';</script>
   3. Update cookies.html to disclose the tracking, and get cookie
      consent working BEFORE enabling (see the note below).

   Until HOMIFY_GA_ID is set, this file loads nothing and sends no data,
   so the site stays tracker-free out of the box.
   ========================================== */
(function () {
    'use strict';

    var GA_ID = window.HOMIFY_GA_ID;
    if (!GA_ID || !/^G-[A-Z0-9]+$/i.test(GA_ID)) return;

    // Respect an existing cookie-consent choice if the banner is present.
    // If the visitor declined, do not load analytics.
    try {
        var consent = localStorage.getItem('homify_consent_v1');
        if (consent === 'declined') return;
    } catch (e) { /* storage may be unavailable; proceed cautiously */ }

    // Load gtag.js
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
})();
