/*
 * Общие помощники для 3D-фигур и доски: геометрия (токарные профили, деформации),
 * материалы (лак, винил, хром, резина), текстуры на canvas и подставки фигур.
 * Все модули 3D складываются в глобальное пространство имён window.CM.
 */
(function () {
    'use strict';
    const CM = window.CM = window.CM || {};
    const T = THREE;

    // ---------- Геометрия ----------

    /**
     * Профиль для LatheGeometry из команд пути (x — радиус, y — высота).
     * Команды: ['M', x, y], ['L', x, y], ['Q', cx, cy, x, y], ['C', c1x, c1y, c2x, c2y, x, y],
     * ['A', cx, cy, r, a0, a1] — дуга окружности (углы в градусах, 0° — вправо, 90° — вверх).
     */
    function profile(cmds, steps = 10) {
        const pts = [];
        let cx = 0, cy = 0;
        const push = (x, y) => pts.push(new T.Vector2(Math.max(0, x), y));
        for (const c of cmds) {
            const op = c[0];
            if (op === 'M' || op === 'L') {
                cx = c[1]; cy = c[2];
                push(cx, cy);
            } else if (op === 'Q') {
                const [, qx, qy, x, y] = c;
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps, u = 1 - t;
                    push(u * u * cx + 2 * u * t * qx + t * t * x, u * u * cy + 2 * u * t * qy + t * t * y);
                }
                cx = x; cy = y;
            } else if (op === 'C') {
                const [, ax, ay, bx, by, x, y] = c;
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps, u = 1 - t;
                    push(
                        u * u * u * cx + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x,
                        u * u * u * cy + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y
                    );
                }
                cx = x; cy = y;
            } else if (op === 'A') {
                const [, ox, oy, r, a0, a1] = c;
                const n = Math.max(4, Math.round(Math.abs(a1 - a0) / 8));
                for (let i = 0; i <= n; i++) {
                    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
                    push(ox + r * Math.cos(a), oy + r * Math.sin(a));
                }
                const a = a1 * Math.PI / 180;
                cx = ox + r * Math.cos(a); cy = oy + r * Math.sin(a);
            }
        }
        return pts;
    }

    function lathe(points, segments = 48, phiStart = 0, phiLength = Math.PI * 2) {
        return new T.LatheGeometry(points, segments, phiStart, phiLength);
    }

    function roundedBox(w, h, d, r, seg = 4) {
        return new T.RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    }

    /** Деформировать вершины: fn(v: Vector3) меняет v на месте. */
    function deform(geo, fn) {
        const pos = geo.attributes.position;
        const v = new T.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            fn(v, i);
            pos.setXYZ(i, v.x, v.y, v.z);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        return geo;
    }

    function ellipsoid(rx, ry, rz, ws = 32, hs = 24) {
        const g = new T.SphereGeometry(1, ws, hs);
        g.scale(rx, ry, rz);
        return g;
    }

    function tube(points, radius, tubular = 32, radial = 10, closed = false) {
        const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(p[0], p[1], p[2])), closed, 'catmullrom', 0.5);
        return new T.TubeGeometry(curve, tubular, radius, radial, closed);
    }

    /** Трубка с переменным радиусом (для хвостов, рогов, ушей). radiusFn(t) → радиус. */
    function taperedTube(points, radiusFn, tubular = 40, radial = 12) {
        const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(p[0], p[1], p[2])));
        const g = new T.TubeGeometry(curve, tubular, 1, radial, false);
        const pos = g.attributes.position;
        const center = new T.Vector3(), v = new T.Vector3();
        for (let i = 0; i <= tubular; i++) {
            const t = i / tubular;
            curve.getPointAt(t, center);
            const r = radiusFn(t);
            for (let j = 0; j <= radial; j++) {
                const idx = i * (radial + 1) + j;
                v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(r).add(center);
                pos.setXYZ(idx, v.x, v.y, v.z);
            }
        }
        g.computeVertexNormals();
        return g;
    }

    /** Плоская фигура из 2D-контура с объёмом (ExtrudeGeometry), центрированная по толщине. */
    function extrude(shape, depth, bevel = 0.02, bevelSeg = 3, curveSeg = 24) {
        const g = new T.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: bevel > 0,
            bevelThickness: bevel,
            bevelSize: bevel,
            bevelSegments: bevelSeg,
            curveSegments: curveSeg
        });
        g.translate(0, 0, -depth / 2);
        return g;
    }

    function roundedRectShape(w, h, r) {
        const s = new T.Shape();
        const x = -w / 2, y = -h / 2;
        s.moveTo(x + r, y);
        s.lineTo(x + w - r, y);
        s.quadraticCurveTo(x + w, y, x + w, y + r);
        s.lineTo(x + w, y + h - r);
        s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        s.lineTo(x + r, y + h);
        s.quadraticCurveTo(x, y + h, x, y + h - r);
        s.lineTo(x, y + r);
        s.quadraticCurveTo(x, y, x + r, y);
        return s;
    }

    /**
     * Скруглённая коробка, у которой каждая грань раскрашена своей картинкой из общего атласа.
     * faces: { front, back, top, bottom, right, left } — функции draw(ctx, fw, fh) рисуют грань
     * в её «реальных» единицах (fw × fh, с учётом скруглений), начало координат — левый верхний
     * угол грани при взгляде на неё снаружи. background — цвет, которым залиты все грани.
     * Возвращает { geometry, texture }.
     */
    function atlasBox(w, h, d, r, seg, faces, opts = {}) {
        const geo = roundedBox(w, h, d, r, seg);
        const rr = geo.parameters.radius;
        const ext = (side) => Math.max(side - 2 * rr, 0) + Math.PI * rr / 2;
        // Порядок граней в BoxGeometry: +x, −x, +y, −y, +z, −z
        const order = ['right', 'left', 'top', 'bottom', 'front', 'back'];
        const sizes = {
            right: [ext(d), ext(h)], left: [ext(d), ext(h)],
            top: [ext(w), ext(d)], bottom: [ext(w), ext(d)],
            front: [ext(w), ext(h)], back: [ext(w), ext(h)]
        };
        const density = opts.density || 700;
        const pad = 6;
        const maxW = opts.atlasWidth || 1024;
        // Полочная упаковка ячеек
        const cells = order.map((name) => {
            const [fw, fh] = sizes[name];
            const drawn = !!faces[name];
            const k = drawn ? density : density * 0.15;
            return { name, fw, fh, pw: Math.max(8, Math.round(fw * k)), ph: Math.max(8, Math.round(fh * k)) };
        });
        const sorted = cells.slice().sort((a, b) => b.ph - a.ph);
        let x = pad, y = pad, shelf = 0;
        for (const c of sorted) {
            if (x + c.pw + pad > maxW) { x = pad; y += shelf + pad; shelf = 0; }
            c.x = x; c.y = y;
            x += c.pw + pad;
            shelf = Math.max(shelf, c.ph);
        }
        const atlasW = maxW;
        let atlasH = 8;
        while (atlasH < y + shelf + pad) atlasH *= 2;

        const texture = canvasTexture(atlasW, atlasH, (ctx) => {
            ctx.fillStyle = opts.background || '#888';
            ctx.fillRect(0, 0, atlasW, atlasH);
            for (const c of cells) {
                const draw = faces[c.name];
                if (!draw) continue;
                ctx.save();
                ctx.beginPath();
                ctx.rect(c.x - 2, c.y - 2, c.pw + 4, c.ph + 4);
                ctx.clip();
                ctx.translate(c.x, c.y);
                ctx.scale(c.pw / c.fw, c.ph / c.fh);
                draw(ctx, c.fw, c.fh);
                ctx.restore();
            }
        });

        // Переносим UV каждой грани в её ячейку атласа
        const uv = geo.attributes.uv;
        const perFace = uv.count / 6;
        for (let f = 0; f < 6; f++) {
            const c = cells[f];
            for (let i = f * perFace; i < (f + 1) * perFace; i++) {
                const u = uv.getX(i), v = uv.getY(i);
                const px = c.x + u * c.pw, py = c.y + (1 - v) * c.ph;
                uv.setXY(i, px / atlasW, 1 - py / atlasH);
            }
        }
        uv.needsUpdate = true;
        geo.clearGroups();
        return { geometry: geo, texture, radius: rr };
    }

    // ---------- Материалы ----------
    const matCache = new Map();
    function cached(key, make) {
        let m = matCache.get(key);
        if (!m) { m = make(); matCache.set(key, m); }
        return m;
    }

    const Mat = {
        /** Автомобильная краска с лаком */
        paint(color, rough = 0.32) {
            return cached('paint' + color + rough, () => new T.MeshPhysicalMaterial({
                color, roughness: rough, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06
            }));
        },
        /** Виниловая игрушка — мягкий блеск */
        vinyl(color, rough = 0.5) {
            return cached('vinyl' + color + rough, () => new T.MeshPhysicalMaterial({
                color, roughness: rough, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35
            }));
        },
        matte(color, rough = 0.85) {
            return cached('matte' + color + rough, () => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
        },
        metal(color, rough = 0.25) {
            return cached('metal' + color + rough, () => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 1 }));
        },
        chrome() {
            return cached('chrome', () => new T.MeshStandardMaterial({ color: '#f2f4f7', roughness: 0.08, metalness: 1 }));
        },
        rubber() {
            return cached('rubber', () => new T.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.78, metalness: 0 }));
        },
        glass(color = '#1b2633') {
            return cached('glass' + color, () => new T.MeshPhysicalMaterial({
                color, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02
            }));
        },
        glow(color, intensity = 1.5) {
            return cached('glow' + color + intensity, () => new T.MeshStandardMaterial({
                color, emissive: color, emissiveIntensity: intensity, roughness: 0.4
            }));
        },
        /** Материал с текстурой (не кэшируется: у каждой текстуры свой) */
        textured(map, opts = {}) {
            return new T.MeshPhysicalMaterial(Object.assign({
                map, roughness: 0.45, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.25
            }, opts));
        },
        decal(map, opts = {}) {
            return new T.MeshStandardMaterial(Object.assign({
                map, transparent: true, roughness: 0.4, metalness: 0,
                polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false
            }, opts));
        }
    };

    // ---------- Текстуры на canvas ----------
    let maxAniso = 8;
    function canvasTexture(w, h, draw, opts = {}) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        draw(ctx, w, h);
        const tex = new T.CanvasTexture(c);
        tex.colorSpace = opts.linear ? T.NoColorSpace : T.SRGBColorSpace;
        tex.anisotropy = maxAniso;
        if (opts.repeat) {
            tex.wrapS = tex.wrapT = T.RepeatWrapping;
        }
        return tex;
    }

    /** Псевдослучайные числа с зерном — чтобы текстуры были одинаковыми при каждом запуске */
    function rng(seed) {
        let s = seed >>> 0 || 1;
        return () => {
            s ^= s << 13; s >>>= 0;
            s ^= s >>> 17;
            s ^= s << 5; s >>>= 0;
            return s / 4294967296;
        };
    }

    // ---------- Сборка моделей ----------
    function mesh(geo, material, x = 0, y = 0, z = 0, opts = {}) {
        const m = new T.Mesh(geo, material);
        m.position.set(x, y, z);
        if (opts.rx) m.rotation.x = opts.rx;
        if (opts.ry) m.rotation.y = opts.ry;
        if (opts.rz) m.rotation.z = opts.rz;
        if (opts.s) typeof opts.s === 'number' ? m.scale.setScalar(opts.s) : m.scale.set(opts.s[0], opts.s[1], opts.s[2]);
        if (opts.name) m.name = opts.name;
        m.castShadow = opts.shadow !== false;
        m.receiveShadow = opts.receive !== false;
        return m;
    }

    // Общие материалы с цветом в вершинах: одна «краска» на все детали с одинаковыми свойствами поверхности
    const bakedMats = new Map();
    function bakeable(m) {
        return m && m.isMeshStandardMaterial && !m.map && !m.transparent && m.opacity === 1 &&
            (!m.emissive || m.emissive.getHex() === 0 || m.emissiveIntensity === 0);
    }
    // Шероховатость округляем — почти одинаковые поверхности делят один материал
    const q = (v, step) => Math.round((v || 0) / step) * step;
    function bakedMaterial(m) {
        const rough = q(m.roughness, 0.15), cc = q(m.clearcoat, 0.5), ccr = q(m.clearcoatRoughness, 0.15);
        const sig = [m.type, rough, q(m.metalness, 0.5), cc, ccr, q(m.sheen, 0.5), m.side].join('|');
        let b = bakedMats.get(sig);
        if (!b) {
            b = m.clone();
            b.color = new T.Color(1, 1, 1);
            b.vertexColors = true;
            b.roughness = Math.max(0.05, rough);
            if (b.isMeshPhysicalMaterial) { b.clearcoat = cc; b.clearcoatRoughness = ccr; }
            bakedMats.set(sig, b);
        }
        return { sig, material: b };
    }
    let wheelMat = null;

    /**
     * Объединить меши модели — меньше вызовов отрисовки (важно для телефонов).
     * Детали без текстур сливаются в один меш с цветом в вершинах для каждого набора свойств
     * поверхности. Узлы с именем (колёса, мотовило) — отдельные анимируемые части: их содержимое
     * объединяется внутри них самих, колесо целиком становится одним мешем.
     */
    function optimize(root) {
        root.updateMatrixWorld(true);
        mergeScope(root);
        return root;
    }

    function mergeScope(scope) {
        const inv = new T.Matrix4().copy(scope.matrixWorld).invert();
        const single = scope.name === 'wheel';
        const buckets = new Map();
        const remove = [];
        const visit = (o) => {
            for (const c of o.children.slice()) {
                if (c.name && c !== scope) { mergeScope(c); continue; }
                if (c.isMesh && !Array.isArray(c.material)) collect(c);
                if (c.children.length) visit(c);
            }
        };
        const collect = (o) => {
            const m = o.material;
            let key, material, color = null;
            if (single) {
                wheelMat = wheelMat || new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35 });
                key = 'wheel'; material = wheelMat; color = m.color;
            } else if (bakeable(m)) {
                const b = bakedMaterial(m);
                key = 'bake|' + b.sig + (o.castShadow ? 's' : 'n');
                material = b.material; color = m.color;
            } else {
                key = m.uuid + (o.castShadow ? 's' : 'n');
                material = m;
            }
            if (!buckets.has(key)) buckets.set(key, { material, cast: single ? false : o.castShadow, geos: [], colored: !!color });
            const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
            g.clearGroups();
            g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
            for (const name of Object.keys(g.attributes)) {
                if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
            }
            const n = g.attributes.position.count;
            if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(n * 2), 2));
            if (color) {
                const arr = new Float32Array(n * 3);
                for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
                g.setAttribute('color', new T.Float32BufferAttribute(arr, 3));
            }
            buckets.get(key).geos.push(g);
            remove.push(o);
        };
        visit(scope);
        for (const o of remove) o.parent.remove(o);
        for (const b of buckets.values()) {
            const merged = b.geos.length === 1 ? b.geos[0] : T.mergeGeometries(b.geos, false);
            if (!merged) continue;
            const m = new T.Mesh(merged, b.material);
            m.castShadow = b.cast;
            m.receiveShadow = true;
            scope.add(m);
        }
        // Пустые группы-обёртки больше не нужны
        const prune = (o) => {
            for (const c of o.children.slice()) {
                if (c.name) continue;
                prune(c);
                if (!c.isMesh && !c.children.length) o.remove(c);
            }
        };
        prune(scope);
    }

    /** Подставка-«пьедестал» для фигурок: светлая с золотом или тёмная с цветным ободком. */
    function podium(color, accent, opts = {}) {
        const g = new T.Group();
        const r = opts.radius || 0.4;
        const h = opts.height || 0.085;
        const light = color === 'w';
        const body = light
            ? Mat.vinyl('#f4efe4', 0.3)
            : Mat.vinyl('#1e1a26', 0.32);
        const pts = profile([
            ['M', 0, 0], ['L', r - 0.02, 0], ['Q', r, 0, r, 0.02], ['L', r, h - 0.03],
            ['Q', r, h, r - 0.03, h], ['L', 0, h]
        ], 6);
        g.add(mesh(lathe(pts, 48), body, 0, 0, 0));
        const rim = new T.Mesh(new T.TorusGeometry(r - 0.012, 0.014, 10, 64), Mat.metal(accent || (light ? '#e2b447' : '#b8324a'), 0.3));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = h - 0.018;
        rim.castShadow = false;
        g.add(rim);
        g.userData.top = h;
        return g;
    }

    CM.G = { profile, lathe, roundedBox, deform, ellipsoid, tube, taperedTube, extrude, roundedRectShape, atlasBox };
    CM.Mat = Mat;
    CM.Tex = {
        canvas: canvasTexture,
        rng,
        setMaxAnisotropy(v) { maxAniso = v; }
    };
    // Кэш готовых моделей: одна сборка на тему/цвет/фигуру, дальше — только клоны
    const templates = {};
    function getTemplate(theme, color, type) {
        const bucket = templates[theme] || (templates[theme] = {});
        const key = color + type;
        if (!bucket[key]) bucket[key] = CM.Themes3D[theme].buildPiece(type, color);
        return bucket[key];
    }

    CM.mesh = mesh;
    CM.optimize = optimize;
    CM.getTemplate = getTemplate;
    CM.podium = podium;
    CM.Themes3D = CM.Themes3D || {};
})();
