/*
 * Тема «Хоккей»: «Металлург» (Магнитогорск) против «Авангарда» (Омск).
 * Белые — «Металлург» в белой выездной форме с синими и красными полосами, чёрные —
 * «Авангард» в чёрной форме с красным. Эмблемы на свитерах и маски вратарей — собственная
 * стилизация по мотивам клубов, а не официальные логотипы.
 * Король — вратарь в маске и щитках, ферзь — капитан с кубком над головой, ладья — защитник
 * с клюшкой поперёк, слон — снайпер, замахнувшийся для щелчка, конь — талисман клуба
 * (лисёнок Тимоша у «Металлурга», ястреб у «Авангарда»), пешка — юниор с шайбой.
 * Все фигуры стоят на шайбах.
 */
(function () {
    'use strict';
    const CM = window.CM;
    const T = THREE;
    const { profile, lathe, ellipsoid, taperedTube, tube, roundedBox, deform } = CM.G;
    const { mesh, Mat } = CM;

    const V = (x, y, z) => new T.Vector3(x, y, z);
    const UP = V(0, 1, 0);

    function shade(hex, k) {
        const c = new T.Color(hex);
        if (k < 0) c.lerp(new T.Color('#000000'), -k); else c.lerp(new T.Color('#ffffff'), k);
        return '#' + c.getHexString();
    }

    // ---------- Рисование на canvas ----------
    /** Надпись крупным шрифтом с масштабом: мелкие размеры шрифта браузеры рисуют плохо. */
    function text(ctx, str, x, y, size, o = {}) {
        ctx.save();
        ctx.translate(x, y);
        const k = size / 100;
        ctx.scale(k * (o.sx || 1), k);
        ctx.font = `${o.weight || 700} 100px ${o.font || 'Oswald, "Arial Narrow", "Arial Black", sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (o.stroke) {
            ctx.lineJoin = 'round';
            ctx.strokeStyle = o.stroke;
            ctx.lineWidth = (o.lw || 0.12) * 100;
            ctx.strokeText(str, 0, 0);
        }
        ctx.fillStyle = o.fill || '#ffffff';
        ctx.fillText(str, 0, 0);
        ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /** Перо или язык пламени: вытянутый лист от (x0, y0) до (x1, y1) шириной wd. */
    function leaf(ctx, x0, y0, x1, y1, wd) {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        let nx = -(y1 - y0), ny = x1 - x0;
        const nl = Math.hypot(nx, ny) || 1;
        nx = nx / nl * wd; ny = ny / nl * wd;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(mx + nx, my + ny, x1, y1);
        ctx.quadraticCurveTo(mx - nx, my - ny, x0, y0);
        ctx.closePath();
    }

    // ---------- Эмблемы (квадрат −1…1, ось y вниз) ----------
    // «Металлург»: синий щит в бело-красной кайме, белая «М» и огонёк плавки над ней
    function emblemMMG(ctx) {
        const shield = () => {
            ctx.beginPath();
            ctx.moveTo(-0.84, -0.9);
            ctx.lineTo(0.84, -0.9);
            ctx.lineTo(0.84, 0.12);
            ctx.quadraticCurveTo(0.82, 0.72, 0, 1);
            ctx.quadraticCurveTo(-0.82, 0.72, -0.84, 0.12);
            ctx.closePath();
        };
        ctx.save();
        shield();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.translate(0, 0.02);
        ctx.scale(0.87, 0.87);
        shield();
        ctx.fillStyle = '#d7262e';
        ctx.fill();
        ctx.scale(0.9, 0.9);
        shield();
        const g = ctx.createLinearGradient(0, -1, 0, 1);
        g.addColorStop(0, '#2f67c8');
        g.addColorStop(1, '#163c80');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const M = [[-0.44, 0.42], [-0.44, -0.3], [-0.24, -0.3], [0, 0.04], [0.24, -0.3], [0.44, -0.3], [0.44, 0.42],
            [0.26, 0.42], [0.26, -0.02], [0.03, 0.3], [-0.03, 0.3], [-0.26, -0.02], [-0.26, 0.42]];
        M.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff9a1a';
        ctx.beginPath();
        ctx.moveTo(0, -0.66);
        ctx.quadraticCurveTo(0.17, -0.44, 0, -0.3);
        ctx.quadraticCurveTo(-0.17, -0.44, 0, -0.66);
        ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.moveTo(0, -0.55);
        ctx.quadraticCurveTo(0.08, -0.42, 0, -0.35);
        ctx.quadraticCurveTo(-0.08, -0.42, 0, -0.55);
        ctx.fill();
    }

    // «Авангард»: красная «А», вершина которой — голова ястреба, белые крылья, чёрный круг
    function emblemAVG(ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d4202c';
        ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#121216';
        ctx.beginPath(); ctx.arc(0, 0, 0.78, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        for (const s of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                leaf(ctx, s * 0.14, 0.2 - i * 0.07, s * (0.66 - i * 0.06), -0.3 + i * 0.16, 0.07);
                ctx.fill();
            }
        }
        ctx.fillStyle = '#e0262f';
        ctx.beginPath();
        ctx.moveTo(-0.11, -0.46); ctx.lineTo(0.11, -0.46);
        ctx.lineTo(0.5, 0.6); ctx.lineTo(0.28, 0.6); ctx.lineTo(0.19, 0.34);
        ctx.lineTo(-0.19, 0.34); ctx.lineTo(-0.28, 0.6); ctx.lineTo(-0.5, 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#121216';
        ctx.beginPath(); ctx.moveTo(0, -0.12); ctx.lineTo(0.12, 0.2); ctx.lineTo(-0.12, 0.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e0262f';
        ctx.beginPath(); ctx.arc(0, -0.5, 0.17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0.12, -0.6);
        ctx.quadraticCurveTo(0.36, -0.58, 0.34, -0.4);
        ctx.quadraticCurveTo(0.26, -0.46, 0.14, -0.43);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath(); ctx.arc(0.02, -0.54, 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#121216';
        ctx.beginPath(); ctx.arc(0.035, -0.54, 0.026, 0, Math.PI * 2); ctx.fill();
    }

    // ---------- Рисунки на масках вратарей (x — азимут от переда, y — вниз от «экватора», рад) ----------
    function maskAVG(ctx) {
        for (const off of [0, Math.PI * 2]) {
            // Красно-белая полоса через макушку
            for (const x of [0, Math.PI]) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - 0.13 + off, -1.8, 0.26, 1.62);
                ctx.fillStyle = '#d4202c';
                ctx.fillRect(x - 0.09 + off, -1.8, 0.18, 1.62);
            }
            // Перья ястреба от лба к затылку
            for (const s of [-1, 1]) {
                for (let i = 0; i < 4; i++) {
                    leaf(ctx, s * (0.34 + i * 0.06) + off, 0.12 - i * 0.12, s * (1.5 + i * 0.22) + off, -0.28 - i * 0.16, 0.13);
                    ctx.fillStyle = i % 2 ? '#ffffff' : '#d4202c';
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 0.02;
                    ctx.stroke();
                }
            }
        }
        // Грозные глаза ястреба над решёткой
        for (const s of [-1, 1]) {
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.moveTo(s * 0.05, 0.12);
            ctx.quadraticCurveTo(s * 0.2, -0.03, s * 0.36, 0.01);
            ctx.quadraticCurveTo(s * 0.22, 0.14, s * 0.05, 0.12);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.02;
            ctx.stroke();
            ctx.fillStyle = '#111114';
            ctx.beginPath(); ctx.arc(s * 0.19, 0.07, 0.034, 0, Math.PI * 2); ctx.fill();
        }
    }

    function maskMMG(ctx) {
        for (const off of [0, Math.PI * 2]) {
            // Бело-красная полоса через макушку
            for (const x of [0, Math.PI]) {
                ctx.fillStyle = '#d7262e';
                ctx.fillRect(x - 0.14 + off, -1.8, 0.28, 1.62);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - 0.1 + off, -1.8, 0.2, 1.62);
            }
            // Языки пламени плавки от нижнего края к затылку
            for (const s of [-1, 1]) {
                for (let i = 0; i < 3; i++) {
                    const x0 = s * (0.32 + i * 0.3) + off, y0 = 0.2;
                    const x1 = s * (1.25 + i * 0.4) + off, y1 = -0.42 - i * 0.14;
                    leaf(ctx, x0, y0, x1, y1, 0.16);
                    ctx.fillStyle = '#ff6a13';
                    ctx.fill();
                    leaf(ctx, x0, y0, x0 + (x1 - x0) * 0.75, y0 + (y1 - y0) * 0.75, 0.1);
                    ctx.fillStyle = '#ffb22e';
                    ctx.fill();
                    leaf(ctx, x0, y0, x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.45, 0.05);
                    ctx.fillStyle = '#fff3b0';
                    ctx.fill();
                }
            }
        }
        // Глаза лиса над решёткой
        for (const s of [-1, 1]) {
            ctx.fillStyle = '#ffb02e';
            ctx.beginPath();
            ctx.moveTo(s * 0.05, 0.12);
            ctx.quadraticCurveTo(s * 0.2, -0.02, s * 0.35, 0.02);
            ctx.quadraticCurveTo(s * 0.22, 0.15, s * 0.05, 0.12);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.02;
            ctx.stroke();
            ctx.fillStyle = '#111114';
            ctx.beginPath(); ctx.ellipse(s * 0.19, 0.07, 0.014, 0.045, 0, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ---------- Команды ----------
    const TEAMS = {
        // «Металлург»: белый свитер, синие шлем и трусы, сине-красные полосы
        w: {
            jersey: '#f3f5f9', main: '#1f4fa3', second: '#d7262e', yoke: '#1f4fa3', collar: '#d7262e',
            helmet: '#1f4fa3', helmetStripe: '#f3f5f9', pants: '#1f4fa3', pantsStripe: '#f3f5f9', socks: '#f3f5f9',
            glove: '#1f4fa3', cuff: '#f3f5f9', number: '#1f4fa3', numberEdge: '#d7262e',
            pad: '#f4f6fa', padAccent: '#1f4fa3', padAccent2: '#d7262e',
            maskBase: '#1f4fa3', maskChin: '#1f4fa3', maskArt: maskMMG,
            skin: '#f4c9a4', hair: '#8a5a32', eye: '#3f78c8', puck: '#3a78e6', emblem: emblemMMG
        },
        // «Авангард»: чёрный свитер с красной кокеткой, красно-белые полосы
        b: {
            jersey: '#16161b', main: '#d4202c', second: '#ffffff', yoke: '#d4202c', collar: '#ffffff', dark: true,
            helmet: '#16161b', helmetStripe: '#d4202c', pants: '#16161b', pantsStripe: '#d4202c', socks: '#16161b',
            glove: '#16161b', cuff: '#d4202c', number: '#ffffff', numberEdge: '#d4202c',
            pad: '#f2f2f4', padAccent: '#d4202c', padAccent2: '#16161b',
            maskBase: '#16161b', maskChin: '#16161b', maskArt: maskAVG,
            skin: '#e9b58c', hair: '#2b1d15', eye: '#6b4423', puck: '#e3262f', emblem: emblemAVG
        }
    };

    // ---------- Геометрия ----------
    /** Капсула-«конечность» от точки a до точки b. */
    function limb(a, b, r, mat) {
        const dir = b.clone().sub(a);
        const m = mesh(new T.CapsuleGeometry(r, Math.max(0.001, dir.length()), 6, 12), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(UP, dir.normalize());
        return m;
    }

    /** Цилиндр от a до b (древко клюшки): радиус r0 у a, r1 у b. */
    function rod(a, b, r0, r1, mat, seg = 10) {
        const dir = b.clone().sub(a);
        const m = mesh(new T.CylinderGeometry(r1, r0, dir.length(), seg), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(UP, dir.normalize());
        return m;
    }

    /** Полоска-кольцо вокруг конечности a–b в точке t (0…1). */
    function band(a, b, t, r, w, mat) {
        const m = mesh(new T.CylinderGeometry(r, r, w, 20, 1, true), mat, 0, 0, 0, { shadow: false });
        m.position.copy(a).lerp(b, t);
        m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
        return m;
    }

    /** Плавная интерполяция по ключам [[t, v], …]. */
    function smooth(keys, t) {
        for (let i = 1; i < keys.length; i++) {
            if (t <= keys[i][0]) {
                const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
                const k = (t - t0) / (t1 - t0);
                return v0 + (v1 - v0) * (1 - Math.cos(Math.PI * k)) / 2;
            }
        }
        return keys[keys.length - 1][1];
    }

    // Силуэт свитера: радиус (в долях R) по высоте — талия, грудь, плечи с «наплечниками», ворот
    const TORSO = [[0, 0.93], [0.25, 0.9], [0.55, 0.98], [0.78, 1.04], [0.88, 0.98], [0.95, 0.74], [1, 0.36]];
    const JW = 768, JH = 384, JN = 24;
    /**
     * Свитер — токарное тело со своей развёрткой: точки профиля идут равномерно по высоте,
     * поэтому рисунок на текстуре ложится без искажений. Перед — в центре текстуры.
     */
    function jerseyGeometry(R, h) {
        const pts = [new T.Vector2(0, 0)];
        for (let i = 0; i < JN; i++) {
            const t = i / (JN - 1);
            pts.push(new T.Vector2(R * smooth(TORSO, t), t * h));
        }
        pts.push(new T.Vector2(0, h));
        return new T.LatheGeometry(pts, 48, -Math.PI, Math.PI * 2);
    }
    // Строка канвы свитера для высоты t (0 — низ, 1 — ворот)
    const jy = (t) => JH * (1 - (1 + t * (JN - 1)) / (JN + 1));

    function jerseyTexture(team, o) {
        return CM.Tex.canvas(JW, JH, (ctx) => {
            ctx.fillStyle = team.jersey;
            ctx.fillRect(0, 0, JW, JH);
            // Фактура трикотажа
            ctx.fillStyle = team.dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
            for (let x = 0; x < JW; x += 5) ctx.fillRect(x, 0, 2, JH);
            const band = (t0, t1, c) => { ctx.fillStyle = c; ctx.fillRect(0, jy(t1), JW, jy(t0) - jy(t1)); };
            band(0.05, 0.12, team.main);
            band(0.12, 0.16, team.second);
            band(0.16, 0.23, team.main);
            band(0.8, 1, team.yoke);
            band(0.785, 0.8, team.collar);
            // V-образный ворот с чёрной защитой шеи
            ctx.fillStyle = team.collar;
            ctx.beginPath(); ctx.moveTo(JW * 0.5 - 52, 0); ctx.lineTo(JW * 0.5, jy(0.84)); ctx.lineTo(JW * 0.5 + 52, 0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#1d1d22';
            ctx.beginPath(); ctx.moveTo(JW * 0.5 - 34, 0); ctx.lineTo(JW * 0.5, jy(0.88)); ctx.lineTo(JW * 0.5 + 34, 0); ctx.closePath(); ctx.fill();
            // Рисование в настоящих размерах на поверхности свитера: квадрат −1…1 → size единиц
            const place = (u, t, size, draw) => {
                const kx = JW / (2 * Math.PI * o.R * smooth(TORSO, t)), ky = JH * (JN - 1) / (JN + 1) / o.h;
                ctx.save();
                ctx.translate(u * JW, jy(t));
                ctx.scale(kx * size / 2, ky * size / 2);
                draw(ctx);
                ctx.restore();
            };
            place(0.5, 0.54, 0.15, team.emblem);
            if (o.letter) place(0.605, 0.7, 0.06, (c) => text(c, o.letter, 0, 0.08, 1.9, { fill: team.number, stroke: team.numberEdge, lw: 0.14 }));
            if (o.number) {
                for (const u of [0, 1]) {
                    place(u, 0.5, 0.16, (c) => text(c, o.number, 0, 0.06, 1.55, { fill: team.number, stroke: team.numberEdge, lw: 0.1, sx: 0.85 }));
                }
            }
        });
    }

    /** Текстура головы: кожа, волосы из-под шлема и лицо (рисуется в радианах, 0,0 — центр лица). */
    function faceTexture(skin, hair, draw) {
        return CM.Tex.canvas(1024, 512, (ctx, w, h) => {
            ctx.fillStyle = skin;
            ctx.fillRect(0, 0, w, h);
            const S = w / (Math.PI * 2);
            ctx.save();
            ctx.translate(w * 0.25, h * 0.5);
            ctx.scale(S, S);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (hair) {
                // Волосы видны на висках и сзади — «хоккейная причёска» из-под шлема
                ctx.fillStyle = hair;
                const a = 0.9, b = Math.PI * 2 - 0.9;
                for (const off of [0, -Math.PI * 2]) {
                    ctx.beginPath();
                    ctx.moveTo(a + off, -1.7);
                    for (let x = a; x <= b + 1e-6; x += 0.06) {
                        const k = (x - a) / (b - a);
                        ctx.lineTo(x + off, 0.06 + 0.66 * Math.pow(Math.sin(Math.PI * k), 1.6) + 0.05 * Math.sin(x * 11));
                    }
                    ctx.lineTo(b + off, -1.7);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            if (draw) draw(ctx);
            ctx.restore();
        });
    }

    // Мультяшные глаза: o = { r, dx, y, iris, brow, browTilt (>0 — хмурые), browY, lid (прищур), skin, look }
    function eyes(ctx, o) {
        const r = o.r || 0.1, y = o.y === undefined ? 0 : o.y, dx = o.dx || 0.26;
        for (const s of [-1, 1]) {
            const x = s * dx;
            ctx.fillStyle = '#fbfaf6';
            ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
            const lx = (o.look ? o.look[0] : 0) * r * 0.32, ly = (o.look ? o.look[1] : 0) * r * 0.32;
            ctx.fillStyle = o.iris || '#3f78c8';
            ctx.beginPath(); ctx.arc(x + lx, y + ly + r * 0.1, r * 0.58, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#120d0b';
            ctx.beginPath(); ctx.arc(x + lx, y + ly + r * 0.1, r * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x + lx - r * 0.2, y + ly - r * 0.12, r * 0.18, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + lx + r * 0.18, y + ly + r * 0.34, r * 0.08, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = r * 0.13;
            ctx.strokeStyle = '#231915';
            ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, r * 1.1, 0, 0, Math.PI * 2); ctx.stroke();
            if (o.lid) {
                // Прищур: внутренний угол века ниже — решительный взгляд
                ctx.fillStyle = o.skin;
                const inner = x - s * r * 1.2, outer = x + s * r * 1.2;
                const yIn = y - r * (0.62 - o.lid * 1.8), yOut = y - r * (0.78 - o.lid * 0.5);
                ctx.beginPath();
                ctx.moveTo(inner, y - r * 1.5);
                ctx.lineTo(outer, y - r * 1.5);
                ctx.lineTo(outer, yOut);
                ctx.lineTo(inner, yIn);
                ctx.closePath();
                ctx.fill();
                ctx.lineWidth = r * 0.16;
                ctx.beginPath(); ctx.moveTo(outer, yOut); ctx.lineTo(inner, yIn); ctx.stroke();
            }
            if (o.brow) {
                const tilt = o.browTilt || 0;
                const yb = y - r * (o.browY || 1.65);
                ctx.strokeStyle = o.brow;
                ctx.lineWidth = r * 0.36;
                ctx.beginPath();
                ctx.moveTo(x + s * r * 0.95, yb - tilt * r * 0.35);
                ctx.quadraticCurveTo(x, yb - r * 0.35, x - s * r * 0.9, yb + tilt * r * 0.6);
                ctx.stroke();
            }
        }
    }

    function mouth(ctx, kind = 'smile', y = 0.28, w = 0.24) {
        const lip = '#5a2419';
        ctx.lineCap = 'round';
        if (kind === 'smile') {
            ctx.strokeStyle = lip;
            ctx.lineWidth = 0.03;
            ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.quadraticCurveTo(0, y + w * 0.5, w / 2, y); ctx.stroke();
            return;
        }
        if (kind === 'flat') {
            ctx.strokeStyle = lip;
            ctx.lineWidth = 0.03;
            ctx.beginPath(); ctx.moveTo(-w / 2, y + 0.01); ctx.quadraticCurveTo(0, y + 0.03, w / 2, y - 0.015); ctx.stroke();
            return;
        }
        if (kind === 'shout') {
            ctx.save();
            ctx.fillStyle = '#4a130e';
            ctx.beginPath(); ctx.ellipse(0, y + 0.02, w * 0.42, w * 0.46, 0, 0, Math.PI * 2); ctx.fill();
            ctx.clip();
            ctx.fillStyle = '#fffaf0';
            ctx.fillRect(-w / 2, y + 0.02 - w * 0.46, w, w * 0.2);
            ctx.fillStyle = '#e25b5e';
            ctx.beginPath(); ctx.ellipse(0, y + 0.02 + w * 0.36, w * 0.26, w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return;
        }
        // Открытая улыбка с зубами, у защитника ('gap') — без одного зуба
        const outline = () => {
            ctx.beginPath();
            ctx.moveTo(-w / 2, y);
            ctx.quadraticCurveTo(0, y + w * 0.1, w / 2, y);
            ctx.quadraticCurveTo(0, y + w * 0.95, -w / 2, y);
            ctx.closePath();
        };
        ctx.save();
        outline();
        ctx.fillStyle = '#4a130e';
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(-w / 2, y - 0.01, w, w * 0.3);
        if (kind === 'gap') {
            ctx.fillStyle = '#2a0a06';
            ctx.fillRect(w * 0.05, y - 0.01, w * 0.14, w * 0.3);
        }
        ctx.fillStyle = '#e25b5e';
        ctx.beginPath(); ctx.ellipse(0, y + w * 0.55, w * 0.26, w * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        outline();
        ctx.strokeStyle = lip;
        ctx.lineWidth = 0.02;
        ctx.stroke();
    }

    function beard(ctx, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-0.5, 0.02);
        ctx.quadraticCurveTo(-0.52, 0.5, -0.2, 0.64);
        ctx.quadraticCurveTo(0, 0.72, 0.2, 0.64);
        ctx.quadraticCurveTo(0.52, 0.5, 0.5, 0.02);
        ctx.quadraticCurveTo(0.44, 0.24, 0.26, 0.2);
        ctx.quadraticCurveTo(0, 0.14, -0.26, 0.2);
        ctx.quadraticCurveTo(-0.44, 0.24, -0.5, 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 0.012;
        for (let i = 0; i < 26; i++) {
            const x = -0.42 + i * 0.034;
            ctx.beginPath(); ctx.moveTo(x, 0.3 + Math.abs(x) * 0.2); ctx.lineTo(x * 0.96, 0.52 - Math.abs(x) * 0.3); ctx.stroke();
        }
    }

    function mustache(ctx, color, y) {
        ctx.fillStyle = color;
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(0, y - 0.045);
            ctx.quadraticCurveTo(s * 0.1, y - 0.075, s * 0.19, y - 0.01);
            ctx.quadraticCurveTo(s * 0.09, y - 0.035, 0, y - 0.02);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Пластырь крест-накрест на щеке — у защитника
    function plaster(ctx, x, y) {
        ctx.save();
        ctx.translate(x, y);
        for (const a of [0.55, -0.55]) {
            ctx.save();
            ctx.rotate(a);
            roundRect(ctx, -0.085, -0.026, 0.17, 0.052, 0.02);
            ctx.fillStyle = '#f2d1ab';
            ctx.fill();
            ctx.strokeStyle = 'rgba(140, 90, 50, 0.45)';
            ctx.lineWidth = 0.006;
            ctx.stroke();
            ctx.restore();
        }
        ctx.fillStyle = '#e0b58a';
        ctx.fillRect(-0.025, -0.025, 0.05, 0.05);
        ctx.restore();
    }

    function playerFace(o) {
        return (ctx) => {
            ctx.fillStyle = 'rgba(255, 110, 100, 0.26)';
            for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.37, 0.15, 0.11, 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
            if (o.freckles) {
                ctx.fillStyle = 'rgba(160, 90, 50, 0.5)';
                for (const s of [-1, 1]) {
                    for (const [x, y] of [[0.3, 0.1], [0.36, 0.14], [0.42, 0.1], [0.34, 0.2], [0.4, 0.18]]) {
                        ctx.beginPath(); ctx.arc(s * x, y, 0.011, 0, Math.PI * 2); ctx.fill();
                    }
                }
            }
            if (o.beard) beard(ctx, o.beard);
            eyes(ctx, { r: o.eyeR || 0.1, iris: o.iris, brow: o.brow, browTilt: o.browTilt, browY: o.browY, lid: o.lid, skin: o.skin, look: o.look });
            mouth(ctx, o.mouth, o.mouthY, o.mouthW);
            if (o.beard) mustache(ctx, o.beard, o.mouthY);
            if (o.plaster) plaster(ctx, 0.42, 0.08);
        };
    }

    // ---------- Снаряжение ----------
    function onHead(info, az, el, out = 0) {
        const r = info.headR + out;
        return V(
            Math.sin(az) * Math.cos(el) * r * info.hs[0],
            info.headY + Math.sin(el) * r * info.hs[1],
            Math.cos(az) * Math.cos(el) * r * info.hs[2]
        );
    }

    function skate(g, x, team) {
        g.add(mesh(roundedBox(0.074, 0.064, 0.14, 0.026, 3), Mat.vinyl('#17171c', 0.35), x, 0.074, 0.02));
        g.add(mesh(roundedBox(0.048, 0.05, 0.022, 0.012, 2), Mat.vinyl(team.main, 0.45), x, 0.112, 0.07, { rx: -0.35 }));
        g.add(mesh(roundedBox(0.024, 0.026, 0.128, 0.008, 2), Mat.vinyl('#f1f1f3', 0.4), x, 0.031, 0.02));
        g.add(mesh(roundedBox(0.008, 0.02, 0.152, 0.004, 1), Mat.chrome(), x, 0.01, 0.022));
    }

    function glove(g, H, dir, team) {
        const q = new T.Quaternion().setFromUnitVectors(UP, dir);
        const m = mesh(roundedBox(0.07, 0.08, 0.075, 0.027, 3), Mat.vinyl(team.glove, 0.55));
        m.position.copy(H);
        m.quaternion.copy(q);
        g.add(m);
        const c = mesh(new T.CylinderGeometry(0.05, 0.047, 0.036, 18), Mat.vinyl(team.cuff, 0.55));
        c.position.copy(H).addScaledVector(dir, -0.05);
        c.quaternion.copy(q);
        g.add(c);
    }

    let visorM = null;
    function visorMat() {
        if (!visorM) {
            visorM = new T.MeshPhysicalMaterial({
                color: '#d8ecff', transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0,
                clearcoat: 1, clearcoatRoughness: 0.03, side: T.DoubleSide, depthWrite: false
            });
        }
        return visorM;
    }

    /** Шлем игрока с гребнем и защитой ушей; gear: 'visor' — прозрачный визор, 'cage' — решётка. */
    function helmet(g, info, team, gear) {
        const R = info.headR, hs = info.hs;
        const grp = new T.Group();
        grp.position.set(0, info.headY, 0);
        grp.rotation.x = -0.42;
        const paint = Mat.paint(team.helmet, 0.3);
        const shell = new T.SphereGeometry(R * 1.085, 40, 20, 0, Math.PI * 2, 0, 1.62);
        shell.scale(hs[0], hs[1], hs[2]);
        grp.add(mesh(shell, paint));
        const rim = new T.TorusGeometry(R * 1.085 * Math.sin(1.62), 0.011, 8, 48);
        rim.rotateX(Math.PI / 2);
        rim.scale(hs[0], 1, hs[2]);
        grp.add(mesh(rim, Mat.vinyl('#1a1a1f', 0.5), 0, R * 1.085 * Math.cos(1.62) * hs[1], 0));
        const ridge = new T.TorusGeometry(R * 1.1, 0.016, 8, 40, Math.PI - 0.9);
        ridge.rotateZ(0.45);
        ridge.rotateY(Math.PI / 2);
        ridge.scale(hs[0], hs[1], hs[2]);
        grp.add(mesh(ridge, Mat.paint(team.helmetStripe, 0.35)));
        for (const s of [-1, 1]) {
            grp.add(mesh(new T.CylinderGeometry(0.05, 0.055, 0.03, 20), paint, s * R * 1.04, -0.045, 0.01, { rz: Math.PI / 2 }));
            grp.add(mesh(roundedBox(0.03, 0.012, 0.07, 0.005, 1), Mat.vinyl('#141418', 0.6), s * 0.055, R * 1.07 * hs[1], -0.03));
        }
        g.add(grp);
        if (gear === 'visor') {
            const vis = new T.SphereGeometry(R * 1.14, 32, 8, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.4, 0.5);
            vis.scale(hs[0], hs[1], hs[2]);
            g.add(mesh(vis, visorMat(), 0, info.headY, 0, { shadow: false }));
            for (const s of [-1, 1]) {
                const p = onHead(info, s * 0.93, 0.16, R * 0.15);
                g.add(mesh(new T.SphereGeometry(0.012, 10, 8), Mat.chrome(), p.x, p.y, p.z));
            }
        } else if (gear === 'cage') {
            cage(g, info, {});
        }
    }

    /** Решётка перед лицом: прутья на сфере вокруг головы. */
    function cage(g, info, o) {
        const R = info.headR * (o.r || 1.17), hs = info.hs;
        const pt = (az, el) => [Math.sin(az) * Math.cos(el) * R * hs[0], info.headY + Math.sin(el) * R * hs[1], Math.cos(az) * Math.cos(el) * R * hs[2]];
        const mat = o.mat || Mat.metal('#d9dde2', 0.3);
        const w = o.w || 0.78, bottom = o.bottom === undefined ? -0.62 : o.bottom, top = o.top === undefined ? 0.36 : o.top;
        for (const el of o.rows || [-0.52, -0.36, -0.14]) {
            const pts = [];
            for (let i = 0; i <= 10; i++) pts.push(pt(-w + (2 * w * i) / 10, el));
            g.add(mesh(tube(pts, 0.0065, 20, 5), mat));
        }
        for (const az of o.cols || [-0.46, -0.08, 0.08, 0.46]) {
            const pts = [];
            for (let i = 0; i <= 8; i++) pts.push(pt(az, bottom + ((top - bottom) * i) / 8));
            g.add(mesh(tube(pts, 0.0065, 14, 5), mat));
        }
        const frame = [];
        for (let i = 0; i <= 8; i++) frame.push(pt(-w, top - ((top - bottom) * i) / 8));
        for (let i = 1; i <= 10; i++) frame.push(pt(-w + (2 * w * i) / 10, bottom));
        for (let i = 1; i <= 8; i++) frame.push(pt(w, bottom + ((top - bottom) * i) / 8));
        g.add(mesh(tube(frame, 0.009, 64, 6), mat));
        if (o.chin !== false) {
            const c = pt(0, bottom - 0.05);
            g.add(mesh(ellipsoid(0.055, 0.03, 0.035, 16, 10), Mat.vinyl('#1a1a1f', 0.5), c[0], c[1], c[2]));
        }
    }

    const MASK_THETA = 1.78;
    function maskTexture(team) {
        return CM.Tex.canvas(1024, 512, (ctx, w, h) => {
            ctx.fillStyle = team.maskBase;
            ctx.fillRect(0, 0, w, h);
            ctx.save();
            ctx.translate(w * 0.25, h * (Math.PI / 2) / MASK_THETA);
            ctx.scale(w / (Math.PI * 2), h / MASK_THETA);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            team.maskArt(ctx);
            ctx.restore();
        });
    }

    /** Вратарская маска: расписанный шлем, подбородник и решётка. */
    function goalieMask(g, info, team) {
        const R = info.headR, hs = info.hs;
        const grp = new T.Group();
        grp.position.set(0, info.headY, 0);
        grp.rotation.x = -0.36;
        const shell = new T.SphereGeometry(R * 1.1, 48, 24, 0, Math.PI * 2, 0, MASK_THETA);
        shell.scale(hs[0], hs[1], hs[2]);
        grp.add(mesh(shell, Mat.textured(maskTexture(team), { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 })));
        const rim = new T.TorusGeometry(R * 1.1 * Math.sin(MASK_THETA), 0.011, 8, 48);
        rim.rotateX(Math.PI / 2);
        rim.scale(hs[0], 1, hs[2]);
        grp.add(mesh(rim, Mat.vinyl('#1b1b20', 0.5), 0, R * 1.1 * Math.cos(MASK_THETA) * hs[1], 0));
        g.add(grp);
        const chin = new T.SphereGeometry(R * 1.12, 32, 10, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 + 0.28, 0.66);
        chin.scale(hs[0], hs[1], hs[2]);
        g.add(mesh(chin, Mat.paint(team.maskChin, 0.3), 0, info.headY, 0));
        cage(g, info, { r: 1.2, w: 0.66, bottom: -0.3, top: 0.24, rows: [-0.16], cols: [-0.42, -0.1, 0.1, 0.42], mat: Mat.metal('#eceff2', 0.3), chin: false });
    }

    /**
     * Клюшка: древко от knob до heel, крюк от пятки вдоль bladeDir (ребром ко льду, если пятка
     * стоит на льду). o: { blade, bladeH, curve, paddle }. Возвращает оси крюка.
     */
    function stick(g, knob, heel, bladeDir, team, o = {}) {
        const black = Mat.vinyl('#1c1c21', 0.35);
        const d = knob.clone().sub(heel).normalize();
        g.add(rod(heel, knob, 0.013, 0.015, black));
        g.add(rod(knob.clone().addScaledVector(d, -0.07), knob.clone().addScaledVector(d, 0.004), 0.0165, 0.0165, Mat.vinyl('#f1f1f1', 0.8)));
        const mid = heel.clone().lerp(knob, 0.6);
        g.add(rod(mid.clone().addScaledVector(d, -0.03), mid.clone().addScaledVector(d, 0.03), 0.016, 0.016, Mat.vinyl(team.main, 0.4)));
        const L = o.blade || 0.11, H = o.bladeH || 0.036, curve = o.curve === undefined ? 1 : o.curve;
        const z = bladeDir.clone().normalize();
        const y = d.clone().addScaledVector(z, -d.dot(z)).normalize();
        const x = new T.Vector3().crossVectors(y, z);
        const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
        const bend = (v) => { const k = Math.max(0, v.z) / L; v.x += k * k * 0.018 * curve; };
        const blade = roundedBox(0.015, H, L, 0.006, 2);
        blade.translate(0, 0, L / 2 - 0.006);
        deform(blade, bend);
        const tape = roundedBox(0.018, H * 0.9, L * 0.42, 0.005, 1);
        tape.translate(0, 0, L * 0.52);
        deform(tape, bend);
        const at = heel.clone().addScaledVector(y, H / 2 - 0.004);
        for (const [geo, mat] of [[blade, black], [tape, Mat.vinyl('#f4f4f4', 0.85)]]) {
            const m = mesh(geo, mat);
            m.position.copy(at);
            m.quaternion.copy(q);
            g.add(m);
        }
        if (o.paddle) {
            // Широкая часть вратарской клюшки
            const p = mesh(roundedBox(0.016, o.paddle, 0.042, 0.006, 1), black);
            p.position.copy(heel).addScaledVector(d, o.paddle / 2 + 0.02).addScaledVector(z, 0.018);
            p.quaternion.copy(q);
            g.add(p);
        }
        return { heel, x, y, z, L };
    }

    function pads(g, team) {
        for (const s of [-1, 1]) {
            const p = new T.Group();
            p.position.set(s * 0.088, 0.16, 0.078);
            p.rotation.z = s * 0.04;
            const base = Mat.vinyl(team.pad, 0.5);
            p.add(mesh(roundedBox(0.112, 0.28, 0.07, 0.03, 3), base));
            p.add(mesh(roundedBox(0.1, 0.05, 0.075, 0.022, 2), base, 0, 0.115, 0.012, { rx: 0.25 }));
            p.add(mesh(roundedBox(0.114, 0.024, 0.072, 0.008, 1), Mat.vinyl(team.padAccent, 0.5), 0, 0.02, 0));
            p.add(mesh(roundedBox(0.114, 0.012, 0.072, 0.005, 1), Mat.vinyl(team.padAccent2, 0.5), 0, 0.046, 0));
            p.add(mesh(roundedBox(0.03, 0.27, 0.072, 0.01, 1), Mat.vinyl(team.padAccent, 0.5), -s * 0.03, -0.004, 0));
            g.add(p);
        }
    }

    function catcher(g, H, team) {
        const c = new T.Group();
        c.position.copy(H);
        c.rotation.set(0.1, -0.35, -0.5);
        c.add(mesh(ellipsoid(0.072, 0.096, 0.046, 24, 16), Mat.vinyl(team.pad, 0.5)));
        c.add(mesh(ellipsoid(0.05, 0.062, 0.02, 20, 12), Mat.vinyl(team.padAccent, 0.5), 0, 0.012, 0.036));
        c.add(mesh(new T.TorusGeometry(0.07, 0.012, 8, 24, Math.PI), Mat.vinyl(team.padAccent, 0.5), 0, 0.02, 0));
        c.add(mesh(new T.CylinderGeometry(0.05, 0.056, 0.05, 18), Mat.vinyl(team.padAccent2, 0.55), 0, -0.1, -0.008));
        g.add(c);
    }

    function blocker(g, H, team) {
        const b = new T.Group();
        b.position.copy(H).add(V(-0.047, 0.02, 0.005));
        b.rotation.set(0, 0.25, 0.08);
        b.add(mesh(roundedBox(0.022, 0.15, 0.1, 0.01, 2), Mat.vinyl(team.pad, 0.5)));
        b.add(mesh(roundedBox(0.024, 0.04, 0.102, 0.008, 1), Mat.vinyl(team.padAccent, 0.5), 0, 0.035, 0));
        g.add(b);
    }

    function trophy(g, base) {
        const cup = new T.Group();
        cup.position.copy(base);
        const pts = profile([
            ['M', 0, 0], ['L', 0.07, 0], ['L', 0.07, 0.02], ['Q', 0.035, 0.028, 0.022, 0.05], ['L', 0.018, 0.078],
            ['Q', 0.03, 0.09, 0.052, 0.094], ['Q', 0.1, 0.108, 0.104, 0.17], ['L', 0.108, 0.186], ['L', 0.094, 0.186], ['L', 0, 0.172]
        ], 6);
        const silver = Mat.metal('#e8ebf0', 0.18);
        cup.add(mesh(lathe(pts, 40), silver));
        for (const s of [-1, 1]) {
            cup.add(mesh(new T.TorusGeometry(0.036, 0.009, 8, 20, Math.PI), silver, s * 0.1, 0.13, 0, { rz: -s * Math.PI / 2 }));
        }
        cup.add(mesh(new T.TorusGeometry(0.109, 0.006, 6, 40), Mat.metal('#e6be4a', 0.25), 0, 0.178, 0, { rx: Math.PI / 2 }));
        g.add(cup);
    }

    // ---------- Сборка хоккеиста ----------
    const BODY_BOTTOM = 0.262;

    /**
     * Хоккеист: коньки, гамаши, трусы, свитер, руки в крагах, голова, шлем.
     * o: { team, R, h, headR, hs, legX, pantsR, number, letter, hands: { l, r } — куда тянутся кисти,
     *      hand(g, H, dir, side) — своя кисть вместо краги, face(ctx) — лицо,
     *      gear: 'visor' | 'cage' | 'mask' | 'none', skin, hair, noNose, extras(g, info) }
     */
    function build(o) {
        const g = new T.Group();
        const team = o.team;
        const R = o.R || 0.15, h = o.h || 0.27, headR = o.headR || 0.19;
        const hs = o.hs || [1, 0.95, 0.97];
        const legX = o.legX || 0.062;
        const top = BODY_BOTTOM + h;
        const info = { team, R, h, headR, hs, top, headY: top + headR * 0.7, hands: {} };
        info.headTop = info.headY + headR * hs[1];

        const sock = Mat.vinyl(team.socks, 0.6);
        for (const s of [-1, 1]) {
            skate(g, s * legX, team);
            const a = V(s * legX, 0.095, 0.006), b = V(s * legX * 1.04, 0.21, 0);
            g.add(limb(a, b, 0.046, sock));
            g.add(band(a, b, 0.42, 0.0485, 0.02, Mat.vinyl(team.main, 0.5)));
            g.add(band(a, b, 0.62, 0.0485, 0.011, Mat.vinyl(team.second, 0.5)));
        }
        const pr = o.pantsR || R * 1.03;
        g.add(mesh(lathe(profile([
            ['M', 0, 0.168], ['L', pr * 0.82, 0.168], ['Q', pr * 1.08, 0.2, pr, 0.25], ['Q', pr * 0.96, 0.286, pr * 0.84, 0.296], ['L', 0, 0.296]
        ], 8), 40), Mat.vinyl(team.pants, 0.5)));
        for (const s of [-1, 1]) {
            g.add(mesh(roundedBox(0.012, 0.08, 0.036, 0.005, 2), Mat.vinyl(team.pantsStripe, 0.5), s * (pr * 1.02 + 0.004), 0.232, 0));
        }

        const jersey = Mat.textured(jerseyTexture(team, { R, h, number: o.number, letter: o.letter }), {
            roughness: 0.72, clearcoat: 0.04, sheen: 0.3, sheenRoughness: 0.7, sheenColor: '#ffffff'
        });
        g.add(mesh(jerseyGeometry(R, h), jersey, 0, BODY_BOTTOM, 0));
        const shY = BODY_BOTTOM + h * 0.8;
        for (const s of [-1, 1]) g.add(mesh(new T.SphereGeometry(0.058, 20, 14), Mat.vinyl(team.yoke, 0.6), s * R * 0.93, shY + 0.005, 0));

        const sleeve = Mat.vinyl(team.jersey, 0.65);
        for (const [side, s] of [['l', 1], ['r', -1]]) {
            const H = o.hands && o.hands[side];
            if (!H) continue;
            const S = V(s * R * 0.98, shY - 0.012, 0);
            const E = S.clone().lerp(H, 0.5).add(V(s * (o.elbowOut === undefined ? 0.045 : o.elbowOut), -0.03, -0.02));
            const dir = H.clone().sub(E).normalize();
            const W = H.clone().addScaledVector(dir, -0.04);
            g.add(limb(S, E, 0.043, sleeve));
            g.add(mesh(new T.SphereGeometry(0.046, 16, 12), sleeve, E.x, E.y, E.z));
            g.add(limb(E, W, 0.041, sleeve));
            g.add(band(E, W, 0.28, 0.0445, 0.024, Mat.vinyl(team.main, 0.55)));
            g.add(band(E, W, 0.48, 0.0445, 0.012, Mat.vinyl(team.second, 0.55)));
            if (o.hand) o.hand(g, H, dir, side, info); else glove(g, H, dir, team);
            info.hands[side] = H;
        }

        const skin = o.skin || team.skin;
        const faceTex = faceTexture(skin, o.hair === undefined ? team.hair : o.hair, o.face);
        const head = new T.SphereGeometry(headR, 48, 32);
        head.scale(hs[0], hs[1], hs[2]);
        g.add(mesh(head, Mat.textured(faceTex, { roughness: 0.6, clearcoat: 0.12 }), 0, info.headY, 0));
        if (!o.noNose) {
            const p = onHead(info, 0, -0.09, -0.012);
            g.add(mesh(ellipsoid(0.03, 0.026, 0.028, 16, 12), Mat.vinyl(shade(skin, -0.07), 0.55), p.x, p.y, p.z));
        }
        if (o.gear === 'visor' || o.gear === 'cage') helmet(g, info, team, o.gear);
        else if (o.gear === 'mask') goalieMask(g, info, team);
        if (o.extras) o.extras(g, info);
        return g;
    }

    // ---------- Роли ----------
    // Король — вратарь: щитки, ловушка и блин, маска с решёткой, широкая клюшка
    function goalie(color) {
        const team = TEAMS[color];
        const hl = V(0.235, 0.31, 0.15), hr = V(-0.215, 0.3, 0.15);
        return build({
            team, R: 0.168, legX: 0.088, pantsR: 0.18, number: color === 'w' ? '30' : '1', gear: 'mask',
            hands: { l: hl, r: hr },
            hand(g, H, dir, side) {
                if (side === 'l') catcher(g, H, team);
                else { glove(g, H, dir, team); blocker(g, H, team); }
            },
            face: playerFace({ iris: team.eye, brow: team.hair, browTilt: 0.8, browY: 1.45, lid: 0.16, skin: team.skin, mouth: 'flat', mouthY: 0.2, mouthW: 0.16 }),
            extras(g) {
                pads(g, team);
                stick(g, hr.clone().add(V(0.03, 0.08, -0.02)), V(-0.03, 0.006, 0.3), V(1, 0, 0.08), team, { blade: 0.16, bladeH: 0.048, curve: 0.2, paddle: 0.2 });
            }
        });
    }

    // Ферзь — капитан с «К» на груди, поднимает кубок над головой
    function captain(color) {
        const team = TEAMS[color];
        const cupY = 0.865;
        return build({
            team, number: color === 'w' ? '17' : '13', letter: 'К', gear: 'visor', elbowOut: 0.07,
            hands: { l: V(0.145, cupY + 0.12, 0.03), r: V(-0.145, cupY + 0.12, 0.03) },
            face: playerFace({ iris: team.eye, brow: team.hair, browTilt: -0.15, skin: team.skin, mouth: 'grin', mouthY: 0.27, mouthW: 0.28, look: [0, -0.6] }),
            extras(g) { trophy(g, V(0, cupY, 0.03)); }
        });
    }

    // Ладья — защитник-«скала»: широкий, бородатый, с пластырем, клюшка поперёк
    function defenseman(color) {
        const team = TEAMS[color];
        const knob = V(0.23, 0.395, 0.2), heel = V(-0.27, 0.37, 0.2);
        const at = (t) => knob.clone().lerp(heel, t);
        return build({
            team, R: 0.172, headR: 0.186, legX: 0.078, pantsR: 0.18, number: color === 'w' ? '44' : '5', letter: 'А', gear: 'visor',
            hands: { l: at(0.12), r: at(0.66) },
            face: playerFace({ iris: team.eye, brow: team.hair, browTilt: 1, lid: 0.14, skin: team.skin, mouth: 'gap', mouthY: 0.29, mouthW: 0.28, beard: team.hair, plaster: true }),
            extras(g) { stick(g, knob, heel, V(0.1, -1, 0.3), team, { blade: 0.12 }); }
        });
    }

    // Слон — снайпер: клюшка занесена над плечом для щелчка
    function sniper(color) {
        const team = TEAMS[color];
        const knob = V(-0.01, 0.37, 0.14), heel = V(-0.34, 0.86, -0.1);
        const at = (t) => knob.clone().lerp(heel, t);
        return build({
            team, number: color === 'w' ? '91' : '87', gear: 'visor',
            hands: { l: at(0.05), r: at(0.42) },
            face: playerFace({ iris: team.eye, brow: team.hair, browTilt: 0.9, lid: 0.1, skin: team.skin, mouth: 'shout', mouthY: 0.28, mouthW: 0.22 }),
            extras(g) { stick(g, knob, heel, V(-0.75, 0.55, -0.35), team, { blade: 0.13, bladeH: 0.042 }); }
        });
    }

    // Пешка — юниор в шлеме с решёткой, ведёт шайбу
    function junior(color) {
        const team = TEAMS[color];
        const knob = V(0.13, 0.42, 0.09), heel = V(-0.12, 0.006, 0.27);
        const at = (t) => knob.clone().lerp(heel, t);
        return build({
            team, R: 0.14, h: 0.25, headR: 0.2, number: color === 'w' ? '7' : '9', gear: 'cage',
            hands: { l: at(0.06), r: at(0.42) },
            face: playerFace({ iris: team.eye, brow: team.hair, browTilt: -0.3, skin: team.skin, mouth: 'smile', mouthY: 0.27, mouthW: 0.2, freckles: true, eyeR: 0.11 }),
            extras(g) {
                const s = stick(g, knob, heel, V(-0.8, 0, 0.6), team, { blade: 0.1 });
                const p = s.heel.clone().addScaledVector(s.z, s.L * 0.55).addScaledVector(s.x, 0.045);
                g.add(mesh(new T.CylinderGeometry(0.042, 0.042, 0.024, 22), Mat.vinyl('#141416', 0.4), p.x, 0.012, p.z));
            }
        });
    }

    // Конь «Металлурга» — лисёнок Тимоша: рыжий, с белой мордочкой и пышным хвостом, машет лапой
    function fox() {
        const team = TEAMS.w;
        const fur = '#ee8a2e', cream = '#fff6ea', dark = '#2b1b12';
        return build({
            team, number: '74', headR: 0.205, hs: [1.04, 0.95, 1], gear: 'none', noNose: true, skin: fur, hair: null,
            hands: { l: V(0.2, 0.3, 0.1), r: V(-0.22, 0.86, 0.05) },
            hand(g, H) { g.add(mesh(new T.SphereGeometry(0.047, 18, 14), Mat.vinyl(dark, 0.6), H.x, H.y, H.z)); },
            face: (ctx) => {
                ctx.fillStyle = cream;
                ctx.beginPath(); ctx.ellipse(0, 0.32, 0.46, 0.3, 0, 0, Math.PI * 2); ctx.fill();
                for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.46, 0.2, 0.22, 0.2, s * 0.4, 0, Math.PI * 2); ctx.fill(); }
                ctx.strokeStyle = '#8a3f12';
                ctx.lineWidth = 0.03;
                for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.16, 0.06); ctx.quadraticCurveTo(s * 0.12, 0.14, s * 0.08, 0.18); ctx.stroke(); }
                eyes(ctx, { r: 0.12, y: -0.04, dx: 0.27, iris: '#8a5212' });
                ctx.fillStyle = cream;
                for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.25, -0.24, 0.07, 0.035, s * 0.2, 0, Math.PI * 2); ctx.fill(); }
            },
            extras(g, info) {
                // Острая лисья мордочка с чёрным носом и улыбкой
                const m = onHead(info, 0, -0.22, -0.06);
                g.add(mesh(ellipsoid(0.066, 0.056, 0.12, 24, 16), Mat.vinyl(cream, 0.55), m.x, m.y, m.z + 0.05, { rx: 0.12 }));
                g.add(mesh(ellipsoid(0.028, 0.022, 0.022, 16, 12), Mat.vinyl('#1a120e', 0.3), m.x, m.y + 0.005, m.z + 0.165));
                g.add(mesh(tube([[-0.03, m.y - 0.034, m.z + 0.128], [0, m.y - 0.05, m.z + 0.142], [0.03, m.y - 0.034, m.z + 0.128]], 0.0045, 12, 5), Mat.vinyl('#3a1f14', 0.5)));
                for (const s of [-1, 1]) {
                    const p = onHead(info, s * 0.62, 0.78, -0.04);
                    const ear = new T.Group();
                    ear.position.copy(p);
                    ear.rotation.set(-0.12, 0, -s * 0.38);
                    ear.add(mesh(new T.ConeGeometry(0.086, 0.2, 20).scale(1, 1, 0.45), Mat.vinyl(fur, 0.55), 0, 0.09, 0));
                    ear.add(mesh(new T.ConeGeometry(0.054, 0.13, 16).scale(1, 1, 0.3), Mat.vinyl(cream, 0.6), 0, 0.07, 0.018));
                    ear.add(mesh(new T.ConeGeometry(0.038, 0.066, 14).scale(1, 1, 0.5), Mat.vinyl(dark, 0.5), 0, 0.166, 0));
                    g.add(ear);
                }
                for (const s of [-1, 1]) {
                    const p = onHead(info, s * 1.05, -0.35, -0.03);
                    g.add(mesh(new T.ConeGeometry(0.045, 0.11, 12).scale(1, 1, 0.6), Mat.vinyl(cream, 0.6), p.x + s * 0.03, p.y - 0.02, p.z, { rz: s * 2 }));
                }
                const pts = [[0.03, 0.3, -0.14], [0.13, 0.27, -0.26], [0.23, 0.36, -0.33], [0.27, 0.52, -0.3]];
                g.add(mesh(taperedTube(pts, (t) => 0.035 + Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * 0.05, 32, 14), Mat.vinyl(fur, 0.6)));
                g.add(mesh(ellipsoid(0.05, 0.075, 0.05, 20, 14), Mat.vinyl(cream, 0.6), 0.275, 0.575, -0.29, { rz: -0.2 }));
            }
        });
    }

    // Крыло вместо кисти: веер маховых перьев с красными и белыми кончиками
    function wing(g, H, s) {
        const plume = '#3b3236', red = '#d4202c';
        g.add(mesh(new T.SphereGeometry(0.04, 16, 12), Mat.vinyl(plume, 0.55), H.x, H.y, H.z));
        for (let i = 0; i < 5; i++) {
            const a = -0.05 - i * 0.3;
            const dir = V(s * Math.cos(a), Math.sin(a), 0.08).normalize();
            const q = new T.Quaternion().setFromUnitVectors(UP, dir);
            const f = mesh(ellipsoid(0.03, 0.1, 0.01, 14, 10), Mat.vinyl(plume, 0.5));
            f.position.copy(H).addScaledVector(dir, 0.09);
            f.quaternion.copy(q);
            g.add(f);
            const tip = mesh(ellipsoid(0.026, 0.036, 0.012, 12, 8), Mat.vinyl(i % 2 ? '#ffffff' : red, 0.5));
            tip.position.copy(H).addScaledVector(dir, 0.18);
            tip.quaternion.copy(q);
            g.add(tip);
        }
    }

    // Конь «Авангарда» — ястреб: хмурые жёлтые глаза, клюв-крючок, красный хохолок, крылья
    function hawk() {
        const team = TEAMS.b;
        const plume = '#3b3236', cheek = '#6e5d57', light = '#efe7da', beak = '#f5b90a', red = '#d4202c';
        return build({
            team, number: '55', headR: 0.2, hs: [1, 0.96, 1.04], gear: 'none', noNose: true, skin: plume, hair: null, elbowOut: 0.02,
            hands: { l: V(0.26, 0.5, 0.03), r: V(-0.26, 0.5, 0.03) },
            hand(g, H, dir, side) { wing(g, H, side === 'l' ? 1 : -1); },
            face: (ctx) => {
                // Серо-бурые щёки и светлое горло
                ctx.fillStyle = cheek;
                ctx.beginPath(); ctx.ellipse(0, 0.3, 0.64, 0.36, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = light;
                ctx.beginPath(); ctx.ellipse(0, 0.58, 0.44, 0.32, 0, 0, Math.PI * 2); ctx.fill();
                for (const s of [-1, 1]) {
                    const x = s * 0.27, y = -0.02, r = 0.125;
                    ctx.fillStyle = '#ffc21a';
                    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#120c08';
                    ctx.beginPath(); ctx.arc(x + s * 0.012, y + 0.018, r * 0.42, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.arc(x - 0.03, y - 0.01, r * 0.15, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#120c08';
                    ctx.lineWidth = 0.02;
                    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
                    // Хмурое веко: закрывает верх глаза, внутренний угол ниже
                    ctx.fillStyle = plume;
                    ctx.beginPath();
                    ctx.moveTo(x - s * r * 1.3, y - r * 0.3);
                    ctx.lineTo(x + s * r * 1.3, y - r * 0.85);
                    ctx.lineTo(x + s * r * 1.3, y - r * 1.9);
                    ctx.lineTo(x - s * r * 1.3, y - r * 1.9);
                    ctx.closePath();
                    ctx.fill();
                    // Белая «бровь» ястреба — над веком и дальше к затылку
                    ctx.strokeStyle = light;
                    ctx.lineWidth = 0.055;
                    ctx.beginPath();
                    ctx.moveTo(x - s * r * 1.35, y - r * 0.5);
                    ctx.lineTo(x + s * r * 1.2, y - r * 1.05);
                    ctx.quadraticCurveTo(s * 0.6, y - r * 1.25, s * 0.85, -0.16);
                    ctx.stroke();
                }
            },
            extras(g, info) {
                const b = onHead(info, 0, -0.1, -0.03);
                const up = [[0, b.y + 0.01, b.z - 0.02], [0, b.y + 0.012, b.z + 0.06], [0, b.y - 0.025, b.z + 0.115], [0, b.y - 0.075, b.z + 0.105]];
                g.add(mesh(taperedTube(up, (t) => 0.05 * Math.pow(1 - t, 0.7) + 0.005, 24, 12), Mat.vinyl(beak, 0.35)));
                g.add(mesh(ellipsoid(0.034, 0.016, 0.045, 16, 10), Mat.vinyl(shade(beak, -0.25), 0.4), 0, b.y - 0.035, b.z + 0.025));
                for (let i = 0; i < 3; i++) {
                    const p = onHead(info, 0, 1.25 - i * 0.28, -0.02);
                    g.add(mesh(ellipsoid(0.02, 0.09 - i * 0.012, 0.045, 12, 10), Mat.vinyl(i === 1 ? plume : red, 0.5), p.x, p.y + 0.05, p.z - 0.02, { rx: -0.7 - i * 0.35 }));
                }
                for (let i = 0; i < 5; i++) {
                    const f = new T.Group();
                    f.position.set(0, 0.27, -0.13);
                    f.rotation.set(1, 0, (i - 2) * 0.32);
                    f.add(mesh(ellipsoid(0.03, 0.12, 0.01, 12, 10), Mat.vinyl(plume, 0.5), 0, -0.1, 0));
                    f.add(mesh(ellipsoid(0.026, 0.035, 0.012, 10, 8), Mat.vinyl(red, 0.5), 0, -0.19, 0));
                    g.add(f);
                }
            }
        });
    }

    // ---------- Шайба-подставка ----------
    let puckMat = null;
    function puckBase(color) {
        if (!puckMat) {
            // Рифлёный бок шайбы: в развёртке токарного профиля бок — узкая полоса посередине
            const tex = CM.Tex.canvas(512, 64, (ctx, w, h) => {
                ctx.fillStyle = '#141417';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#2c2c33';
                for (let x = 0; x < w; x += 6) ctx.fillRect(x, h * 0.43, 3, h * 0.14);
            });
            puckMat = Mat.textured(tex, { roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });
        }
        const g = new T.Group();
        const r = 0.4, h = 0.085;
        const pts = profile([['M', 0, 0], ['L', r - 0.014, 0], ['Q', r, 0, r, 0.014], ['L', r, h - 0.014], ['Q', r, h, r - 0.014, h], ['L', 0, h]], 4);
        g.add(mesh(lathe(pts, 64), puckMat));
        g.add(mesh(new T.TorusGeometry(r - 0.04, 0.01, 8, 64), Mat.vinyl(TEAMS[color].puck, 0.35), 0, h - 0.004, 0, { rx: Math.PI / 2, shadow: false }));
        g.userData.top = h;
        return g;
    }

    const BUILDERS = {
        k: goalie, q: captain, r: defenseman, b: sniper, p: junior,
        n: (color) => (color === 'w' ? fox() : hawk())
    };

    const NAMES = {
        w: { k: 'Вратарь «Металлурга»', q: 'Капитан «Металлурга»', r: 'Защитник «Металлурга»', b: 'Снайпер «Металлурга»', n: 'Лисёнок Тимоша', p: 'Юниор «Металлурга»' },
        b: { k: 'Вратарь «Авангарда»', q: 'Капитан «Авангарда»', r: 'Защитник «Авангарда»', b: 'Снайпер «Авангарда»', n: 'Ястреб', p: 'Юниор «Авангарда»' }
    };

    const SCALE = { k: 1.16, q: 1.1, r: 1.14, b: 1.1, n: 1.1, p: 0.92 };

    function buildPiece(type, color) {
        const root = new T.Group();
        const pod = puckBase(color);
        root.add(pod);
        const ch = BUILDERS[type](color);
        ch.scale.setScalar(SCALE[type]);
        ch.position.y = pod.userData.top;
        root.add(ch);
        CM.optimize(root);
        const box = new T.Box3().setFromObject(root);
        root.userData.height = box.max.y;
        root.userData.radius = 0.4;
        return root;
    }

    CM.Themes3D.hockey = {
        key: 'hockey',
        buildPiece,
        names: NAMES,
        teams: TEAMS,
        motion: 'skate',
        // Команды стоят лицом друг к другу, как на вбрасывании
        faceOpponent: true,
        elevation: 48,
        fitHeight: 1.2,
        portraitYaw: 0.28
    };
})();
