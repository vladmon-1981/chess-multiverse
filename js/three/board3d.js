/*
 * Трёхмерная шахматная доска на Three.js.
 * Отвечает только за показ и ввод: рисует доску и фигуры, анимирует ходы и эффекты,
 * превращает клики/перетаскивания в клетки и сообщает о них контроллеру (handlers).
 * Камеру можно крутить, приближать и сдвигать; в кинорежиме она сама подлетает к ходу.
 * Кадры рисуются по требованию — только пока идут анимации.
 */
(function () {
    'use strict';
    const CM = window.CM;
    const T = THREE;

    const Ease = {
        linear: (t) => t,
        inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        out: (t) => 1 - Math.pow(1 - t, 3),
        in: (t) => t * t * t,
        outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
        outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1)
    };

    const FILES = 'abcdefgh';
    const sqToXZ = (sq) => [sq.charCodeAt(0) - 97 - 3.5, 3.5 - (parseInt(sq[1], 10) - 1)];
    function xzToSq(x, z) {
        const f = Math.floor(x + 4), r = Math.floor(4 - z);
        if (f < 0 || f > 7 || r < 0 || r > 7) return null;
        return FILES[f] + (r + 1);
    }
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    /** Кратчайшая разница углов b − a в диапазоне (−π, π]. */
    function angleDiff(a, b) {
        let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return d;
    }
    const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;

    // Пределы камеры: zoom 1 — вся доска в кадре, меньше — ближе
    const ZOOM_MIN = 0.3, ZOOM_MAX = 1;
    const EL_MIN = 12 * Math.PI / 180, EL_MAX = 86 * Math.PI / 180;
    const PAN_MAX = 4;

    function rayPlane(ray, y) {
        if (Math.abs(ray.direction.y) < 1e-6) return null;
        const t = (y - ray.origin.y) / ray.direction.y;
        if (t < 0) return null;
        return ray.origin.clone().addScaledVector(ray.direction, t);
    }

    // Пересечение луча с вертикальным цилиндром (ось в (cx, cz), радиус r, высота y0..y1)
    function rayCylinder(ray, cx, cz, r, y0, y1) {
        const o = ray.origin, d = ray.direction;
        const ox = o.x - cx, oz = o.z - cz;
        let best = null;
        const a = d.x * d.x + d.z * d.z;
        if (a > 1e-9) {
            const b = 2 * (ox * d.x + oz * d.z);
            const c = ox * ox + oz * oz - r * r;
            const disc = b * b - 4 * a * c;
            if (disc >= 0) {
                const t = (-b - Math.sqrt(disc)) / (2 * a);
                const y = o.y + t * d.y;
                if (t > 0 && y >= y0 && y <= y1) best = t;
            }
        }
        if (Math.abs(d.y) > 1e-9) {
            const t = (y1 - o.y) / d.y;
            if (t > 0) {
                const px = ox + t * d.x, pz = oz + t * d.z;
                if (px * px + pz * pz <= r * r && (best === null || t < best)) best = t;
            }
        }
        return best;
    }

    const BURST_COLORS = {
        classic: ['#f7d774', '#fff3c4', '#d9a441', '#ffffff'],
        cars: ['#9e9e9e', '#d6d6d6', '#ffb300', '#ff7043', '#616161'],
        hospital: ['#ff8fb1', '#ffd1e0', '#9be7ff', '#ffffff', '#b388ff']
    };

    class Board3D {
        /**
         * @param {HTMLElement} container
         * @param {{down(sq):boolean, up(sq, startSq), drop(from, to):boolean|'pending'}} handlers
         */
        constructor(container, handlers, opts = {}) {
            this.container = container;
            this.handlers = handlers;
            // Качество: 'auto' (подстраивается под скорость устройства) или 'low'
            this.quality = opts.quality === 'low' ? 'low' : 'auto';
            this.frameTimes = [];
            this.theme = null;
            // Камера зрителя: угол вокруг доски, наклон, приближение и сдвиг точки взгляда
            this.azimuth = 0;
            this.elevation = 54 * Math.PI / 180;
            this.zoom = 1;
            this.pan = new T.Vector3();
            this.orientation = 'w';
            this.viewToken = 0;
            // Свет привязан к стороне игрока, а не к камере: при вращении тени остаются на месте
            this.lightAzimuth = 0;
            // Кинокамера: w — насколько она сейчас управляет кадром (0…1)
            this.cine = { w: 0, target: new T.Vector3(), azimuth: 0, elevation: 0.45, dist: 6 };
            this.cineToken = 0;
            this.cineLock = false;
            this.cineFollow = null;
            this.shakeAmp = 0;
            // Виртуальные часы анимаций (мс): идут медленнее во время замедленной съёмки
            this.clock = 0;
            this.speed = 1;
            this.timeScale = 1;
            this.slow = null;
            this.captureFx = true;
            this.pieces = new Map();
            this.anims = new Set();
            this.particles = [];
            this.debris = [];
            this.colorCache = new Map();
            this.continuous = 0;
            this.raf = 0;
            this.lastFrame = 0;
            this.interactive = true;
            this.highlight = { selected: null, targets: [], last: null, check: null, hover: null };
            this.ptrs = new Map();
            this.gesture = null;
            this.lowPower = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
            this.reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

            this.loop = this.loop.bind(this);
            this.onPointerDown = this.onPointerDown.bind(this);
            this.onPointerMove = this.onPointerMove.bind(this);
            this.onPointerUp = this.onPointerUp.bind(this);
            this.onWheel = this.onWheel.bind(this);

            this.initRenderer();
            this.initScene();
            this.initEvents();
            this.resize();
        }

        // ---------- Инициализация ----------
        initRenderer() {
            const low = this.quality === 'low';
            const r = new T.WebGLRenderer({ antialias: !low, alpha: true, powerPreference: 'high-performance' });
            this.pixelRatio = low ? 0.75 : Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2);
            r.setPixelRatio(this.pixelRatio);
            r.outputColorSpace = T.SRGBColorSpace;
            r.toneMapping = T.NeutralToneMapping;
            r.shadowMap.enabled = !low;
            r.shadowMap.type = T.PCFShadowMap;
            r.domElement.className = 'board3d-canvas';
            r.domElement.setAttribute('aria-label', 'Шахматная доска');
            this.container.appendChild(r.domElement);
            CM.Tex.setMaxAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));
            this.renderer = r;
            r.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
            r.domElement.addEventListener('webglcontextrestored', () => { this.lost = false; this.requestRender(); });
        }

        initScene() {
            const s = this.scene = new T.Scene();
            const pm = new T.PMREMGenerator(this.renderer);
            s.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
            pm.dispose();

            this.camera = new T.PerspectiveCamera(30, 1, 0.1, 120);
            this.lookTarget = new T.Vector3(0, 0, 0);

            this.hemi = new T.HemisphereLight('#ffffff', '#444444', 0.6);
            s.add(this.hemi);
            const sun = this.sun = new T.DirectionalLight('#ffffff', 2.4);
            sun.castShadow = true;
            const sm = this.lowPower ? 1024 : 2048;
            sun.shadow.mapSize.set(sm, sm);
            const sc = sun.shadow.camera;
            sc.left = -6.5; sc.right = 6.5; sc.top = 6.5; sc.bottom = -6.5; sc.near = 1; sc.far = 40;
            sun.shadow.bias = -0.0005;
            sun.shadow.normalBias = 0.025;
            sun.shadow.radius = 2.5;
            s.add(sun, sun.target);
            this.rim = new T.DirectionalLight('#ffffff', 0.45);
            s.add(this.rim);
            this.updateLights();

            const ground = new T.Mesh(new T.PlaneGeometry(60, 60), new T.ShadowMaterial({ opacity: 0.22 }));
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -0.33;
            ground.receiveShadow = true;
            s.add(ground);

            this.boardGroup = new T.Group();
            this.pieceGroup = new T.Group();
            this.fxGroup = new T.Group();
            s.add(this.boardGroup, this.pieceGroup, this.fxGroup);

            // Слой подсветки клеток
            this.hlCanvas = document.createElement('canvas');
            this.hlCanvas.width = this.hlCanvas.height = this.lowPower ? 512 : 1024;
            this.hlTex = new T.CanvasTexture(this.hlCanvas);
            this.hlTex.colorSpace = T.SRGBColorSpace;
            const hl = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshBasicMaterial({
                map: this.hlTex, transparent: true, depthWrite: false, toneMapped: false
            }));
            hl.rotation.x = -Math.PI / 2;
            hl.position.y = 0.006;
            hl.renderOrder = 2;
            s.add(hl);

            // Пульсирующее кольцо шаха
            this.checkRing = new T.Mesh(new T.RingGeometry(0.4, 0.56, 48), new T.MeshBasicMaterial({
                color: '#ff2d2d', transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false
            }));
            this.checkRing.rotation.x = -Math.PI / 2;
            this.checkRing.position.y = 0.012;
            this.checkRing.visible = false;
            s.add(this.checkRing);

            // Мягкая точка для частиц
            const dot = document.createElement('canvas');
            dot.width = dot.height = 64;
            const dctx = dot.getContext('2d');
            const g = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            dctx.fillStyle = g;
            dctx.fillRect(0, 0, 64, 64);
            this.dotTex = new T.CanvasTexture(dot);

            // Спецэффекты взятия. Точечный свет всегда в сцене (с нулевой яркостью), чтобы
            // вспышка не заставляла пересобирать шейдеры всех материалов
            if (this.quality !== 'low') {
                this.flashLight = new T.PointLight('#ffd08a', 0, 7, 2);
                this.flashLight.position.set(0, 1, 0);
                s.add(this.flashLight);
            }
            this.ringGeo = new T.RingGeometry(0.44, 0.58, 56);
            this.debrisGeos = [
                new T.TetrahedronGeometry(0.075),
                new T.BoxGeometry(0.1, 0.05, 0.075),
                new T.OctahedronGeometry(0.065),
                new T.IcosahedronGeometry(0.06, 0)
            ];
            this.debrisMats = new Map();
            this.boltMat = new T.MeshBasicMaterial({
                color: '#f2fdff', transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false
            });
            this.boltGlowMat = new T.MeshBasicMaterial({
                color: '#38c8ff', transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false
            });
        }

        /** Материал осколков цвета color (по одному на цвет — шейдер собирается один раз). */
        debrisMat(color) {
            const key = typeof color === 'string' ? color : '#' + color.getHexString();
            if (!this.debrisMats.has(key)) {
                this.debrisMats.set(key, new T.MeshStandardMaterial({ color: key, roughness: 0.45, metalness: 0.08, flatShading: true }));
            }
            return this.debrisMats.get(key);
        }

        /**
         * Скомпилировать шейдеры эффектов заранее, пока открыт экран загрузки:
         * иначе первое взятие подтормаживает на сборке программ.
         */
        warmUp() {
            if (this.warmed || !this.renderer.compile) return;
            this.warmed = true;
            const g = new T.Group();
            g.position.set(0, -4, 0);
            const ring = new T.Mesh(this.ringGeo, new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
            const shard = new T.Mesh(this.debrisGeos[0], this.debrisMat('#ffffff'));
            const pg = new T.BufferGeometry();
            pg.setAttribute('position', new T.BufferAttribute(new Float32Array(3), 3));
            pg.setAttribute('color', new T.BufferAttribute(new Float32Array([1, 1, 1]), 3));
            const pts = new T.Points(pg, new T.PointsMaterial({ size: 0.1, map: this.dotTex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
            g.add(ring, shard, pts);
            this.scene.add(g);
            try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* не критично */ }
            this.scene.remove(g);
            ring.material.dispose();
            pts.material.dispose();
            pg.dispose();
        }

        initEvents() {
            const el = this.renderer.domElement;
            el.style.touchAction = 'none';
            el.addEventListener('pointerdown', this.onPointerDown);
            el.addEventListener('pointermove', (e) => this.onHover(e));
            window.addEventListener('pointermove', this.onPointerMove);
            window.addEventListener('pointerup', this.onPointerUp);
            window.addEventListener('pointercancel', this.onPointerUp);
            el.addEventListener('wheel', this.onWheel, { passive: false });
            el.addEventListener('contextmenu', (e) => e.preventDefault());
            if (window.ResizeObserver) {
                this.ro = new ResizeObserver(() => this.resize());
                this.ro.observe(this.container);
            } else {
                window.addEventListener('resize', () => this.resize());
            }
        }

        // ---------- Цикл отрисовки и анимации ----------
        requestRender() {
            if (!this.raf) this.raf = requestAnimationFrame(this.loop);
        }

        loop(now) {
            this.raf = 0;
            // Реальный шаг кадра и шаг виртуальных часов (с учётом замедленной съёмки)
            const rdt = this.lastFrame ? clamp((now - this.lastFrame) / 1000, 0, 0.1) : 0.016;
            this.lastFrame = now;
            this.updateSlowmo(now);
            const dt = rdt * this.timeScale;
            this.clock += dt * 1000;
            this.inLoop = true;
            for (const a of Array.from(this.anims)) {
                if (this.clock < a.t0) continue;
                const t = Math.min(1, Math.max(0, (this.clock - a.t0) / a.duration));
                a.update(a.ease(t), t, dt);
                if (t >= 1) {
                    this.anims.delete(a);
                    a.resolve();
                }
            }
            this.inLoop = false;
            this.updateParticles(dt);
            this.updateDebris(dt);
            this.updateCineFollow(dt);
            if (this.shakeAmp > 0.0005) {
                this.shakeAmp *= Math.exp(-rdt * 6.5);
                if (this.shakeAmp <= 0.0005) this.shakeAmp = 0;
                this.updateCamera();
            }
            if (this.checkRing.visible) {
                const k = 0.5 + 0.5 * Math.sin(now / 180);
                this.checkRing.material.opacity = 0.45 + 0.45 * k;
                this.checkRing.scale.setScalar(0.94 + 0.12 * k);
            }
            if (!this.lost) this.renderer.render(this.scene, this.camera);
            const busy = this.anims.size || this.particles.length || this.debris.length || this.continuous > 0 ||
                this.checkRing.visible || this.shakeAmp > 0 || this.cineFollow || this.slow;
            if (busy) {
                this.adaptQuality(rdt);
                this.requestRender();
            } else {
                this.lastFrame = 0;
            }
        }

        /** Замедленная съёмка: время плавно замедляется до scale, держится hold секунд и возвращается. */
        slowmo(scale = 0.25, hold = 0.45) {
            if (this.reduceMotion) return;
            this.slow = { t0: null, scale, hold };
            this.requestRender();
        }

        updateSlowmo(now) {
            const s = this.slow;
            let k = 1;
            if (s) {
                if (s.t0 === null) s.t0 = now;
                const t = (now - s.t0) / 1000, tin = 0.08, tout = 0.4;
                if (t < tin) k = lerp(1, s.scale, t / tin);
                else if (t < tin + s.hold) k = s.scale;
                else if (t < tin + s.hold + tout) k = lerp(s.scale, 1, Ease.inOut((t - tin - s.hold) / tout));
                else this.slow = null;
            }
            this.timeScale = k * this.speed;
        }

        /** Тряска камеры (при ударах). */
        shake(amp) {
            if (this.reduceMotion) return;
            this.shakeAmp = Math.max(this.shakeAmp, amp);
            this.requestRender();
        }

        /** Если анимации идут заметно медленнее 30 кадров/с — уменьшаем разрешение рендера. */
        adaptQuality(dt) {
            if (this.quality !== 'auto' || this.pixelRatio <= 1) return;
            this.frameTimes.push(dt);
            if (this.frameTimes.length < 40) return;
            const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
            this.frameTimes.length = 0;
            if (avg > 0.045) {
                this.pixelRatio = Math.max(1, this.pixelRatio - 0.5);
                this.renderer.setPixelRatio(this.pixelRatio);
                this.resize();
            }
        }

        /**
         * Анимация: update(eased, raw, dt) вызывается каждый кадр. Возвращает Promise.
         * Время — виртуальное (this.clock): в замедленной съёмке все анимации идут медленнее.
         */
        tween(seconds, update, ease = Ease.inOut, delay = 0) {
            return new Promise((resolve) => {
                this.anims.add({ t0: this.clock + delay * 1000, duration: Math.max(1, seconds * 1000), update, ease, resolve });
                this.requestRender();
            });
        }

        // ---------- Камера ----------
        resize() {
            const w = this.container.clientWidth, h = this.container.clientHeight;
            if (!w || !h) return;
            this.renderer.setSize(w, h, false);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            // Сцена стала другой формы (поворот телефона, новая раскладка) — наклон по пресету,
            // если зритель не наклонял камеру сам
            if (!this.elevUser && !this.viewGoal && this.theme) this.elevation = this.presetElevation();
            this.updateCamera();
            this.requestRender();
        }

        presetElevation(name = this.preset || 'normal') {
            const base = (this.theme && CM.Themes3D[this.theme].elevation) || 54;
            // На квадратной или вытянутой вверх сцене (телефон) смотрим круче: доска почти квадратом
            // заполняет ширину экрана и получается крупнее
            const steep = this.camera && this.camera.aspect < 1.12 ? 12 : 0;
            return ({ normal: base + steep, top: 80, low: base - 16 + steep / 2 }[name] || base) * Math.PI / 180;
        }

        /** Азимут своей стороны: белые внизу — 0, чёрные — π. */
        sideAzimuth(color = this.orientation) {
            return color === 'b' ? Math.PI : 0;
        }

        /**
         * Кадр, в который целиком помещается доска при угле az и наклоне el:
         * расстояние камеры и точка взгляда, отцентрированная по вертикали.
         */
        fitFrame(az, el) {
            const cam = this.camera;
            const key = az.toFixed(4) + '|' + el.toFixed(4) + '|' + cam.aspect.toFixed(4) + '|' + this.theme;
            if (this.fitCache && this.fitCache.key === key) return this.fitCache;
            const savedPos = cam.position.clone(), savedQuat = cam.quaternion.clone();
            const dir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
            const fwd = new T.Vector3(-Math.sin(az), 0, -Math.cos(az));
            // В кадр должны попасть игровое поле с краем рамки и верхушки фигур на крайних клетках
            const H = (this.theme && CM.Themes3D[this.theme].fitHeight) || 1.0;
            const pts = [];
            for (const x of [-4.4, 4.4]) for (const z of [-4.4, 4.4]) pts.push(new T.Vector3(x, 0, z));
            for (const x of [-3.9, 3.9]) for (const z of [-3.9, 3.9]) pts.push(new T.Vector3(x, H, z));
            const v = new T.Vector3();
            const measure = (d, tgt) => {
                cam.position.copy(tgt).addScaledVector(dir, d);
                cam.lookAt(tgt);
                cam.updateMatrixWorld();
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (const p of pts) {
                    v.copy(p).project(cam);
                    if (v.x < minX) minX = v.x;
                    if (v.x > maxX) maxX = v.x;
                    if (v.y < minY) minY = v.y;
                    if (v.y > maxY) maxY = v.y;
                }
                return { minX, maxX, minY, maxY };
            };
            const mx = 0.985, my = 0.97;
            const target = new T.Vector3();
            let d = 20;
            for (let iter = 0; iter < 4; iter++) {
                let lo = 2, hi = 90;
                for (let i = 0; i < 28; i++) {
                    const mid = (lo + hi) / 2;
                    const r = measure(mid, target);
                    if (r.minX > -mx && r.maxX < mx && r.minY > -my && r.maxY < my) hi = mid; else lo = mid;
                }
                d = hi;
                // Центрируем кадр по вертикали: сдвигаем точку взгляда вдоль «глубины» доски
                const r1 = measure(d, target);
                const c1 = (r1.minY + r1.maxY) / 2;
                const probe = target.clone().addScaledVector(fwd, 0.5);
                const r2 = measure(d, probe);
                const k = ((r2.minY + r2.maxY) / 2 - c1) / 0.5;
                if (Math.abs(k) > 1e-4) target.addScaledVector(fwd, -c1 / k);
            }
            cam.position.copy(savedPos);
            cam.quaternion.copy(savedQuat);
            cam.updateMatrixWorld();
            this.fitCache = { key, d, target };
            return this.fitCache;
        }

        /** Поставить камеру: вид зрителя, смешанный с кинокамерой, плюс тряска. */
        updateCamera() {
            const cam = this.camera;
            if (!cam.aspect) return;
            const f = this.fitFrame(this.azimuth, this.elevation);
            let az = this.azimuth, el = this.elevation, dist = f.d * this.zoom;
            const tgt = this.lookTarget.copy(f.target).add(this.pan);
            const c = this.cine;
            if (c.w > 0) {
                az = lerpAngle(az, c.azimuth, c.w);
                el = lerp(el, c.elevation, c.w);
                dist = Math.exp(lerp(Math.log(dist), Math.log(c.dist), c.w));
                tgt.lerp(c.target, c.w);
            }
            const ce = Math.cos(el);
            cam.position.set(tgt.x + Math.sin(az) * ce * dist, tgt.y + Math.sin(el) * dist, tgt.z + Math.cos(az) * ce * dist);
            if (this.shakeAmp > 0) {
                const s = this.shakeAmp;
                cam.position.x += (Math.random() - 0.5) * s;
                cam.position.y += (Math.random() - 0.5) * s;
                cam.position.z += (Math.random() - 0.5) * s;
                tgt.x += (Math.random() - 0.5) * s * 0.35;
                tgt.y += (Math.random() - 0.5) * s * 0.35;
            }
            cam.lookAt(tgt);
            cam.updateMatrixWorld();
            this.requestRender();
        }

        updateLights() {
            const up = new T.Vector3(0, 1, 0), az = this.lightAzimuth;
            // Ключевой свет — спереди-слева от игрока, контровой — сзади-справа
            this.sun.position.copy(new T.Vector3(-5, 11, 6).applyAxisAngle(up, az));
            this.sun.target.position.set(0, 0, 0);
            this.rim.position.copy(new T.Vector3(6, 6, -7).applyAxisAngle(up, az));
            this.requestRender();
        }

        /**
         * Плавно перевести камеру зрителя к виду to = { azimuth, elevation, zoom, pan, light }.
         * Углы передаются «развёрнутыми»: переход идёт от текущего значения прямо к цели.
         * Незавершённый предыдущий переход не бросается: его цели продолжают действовать.
         */
        animateView(to, seconds = 0.6) {
            if (this.viewGoal) to = Object.assign({}, this.viewGoal, to);
            const token = ++this.viewToken;
            const from = { azimuth: this.azimuth, elevation: this.elevation, zoom: this.zoom, pan: this.pan.clone(), light: this.lightAzimuth };
            const apply = (e) => {
                if (to.azimuth !== undefined) this.azimuth = lerp(from.azimuth, to.azimuth, e);
                if (to.elevation !== undefined) this.elevation = lerp(from.elevation, to.elevation, e);
                if (to.zoom !== undefined) this.zoom = Math.exp(lerp(Math.log(from.zoom), Math.log(to.zoom), e));
                if (to.pan) this.pan.lerpVectors(from.pan, to.pan, e);
                if (to.light !== undefined) {
                    this.lightAzimuth = lerp(from.light, to.light, e);
                    this.updateLights();
                }
                this.updateCamera();
            };
            if (!seconds) {
                apply(1);
                this.viewGoal = null;
                return Promise.resolve();
            }
            this.viewGoal = to;
            return this.tween(seconds, (e) => { if (token === this.viewToken) apply(e); }, Ease.inOut)
                .then(() => { if (token === this.viewToken) this.viewGoal = null; });
        }

        /** Зритель сам взялся за камеру: прерываем автоматический переход (свет доводим сразу). */
        stopViewAnim() {
            const g = this.viewGoal;
            this.viewToken++;
            this.viewGoal = null;
            if (g && g.light !== undefined) {
                this.lightAzimuth = g.light;
                this.updateLights();
            }
        }

        setPreset(name, animate = true) {
            this.preset = name;
            this.elevUser = false;
            return this.animateView({ elevation: this.presetElevation(name), zoom: 1, pan: new T.Vector3() }, animate ? 0.6 : 0);
        }

        /** Повернуть доску к стороне color ('w' — белые внизу) без приближения. */
        setOrientation(color, animate = true) {
            this.orientation = color;
            const side = this.sideAzimuth(color);
            return this.animateView({
                azimuth: this.azimuth + angleDiff(this.azimuth, side),
                zoom: 1,
                pan: new T.Vector3(),
                light: this.lightAzimuth + angleDiff(this.lightAzimuth, side)
            }, animate ? 1.1 : 0);
        }

        /** Обычный вид: со своей стороны, наклон по пресету, без приближения. */
        resetView(animate = true) {
            if (this.cineLock) return Promise.resolve();
            this.elevUser = false;
            const side = this.sideAzimuth();
            return this.animateView({
                azimuth: this.azimuth + angleDiff(this.azimuth, side),
                elevation: this.presetElevation(),
                zoom: 1,
                pan: new T.Vector3(),
                light: this.lightAzimuth + angleDiff(this.lightAzimuth, side)
            }, animate ? 0.8 : 0);
        }

        /** Повернуть камеру вокруг доски на delta радиан (кнопки ⟲ ⟳). */
        rotateBy(delta) {
            if (this.cineLock) return Promise.resolve();
            const base = this.viewGoal && this.viewGoal.azimuth !== undefined ? this.viewGoal.azimuth : this.azimuth;
            return this.animateView({ azimuth: base + delta }, 0.45);
        }

        /** Приблизить (factor < 1) или отдалить камеру к центру кадра (кнопки + −). */
        zoomBy(factor) {
            if (this.cineLock) return Promise.resolve();
            const r = this.renderer.domElement.getBoundingClientRect();
            return this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor, true);
        }

        /** Приближение к точке экрана (cx, cy): точка доски под ней остаётся на месте. */
        zoomAt(cx, cy, factor, animate = false) {
            const z0 = this.zoom, z1 = clamp(z0 * factor, ZOOM_MIN, ZOOM_MAX);
            if (Math.abs(z1 - z0) < 1e-4) return Promise.resolve();
            const hit = this.boardPointAt(cx, cy);
            const f = this.fitFrame(this.azimuth, this.elevation);
            const pan = this.pan.clone();
            if (hit) {
                const tgt = f.target.clone().add(this.pan);
                pan.copy(hit).add(tgt.sub(hit).multiplyScalar(z1 / z0)).sub(f.target);
            }
            this.clampPanVec(pan, z1);
            if (animate) return this.animateView({ zoom: z1, pan }, 0.3);
            this.zoom = z1;
            this.pan.copy(pan);
            this.updateCamera();
            return Promise.resolve();
        }

        /** Ограничить сдвиг: чем ближе камера, тем дальше можно уйти от центра. */
        clampPanVec(v, zoom = this.zoom) {
            const max = PAN_MAX * (1 - zoom) / (1 - ZOOM_MIN);
            const len = Math.hypot(v.x, v.z);
            if (len > max) {
                const k = max / len;
                v.x *= k;
                v.z *= k;
            }
            v.y = 0;
            return v;
        }

        /** Вращение перетаскиванием: по горизонтали — вокруг доски, по вертикали — наклон. */
        orbitBy(dx, dy) {
            const r = this.renderer.domElement.getBoundingClientRect();
            this.azimuth -= dx * Math.PI * 2 / Math.max(360, r.width) * 0.85;
            if (dy) this.elevUser = true;
            this.elevation = clamp(this.elevation + dy * Math.PI / Math.max(300, r.height) * 0.75, EL_MIN, EL_MAX);
            this.updateCamera();
        }

        /** Сдвиг: точка доски под (x0, y0) переезжает под (x1, y1). */
        panBetween(x0, y0, x1, y1) {
            const a = this.boardPointAt(x0, y0), b = this.boardPointAt(x1, y1);
            if (!a || !b) return;
            this.pan.x += a.x - b.x;
            this.pan.z += a.z - b.z;
            this.clampPanVec(this.pan);
            this.updateCamera();
        }

        boardPointAt(cx, cy) {
            return rayPlane(this.rayFrom({ clientX: cx, clientY: cy }), 0);
        }

        // ---------- Тема и доска ----------
        setTheme(key) {
            if (this.theme === key) return;
            this.theme = key;
            const spec = CM.Boards[key];
            this.buildBoard(spec);
            const L = spec.light;
            this.hemi.color.set(L.hemiSky);
            this.hemi.groundColor.set(L.hemiGround);
            this.hemi.intensity = L.hemi;
            this.sun.color.set(L.sun);
            this.sun.intensity = L.sunI;
            this.scene.environmentIntensity = L.env;
            this.renderer.toneMappingExposure = L.exposure;
            this.hemiBase = L.hemi;
            // Новая вселенная — обычный вид (без кинокамеры и приближения)
            this.cineReset();
            this.stopViewAnim();
            this.elevUser = false;
            this.elevation = this.presetElevation();
            this.zoom = 1;
            this.pan.set(0, 0, 0);
            this.updateCamera();
            if (this.lastBoard) this.setPosition(this.lastBoard);
            this.drawHighlights();
            this.warmUp();
        }

        buildBoard(spec) {
            for (const o of this.boardGroup.children.slice()) {
                this.boardGroup.remove(o);
                o.geometry.dispose();
                if (o.material.map) o.material.map.dispose();
                o.material.dispose();
            }
            const size = 9.2, thick = 0.32;
            const frame = new T.Mesh(CM.G.roundedBox(size, thick, size, 0.08, 3), new T.MeshPhysicalMaterial({
                color: spec.side, roughness: spec.sideRough, clearcoat: spec.clearcoat, clearcoatRoughness: 0.2
            }));
            frame.position.y = -thick / 2;
            frame.castShadow = true;
            frame.receiveShadow = true;
            this.boardGroup.add(frame);
            const topSize = size - 0.16;
            const S = this.lowPower || this.quality === 'low' ? 1024 : 2048;
            const L = CM.Boards.layout(S, topSize);
            const tex = CM.Tex.canvas(S, S, (ctx) => spec.drawTop(ctx, L));
            const top = new T.Mesh(new T.PlaneGeometry(topSize, topSize), new T.MeshPhysicalMaterial({
                map: tex, roughness: 0.55, clearcoat: spec.clearcoat, clearcoatRoughness: 0.18
            }));
            top.rotation.x = -Math.PI / 2;
            top.position.y = 0.002;
            top.receiveShadow = true;
            this.boardGroup.add(top);
            this.requestRender();
        }

        // ---------- Фигуры ----------
        template(color, type, theme = this.theme) {
            return CM.getTemplate(theme, color, type);
        }

        makePiece(color, type) {
            const tpl = this.template(color, type);
            const model = tpl.clone(true);
            const holder = new T.Group();
            holder.add(model);
            const wheels = [], reels = [];
            model.traverse((o) => {
                if (o.name === 'wheel') wheels.push(o);
                if (o.name === 'reel') reels.push(o);
            });
            return { holder, model, color, type, wheels, reels, height: tpl.userData.height || 1, lift: 0 };
        }

        /**
         * Поворот фигуры на доске. Модели смотрят «носом» в +z; персонажи тем с faceOpponent
         * стоят лицом к соперникам: белые — к чёрным (−z), чёрные — к белым (+z).
         * От камеры поворот не зависит: вращая доску, можно рассмотреть фигуры с любой стороны.
         */
        pieceYaw(p) {
            const spec = CM.Themes3D[this.theme];
            const base = spec.faceOpponent && p.color === 'w' ? Math.PI : 0;
            return base + (spec.yaw ? spec.yaw(p.type, p.color) : 0);
        }

        placeAt(p, sq) {
            const [x, z] = sqToXZ(sq);
            p.holder.position.set(x, p.lift, z);
            p.holder.rotation.y = this.pieceYaw(p);
        }

        /** Расставить фигуры по массиву chess.js board() без анимации. */
        setPosition(board) {
            this.lastBoard = board;
            this.version = (this.version || 0) + 1;
            if (!this.theme) return;
            // Позицию заменили посреди кинохода (отмена, новая партия) — сразу обычная камера
            if (this.cineLock || this.cine.w > 0) {
                this.cineReset();
                this.updateCamera();
            }
            this.clearPieces();
            for (let r = 0; r < 8; r++) {
                for (let f = 0; f < 8; f++) {
                    const cell = board[r][f];
                    if (!cell) continue;
                    const sq = FILES[f] + (8 - r);
                    const p = this.makePiece(cell.color, cell.type);
                    this.pieces.set(sq, p);
                    this.pieceGroup.add(p.holder);
                    this.placeAt(p, sq);
                }
            }
            this.syncSelection();
            this.requestRender();
        }

        clearPieces() {
            for (const p of this.pieces.values()) this.pieceGroup.remove(p.holder);
            this.pieces.clear();
            for (const a of Array.from(this.anims)) if (a.piece) { this.anims.delete(a); a.resolve(); }
        }

        /** Подсветить выбранную фигуру подъёмом */
        syncSelection() {
            for (const [sq, p] of this.pieces) {
                const want = sq === this.highlight.selected ? 0.14 : 0;
                if (Math.abs(p.lift - want) < 1e-3 || p.moving) continue;
                const from = p.lift;
                p.lift = want;
                const a = this.tween(0.18, (e) => {
                    if (!p.moving && !p.dragging) p.holder.position.y = lerp(from, want, e);
                }, want ? Ease.outBack : Ease.out);
                a.piece = p;
            }
        }

        /**
         * Сыграть ход (объект хода chess.js) с анимацией.
         * opts.dragged — фигуру уже перенесли мышью/пальцем, её не нужно везти через доску;
         * opts.cinematic — кинокамера подлетает к ходу, следит за фигурой, удар — в замедлении;
         * opts.onStart() — фигура тронулась; opts.onImpact() — удар при взятии;
         * opts.onFx(name) — звуковые моменты эффектов: 'whoosh', 'shatter', 'boom', 'zap', 'pop'.
         */
        async applyMove(move, opts = {}) {
            const call = (fn, arg) => { if (fn) { try { fn(arg); } catch (e) { console.warn(e); } } };
            const p = this.pieces.get(move.from);
            if (!p || !this.theme) {
                call(opts.onStart);
                if (move.captured) call(opts.onImpact);
                return;
            }
            const version = this.version;
            const isEp = move.flags.includes('e');
            const capSq = isEp ? move.to[0] + move.from[1] : (move.captured ? move.to : null);
            const victim = capSq ? this.pieces.get(capSq) : null;
            this.pieces.delete(move.from);
            if (capSq) this.pieces.delete(capSq);
            this.pieces.set(move.to, p);
            p.lift = 0;

            const cine = !!opts.cinematic && !opts.dragged;
            let shot = 0;
            if (cine) {
                shot = this.cineBegin(move.from, move.to, !!capSq, opts.onFx);
                await this.cineFocus(shot);
                // Пока камера подлетала, позицию могли заменить (отмена хода, новая партия)
                if (version !== this.version) return;
                this.cineFollow = { token: shot, piece: p };
            }
            call(opts.onStart);
            if (capSq && !victim) call(opts.onImpact);

            const pace = cine ? 1.35 : 1;
            const jobs = [];
            if (move.flags.includes('k') || move.flags.includes('q')) {
                const rank = move.from[1];
                const [rf, rt] = move.flags.includes('k') ? ['h' + rank, 'f' + rank] : ['a' + rank, 'd' + rank];
                const rook = this.pieces.get(rf);
                if (rook) {
                    this.pieces.delete(rf);
                    this.pieces.set(rt, rook);
                    jobs.push(this.movePiece(rook, rt, { delay: 0.12, pace }));
                }
            }
            jobs.push(this.movePiece(p, move.to, {
                dragged: opts.dragged,
                knight: move.piece === 'n',
                pace,
                onArrive: victim ? () => {
                    call(opts.onImpact);
                    this.capture(victim, capSq, p, { cinematic: cine, onFx: opts.onFx });
                    if (cine) {
                        // После удара в кадре держим и атакующего, и отброшенную жертву
                        if (this.cineFollow && this.cineFollow.token === shot) this.cineFollow.victim = victim;
                        this.cineImpact(shot);
                    }
                } : null
            }));
            await Promise.all(jobs);
            // Пока шла анимация, позицию могли заменить (отмена хода, новая партия) — не трогаем её
            if (move.promotion && version === this.version) await this.promote(move.to, move.color, move.promotion);
            if (cine) await this.cineEnd(shot, victim ? 0.55 : 0.2);
        }

        // ---------- Кинокамера ----------
        /**
         * Кинокадр хода: камера низко, сбоку-сзади или сбоку-спереди от движения —
         * из четырёх ракурсов берётся ближайший к тому, откуда смотрит зритель.
         */
        cineBegin(fromSq, toSq, isCapture, onFx) {
            const token = ++this.cineToken;
            const [sx, sz] = sqToXZ(fromSq), [tx, tz] = sqToXZ(toSq);
            const len = Math.hypot(tx - sx, tz - sz);
            const h = Math.atan2(tx - sx, tz - sz);
            const cur = this.cine.w > 0 ? this.cine.azimuth : this.azimuth;
            let best = null;
            for (const a of [h + Math.PI + 0.75, h + Math.PI - 0.75, h + 0.95, h - 0.95]) {
                if (best === null || Math.abs(angleDiff(cur, a)) < Math.abs(angleDiff(cur, best))) best = a;
            }
            const k = isCapture ? 0.6 : 0.4;
            this.cineShot = {
                azimuth: cur + angleDiff(cur, best),
                elevation: 0.36 + Math.min(0.16, len * 0.02),
                dist: 3.2 + len * 0.42,
                target: new T.Vector3(lerp(sx, tx, k), 0.38, lerp(sz, tz, k)),
                dest: new T.Vector3(tx, 0.38, tz),
                drift: (Math.random() < 0.5 ? -1 : 1) * 0.09
            };
            this.cineLock = true;
            this.stopViewAnim();
            this.ptrs.clear();
            this.gesture = null;
            if (onFx) onFx('whoosh');
            return token;
        }

        /** Подлёт кинокамеры к кадру хода. */
        cineFocus(token) {
            const S = this.cineShot, c = this.cine, w0 = c.w;
            if (w0 <= 0) {
                c.azimuth = S.azimuth;
                c.elevation = S.elevation;
                c.dist = S.dist;
                c.target.copy(S.target);
            }
            const from = { az: c.azimuth, el: c.elevation, dist: c.dist, target: c.target.clone() };
            return this.tween(0.65, (e) => {
                if (token !== this.cineToken) return;
                c.w = lerp(w0, 1, e);
                c.azimuth = lerpAngle(from.az, S.azimuth, e);
                c.elevation = lerp(from.el, S.elevation, e);
                c.dist = lerp(from.dist, S.dist, e);
                c.target.lerpVectors(from.target, S.target, e);
                this.updateCamera();
            }, Ease.inOut);
        }

        /** Во время хода кинокамера следит за фигурой, медленно облетая и наезжая. */
        updateCineFollow(dt) {
            const F = this.cineFollow;
            if (!F) return;
            if (F.token !== this.cineToken || !this.cineShot) { this.cineFollow = null; return; }
            const c = this.cine, S = this.cineShot, pp = F.piece.holder.position;
            const want = this.cineWant || (this.cineWant = new T.Vector3());
            want.set(lerp(pp.x, S.dest.x, 0.35), 0.38 + pp.y * 0.5, lerp(pp.z, S.dest.z, 0.35));
            if (F.victim) {
                // Жертва ещё летит — запоминаем, где она; после взрыва смотрим на это место
                if (F.victim.holder.parent) F.victimPos = (F.victimPos || new T.Vector3()).copy(F.victim.holder.position);
                if (F.victimPos) want.set((pp.x + F.victimPos.x) / 2, 0.38, (pp.z + F.victimPos.z) / 2);
            }
            c.target.lerp(want, 1 - Math.exp(-dt * 5));
            c.azimuth += S.drift * dt;
            c.dist = Math.max(2.4, c.dist * (1 - 0.05 * dt));
            this.updateCamera();
        }

        /** Удар в кинорежиме: замедленная съёмка и короткий наезд камеры. */
        cineImpact(token) {
            if (token !== this.cineToken) return;
            this.slowmo(0.22, 0.55);
            const c = this.cine, d0 = c.dist, el0 = c.elevation;
            this.tween(0.3, (e) => {
                if (token !== this.cineToken) return;
                c.dist = d0 * (1 - 0.1 * e);
                c.elevation = el0 - 0.05 * e;
            }, Ease.out);
        }

        /** Досмотреть ход (hold секунд) и плавно вернуть камеру зрителю. */
        async cineEnd(token, hold) {
            if (token !== this.cineToken) return;
            await this.tween(hold, () => {}, Ease.linear);
            if (token !== this.cineToken) return;
            this.cineFollow = null;
            const c = this.cine, w0 = c.w;
            await this.tween(0.75, (e) => {
                if (token !== this.cineToken) return;
                c.w = w0 * (1 - e);
                this.updateCamera();
            }, Ease.inOut);
            if (token !== this.cineToken) return;
            this.cineReset();
            this.updateCamera();
        }

        cineReset() {
            this.cineToken++;
            this.cineFollow = null;
            this.cineShot = null;
            this.cineLock = false;
            this.cine.w = 0;
            this.slow = null;
            this.timeScale = this.speed;
            this.shakeAmp = 0;
        }

        /** Перевезти фигуру на клетку с анимацией в стиле темы. */
        movePiece(p, sq, o = {}) {
            const spec = CM.Themes3D[this.theme];
            const [tx, tz] = sqToXZ(sq);
            const sx = p.holder.position.x, sz = p.holder.position.z, sy = p.holder.position.y;
            const dist = Math.hypot(tx - sx, tz - sz);
            const endYaw = this.pieceYaw(p);
            p.moving = true;
            const done = () => {
                p.moving = false;
                p.holder.position.set(tx, 0, tz);
                p.holder.rotation.y = endYaw;
                p.model.scale.set(1, 1, 1);
                p.model.position.y = 0;
                p.model.rotation.set(0, 0, 0);
                this.requestRender();
            };
            let arrived = false;
            const arrive = (t) => {
                if (!arrived && t >= 0.82 && o.onArrive) { arrived = true; o.onArrive(); }
            };
            if (o.dragged) {
                // Плавно «приземлить» уже перенесённую фигуру
                return this.tween(0.16, (e) => {
                    p.holder.position.set(lerp(sx, tx, e), lerp(sy, 0, e), lerp(sz, tz, e));
                    arrive(e);
                }, Ease.out).then(() => { if (!arrived && o.onArrive) o.onArrive(); done(); });
            }
            const motion = spec.motion;
            const pace = o.pace || 1;
            const dur = Math.min(0.75, 0.3 + dist * 0.07) * pace;
            const heading = Math.atan2(tx - sx, tz - sz);
            const startYaw = p.holder.rotation.y;

            if (motion === 'drive' && !o.knight) {
                // Машинка: повернуть, проехать с вращением колёс, развернуться обратно
                const turn = 0.16 * pace, back = 0.2 * pace, total = turn + dur + back;
                // Фигуры смотрят носом (+z) в сторону движения
                return this.tween(total, (e, raw, dt) => {
                    const time = raw * total;
                    if (time < turn) {
                        p.holder.rotation.y = lerpAngle(startYaw, heading, Ease.inOut(time / turn));
                    } else if (time < turn + dur) {
                        const k = (time - turn) / dur;
                        const ke = Ease.inOut(k);
                        p.holder.position.set(lerp(sx, tx, ke), sy * (1 - ke) + Math.sin(Math.PI * k) * 0.03, lerp(sz, tz, ke));
                        p.holder.rotation.y = heading;
                        p.model.rotation.x = -Math.sin(Math.PI * k) * 0.05;
                        const speed = (Math.PI * Math.cos(Math.PI * (k - 0.5)) / 2) * dist / dur;
                        for (const w of p.wheels) w.rotation.x += speed * dt / 0.1;
                        for (const r of p.reels) r.rotation.x += dt * 9;
                        arrive(k);
                    } else {
                        p.holder.position.set(tx, 0, tz);
                        p.model.rotation.x = 0;
                        p.holder.rotation.y = lerpAngle(heading, endYaw, Ease.inOut((time - turn - dur) / back));
                        arrive(1);
                    }
                }, Ease.linear).then(done);
            }

            if (motion === 'hop') {
                // Персонажи скачут: несколько прыжков с «приплющиванием»
                const hops = Math.max(1, Math.min(3, Math.round(dist)));
                const hopT = 0.22 * pace, settleT = 0.12 * pace;
                const total = hopT * hops + settleT;
                return this.tween(total, (e, raw) => {
                    const k = Math.min(1, raw * total / (hopT * hops));
                    const ke = Ease.inOut(k);
                    const hk = (k * hops) % 1;
                    const hopH = (o.knight ? 0.55 : 0.22 + dist * 0.03) * Math.sin(Math.PI * hk);
                    p.holder.position.set(lerp(sx, tx, ke), sy * (1 - ke) + (k < 1 ? hopH : 0), lerp(sz, tz, ke));
                    p.holder.rotation.y = k < 1 ? lerpAngle(startYaw, heading, Math.min(1, k * 4)) : lerpAngle(heading, endYaw, (raw * total - hopT * hops) / settleT);
                    const squash = k < 1 ? 1 - 0.1 * Math.cos(Math.PI * 2 * hk) : 1;
                    p.model.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
                    arrive(k);
                }, Ease.linear).then(done);
            }

            // Классика и прыжки коней: дуга с подъёмом
            const lift = o.knight ? 0.9 : 0.28 + dist * 0.02;
            const flip = motion === 'drive' && o.knight;
            return this.tween(dur + (o.knight ? 0.1 : 0), (e, raw, dt) => {
                p.holder.position.set(lerp(sx, tx, e), lerp(sy, 0, e) + Math.sin(Math.PI * e) * lift, lerp(sz, tz, e));
                if (flip) {
                    p.holder.rotation.y = lerpAngle(startYaw, endYaw, e) + Math.PI * 2 * Ease.inOut(raw);
                    for (const w of p.wheels) w.rotation.x += dt * 25;
                }
                arrive(e);
            }, Ease.inOut).then(done);
        }

        /**
         * Взятие. Со спецэффектами — в стиле вселенной: классическая фигура разлетается
         * на осколки, машинку таранят и она взрывается, персонажа бьёт разрядом дефибриллятора.
         * Без спецэффектов — жертва подпрыгивает и исчезает в облачке частиц.
         */
        capture(victim, sq, attacker, o = {}) {
            const [x, z] = sqToXZ(sq);
            victim.moving = true;
            // Направление удара — от атакующего к жертве
            let dx = attacker ? x - attacker.holder.position.x : 0, dz = attacker ? z - attacker.holder.position.z : 0;
            const len = Math.hypot(dx, dz);
            if (len < 0.05) { dx = 0; dz = attacker && attacker.color === 'b' ? 1 : -1; } else { dx /= len; dz /= len; }
            if (!this.captureFx) { this.capturePlain(victim, x, z, dx, dz); return; }
            const strong = !!o.cinematic;
            const fx = o.onFx || (() => {});
            this.shake(strong ? 0.16 : 0.07);
            if (this.theme === 'classic') this.fxShatter(victim, x, z, dx, dz, strong, fx);
            else if (this.theme === 'cars') this.fxCrash(victim, x, z, dx, dz, strong, fx);
            else this.fxZap(victim, attacker, x, z, dx, dz, strong, fx);
        }

        capturePlain(victim, x, z, dx, dz) {
            const start = victim.holder.position.clone();
            this.burst(x, 0.35, z, { count: 34, speed: 2.4, colors: BURST_COLORS[this.theme], size: 0.13 });
            this.tween(0.55, (e, raw) => {
                victim.holder.position.set(start.x + dx * 0.7 * raw, Math.sin(Math.PI * Math.min(1, raw * 1.3)) * 0.7, start.z + dz * 0.7 * raw);
                victim.holder.rotation.y += 0.25;
                victim.holder.rotation.z = raw * 1.4;
                victim.holder.scale.setScalar(Math.max(0.001, 1 - Ease.in(raw)));
            }, Ease.linear).then(() => this.removeVictim(victim));
        }

        removeVictim(victim) {
            this.pieceGroup.remove(victim.holder);
            if (victim.clonedMats) for (const m of victim.clonedMats) m.dispose();
            victim.clonedMats = null;
            this.requestRender();
        }

        /** Классика: вспышка, ударная волна и фигура разлетается на осколки своего цвета. */
        fxShatter(victim, x, z, dx, dz, strong, fx) {
            const cols = this.pieceColors(victim);
            const h = victim.height || 1;
            fx('shatter');
            this.flash(x, 0.7, z, '#ffe3ad', strong ? 42 : 30);
            this.glow(x, h * 0.55, z, '#fff1c9', 1.9);
            this.shockwave(x, z, '#ffd27a');
            this.burst(x, h * 0.5, z, { count: strong ? 46 : 32, speed: 3.8, up: 1.4, gravity: 7.5, life: 0.6, size: 0.07, colors: ['#fff6d6', '#ffd66b', '#ffffff'], additive: true });
            this.burst(x, 0.12, z, { count: 14, speed: 0.8, up: 0.25, gravity: -0.35, life: 1.3, size: 0.45, grow: 0.8, opacity: 0.3, colors: ['#d8cbb4', '#bfb29c'] });
            const n = strong ? 28 : 20;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.8;
                this.spawnDebris(
                    x + (Math.random() - 0.5) * 0.28, 0.08 + Math.random() * h * 0.85, z + (Math.random() - 0.5) * 0.28,
                    Math.cos(a) * sp + dx * 2.2, 1.4 + Math.random() * 2.6, Math.sin(a) * sp + dz * 2.2,
                    cols[i % cols.length], 0.8 + Math.random() * 0.9);
            }
            victim.holder.visible = false;
            this.removeVictim(victim);
        }

        /** Тачки: таран — искры, машинка кувырком отлетает, падает и взрывается. */
        fxCrash(victim, x, z, dx, dz, strong, fx) {
            const cols = this.pieceColors(victim);
            this.flash(x, 0.5, z, '#ffb45c', strong ? 48 : 34);
            this.shockwave(x, z, '#ff9a3c');
            this.burst(x, 0.3, z, { count: strong ? 56 : 40, speed: 5.2, up: 1.1, gravity: 9, life: 0.45, size: 0.055, colors: ['#fff3b0', '#ffc107', '#ff6f00'], additive: true });
            // Машинку отбрасывает юзом: подлёт, крен и разворот вокруг себя (без переворота —
            // иначе на крупном плане камеру закрывает подставка)
            const start = victim.holder.position.clone();
            const yaw0 = victim.holder.rotation.y;
            const spin = (1.6 + Math.random() * 0.8) * Math.PI * (Math.random() < 0.5 ? -1 : 1);
            const tilt = (Math.random() < 0.5 ? -1 : 1) * 0.5;
            const H = 0.4 + Math.random() * 0.15;
            let smoke = 0;
            this.tween(0.8, (e, t, dt) => {
                const k = Ease.out(t);
                victim.holder.position.set(start.x + dx * 1.3 * k, 4 * H * t * (1 - t), start.z + dz * 1.3 * k);
                victim.holder.rotation.y = yaw0 + spin * k;
                victim.model.rotation.z = Math.sin(Math.PI * t) * tilt;
                victim.model.rotation.x = -Math.sin(Math.PI * t) * 0.3;
                smoke += dt;
                if (smoke > 0.07) {
                    smoke = 0;
                    const pp = victim.holder.position;
                    this.burst(pp.x, pp.y + 0.2, pp.z, { count: 3, speed: 0.25, up: 0.2, gravity: -0.4, life: 0.8, size: 0.3, grow: 1, opacity: 0.45, colors: ['#6d6d6d', '#8a8a8a'] });
                }
            }, Ease.linear).then(() => {
                const px = victim.holder.position.x, pz = victim.holder.position.z;
                this.removeVictim(victim);
                fx('boom');
                this.flash(px, 0.45, pz, '#ff7b2e', strong ? 60 : 44);
                this.glow(px, 0.4, pz, '#ffb74d', 2.4);
                this.shockwave(px, pz, '#ff6a2b');
                this.shake(strong ? 0.2 : 0.09);
                this.burst(px, 0.3, pz, { count: 36, speed: 2.2, up: 1.2, gravity: -1.2, life: 0.7, size: 0.3, grow: 1.3, colors: ['#fff2a8', '#ffb74d', '#ff7043', '#e64a19'], additive: true });
                this.burst(px, 0.35, pz, { count: 20, speed: 0.9, up: 0.7, gravity: -0.7, life: 1.8, size: 0.55, grow: 1.1, opacity: 0.55, colors: ['#4a4a4a', '#6b6b6b', '#353535'] });
                const parts = [cols[0], '#1c1c1c', cols[1] || '#b0bec5', '#b0bec5'];
                for (let i = 0, n = strong ? 18 : 12; i < n; i++) {
                    const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 2.2;
                    this.spawnDebris(px, 0.25, pz, Math.cos(a) * sp, 2 + Math.random() * 2.5, Math.sin(a) * sp, parts[i % parts.length], 0.9 + Math.random() * 0.8);
                }
            });
        }

        /**
         * Animal Hospital: разряд дефибриллятора — атакующий бьёт током, жертву отбрасывает
         * и приподнимает, она трясётся и светится, потом лопается брызгами (у аномалий — слизью),
         * а огонёк-душа улетает вверх.
         */
        fxZap(victim, attacker, x, z, dx, dz, strong, fx) {
            const cols = this.pieceColors(victim);
            const h = victim.height || 1;
            fx('zap');
            this.flash(x, 0.9, z, '#8fe9ff', strong ? 40 : 30);
            this.glow(x, h * 0.6, z, '#a8f0ff', 1.6);
            this.shockwave(x, z, '#5fd4ff');
            this.burst(x, h * 0.6, z, { count: 30, speed: 3, up: 1, gravity: 4, life: 0.5, size: 0.06, colors: ['#e0fbff', '#7fe3ff', '#ffffff'], additive: true });
            // Материалы общие для всех одинаковых фигур — светится только копия у жертвы
            const mats = [];
            victim.model.traverse((ob) => {
                if (!ob.isMesh || !ob.material || Array.isArray(ob.material)) return;
                const m = ob.material.clone();
                if (m.emissive) m.emissive.set('#58d6ff');
                ob.material = m;
                mats.push(m);
            });
            victim.clonedMats = mats;
            const bolts = [];
            const clearBolts = () => {
                for (const b of bolts) { this.fxGroup.remove(b); b.geometry.dispose(); }
                bolts.length = 0;
            };
            const base = victim.holder.position.clone();
            const at = new T.Vector3();
            let tick = 0;
            this.tween(strong ? 0.55 : 0.42, (e, raw, dt) => {
                // Жертву отбрасывает с клетки и приподнимает над доской
                const k = Ease.out(Math.min(1, raw * 3));
                const px = base.x + dx * 0.75 * k, pz = base.z + dz * 0.75 * k, py = 0.5 * k;
                victim.holder.position.set(px + (Math.random() - 0.5) * 0.06, py, pz + (Math.random() - 0.5) * 0.06);
                victim.model.rotation.z = (Math.random() - 0.5) * 0.18;
                for (const m of mats) if (m.emissive) m.emissiveIntensity = 0.5 + Math.random() * 1.2;
                tick -= dt;
                if (tick > 0) return;
                tick = 0.06;
                clearBolts();
                const to = () => at.set(px + (Math.random() - 0.5) * 0.25, py + h * (0.3 + Math.random() * 0.5), pz + (Math.random() - 0.5) * 0.25).clone();
                // Разряды из «дефибриллятора» атакующего и с неба
                if (attacker) {
                    const a = attacker.holder.position;
                    for (let i = 0; i < 2; i++) {
                        bolts.push(...this.bolt(new T.Vector3(a.x + (Math.random() - 0.5) * 0.2, a.y + (attacker.height || 1) * 0.55, a.z + (Math.random() - 0.5) * 0.2), to()));
                    }
                }
                bolts.push(...this.bolt(new T.Vector3(px + (Math.random() - 0.5) * 0.6, py + h + 0.8 + Math.random() * 0.5, pz + (Math.random() - 0.5) * 0.6), to()));
                this.boltMat.opacity = 0.6 + Math.random() * 0.4;
                this.boltGlowMat.opacity = 0.25 + Math.random() * 0.25;
            }, Ease.linear).then(() => {
                clearBolts();
                fx('pop');
                return this.tween(0.16, (e) => victim.holder.scale.setScalar(1 + 0.35 * e), Ease.out);
            }).then(() => {
                const px = victim.holder.position.x, pz = victim.holder.position.z, py = victim.holder.position.y;
                const splash = victim.color === 'b' ? ['#b04dff', '#7c3aed', '#76ff03', '#c6ff00'] : ['#ffffff', '#ff8fb1', '#9be7ff'];
                this.burst(px, py + h * 0.55, pz, { count: strong ? 60 : 44, speed: 3.2, up: 1.8, gravity: 8, life: 0.9, size: 0.11, colors: cols.concat(splash) });
                this.shockwave(px, pz, victim.color === 'b' ? '#b04dff' : '#9be7ff');
                this.burst(px, py + h * 0.7, pz, { count: 1, speed: 0, up: 1.6, gravity: -0.6, life: 1.5, size: 0.5, colors: ['#e8fbff'], additive: true });
                this.burst(px, py + h * 0.7, pz, { count: 6, speed: 0.4, up: 1.3, gravity: -0.5, life: 1.3, size: 0.12, colors: ['#bdf3ff', '#ffffff'], additive: true });
                this.removeVictim(victim);
            });
        }

        /** Молния от a до b: изломанная яркая сердцевина и голубое свечение вокруг. */
        bolt(a, b) {
            const pts = [];
            const n = 11;
            for (let i = 0; i <= n; i++) {
                const p = a.clone().lerp(b, i / n);
                if (i > 0 && i < n) {
                    p.x += (Math.random() - 0.5) * 0.26;
                    p.y += (Math.random() - 0.5) * 0.14;
                    p.z += (Math.random() - 0.5) * 0.26;
                }
                pts.push(p);
            }
            const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.02);
            const core = new T.Mesh(new T.TubeGeometry(curve, 44, 0.011, 4, false), this.boltMat);
            const glow = new T.Mesh(new T.TubeGeometry(curve, 44, 0.04, 5, false), this.boltGlowMat);
            core.renderOrder = 7;
            glow.renderOrder = 6;
            this.fxGroup.add(glow, core);
            return [core, glow];
        }

        /** Вспышка света в точке удара. */
        flash(x, y, z, color, power) {
            const L = this.flashLight;
            const token = this.flashToken = (this.flashToken || 0) + 1;
            if (!L) {
                // Облегчённая графика: без точечного света — на миг ярче рассеянный свет сцены
                const base = this.hemiBase || this.hemi.intensity;
                this.tween(0.4, (e, raw) => { if (token === this.flashToken) this.hemi.intensity = base * (1 + 1.4 * (1 - raw)); }, Ease.linear)
                    .then(() => { if (token === this.flashToken) this.hemi.intensity = base; });
                return;
            }
            L.color.set(color);
            L.position.set(x, y, z);
            this.tween(0.45, (e, raw) => {
                if (token !== this.flashToken) return;
                L.intensity = power * (raw < 0.06 ? raw / 0.06 : Math.pow(1 - (raw - 0.06) / 0.94, 2));
            }, Ease.linear).then(() => { if (token === this.flashToken) L.intensity = 0; });
        }

        /** Яркое пятно света, обращённое к камере. */
        glow(x, y, z, color, size) {
            this.burst(x, y, z, { count: 1, speed: 0, up: 0, gravity: 0, life: 0.28, size, colors: [color], additive: true });
        }

        /** Кольцо ударной волны по доске. */
        shockwave(x, z, color) {
            const m = new T.Mesh(this.ringGeo, new T.MeshBasicMaterial({
                color, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide
            }));
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, 0.03, z);
            m.renderOrder = 3;
            this.fxGroup.add(m);
            this.tween(0.6, (e, raw) => {
                const k = 0.4 + e * 2.5;
                m.scale.set(k, k, k);
                m.material.opacity = 0.9 * (1 - raw);
            }, Ease.out).then(() => {
                this.fxGroup.remove(m);
                m.material.dispose();
            });
        }

        /** Осколок: летит, кувыркается, отскакивает от доски и тает. */
        spawnDebris(x, y, z, vx, vy, vz, color, size = 1) {
            const geo = this.debrisGeos[(Math.random() * this.debrisGeos.length) | 0];
            const m = new T.Mesh(geo, this.debrisMat(color));
            m.position.set(x, y, z);
            m.rotation.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
            m.scale.setScalar(size);
            this.fxGroup.add(m);
            const spin = () => (Math.random() - 0.5) * 16;
            this.debris.push({ m, v: new T.Vector3(vx, vy, vz), w: new T.Vector3(spin(), spin(), spin()), life: 0, max: 1.4 + Math.random() * 0.6, size });
            this.requestRender();
        }

        updateDebris(dt) {
            for (let i = this.debris.length - 1; i >= 0; i--) {
                const d = this.debris[i], m = d.m;
                d.life += dt;
                d.v.y -= 9.8 * dt;
                m.position.addScaledVector(d.v, dt);
                // На доске осколки лежат на её поверхности, за краем — падают на «пол»
                const onBoard = Math.abs(m.position.x) < 4.6 && Math.abs(m.position.z) < 4.6;
                const floor = onBoard ? 0.03 * d.size : -0.3;
                if (m.position.y < floor) {
                    m.position.y = floor;
                    if (d.v.y < 0) d.v.y = -d.v.y * 0.32;
                    d.v.x *= 0.62;
                    d.v.z *= 0.62;
                    d.w.multiplyScalar(0.55);
                }
                m.rotation.x += d.w.x * dt;
                m.rotation.y += d.w.y * dt;
                m.rotation.z += d.w.z * dt;
                const k = d.life / d.max;
                if (k > 0.72) m.scale.setScalar(d.size * Math.max(0.001, (1 - k) / 0.28));
                if (k >= 1) {
                    this.fxGroup.remove(m);
                    this.debris.splice(i, 1);
                }
            }
        }

        /** Основные цвета фигуры (по цветам её модели, без подставки) — для осколков и брызг. */
        pieceColors(p) {
            const key = this.theme + p.color + p.type;
            if (this.colorCache.has(key)) return this.colorCache.get(key);
            const bins = new Map();
            const v = new T.Vector3(), c = new T.Color();
            // Подставку (нижние ~0.16) не считаем: осколки должны быть цвета самой фигуры
            const minY = p.holder.position.y + Math.max(0.16, (p.height || 1) * 0.2);
            p.holder.updateMatrixWorld(true);
            p.model.traverse((o) => {
                if (!o.isMesh || !o.geometry || Array.isArray(o.material)) return;
                const pos = o.geometry.attributes.position, col = o.geometry.attributes.color;
                if (!pos) return;
                const mc = o.material && o.material.color;
                const step = Math.max(1, Math.floor(pos.count / 240));
                for (let i = 0; i < pos.count; i += step) {
                    v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
                    if (v.y < minY) continue;
                    if (mc) c.copy(mc); else c.setRGB(1, 1, 1);
                    if (col) { c.r *= col.getX(i); c.g *= col.getY(i); c.b *= col.getZ(i); }
                    const q = ((c.r * 7.99) | 0) * 64 + ((c.g * 7.99) | 0) * 8 + ((c.b * 7.99) | 0);
                    const b = bins.get(q) || { n: 0, r: 0, g: 0, b: 0 };
                    b.n += step; b.r += c.r * step; b.g += c.g * step; b.b += c.b * step;
                    bins.set(q, b);
                }
            });
            const hsl = {};
            const list = Array.from(bins.values()).map((b) => {
                const col = new T.Color(b.r / b.n, b.g / b.n, b.b / b.n);
                col.getHSL(hsl);
                return { col, w: b.n * (0.35 + hsl.s) };
            }).sort((a, b) => b.w - a.w);
            const out = [];
            for (const it of list) {
                if (out.length >= 3) break;
                const far = out.every((o) => Math.abs(o.r - it.col.r) + Math.abs(o.g - it.col.g) + Math.abs(o.b - it.col.b) > 0.25);
                if (far) out.push(it.col);
            }
            if (!out.length) out.push(new T.Color('#cccccc'));
            this.colorCache.set(key, out);
            return out;
        }

        async promote(sq, color, type) {
            const old = this.pieces.get(sq);
            if (!old) return;
            const [x, z] = sqToXZ(sq);
            this.burst(x, 0.6, z, { count: 46, speed: 2.8, colors: ['#fff59d', '#ffffff', '#ffd54f', '#80deea'], size: 0.12, up: 2 });
            await this.tween(0.22, (e) => { old.holder.scale.setScalar(Math.max(0.001, 1 - e)); old.holder.rotation.y += 0.3; }, Ease.in);
            this.pieceGroup.remove(old.holder);
            const p = this.makePiece(color, type);
            this.pieces.set(sq, p);
            this.pieceGroup.add(p.holder);
            this.placeAt(p, sq);
            p.holder.scale.setScalar(0.001);
            await this.tween(0.55, (e) => { p.holder.scale.setScalar(Math.max(0.001, e)); }, Ease.outElastic);
        }

        /** Вернуть фигуру на её клетку (после неудачного перетаскивания). */
        returnPiece(sq) {
            const p = this.pieces.get(sq);
            if (!p) return Promise.resolve();
            const [tx, tz] = sqToXZ(sq);
            const s = p.holder.position.clone();
            const liftTo = sq === this.highlight.selected ? 0.14 : 0;
            p.lift = liftTo;
            p.moving = true;
            return this.tween(0.22, (e) => {
                p.holder.position.set(lerp(s.x, tx, e), lerp(s.y, liftTo, e), lerp(s.z, tz, e));
            }, Ease.out).then(() => {
                p.moving = false;
                // За время возврата выбор мог смениться — поднимаем/опускаем фигуру по факту
                this.syncSelection();
            });
        }

        // ---------- Эффекты ----------
        burst(x, y, z, o = {}) {
            const n = o.count || 24;
            const geo = new T.BufferGeometry();
            const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
            const vel = [];
            const colors = (o.colors || ['#ffffff']).map((c) => new T.Color(c));
            for (let i = 0; i < n; i++) {
                pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
                const a = Math.random() * Math.PI * 2, u = Math.random();
                const sp = (o.speed || 2) * (0.4 + Math.random() * 0.8);
                vel.push(new T.Vector3(Math.cos(a) * sp * Math.sqrt(1 - u * u), (o.up || 1.2) + u * sp, Math.sin(a) * sp * Math.sqrt(1 - u * u)));
                const c = colors[i % colors.length];
                col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
            }
            geo.setAttribute('position', new T.BufferAttribute(pos, 3));
            geo.setAttribute('color', new T.BufferAttribute(col, 3));
            const mat = new T.PointsMaterial({
                size: o.size || 0.12, map: this.dotTex, vertexColors: true, transparent: true, depthWrite: false,
                sizeAttenuation: true, opacity: o.opacity || 1, toneMapped: false
            });
            // Искры и свечение складываются со светом сцены, дым и брызги — обычные
            if (o.additive) mat.blending = T.AdditiveBlending;
            const pts = new T.Points(geo, mat);
            this.fxGroup.add(pts);
            this.particles.push({
                pts, vel, life: 0, max: o.life || 0.9, gravity: o.gravity === undefined ? 4 : o.gravity,
                size: o.size || 0.12, grow: o.grow || 0, opacity: o.opacity || 1
            });
            this.requestRender();
        }

        updateParticles(dt) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const P = this.particles[i];
                P.life += dt;
                const pos = P.pts.geometry.attributes.position;
                for (let j = 0; j < P.vel.length; j++) {
                    const v = P.vel[j];
                    v.y -= P.gravity * dt;
                    v.multiplyScalar(1 - dt * 1.2);
                    pos.setXYZ(j, pos.getX(j) + v.x * dt, Math.max(0.02, pos.getY(j) + v.y * dt), pos.getZ(j) + v.z * dt);
                }
                pos.needsUpdate = true;
                if (P.grow) P.pts.material.size = P.size * (1 + P.grow * P.life);
                P.pts.material.opacity = P.opacity * Math.max(0, 1 - P.life / P.max);
                if (P.life >= P.max) {
                    this.fxGroup.remove(P.pts);
                    P.pts.geometry.dispose();
                    P.pts.material.dispose();
                    this.particles.splice(i, 1);
                }
            }
        }

        /** Шах: кольцо под королём и дрожь фигуры. */
        showCheck(sq) {
            this.highlight.check = sq;
            if (!sq) {
                this.checkRing.visible = false;
                this.drawHighlights();
                return;
            }
            const [x, z] = sqToXZ(sq);
            this.checkRing.position.set(x, 0.012, z);
            this.checkRing.visible = true;
            const p = this.pieces.get(sq);
            if (p) {
                this.tween(0.6, (e, raw) => {
                    if (!p.moving) p.model.rotation.z = Math.sin(raw * Math.PI * 8) * 0.12 * (1 - raw);
                }, Ease.linear).then(() => { p.model.rotation.z = 0; });
            }
            this.drawHighlights();
        }

        /** Мат: поверженный король падает, над доской — салют частиц. */
        async showMate(kingSq, winnerColor) {
            const p = this.pieces.get(kingSq);
            if (p) {
                const spin = this.theme === 'cars';
                await this.tween(spin ? 1.1 : 0.9, (e, raw) => {
                    if (spin) {
                        p.holder.rotation.y += 0.35 * (1 - raw);
                        p.model.rotation.z = Ease.outBack(Math.min(1, raw * 1.4)) * 0.5;
                    } else {
                        p.model.rotation.x = -Ease.outBack(raw) * 1.35;
                        p.model.position.y = Math.sin(Math.PI * raw) * 0.15;
                    }
                }, Ease.linear);
            }
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    const x = (Math.random() - 0.5) * 6, z = (Math.random() - 0.5) * 6;
                    this.burst(x, 1.2 + Math.random(), z, {
                        count: 60, speed: 3.2, up: 0.6, gravity: 2.2, life: 1.4, size: 0.14,
                        colors: winnerColor === 'w' ? ['#fff8e1', '#ffd54f', '#ffffff', '#ffe082'] : ['#b388ff', '#ff5252', '#ffd740', '#40c4ff']
                    });
                }, i * 260);
            }
        }

        // ---------- Подсветка ----------
        setHighlights(h) {
            Object.assign(this.highlight, h);
            this.syncSelection();
            this.drawHighlights();
        }

        drawHighlights() {
            const c = this.hlCanvas, ctx = c.getContext('2d');
            const S = c.width, s = S / 8;
            ctx.clearRect(0, 0, S, S);
            const H = this.highlight;
            const cell = (sq) => [(sq.charCodeAt(0) - 97) * s, (8 - parseInt(sq[1], 10)) * s];
            const pal = {
                classic: { last: 'rgba(255,214,90,0.42)', sel: 'rgba(120,200,255,0.5)', dot: 'rgba(30,20,10,0.38)', cap: 'rgba(200,40,40,0.55)' },
                cars: { last: 'rgba(255,225,77,0.45)', sel: 'rgba(80,220,255,0.5)', dot: 'rgba(15,15,20,0.42)', cap: 'rgba(230,30,30,0.6)' },
                hospital: { last: 'rgba(255,200,90,0.45)', sel: 'rgba(120,120,255,0.42)', dot: 'rgba(20,80,90,0.42)', cap: 'rgba(230,50,80,0.55)' }
            }[this.theme || 'classic'];
            if (H.last) {
                ctx.fillStyle = pal.last;
                for (const sq of [H.last.from, H.last.to]) { const [x, y] = cell(sq); ctx.fillRect(x, y, s, s); }
            }
            if (H.selected) {
                const [x, y] = cell(H.selected);
                ctx.fillStyle = pal.sel;
                ctx.fillRect(x, y, s, s);
            }
            if (H.check) {
                const [x, y] = cell(H.check);
                const g = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.1, x + s / 2, y + s / 2, s * 0.72);
                g.addColorStop(0, 'rgba(255,40,40,0.95)');
                g.addColorStop(0.6, 'rgba(255,40,40,0.45)');
                g.addColorStop(1, 'rgba(255,40,40,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x, y, s, s);
            }
            for (const t of H.targets || []) {
                const [x, y] = cell(t.sq);
                if (t.capture) {
                    ctx.fillStyle = pal.cap;
                    const k = s * 0.3;
                    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]]) {
                        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * k, cy); ctx.lineTo(cx, cy + dy * k); ctx.closePath(); ctx.fill();
                    }
                } else {
                    ctx.fillStyle = pal.dot;
                    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.15, 0, Math.PI * 2); ctx.fill();
                }
            }
            if (H.hover) {
                const [x, y] = cell(H.hover);
                ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                ctx.lineWidth = s * 0.06;
                ctx.strokeRect(x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92);
            }
            this.hlTex.needsUpdate = true;
            this.requestRender();
        }

        // ---------- Ввод ----------
        rayFrom(ev) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const ndc = new T.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
            if (!this.raycaster) this.raycaster = new T.Raycaster();
            this.raycaster.setFromCamera(ndc, this.camera);
            return this.raycaster.ray;
        }

        /**
         * Клетка под указателем. Цилиндры вокруг фигур отбирают кандидатов, затем луч проверяется
         * по настоящей геометрии (от ближних к дальним) — так высокая фигура впереди не «перехватывает»
         * клик по соседней. Если в фигуру не попали — берём клетку доски под указателем.
         * precise = false — только быстрая проверка по цилиндрам (для курсора при наведении).
         */
        pickSquare(ev, precise = true) {
            const ray = this.rayFrom(ev);
            const cands = [];
            for (const [sq, p] of this.pieces) {
                if (p.dragging || p.moving) continue;
                const h = p.height * p.holder.scale.y + p.holder.position.y;
                const t = rayCylinder(ray, p.holder.position.x, p.holder.position.z, 0.4, 0, h);
                if (t !== null) cands.push({ sq, p, t });
            }
            cands.sort((a, b) => a.t - b.t);
            const hit = rayPlane(ray, 0);
            const boardSq = hit ? xzToSq(hit.x, hit.z) : null;
            if (!precise) return cands.length ? cands[0].sq : boardSq;
            for (const c of cands) {
                c.p.holder.updateMatrixWorld(true);
                if (this.raycaster.intersectObject(c.p.holder, true).length) return c.sq;
            }
            return boardSq;
        }

        /** Курсор: «рука» над своими фигурами, «захват» над остальной доской — её можно крутить. */
        onHover(ev) {
            if (this.ptrs.size) return;
            const el = this.renderer.domElement;
            if (this.cineLock) { el.style.cursor = 'default'; return; }
            const sq = this.interactive ? this.pickSquare(ev, false) : null;
            const clickable = sq && this.handlers.canPick && this.handlers.canPick(sq);
            el.style.cursor = clickable ? 'pointer' : 'grab';
        }

        /**
         * Нажатие. Своя фигура — выбор и перетаскивание. Всё остальное ждёт: сдвинулся указатель —
         * это вращение камеры, нет — обычный клик по клетке (ход, снятие выбора).
         * Правая кнопка — всегда вращение, средняя или Shift — сдвиг кадра, два пальца — жест.
         */
        onPointerDown(ev) {
            ev.preventDefault();
            if (this.cineLock) return;
            const P = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, touch: ev.pointerType === 'touch', mode: 'pending', sq: null };
            this.ptrs.set(ev.pointerId, P);
            try { this.renderer.domElement.setPointerCapture(ev.pointerId); } catch (e) { /* не критично */ }
            if (this.ptrs.size >= 2) { this.beginGesture(); return; }
            if (ev.button === 2) { P.mode = 'orbit'; return; }
            if (ev.button === 1 || (ev.button === 0 && ev.shiftKey)) { P.mode = 'pan'; return; }
            if (ev.button > 2) { P.mode = 'none'; return; }
            P.sq = this.pickSquare(ev);
            if (this.interactive && P.sq && this.handlers.canPick && this.handlers.canPick(P.sq)) {
                P.mode = 'piece';
                P.canDrag = !!this.handlers.down(P.sq) && this.pieces.has(P.sq);
            }
        }

        onPointerMove(ev) {
            const P = this.ptrs.get(ev.pointerId);
            if (!P || this.cineLock) return;
            const dx = ev.clientX - P.lx, dy = ev.clientY - P.ly;
            P.lx = ev.clientX;
            P.ly = ev.clientY;
            if (this.gesture) { this.updateGesture(); return; }
            if (P.mode === 'pending' && Math.hypot(ev.clientX - P.x, ev.clientY - P.y) > (P.touch ? 10 : 6)) P.mode = 'orbit';
            if (P.mode === 'orbit' || P.mode === 'pan') {
                if (!P.started) {
                    P.started = true;
                    this.stopViewAnim();
                    this.renderer.domElement.style.cursor = 'grabbing';
                }
                if (P.mode === 'orbit') this.orbitBy(dx, dy);
                else this.panBetween(ev.clientX - dx, ev.clientY - dy, ev.clientX, ev.clientY);
                return;
            }
            if (P.mode !== 'piece') return;
            if (!P.dragging && P.canDrag && Math.hypot(ev.clientX - P.x, ev.clientY - P.y) > 6) {
                const p = this.pieces.get(P.sq);
                if (!p) return;
                P.dragging = true;
                p.dragging = true;
                this.renderer.domElement.style.cursor = 'grabbing';
            }
            if (P.dragging) {
                const p = this.pieces.get(P.sq);
                const hit = rayPlane(this.rayFrom(ev), 0);
                if (p && hit) {
                    p.holder.position.set(Math.max(-4.3, Math.min(4.3, hit.x)), 0.45, Math.max(-4.3, Math.min(4.3, hit.z)));
                }
                const target = hit ? xzToSq(hit.x, hit.z) : null;
                if (target !== this.highlight.hover) {
                    this.highlight.hover = target;
                    this.drawHighlights();
                }
                this.requestRender();
            }
        }

        onPointerUp(ev) {
            const P = this.ptrs.get(ev.pointerId);
            if (!P) return;
            this.ptrs.delete(ev.pointerId);
            if (this.gesture) {
                // Жест двумя пальцами закончился: оставшийся палец уже не станет кликом
                if (this.ptrs.size < 2) this.gesture = null;
                for (const q of this.ptrs.values()) q.mode = 'none';
                return;
            }
            this.renderer.domElement.style.cursor = 'default';
            if (this.cineLock) return;
            const cancel = ev.type === 'pointercancel';
            if (P.mode === 'piece') {
                if (P.dragging) {
                    const p = this.pieces.get(P.sq);
                    const hit = rayPlane(this.rayFrom(ev), 0);
                    const target = hit && !cancel ? xzToSq(hit.x, hit.z) : null;
                    this.highlight.hover = null;
                    if (p) p.dragging = false;
                    const res = target && target !== P.sq ? this.handlers.drop(P.sq, target) : false;
                    if (res === 'pending' && p && target) {
                        const [tx, tz] = sqToXZ(target);
                        const s = p.holder.position.clone();
                        this.tween(0.15, (e) => p.holder.position.set(lerp(s.x, tx, e), lerp(s.y, 0.1, e), lerp(s.z, tz, e)), Ease.out);
                    } else if (!res) {
                        this.returnPiece(P.sq);
                    }
                    this.drawHighlights();
                } else if (!cancel) {
                    this.handlers.up(this.pickSquare(ev), P.sq);
                }
            } else if (P.mode === 'pending' && !cancel) {
                // Клик по клетке без своей фигуры: ход выбранной фигурой или снятие выбора
                this.handlers.down(P.sq);
                this.handlers.up(P.sq, P.sq);
            }
        }

        /** Второй палец: перетаскивание фигуры отменяется, начинается жест камерой. */
        beginGesture() {
            for (const P of this.ptrs.values()) {
                if (P.mode === 'piece' && P.dragging) this.cancelPieceDrag(P);
                P.mode = 'gesture';
            }
            const [a, b] = Array.from(this.ptrs.values());
            this.gesture = {
                dist: Math.hypot(b.lx - a.lx, b.ly - a.ly), angle: Math.atan2(b.ly - a.ly, b.lx - a.lx),
                cx: (a.lx + b.lx) / 2, cy: (a.ly + b.ly) / 2
            };
            this.stopViewAnim();
        }

        /** Два пальца: поворот крутит доску, щипок приближает, общий сдвиг двигает кадр. */
        updateGesture() {
            const pts = Array.from(this.ptrs.values());
            if (pts.length < 2) return;
            const [a, b] = pts, G = this.gesture;
            const dist = Math.hypot(b.lx - a.lx, b.ly - a.ly), angle = Math.atan2(b.ly - a.ly, b.lx - a.lx);
            const cx = (a.lx + b.lx) / 2, cy = (a.ly + b.ly) / 2;
            this.azimuth += angleDiff(G.angle, angle);
            this.updateCamera();
            if (G.dist > 12 && dist > 12) this.zoomAt(cx, cy, G.dist / dist);
            this.panBetween(G.cx, G.cy, cx, cy);
            Object.assign(G, { dist, angle, cx, cy });
        }

        cancelPieceDrag(P) {
            const p = this.pieces.get(P.sq);
            if (p) p.dragging = false;
            P.dragging = false;
            this.highlight.hover = null;
            this.returnPiece(P.sq);
            this.drawHighlights();
        }

        /** Колёсико мыши (и щипок на тачпаде) — приближение к точке под курсором. */
        onWheel(ev) {
            let dy = ev.deltaY;
            if (ev.deltaMode === 1) dy *= 16;
            else if (ev.deltaMode === 2) dy *= 400;
            const factor = Math.exp(clamp(dy * (ev.ctrlKey ? 0.01 : 0.0015), -0.5, 0.5));
            // Камера уже в пределе приближения — колёсико прокручивает страницу, как обычно
            if (!ev.ctrlKey && ((factor > 1 && this.zoom >= ZOOM_MAX - 1e-4) || (factor < 1 && this.zoom <= ZOOM_MIN + 1e-4))) return;
            ev.preventDefault();
            if (this.cineLock) return;
            this.stopViewAnim();
            this.zoomAt(ev.clientX, ev.clientY, factor);
        }

        setInteractive(v) {
            this.interactive = v;
            if (v) return;
            for (const P of this.ptrs.values()) {
                if (P.mode !== 'piece') continue;
                if (P.dragging) this.cancelPieceDrag(P);
                P.mode = 'none';
            }
        }

        /** Настройки показа: { captureFx } — спецэффекты взятия. */
        setOptions(o) {
            if (o.captureFx !== undefined) this.captureFx = !!o.captureFx;
        }

        dispose() {
            if (this.ro) this.ro.disconnect();
            window.removeEventListener('pointermove', this.onPointerMove);
            window.removeEventListener('pointerup', this.onPointerUp);
            window.removeEventListener('pointercancel', this.onPointerUp);
            this.renderer.domElement.removeEventListener('wheel', this.onWheel);
            this.renderer.dispose();
        }
    }

    /**
     * Снимки 3D-фигур для интерфейса (взятые фигуры, выбор превращения, меню).
     * Отдельный небольшой рендерер: модели ставятся в ракурсе 3/4 на прозрачном фоне.
     */
    class SpriteMaker {
        constructor(size = 224) {
            this.size = size;
            this.cache = new Map();
            this.boards = null;
        }

        init() {
            if (this.renderer) return;
            const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            r.setPixelRatio(1);
            r.setSize(this.size, this.size, false);
            r.outputColorSpace = T.SRGBColorSpace;
            r.toneMapping = T.NeutralToneMapping;
            r.setClearColor(0x000000, 0);
            const s = this.scene = new T.Scene();
            const pm = new T.PMREMGenerator(r);
            s.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
            s.environmentIntensity = 0.75;
            pm.dispose();
            s.add(new T.HemisphereLight('#ffffff', '#555555', 0.9));
            const d = new T.DirectionalLight('#ffffff', 2.2);
            d.position.set(-2, 4, 3);
            s.add(d);
            this.camera = new T.PerspectiveCamera(24, 1, 0.1, 50);
        }

        /** dataURL снимка фигуры темы theme. */
        get(theme, color, type) {
            const key = theme + color + type;
            if (this.cache.has(key)) return this.cache.get(key);
            this.init();
            const tpl = CM.getTemplate(theme, color, type);
            const model = tpl.clone(true);
            const spec = CM.Themes3D[theme];
            const yaw = spec.portraitYaw !== undefined ? spec.portraitYaw : (spec.yaw ? spec.yaw(type, color) : 0) + 0.3;
            model.rotation.y = yaw;
            this.scene.add(model);
            const box = new T.Box3().setFromObject(model);
            const center = box.getCenter(new T.Vector3());
            const size = box.getSize(new T.Vector3());
            const radius = Math.max(size.x, size.y, size.z) * 0.62;
            const el = 0.38;
            const dist = radius / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 1.02;
            this.camera.position.set(center.x, center.y + Math.sin(el) * dist, center.z + Math.cos(el) * dist);
            this.camera.lookAt(center);
            this.renderer.render(this.scene, this.camera);
            const url = this.renderer.domElement.toDataURL('image/png');
            this.scene.remove(model);
            this.cache.set(key, url);
            return url;
        }
    }

    CM.Board3D = Board3D;
    CM.SpriteMaker = SpriteMaker;
    CM.Ease = Ease;
    CM.sqToXZ = sqToXZ;
})();
