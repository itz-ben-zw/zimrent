/* ==========================================
   HOMIFY - Toast notifications (replaces alert())
   Lightweight, dependency-free. Usage:
     toast.success('Listing saved');
     toast.error('Something went wrong');
     toast.info('Heads up');
   ========================================== */
(function () {
    'use strict';

    const ICONS = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        info: 'fas fa-info-circle'
    };

    function ensureWrap() {
        let wrap = document.querySelector('.toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'toast-wrap';
            wrap.setAttribute('role', 'status');
            wrap.setAttribute('aria-live', 'polite');
            document.body.appendChild(wrap);
        }
        return wrap;
    }

    function show(message, type, duration) {
        type = type || 'info';
        const wrap = ensureWrap();

        const el = document.createElement('div');
        el.className = 'toast ' + type;

        const icon = document.createElement('i');
        icon.className = ICONS[type] + ' toast-icon';
        icon.setAttribute('aria-hidden', 'true');

        const text = document.createElement('span');
        text.textContent = message;

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'toast-close';
        close.setAttribute('aria-label', 'Dismiss notification');
        close.innerHTML = '&times;';

        el.appendChild(icon);
        el.appendChild(text);
        el.appendChild(close);
        wrap.appendChild(el);

        // Trigger the slide-in transition
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { el.classList.add('show'); });
        });

        let removed = false;
        function dismiss() {
            if (removed) return;
            removed = true;
            el.classList.remove('show');
            setTimeout(function () { el.remove(); }, 300);
        }

        close.addEventListener('click', dismiss);
        const ms = typeof duration === 'number' ? duration : (type === 'error' ? 6000 : 4000);
        if (ms > 0) setTimeout(dismiss, ms);

        return dismiss;
    }

    window.toast = {
        success: function (msg, ms) { return show(msg, 'success', ms); },
        error: function (msg, ms) { return show(msg, 'error', ms); },
        info: function (msg, ms) { return show(msg, 'info', ms); }
    };
})();
