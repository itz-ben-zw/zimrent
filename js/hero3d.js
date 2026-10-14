/* ==========================================
   HOMIFY - 3D Hero Scene (Three.js)
   Floating houses & shapes, OKX-style.
   Requires three.js loaded globally first.
   Renders into #hero-canvas inside .hero.
   ========================================== */
(function () {
    'use strict';

    const canvas = document.getElementById('hero-canvas');
    const hero = document.querySelector('.hero');
    if (!canvas || !hero || typeof THREE === 'undefined') return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = () => window.innerWidth < 768;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (err) {
        console.warn('Homify 3D hero: WebGL unavailable', err);
        canvas.style.display = 'none';
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    /* Lights - moody, with a neon key so emissive shapes pop on dark */
    scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
    const keyLight = new THREE.DirectionalLight(0xbfe6ff, 0.85);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x6fc0ff, 0.7);
    rimLight.position.set(-6, -3, 4);
    scene.add(rimLight);

    /* Brand materials - emissive/neon tuned for a dark scene */
    const MAT = {
        white: new THREE.MeshStandardMaterial({ color: 0xeaf2ff, roughness: 0.25, metalness: 0.10, emissive: 0x0a2a44, emissiveIntensity: 0.6 }),
        azure: new THREE.MeshStandardMaterial({ color: 0x29a8f5, roughness: 0.25, metalness:0.15, emissive: 0x0d5a8f, emissiveIntensity: 0.9 }),
        deep: new THREE.MeshStandardMaterial({ color: 0x1f6fd0, roughness: 0.30, metalness: 0.15, emissive: 0x08213d, emissiveIntensity: 0.7 }),
        pale: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.30, metalness: 0.00, emissive: 0x1b4d78, emissiveIntensity: 0.6 }),
        wire: new THREE.MeshBasicMaterial({ color: 0x56ccf2, wireframe: true, transparent: true, opacity: 0.35 })
    };

    /* ---- OKX-style atmosphere: starfield dust + slow orbit ring ---- */
    // Starfield: tiny cyan points drifting behind the shapes.
    let starfield = null;
    if (!prefersReduced) {
        const starCount = isMobile() ? 60 : 140;
        const positions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 26;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
            positions[i * 3 + 2] = -2 - Math.random() * 10;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0x56ccf2, size: 0.06, transparent: true, opacity: 0.7 });
        starfield = new THREE.Points(starGeo, starMat);
        scene.add(starfield);
    }

    // Orbit ring: a large slow-spinning torus framing the whole scene.
    const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(7.5, 0.03, 8, 128),
        new THREE.MeshBasicMaterial({ color: 0x2a8fe0, transparent: true, opacity: 0.5 })
    );
    orbit.position.z = -6;
    orbit.rotation.x = Math.PI / 2.4;
    scene.add(orbit);

    /* House - echoes the logo (body + roof + door) */
    function makeHouse(bodyMat, roofMat) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), bodyMat);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.85, 4), roofMat);
        roof.position.y = 0.975;
        roof.rotation.y = Math.PI / 4;
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.52, 0.06),
            bodyMat === MAT.white ? MAT.deep : MAT.white
        );
        door.position.set(0.28, -0.29, 0.72);
        g.add(body, roof, door);
        return g;
    }

    /* Location pin - the other logo motif */
    function makePin(mat) {
        const g = new THREE.Group();
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 28, 20), mat);
        ball.position.y = 0.3;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.0, 28), mat);
        tip.position.y = -0.35;
        tip.rotation.x = Math.PI;
        g.add(ball, tip);
        return g;
    }

    /* Placement: xFrac/yFrac are fractions of the visible view
       (-1..1) so layout stays correct at any viewport size. */
    const defs = [
        // xFrac, yFrac, z, build fn, baseScale, amp, speed, spinX, spinY
        [-0.82,  0.45, -2, () => makeHouse(MAT.white, MAT.deep), 1.15, 0.30, 0.55, 0.10, 0.22],
        [-0.68, -0.50,  0, () => new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 24), MAT.azure), 1.0, 0.35, 0.70, 0.15, 0.18],
        [-0.90, -0.10, -4, () => new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.26, 18, 48), MAT.pale), 1.0, 0.25, 0.45, 0.25, 0.30],
        [-0.64,  0.82, -3, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), MAT.white), 1.0, 0.30, 0.60, 0.30, 0.24],
        [-0.76, -0.86, -1, () => makeHouse(MAT.azure, MAT.white), 0.75, 0.22, 0.65, 0.08, 0.26],
        [ 0.85,  0.35, -2, () => makeHouse(MAT.pale, MAT.azure), 1.0, 0.28, 0.50, 0.12, 0.20],
        [ 0.68,  0.76, -3, () => new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), MAT.white), 1.0, 0.34, 0.75, 0.18, 0.16],
        [ 0.91, -0.55,  0, () => new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.22, 18, 48), MAT.azure), 1.0, 0.26, 0.52, 0.28, 0.22],
        [ 0.66, -0.82, -1, () => makePin(MAT.white), 1.0, 0.30, 0.62, 0.06, 0.30],
        [ 0.79, -0.12, -4, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), MAT.deep), 1.0, 0.24, 0.58, 0.32, 0.26],
        [-0.63,  0.90, -5, () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), MAT.wire), 1.0, 0.20, 0.40, 0.14, 0.34],
        [ 0.58, -0.92, -5, () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), MAT.wire), 1.0, 0.22, 0.44, 0.20, 0.28]
    ];

    const objects = defs.map(d => {
        const mesh = d[3]();
        scene.add(mesh);
        return {
            mesh: mesh,
            xFrac: d[0], yFrac: d[1], z: d[2],
            baseScale: d[4], amp: d[5], speed: d[6],
            spinX: d[7], spinY: d[8],
            phase: Math.random() * Math.PI * 2,
            baseY: 0
        };
    });

    let viewScale = 1;

    function layout() {
        const w = hero.clientWidth || window.innerWidth;
        const h = hero.clientHeight || 400;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        const dist = camera.position.z; // objects near z=0
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
        viewScale = halfH / 6.5;

        const narrow = isMobile();
        objects.forEach((o, i) => {
            // Thin the herd on small screens for performance & clarity
            o.mesh.visible = !narrow || i % 2 === 0 || i === 0 || i === 5;
            const dz = camera.position.z - o.z;
            const mH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dz;
            o.mesh.position.x = o.xFrac * mH * camera.aspect;
            o.baseY = o.yFrac * mH;
            o.mesh.position.y = o.baseY;
            o.mesh.position.z = o.z;
            o.mesh.scale.setScalar(o.baseScale * (mH / halfH));
        });
    }

    /* Mouse parallax */
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    });
    hero.addEventListener('pointerleave', () => { mouse.tx = 0; mouse.ty = 0; });

    /* Render loop with visibility gating */
    let rafId = null;
    let visible = true;
    let last = performance.now();
    let t = 0;

    function frame(now) {
        rafId = null;
        if (!visible || document.hidden) return;

        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        t += dt;

        // Ease camera toward pointer
        mouse.x += (mouse.tx - mouse.x) * Math.min(dt * 4, 1);
        mouse.y += (mouse.ty - mouse.y) * Math.min(dt * 4, 1);
        camera.position.x = mouse.x * 1.6;
        camera.position.y = mouse.y * 1.0;
        camera.lookAt(0, 0, 0);

        // Slow ambient motion for atmosphere
        orbit.rotation.z += dt * 0.08;
        if (starfield) starfield.rotation.y += dt * 0.01;

        objects.forEach(o => {
            if (!o.mesh.visible) return;
            o.mesh.position.y = o.baseY + Math.sin(t * o.speed + o.phase) * o.amp * viewScale;
            o.mesh.rotation.x += o.spinX * dt;
            o.mesh.rotation.y += o.spinY * dt;
        });

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
    }

    function start() {
        if (rafId === null && visible && !document.hidden && !prefersReduced) {
            last = performance.now();
            rafId = requestAnimationFrame(frame);
        }
    }

    function stop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    // Pause when hero scrolled out of view or tab hidden
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            if (visible) start(); else stop();
        }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else start();
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            layout();
            if (prefersReduced) renderer.render(scene, camera);
        }, 120);
    });

    layout();
    if (prefersReduced) {
        renderer.render(scene, camera); // single static frame
    } else {
        start();
    }
})();
