/*
 * Трёхмерная шахматная доска на Three.js.
 * Отвечает только за показ и ввод: рисует доску и фигуры, анимирует ходы и эффекты,
 * превращает клики/перетаскивания в клетки и сообщает о них контроллеру (handlers).
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
    function lerpAngle(a, b, t) {
        let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
    }

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
            this.azimuth = 0;
            this.targetAzimuth = 0;
            this.elevation = 54 * Math.PI / 180;
            this.pieces = new Map();
            this.anims = new Set();
            this.particles = [];
            this.continuous = 0;
            this.raf = 0;
            this.lastFrame = 0;
            this.interactive = true;
            this.highlight = { selected: null, targets: [], last: null, check: null, hover: null };
            this.pointer = null;
            this.lowPower = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;

            this.loop = this.loop.bind(this);
            this.onPointerDown = this.onPointerDown.bind(this);
            this.onPointerMove = this.onPointerMove.bind(this);
            this.onPointerUp = this.onPointerUp.bind(this);

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
            this.target = new T.Vector3(0, 0, 0);

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
        }

        initEvents() {
            const el = this.renderer.domElement;
            el.style.touchAction = 'none';
            el.addEventListener('pointerdown', this.onPointerDown);
            el.addEventListener('pointermove', (e) => this.onHover(e));
            window.addEventListener('pointermove', this.onPointerMove);
            window.addEventListener('pointerup', this.onPointerUp);
            window.addEventListener('pointercancel', this.onPointerUp);
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
            const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0.016;
            this.lastFrame = now;
            this.clock = now;
            this.inLoop = true;
            for (const a of Array.from(this.anims)) {
                if (a.delay && now < a.t0) continue;
                const t = Math.min(1, Math.max(0, (now - a.t0) / a.duration));
                a.update(a.ease(t), t, dt);
                if (t >= 1) {
                    this.anims.delete(a);
                    a.resolve();
                }
            }
            this.inLoop = false;
            this.updateParticles(dt);
            if (this.checkRing.visible) {
                const k = 0.5 + 0.5 * Math.sin(now / 180);
                this.checkRing.material.opacity = 0.45 + 0.45 * k;
                this.checkRing.scale.setScalar(0.94 + 0.12 * k);
            }
            if (!this.lost) this.renderer.render(this.scene, this.camera);
            const busy = this.anims.size || this.particles.length || this.continuous > 0 || this.checkRing.visible;
            if (busy) {
                this.adaptQuality(dt);
                this.requestRender();
            } else {
                this.lastFrame = 0;
            }
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

        /** Анимация: update(eased, raw, dt) вызывается каждый кадр. Возвращает Promise. */
        tween(seconds, update, ease = Ease.inOut, delay = 0) {
            return new Promise((resolve) => {
                const k = 1000 / (this.timeScale || 1);
                // Анимации, запущенные внутри кадра, отсчитываются от времени этого кадра
                const t0 = (this.inLoop ? this.clock : performance.now()) + delay * k;
                this.anims.add({ t0, delay, duration: Math.max(1, seconds * k), update, ease, resolve });
                this.requestRender();
            });
        }

        // ---------- Камера ----------
        resize() {
            const w = this.container.clientWidth, h = this.container.clientHeight;
            if (!w || !h) return;
            this.renderer.setSize(w, h, false);
            this.camera.aspect = w / h;
            this.updateCamera();
            this.requestRender();
        }

        presetElevation(name = this.preset || 'normal') {
            const base = (this.theme && CM.Themes3D[this.theme].elevation) || 54;
            return ({ normal: base, top: 80, low: base - 16 }[name] || base) * Math.PI / 180;
        }

        setPreset(name, animate = true) {
            this.preset = name;
            const from = this.elevation, to = this.presetElevation(name);
            if (!animate) { this.elevation = to; this.updateCamera(); return Promise.resolve(); }
            return this.tween(0.6, (e) => { this.elevation = lerp(from, to, e); this.updateCamera(); });
        }

        updateCamera() {
            const cam = this.camera;
            const el = this.elevation, az = this.azimuth;
            const dir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
            const fwd = new T.Vector3(-Math.sin(az), 0, -Math.cos(az));
            // Что должно попасть в кадр: рамка доски и верхушки фигур на крайних клетках
            const H = (this.theme && CM.Themes3D[this.theme].fitHeight) || 1.0;
            const pts = [];
            for (const x of [-4.62, 4.62]) for (const z of [-4.62, 4.62]) pts.push(new T.Vector3(x, 0, z), new T.Vector3(x, -0.32, z));
            for (const x of [-3.9, 3.9]) for (const z of [-3.9, 3.9]) pts.push(new T.Vector3(x, H, z));
            const v = new T.Vector3();
            const measure = (d, tgt) => {
                cam.position.copy(tgt).addScaledVector(dir, d);
                cam.lookAt(tgt);
                cam.updateMatrixWorld();
                cam.updateProjectionMatrix();
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
            const mx = 0.965, my = 0.95;
            const target = new T.Vector3();
            let d = 20;
            for (let iter = 0; iter < 4; iter++) {
                let lo = 3, hi = 90;
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
            measure(d, target);
            this.target.copy(target);
            // Свет «привязан» к зрителю: ключевой — спереди-слева, контровой — сзади-справа
            const up = new T.Vector3(0, 1, 0);
            this.sun.position.copy(new T.Vector3(-5, 11, 6).applyAxisAngle(up, az));
            this.sun.target.position.set(0, 0, 0);
            this.rim.position.copy(new T.Vector3(6, 6, -7).applyAxisAngle(up, az));
            this.updatePieceYaws();
            this.requestRender();
        }

        /** Повернуть доску к стороне color ('w' — белые внизу). */
        setOrientation(color, animate = true) {
            const to = color === 'b' ? Math.PI : 0;
            this.orientation = color;
            if (!animate) {
                this.azimuth = to;
                this.updateCamera();
                return Promise.resolve();
            }
            const from = this.azimuth;
            if (Math.abs(from - to) < 1e-3) return Promise.resolve();
            return this.tween(1.1, (e) => { this.azimuth = lerpAngle(from, to, e); this.updateCamera(); }, Ease.inOut);
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
            this.elevation = this.presetElevation();
            this.updateCamera();
            if (this.lastBoard) this.setPosition(this.lastBoard);
            this.drawHighlights();
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

        pieceYaw(p) {
            const spec = CM.Themes3D[this.theme];
            const extra = spec.yaw ? spec.yaw(p.type, p.color) : 0;
            return this.azimuth + (spec.yawOffset || 0) + extra;
        }

        updatePieceYaws() {
            for (const p of this.pieces.values()) {
                if (!p.moving) p.holder.rotation.y = this.pieceYaw(p);
            }
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
         * opts.dragged — фигуру уже перенесли мышью/пальцем, её не нужно везти через доску.
         */
        async applyMove(move, opts = {}) {
            const p = this.pieces.get(move.from);
            if (!p || !this.theme) return;
            const version = this.version;
            const isEp = move.flags.includes('e');
            const capSq = isEp ? move.to[0] + move.from[1] : (move.captured ? move.to : null);
            const victim = capSq ? this.pieces.get(capSq) : null;
            this.pieces.delete(move.from);
            if (capSq) this.pieces.delete(capSq);
            this.pieces.set(move.to, p);
            p.lift = 0;

            const jobs = [];
            if (move.flags.includes('k') || move.flags.includes('q')) {
                const rank = move.from[1];
                const [rf, rt] = move.flags.includes('k') ? ['h' + rank, 'f' + rank] : ['a' + rank, 'd' + rank];
                const rook = this.pieces.get(rf);
                if (rook) {
                    this.pieces.delete(rf);
                    this.pieces.set(rt, rook);
                    jobs.push(this.movePiece(rook, rt, { delay: 0.12 }));
                }
            }
            jobs.push(this.movePiece(p, move.to, {
                dragged: opts.dragged,
                knight: move.piece === 'n',
                onArrive: victim ? () => this.capture(victim, capSq, p) : null
            }));
            await Promise.all(jobs);
            // Пока шла анимация, позицию могли заменить (отмена хода, новая партия) — не трогаем её
            if (move.promotion && version === this.version) await this.promote(move.to, move.color, move.promotion);
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
            const dur = Math.min(0.75, 0.3 + dist * 0.07);
            const heading = Math.atan2(tx - sx, tz - sz);
            const startYaw = p.holder.rotation.y;

            if (motion === 'drive' && !o.knight) {
                // Машинка: повернуть, проехать с вращением колёс, развернуться обратно
                const turn = 0.16, back = 0.2, total = turn + dur + back;
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
                const total = 0.22 * hops + 0.12;
                return this.tween(total, (e, raw) => {
                    const k = Math.min(1, raw * total / (0.22 * hops));
                    const ke = Ease.inOut(k);
                    const hk = (k * hops) % 1;
                    const hopH = (o.knight ? 0.55 : 0.22 + dist * 0.03) * Math.sin(Math.PI * hk);
                    p.holder.position.set(lerp(sx, tx, ke), sy * (1 - ke) + (k < 1 ? hopH : 0), lerp(sz, tz, ke));
                    p.holder.rotation.y = k < 1 ? lerpAngle(startYaw, heading, Math.min(1, k * 4)) : lerpAngle(heading, endYaw, (raw * total - 0.22 * hops) / 0.12);
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

        /** Взятие: жертва подпрыгивает, крутится и исчезает в облачке частиц. */
        capture(victim, sq, attacker) {
            const [x, z] = sqToXZ(sq);
            const dir = attacker ? Math.atan2(x - attacker.holder.position.x, z - attacker.holder.position.z) : 0;
            const vx = Math.sin(dir) * 1.4, vz = Math.cos(dir) * 1.4;
            const start = victim.holder.position.clone();
            victim.moving = true;
            this.burst(x, 0.35, z, { count: 34, speed: 2.4, colors: BURST_COLORS[this.theme], size: 0.13 });
            this.tween(0.55, (e, raw) => {
                victim.holder.position.set(start.x + vx * raw * 0.5, Math.sin(Math.PI * Math.min(1, raw * 1.3)) * 0.7, start.z + vz * raw * 0.5);
                victim.holder.rotation.y += 0.25;
                victim.holder.rotation.z = raw * 1.4;
                victim.holder.scale.setScalar(Math.max(0.001, 1 - Ease.in(raw)));
            }, Ease.linear).then(() => {
                this.pieceGroup.remove(victim.holder);
                this.requestRender();
            });
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
                sizeAttenuation: true, opacity: 1, toneMapped: false
            });
            const pts = new T.Points(geo, mat);
            this.fxGroup.add(pts);
            this.particles.push({ pts, vel, life: 0, max: o.life || 0.9, gravity: o.gravity === undefined ? 4 : o.gravity });
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
                P.pts.material.opacity = Math.max(0, 1 - P.life / P.max);
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

        onHover(ev) {
            if (this.pointer || !this.interactive) return;
            const sq = this.pickSquare(ev, false);
            const clickable = sq && this.handlers.canPick && this.handlers.canPick(sq);
            this.renderer.domElement.style.cursor = clickable ? 'pointer' : 'default';
        }

        onPointerDown(ev) {
            if (ev.button !== undefined && ev.button !== 0) return;
            if (!this.interactive) return;
            ev.preventDefault();
            const sq = this.pickSquare(ev);
            const canDrag = this.handlers.down(sq);
            this.pointer = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sq, dragging: false, canDrag: !!canDrag && this.pieces.has(sq) };
            try { this.renderer.domElement.setPointerCapture(ev.pointerId); } catch (e) { /* не критично */ }
        }

        onPointerMove(ev) {
            const P = this.pointer;
            if (!P || ev.pointerId !== P.id) return;
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
            const P = this.pointer;
            if (!P || ev.pointerId !== P.id) return;
            this.pointer = null;
            this.renderer.domElement.style.cursor = 'default';
            if (P.dragging) {
                const p = this.pieces.get(P.sq);
                const hit = rayPlane(this.rayFrom(ev), 0);
                const target = hit ? xzToSq(hit.x, hit.z) : null;
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
            } else if (ev.type !== 'pointercancel') {
                this.handlers.up(this.pickSquare(ev), P.sq);
            }
        }

        setInteractive(v) {
            this.interactive = v;
            if (!v && this.pointer && this.pointer.dragging) {
                const sq = this.pointer.sq;
                const p = this.pieces.get(sq);
                if (p) p.dragging = false;
                this.pointer = null;
                this.returnPiece(sq);
            }
        }

        dispose() {
            if (this.ro) this.ro.disconnect();
            window.removeEventListener('pointermove', this.onPointerMove);
            window.removeEventListener('pointerup', this.onPointerUp);
            window.removeEventListener('pointercancel', this.onPointerUp);
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
            const yaw = (spec.yawOffset || 0) + (spec.yaw ? spec.yaw(type, color) : 0) + (spec.faceCamera ? 0.35 : 0.3);
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
