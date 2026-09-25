/*
 * Оформление 3D-доски для каждой темы: текстура игрового поля с рамкой и координатами,
 * материал боковин, освещение сцены и объёмный декор (у хоккея — борта и ворота).
 */
(function () {
    'use strict';
    const CM = window.CM;

    const FILES = 'abcdefgh';

    /**
     * Общая раскладка текстуры: size — сторона canvas, units — размер плоскости в единицах,
     * клетки 8×8 по центру. Возвращает функцию-обёртку для рисования.
     */
    function layout(size, units) {
        const k = size / units;
        const off = ((units - 8) / 2) * k;
        return { k, off, sq: k, size, border: off };
    }

    function drawCoords(ctx, L, font, color, shadow) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = font.replace('{px}', Math.round(L.border * 0.5));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = L.border * 0.12; }
        const mid = L.border / 2;
        for (let i = 0; i < 8; i++) {
            const c = L.off + (i + 0.5) * L.sq;
            // Буквы снизу (для белых) и сверху (перевёрнутые, для чёрных)
            ctx.fillText(FILES[i], c, L.size - mid);
            ctx.save(); ctx.translate(c, mid); ctx.rotate(Math.PI); ctx.fillText(FILES[i], 0, 0); ctx.restore();
            // Цифры слева и справа
            const r = L.off + (7 - i + 0.5) * L.sq;
            ctx.fillText(String(i + 1), mid, r);
            ctx.save(); ctx.translate(L.size - mid, r); ctx.rotate(Math.PI); ctx.fillText(String(i + 1), 0, 0); ctx.restore();
        }
        ctx.restore();
    }

    function woodGrain(ctx, x, y, w, h, base, dark, rnd, vertical) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.fillStyle = base;
        ctx.fillRect(x, y, w, h);
        const lines = 46;
        for (let i = 0; i < lines; i++) {
            const t = rnd();
            ctx.strokeStyle = dark;
            ctx.globalAlpha = 0.05 + rnd() * 0.14;
            ctx.lineWidth = 0.6 + rnd() * 2.6;
            ctx.beginPath();
            const phase = rnd() * Math.PI * 2, amp = 2 + rnd() * 5, freq = 0.01 + rnd() * 0.02;
            if (vertical) {
                const x0 = x + t * w;
                for (let yy = y; yy <= y + h; yy += 6) ctx.lineTo(x0 + Math.sin(yy * freq + phase) * amp, yy);
            } else {
                const y0 = y + t * h;
                for (let xx = x; xx <= x + w; xx += 6) ctx.lineTo(xx, y0 + Math.sin(xx * freq + phase) * amp);
            }
            ctx.stroke();
        }
        // Мягкие «волокна» и сучки
        ctx.globalAlpha = 0.07;
        for (let i = 0; i < 3; i++) {
            const cx = x + rnd() * w, cy = y + rnd() * h, r = 8 + rnd() * 22;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, dark); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        ctx.restore();
    }

    function speckle(ctx, x, y, w, h, rnd, colors, count, size = 2.5) {
        for (let i = 0; i < count; i++) {
            ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
            const s = size * (0.5 + rnd());
            ctx.fillRect(x + rnd() * w, y + rnd() * h, s, s);
        }
    }

    // ---------- Классика ----------
    function classicTop(ctx, L) {
        const rnd = CM.Tex.rng(2024);
        woodGrain(ctx, 0, 0, L.size, L.size, '#4a2c17', '#1b0d05', rnd, false);
        const fr = ctx.createLinearGradient(0, 0, L.size, L.size);
        fr.addColorStop(0, 'rgba(255,220,170,0.06)'); fr.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = fr; ctx.fillRect(0, 0, L.size, L.size);
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const light = (r + f) % 2 === 0;
                const x = L.off + f * L.sq, y = L.off + r * L.sq;
                if (light) woodGrain(ctx, x, y, L.sq, L.sq, '#e9cf9f', '#a8844f', rnd, (r + f) % 4 === 0);
                else woodGrain(ctx, x, y, L.sq, L.sq, '#8f5d36', '#3e210c', rnd, (r + f) % 4 === 1);
            }
        }
        // Золотая инкрустация
        ctx.strokeStyle = '#d9b45a';
        ctx.lineWidth = L.k * 0.03;
        ctx.strokeRect(L.off - L.k * 0.045, L.off - L.k * 0.045, L.sq * 8 + L.k * 0.09, L.sq * 8 + L.k * 0.09);
        ctx.lineWidth = L.k * 0.012;
        ctx.strokeRect(L.border * 0.18, L.border * 0.18, L.size - L.border * 0.36, L.size - L.border * 0.36);
        drawCoords(ctx, L, '700 {px}px "Playfair Display", Georgia, serif', '#e8c878', 'rgba(0,0,0,0.6)');
    }

    // ---------- Тачки ----------
    function carsTop(ctx, L) {
        const rnd = CM.Tex.rng(95);
        // Рамка — асфальт с бордюром «красный-белый»
        ctx.fillStyle = '#3a3d44';
        ctx.fillRect(0, 0, L.size, L.size);
        speckle(ctx, 0, 0, L.size, L.size, rnd, ['#4a4e56', '#2c2f35', '#55595f'], 26000, 3);
        const kerb = L.border * 0.34;
        ctx.save();
        const stripe = L.k * 0.35;
        const drawKerb = (x, y, w, h, horizontal) => {
            ctx.save();
            ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
            const len = horizontal ? w : h;
            for (let i = 0; i * stripe < len + stripe; i++) {
                ctx.fillStyle = i % 2 ? '#f4f1ea' : '#d62828';
                if (horizontal) ctx.fillRect(x + i * stripe, y, stripe, h);
                else ctx.fillRect(x, y + i * stripe, w, stripe);
            }
            ctx.restore();
        };
        drawKerb(0, 0, L.size, kerb, true);
        drawKerb(0, L.size - kerb, L.size, kerb, true);
        drawKerb(0, 0, kerb, L.size, false);
        drawKerb(L.size - kerb, 0, kerb, L.size, false);
        ctx.restore();
        // Клетки: светлые — песчаный бетон, тёмные — асфальт
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const light = (r + f) % 2 === 0;
                const x = L.off + f * L.sq, y = L.off + r * L.sq;
                ctx.fillStyle = light ? '#ecd6a7' : '#5a5f68';
                ctx.fillRect(x, y, L.sq, L.sq);
                speckle(ctx, x, y, L.sq, L.sq, rnd, light ? ['#d9c08b', '#f7e6c1', '#cdb27c'] : ['#4b5058', '#6a6f78', '#42464d'], 700, 3);
                if (!light && rnd() < 0.25) {
                    ctx.strokeStyle = 'rgba(20,20,22,0.25)';
                    ctx.lineWidth = L.sq * 0.08;
                    ctx.beginPath();
                    ctx.arc(x + rnd() * L.sq, y + rnd() * L.sq, L.sq * (0.4 + rnd() * 0.4), rnd() * 6, rnd() * 6 + 1.2);
                    ctx.stroke();
                }
            }
        }
        // Шашечки финиша по углам
        const cs = L.border * 0.62 / 4;
        for (const [cx, cy] of [[0, 0], [L.size - L.border, 0], [0, L.size - L.border], [L.size - L.border, L.size - L.border]]) {
            const ox = cx + L.border * 0.19, oy = cy + L.border * 0.19;
            for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
                ctx.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5';
                ctx.fillRect(ox + i * cs, oy + j * cs, cs, cs);
            }
        }
        // Белая разметка вокруг поля
        ctx.strokeStyle = '#f7f3e8';
        ctx.lineWidth = L.k * 0.03;
        ctx.strokeRect(L.off - L.k * 0.04, L.off - L.k * 0.04, L.sq * 8 + L.k * 0.08, L.sq * 8 + L.k * 0.08);
        drawCoords(ctx, L, '900 {px}px "Russo One", "Arial Black", sans-serif', '#ffe14d', 'rgba(0,0,0,0.7)');
    }

    // ---------- Animal Hospital ----------
    function hospitalTop(ctx, L) {
        const rnd = CM.Tex.rng(7);
        ctx.fillStyle = '#eef3f2';
        ctx.fillRect(0, 0, L.size, L.size);
        speckle(ctx, 0, 0, L.size, L.size, rnd, ['#dfe7e6', '#f8fbfb'], 9000, 3);
        // Бирюзовая полоса по рамке
        ctx.fillStyle = '#2bb3a3';
        const band = L.border * 0.16;
        ctx.fillRect(L.border * 0.12, L.border * 0.12, L.size - L.border * 0.24, band);
        ctx.fillRect(L.border * 0.12, L.size - L.border * 0.12 - band, L.size - L.border * 0.24, band);
        ctx.fillRect(L.border * 0.12, L.border * 0.12, band, L.size - L.border * 0.24);
        ctx.fillRect(L.size - L.border * 0.12 - band, L.border * 0.12, band, L.size - L.border * 0.24);
        // Клетки — больничная плитка со швами
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const light = (r + f) % 2 === 0;
                const x = L.off + f * L.sq, y = L.off + r * L.sq;
                ctx.fillStyle = light ? '#f6faf9' : '#86cbbf';
                ctx.fillRect(x, y, L.sq, L.sq);
                speckle(ctx, x, y, L.sq, L.sq, rnd, light ? ['#e4eeec', '#ffffff'] : ['#78bfb3', '#95d5ca'], 380, 3);
                const g = ctx.createLinearGradient(x, y, x + L.sq, y + L.sq);
                g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.05)');
                ctx.fillStyle = g; ctx.fillRect(x, y, L.sq, L.sq);
                ctx.strokeStyle = light ? 'rgba(160,185,182,0.55)' : 'rgba(70,130,122,0.55)';
                ctx.lineWidth = L.sq * 0.025;
                ctx.strokeRect(x + 1, y + 1, L.sq - 2, L.sq - 2);
            }
        }
        // Красные кресты и следы лап по углам
        const cross = (cx, cy, s) => {
            ctx.fillStyle = '#e53935';
            ctx.fillRect(cx - s / 2, cy - s / 6, s, s / 3);
            ctx.fillRect(cx - s / 6, cy - s / 2, s / 3, s);
        };
        const m = L.border / 2;
        for (const [cx, cy] of [[m, m], [L.size - m, m], [m, L.size - m], [L.size - m, L.size - m]]) cross(cx, cy, L.border * 0.5);
        drawCoords(ctx, L, '700 {px}px Comfortaa, "Nunito", sans-serif', '#1f8f82', null);
    }

    // ---------- Хоккей ----------
    // Линии ворот — чуть за крайними горизонталями, в кайме доски
    const GOAL_LINE = 4.14;

    function hockeyTop(ctx, L) {
        const rnd = CM.Tex.rng(1974);
        const S = L.size, k = L.k;
        // Координаты доски (единицы, центр — 0) → пиксели текстуры; +z — сторона белых, внизу
        const X = (x) => S / 2 + x * k;
        const Z = (z) => S / 2 + z * k;
        const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
        g.addColorStop(0, '#f7fbfe');
        g.addColorStop(1, '#e2edf6');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
        speckle(ctx, 0, 0, S, S, rnd, ['#eaf3fa', '#ffffff', '#dde9f3'], 9000, 3);
        // Клетки: светлые — чистый лёд, тёмные — голубой
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const light = (r + f) % 2 === 0;
                const x = L.off + f * L.sq, y = L.off + r * L.sq;
                ctx.fillStyle = light ? '#f2f8fc' : '#8fc0e5';
                ctx.fillRect(x, y, L.sq, L.sq);
                speckle(ctx, x, y, L.sq, L.sq, rnd, light ? ['#e6f1f9', '#ffffff'] : ['#82b5dc', '#a3cdee', '#7aaed6'], 420, 3);
                const gl = ctx.createLinearGradient(x, y, x + L.sq, y + L.sq);
                gl.addColorStop(0, 'rgba(255,255,255,0.24)');
                gl.addColorStop(0.5, 'rgba(255,255,255,0)');
                gl.addColorStop(1, 'rgba(255,255,255,0.1)');
                ctx.fillStyle = gl;
                ctx.fillRect(x, y, L.sq, L.sq);
            }
        }
        // Разметка площадки «подо льдом»
        ctx.save();
        ctx.globalAlpha = 0.8;
        const RED = '#d61f2a', BLUE = '#1d5fd6';
        const line = (z, color, w) => { ctx.fillStyle = color; ctx.fillRect(0, Z(z) - (w * k) / 2, S, w * k); };
        line(0, RED, 0.075);
        for (const s of [-1, 1]) line(s, BLUE, 0.075);
        for (const s of [-1, 1]) line(s * GOAL_LINE, RED, 0.03);
        // Центральный круг вбрасывания
        ctx.strokeStyle = BLUE;
        ctx.lineWidth = 0.04 * k;
        ctx.beginPath(); ctx.arc(X(0), Z(0), 0.95 * k, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = BLUE;
        ctx.beginPath(); ctx.arc(X(0), Z(0), 0.08 * k, 0, Math.PI * 2); ctx.fill();
        // Круги вбрасывания в зонах с «усами» и точки у синих линий
        ctx.strokeStyle = RED;
        ctx.fillStyle = RED;
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
                const cx = X(sx * 2), cz = Z(sz * 2.55);
                ctx.lineWidth = 0.035 * k;
                ctx.beginPath(); ctx.arc(cx, cz, 0.8 * k, 0, Math.PI * 2); ctx.stroke();
                for (const hx of [-1, 1]) {
                    for (const hz of [-1, 1]) {
                        const x0 = hx > 0 ? cx + 0.8 * k : cx - 0.96 * k;
                        ctx.fillRect(x0, cz + hz * 0.14 * k - 0.0175 * k, 0.16 * k, 0.035 * k);
                    }
                }
                ctx.beginPath(); ctx.arc(cx, cz, 0.1 * k, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(X(sx * 2), Z(sz * 0.62), 0.08 * k, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Вратарские площадки перед воротами
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(X(0), Z(s * GOAL_LINE), 0.34 * k, s > 0 ? Math.PI : 0, s > 0 ? Math.PI * 2 : Math.PI);
            ctx.closePath();
            ctx.fillStyle = 'rgba(80, 160, 255, 0.55)';
            ctx.fill();
            ctx.strokeStyle = RED;
            ctx.lineWidth = 0.025 * k;
            ctx.stroke();
        }
        ctx.restore();
        // Царапины от коньков
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 280; i++) {
            ctx.strokeStyle = rnd() < 0.55 ? 'rgba(255,255,255,0.4)' : 'rgba(110,150,185,0.13)';
            ctx.lineWidth = 0.6 + rnd() * 1.6;
            const a0 = rnd() * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(rnd() * S, rnd() * S, (0.6 + rnd() * 2.6) * k, a0, a0 + 0.2 + rnd() * 0.5);
            ctx.stroke();
        }
        ctx.restore();
        drawCoords(ctx, L, '700 {px}px Oswald, "Russo One", "Arial Narrow", sans-serif', '#12325e', null);
    }

    /** Геометрия из четырёхугольников [a, b, c, d] с развёрткой в клетках сетки размера cell. */
    function quads(list, cell) {
        const T = THREE;
        const pos = [], uv = [];
        for (const q of list) {
            const P = q.map((p) => new T.Vector3(p[0], p[1], p[2]));
            const w = P[0].distanceTo(P[1]) / cell, h = P[0].distanceTo(P[3]) / cell;
            const U = [[0, 0], [w, 0], [w, h], [0, h]];
            for (const i of [0, 1, 2, 0, 2, 3]) {
                pos.push(P[i].x, P[i].y, P[i].z);
                uv.push(U[i][0], U[i][1]);
            }
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return g;
    }

    /**
     * Хоккейная коробка вокруг поля: борта со скруглёнными углами (жёлтый низ, белые щиты,
     * тёмно-синий поручень), ворота с сеткой, фонари гола и щиты с названиями команд.
     * Возвращает ссылки на фонари — они загораются при голе (мате).
     */
    function hockeyDecor(group, env) {
        const T = THREE;
        const add = (geo, mat, x = 0, y = 0, z = 0, o = {}) => {
            const m = new T.Mesh(geo, mat);
            m.position.set(x, y, z);
            if (o.rx) m.rotation.x = o.rx;
            if (o.ry) m.rotation.y = o.ry;
            if (o.rz) m.rotation.z = o.rz;
            m.castShadow = o.shadow !== false;
            m.receiveShadow = true;
            group.add(m);
            return m;
        };
        const M = {
            board: new T.MeshPhysicalMaterial({ color: '#f6f8fa', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
            kick: new T.MeshStandardMaterial({ color: '#ffc61a', roughness: 0.45 }),
            cap: new T.MeshStandardMaterial({ color: '#10284f', roughness: 0.4, metalness: 0.1 }),
            red: new T.MeshStandardMaterial({ color: '#d8202b', roughness: 0.3, metalness: 0.25 }),
            white: new T.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.45 })
        };
        const ring = (outer, inner, rOut, rIn, y0, y1) => {
            const s = CM.G.roundedRectShape(outer, outer, rOut);
            s.holes.push(CM.G.roundedRectShape(inner, inner, rIn));
            const geo = new T.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 12 });
            geo.rotateX(-Math.PI / 2);
            geo.translate(0, y0, 0);
            return geo;
        };
        const O = env.size, R = env.corner, I = O - 0.26, RI = R - 0.13;
        add(ring(O, I, R, RI, 0, 0.05), M.kick);
        add(ring(O, I, R, RI, 0.05, 0.2), M.board);
        add(ring(O + 0.03, I - 0.03, R + 0.015, RI - 0.015, 0.2, 0.228), M.cap);

        // Ворота: красные штанги и перекладина, белая рама, сетка
        const netTex = CM.Tex.canvas(64, 64, (ctx, w, h) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.fillRect(0, 0, w, 8);
            ctx.fillRect(0, 0, 8, h);
        }, { repeat: true });
        const net = new T.MeshStandardMaterial({ map: netTex, transparent: true, side: T.DoubleSide, roughness: 0.9, depthWrite: false });
        const lamps = {};
        for (const side of [1, -1]) {
            const z0 = side * GOAL_LINE, w = 0.36, h = 0.3, d = 0.3;
            const bz = (t) => z0 + side * d * t;
            const post = new T.CylinderGeometry(0.02, 0.02, h, 12);
            for (const s of [-1, 1]) add(post, M.red, s * w, h / 2, z0);
            add(new T.CylinderGeometry(0.02, 0.02, 2 * w + 0.04, 12), M.red, 0, h, z0, { rz: Math.PI / 2 });
            add(CM.G.tube([[-w, 0.012, z0], [-w * 0.92, 0.012, bz(0.7)], [0, 0.012, bz(1)], [w * 0.92, 0.012, bz(0.7)], [w, 0.012, z0]], 0.011, 40, 6), M.white);
            for (const s of [-1, 1]) {
                add(CM.G.tube([[s * w, h, z0], [s * w * 0.9, h * 0.72, bz(0.5)], [s * w * 0.88, 0.012, bz(0.78)]], 0.01, 16, 6), M.white);
            }
            const top = [[-w, h, z0], [w, h, z0], [w * 0.9, h * 0.72, bz(0.5)], [-w * 0.9, h * 0.72, bz(0.5)]];
            const back = [[-w * 0.9, h * 0.72, bz(0.5)], [w * 0.9, h * 0.72, bz(0.5)], [w * 0.92, 0.012, bz(0.85)], [-w * 0.92, 0.012, bz(0.85)]];
            const left = [[-w, 0, z0], [-w, h, z0], [-w * 0.9, h * 0.72, bz(0.5)], [-w * 0.92, 0, bz(0.85)]];
            const right = [[w, 0, z0], [w, h, z0], [w * 0.9, h * 0.72, bz(0.5)], [w * 0.92, 0, bz(0.85)]];
            add(quads([top, back, left, right], 0.045), net, 0, 0, 0, { shadow: false });
            // Фонарь гола на поручне за воротами (свой материал — загорается отдельно)
            const zl = side * (O / 2 - 0.065);
            const lampMat = new T.MeshStandardMaterial({ color: '#7a0b10', emissive: '#ff1f1f', emissiveIntensity: 0.18, roughness: 0.25 });
            add(new T.CylinderGeometry(0.074, 0.084, 0.03, 20), M.cap, 0, 0.243, zl);
            add(new T.SphereGeometry(0.072, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampMat, 0, 0.258, zl);
            lamps[side > 0 ? 'w' : 'b'] = { mat: lampMat, pos: new T.Vector3(0, 0.3, zl), goal: new T.Vector3(0, 0.12, z0 + side * 0.14) };
        }

        // Щиты с названиями команд на торцевых бортах, по обе стороны от ворот
        const ad = (label, color, bg) => {
            const tex = CM.Tex.canvas(1024, 43, (ctx, w, h) => {
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = color;
                ctx.font = '700 32px Oswald, "Russo One", "Arial Narrow", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, w / 2, h / 2 + 2);
            });
            return new T.MeshStandardMaterial({ map: tex, roughness: 0.4 });
        };
        const avg = ad('АВАНГАРД · ОМСК', '#ffffff', '#c8202b');
        const mmg = ad('МЕТАЛЛУРГ · МАГНИТОГОРСК', '#ffffff', '#1f4fa3');
        const panel = new T.PlaneGeometry(3.1, 0.13);
        const zi = I / 2 - 0.004;
        for (const s of [-1, 1]) {
            add(panel, avg, s * 2.25, 0.125, -zi, { shadow: false });
            add(panel, mmg, s * 2.25, 0.125, zi, { ry: Math.PI, shadow: false });
        }
        return { lamps };
    }

    CM.Boards = {
        classic: {
            drawTop: classicTop,
            side: '#3b2313', sideRough: 0.35, clearcoat: 0.8,
            light: { hemiSky: '#fff3df', hemiGround: '#3a2a1c', hemi: 0.6, sun: '#fff0d8', sunI: 2.5, env: 0.55, exposure: 1.0 }
        },
        cars: {
            drawTop: carsTop,
            side: '#2e3036', sideRough: 0.7, clearcoat: 0.1,
            light: { hemiSky: '#e3f4ff', hemiGround: '#b18a5a', hemi: 0.75, sun: '#fff5e0', sunI: 2.7, env: 0.7, exposure: 1.02 }
        },
        hospital: {
            drawTop: hospitalTop,
            side: '#dfe7e6', sideRough: 0.4, clearcoat: 0.5,
            light: { hemiSky: '#effffc', hemiGround: '#5f7f7a', hemi: 0.7, sun: '#ffffff', sunI: 2.3, env: 0.75, exposure: 1.0 }
        },
        hockey: {
            drawTop: hockeyTop,
            decor: hockeyDecor,
            // Коробка со скруглёнными углами, как у настоящей площадки; лёд — гладкий и блестящий
            corner: 0.6,
            side: '#0f2240', sideRough: 0.5, sideCoat: 0.3, clearcoat: 1, topRough: 0.22, topCoatRough: 0.06,
            light: { hemiSky: '#f3f9ff', hemiGround: '#50698c', hemi: 0.78, sun: '#ffffff', sunI: 2.35, env: 0.8, exposure: 1.0 }
        },
        layout
    };
})();
