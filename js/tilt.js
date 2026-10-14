/* ==========================================
   HOMIFY - 3D Card Tilt (OKX-style)
   Cards tilt toward the cursor with a
   glossy light sheen. Works on dynamically
   rendered cards via event delegation.
   Fine-pointer devices only.
   ========================================== */
(function () {
    'use strict';

    const SELECTOR = '.property-card, .stat-card, .dash-card';
    const MAX_TILT = 7; // degrees

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let active = null;
    let rafId = null;
    let pending = null;

    function resetCard(card) {
        if (!card) return;
        card.classList.remove('tilting');
        card.style.transform = '';
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
    }

    function applyTilt() {
        rafId = null;
        const p = pending;
        if (!p || !p.card.isConnected) { resetCard(p && p.card); active = null; return; }
        const px = (p.x - p.rect.left) / p.rect.width;
        const py = (p.y - p.rect.top) / p.rect.height;
        const rx = (0.5 - py) * (MAX_TILT * 2);
        const ry = (px - 0.5) * (MAX_TILT * 2);
        p.card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        p.card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        p.card.style.transform =
            'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px)';
    }

    document.addEventListener('pointermove', (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        const card = e.target instanceof Element ? e.target.closest(SELECTOR) : null;

        if (card !== active) {
            resetCard(active);
            active = card;
            if (card) card.classList.add('tilting');
        }
        if (!card) return;

        pending = { card: card, rect: card.getBoundingClientRect(), x: e.clientX, y: e.clientY };
        if (rafId === null) rafId = requestAnimationFrame(applyTilt);
    });

    function clearActive() {
        resetCard(active);
        active = null;
        pending = null;
    }

    document.addEventListener('pointerleave', clearActive);
    window.addEventListener('blur', clearActive);
})();
