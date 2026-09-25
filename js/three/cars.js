/*
 * Тема «Тачки»: мультяшные машинки с глазами на лобовом стекле и ртом на бампере.
 * Белые — команда Радиатор-Спрингс, чёрные — соперники.
 * Все модели процедурные: кузов и кабина — скруглённые коробки с атласом-раскраской (common.js).
 */
(function () {
    'use strict';
    const CM = window.CM;
    const T = THREE;
    const { atlasBox, deform, roundedBox, ellipsoid, tube } = CM.G;
    const { mesh, Mat } = CM;

    const FONT = '"Russo One", "Arial Black", Impact, sans-serif';
    const smooth = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };

    function shade(hex, k) {
        const c = new T.Color(hex);
        if (k < 0) c.lerp(new T.Color('#000000'), -k); else c.lerp(new T.Color('#ffffff'), k);
        return '#' + c.getHexString();
    }

    function rr(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // ---------- Глаза на лобовом стекле ----------
    // up: [у внешнего угла, у внутреннего, изгиб] — доля высоты глаза, закрытая верхним веком
    const EXPR = {
        happy: { up: [0.16, 0.18, -0.07], low: 0.1 },
        confident: { up: [0.3, 0.34, -0.03], low: 0.1 },
        gentle: { up: [0.3, 0.26, -0.07], low: 0.1 },
        smug: { up: [0.48, 0.44, 0.02], low: 0.08 },
        angry: { up: [0.1, 0.52, 0.03], low: 0.1 },
        mean: { up: [0.2, 0.48, 0.02], low: 0.14 },
        serious: { up: [0.38, 0.42, 0.0], low: 0.1 },
        sleepy: { up: [0.52, 0.5, -0.05], low: 0.08 },
        goofy: { up: [0.06, 0.1, -0.05], low: 0.0 },
        cool: { up: [0.32, 0.5, 0.02], low: 0.12 },
        evil: { up: [0.16, 0.5, 0.04], low: 0.16 }
    };

    function drawEyes(ctx, fw, fh, o) {
        ctx.fillStyle = o.lid;
        ctx.fillRect(0, 0, fw, fh);
        const ex = EXPR[o.expr || 'happy'];
        const gap = fw * (o.gap || 0.035);
        const sideM = fw * (o.margin || 0.075);
        const ew = (fw - sideM * 2 - gap) / 2;
        const eh = fh * (o.height || 0.78);
        const ey = fh * (o.top || 0.12);
        const eyes = [
            { x: sideM, side: -1 },
            { x: sideM + ew + gap, side: 1 }
        ];
        const look = o.look || [0, 0];
        for (const e of eyes) {
            const rad = Math.min(ew, eh) * 0.48;
            ctx.save();
            rr(ctx, e.x, ey, ew, eh, rad);
            const eyePath = new Path2D();
            eyePath.moveTo(e.x + rad, ey);
            eyePath.arcTo(e.x + ew, ey, e.x + ew, ey + eh, rad);
            eyePath.arcTo(e.x + ew, ey + eh, e.x, ey + eh, rad);
            eyePath.arcTo(e.x, ey + eh, e.x, ey, rad);
            eyePath.arcTo(e.x, ey, e.x + ew, ey, rad);
            eyePath.closePath();
            ctx.fillStyle = '#fbfaf4';
            ctx.fill(eyePath);
            ctx.clip(eyePath);
            // Тень от века
            const sg = ctx.createLinearGradient(0, ey, 0, ey + eh * 0.5);
            sg.addColorStop(0, 'rgba(60,50,40,0.35)');
            sg.addColorStop(1, 'rgba(60,50,40,0)');
            ctx.fillStyle = sg;
            ctx.fillRect(e.x, ey, ew, eh);
            // Радужка и зрачок
            const irisR = eh * (o.iris || 0.4);
            const cx = e.x + ew / 2 + look[0] * ew * 0.2 + (o.cross ? -e.side * ew * o.cross : 0);
            const cy = ey + eh * 0.56 + look[1] * eh * 0.16;
            const ig = ctx.createRadialGradient(cx, cy - irisR * 0.2, irisR * 0.1, cx, cy, irisR);
            ig.addColorStop(0, shade(o.irisColor, 0.35));
            ig.addColorStop(0.7, o.irisColor);
            ig.addColorStop(1, shade(o.irisColor, -0.45));
            ctx.fillStyle = ig;
            ctx.beginPath(); ctx.arc(cx, cy, irisR, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0b0b0d';
            ctx.beginPath(); ctx.arc(cx, cy, irisR * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath(); ctx.arc(cx - irisR * 0.34, cy - irisR * 0.36, irisR * 0.22, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath(); ctx.arc(cx + irisR * 0.3, cy + irisR * 0.3, irisR * 0.09, 0, Math.PI * 2); ctx.fill();
            // Верхнее веко
            const outerX = e.side < 0 ? e.x : e.x + ew;
            const innerX = e.side < 0 ? e.x + ew : e.x;
            const yo = ey + ex.up[0] * eh, yi = ey + ex.up[1] * eh;
            const my = (yo + yi) / 2 + ex.up[2] * eh;
            ctx.fillStyle = o.lid;
            ctx.beginPath();
            ctx.moveTo(outerX, ey - 2);
            ctx.lineTo(outerX, yo);
            ctx.quadraticCurveTo((outerX + innerX) / 2, my, innerX, yi);
            ctx.lineTo(innerX, ey - 2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = shade(o.lid, -0.55);
            ctx.lineWidth = eh * 0.05;
            ctx.beginPath();
            ctx.moveTo(outerX, yo);
            ctx.quadraticCurveTo((outerX + innerX) / 2, my, innerX, yi);
            ctx.stroke();
            // Нижнее веко
            if (ex.low > 0) {
                ctx.fillStyle = o.lid;
                ctx.beginPath();
                ctx.moveTo(e.x, ey + eh + 2);
                ctx.lineTo(e.x, ey + eh * 0.92);
                ctx.quadraticCurveTo(e.x + ew / 2, ey + eh * (1 - ex.low * 2.2), e.x + ew, ey + eh * 0.92);
                ctx.lineTo(e.x + ew, ey + eh + 2);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            ctx.strokeStyle = 'rgba(25,22,20,0.9)';
            ctx.lineWidth = eh * 0.045;
            ctx.stroke(eyePath);
        }
        // Блик стекла
        const gl = ctx.createLinearGradient(0, 0, fw, fh);
        gl.addColorStop(0, 'rgba(255,255,255,0)');
        gl.addColorStop(0.35, 'rgba(255,255,255,0.18)');
        gl.addColorStop(0.42, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(sideM * 0.5, ey, fw - sideM, eh);
    }

    // ---------- Рот на бампере ----------
    function drawMouth(ctx, cx, cy, mw, mh, type, lip) {
        const dark = '#3a0f12', tongue = '#d8505a';
        const outline = shade(lip, -0.6);
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const L = cx - mw / 2, R = cx + mw / 2;
        const path = new Path2D();
        if (type === 'grin' || type === 'buck' || type === 'evil' || type === 'smirk') {
            const tilt = type === 'smirk' ? mh * 0.22 : 0;
            path.moveTo(L, cy - mh * 0.28 + tilt);
            path.quadraticCurveTo(cx, cy - mh * 0.12, R, cy - mh * 0.36 - tilt * 0.4);
            path.bezierCurveTo(R - mw * 0.08, cy + mh * 0.2, cx + mw * 0.22, cy + mh * 0.62, cx, cy + mh * 0.6);
            path.bezierCurveTo(cx - mw * 0.24, cy + mh * 0.6, L + mw * 0.08, cy + mh * 0.18 + tilt, L, cy - mh * 0.28 + tilt);
            path.closePath();
            ctx.fillStyle = dark;
            ctx.fill(path);
            ctx.save();
            ctx.clip(path);
            ctx.fillStyle = tongue;
            ctx.beginPath();
            ctx.ellipse(cx + mw * 0.05, cy + mh * 0.62, mw * 0.2, mh * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fbfbf6';
            if (type === 'buck') {
                const tw = mw * 0.12;
                rr(ctx, cx - tw - mw * 0.01, cy - mh * 0.3, tw, mh * 0.42, tw * 0.25); ctx.fill();
                rr(ctx, cx + mw * 0.01, cy - mh * 0.3, tw, mh * 0.42, tw * 0.25); ctx.fill();
                ctx.strokeStyle = '#c9c2b0'; ctx.lineWidth = mh * 0.03;
                rr(ctx, cx - tw - mw * 0.01, cy - mh * 0.3, tw, mh * 0.42, tw * 0.25); ctx.stroke();
                rr(ctx, cx + mw * 0.01, cy - mh * 0.3, tw, mh * 0.42, tw * 0.25); ctx.stroke();
            } else if (type === 'evil') {
                ctx.beginPath();
                const n = 9;
                ctx.moveTo(L, cy - mh * 0.4);
                for (let i = 0; i <= n; i++) {
                    const x = L + (mw * i) / n;
                    ctx.lineTo(x, cy - mh * 0.34);
                    if (i < n) ctx.lineTo(x + mw / n / 2, cy - mh * 0.02);
                }
                ctx.lineTo(R, cy - mh * 0.4);
                ctx.fill();
            } else {
                // Верхний ряд зубов
                ctx.beginPath();
                ctx.moveTo(L, cy - mh * 0.5);
                ctx.lineTo(R, cy - mh * 0.5);
                ctx.lineTo(R, cy - mh * 0.24 - tilt * 0.4);
                ctx.quadraticCurveTo(cx, cy + mh * 0.1, L, cy - mh * 0.16 + tilt);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                ctx.lineWidth = mh * 0.025;
                for (let i = 1; i < 6; i++) {
                    const x = L + (mw * i) / 6;
                    ctx.beginPath(); ctx.moveTo(x, cy - mh * 0.4); ctx.lineTo(x, cy - mh * 0.02); ctx.stroke();
                }
            }
            ctx.restore();
            ctx.strokeStyle = outline;
            ctx.lineWidth = mh * 0.09;
            ctx.stroke(path);
        } else if (type === 'serious') {
            ctx.strokeStyle = outline;
            ctx.lineWidth = mh * 0.12;
            ctx.beginPath();
            ctx.moveTo(L + mw * 0.08, cy + mh * 0.08);
            ctx.quadraticCurveTo(cx, cy - mh * 0.06, R - mw * 0.08, cy + mh * 0.1);
            ctx.stroke();
        } else {
            // Добрая закрытая улыбка с ямочками
            ctx.strokeStyle = outline;
            ctx.lineWidth = mh * 0.12;
            ctx.beginPath();
            ctx.moveTo(L + mw * 0.06, cy - mh * 0.1);
            ctx.quadraticCurveTo(cx, cy + mh * 0.55, R - mw * 0.06, cy - mh * 0.1);
            ctx.stroke();
            ctx.lineWidth = mh * 0.08;
            ctx.beginPath(); ctx.moveTo(L, cy - mh * 0.2); ctx.lineTo(L + mw * 0.1, cy - mh * 0.02); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(R, cy - mh * 0.2); ctx.lineTo(R - mw * 0.1, cy - mh * 0.02); ctx.stroke();
        }
        ctx.restore();
    }

    // ---------- Наклейки ----------
    function drawNumber(ctx, text, cx, cy, size, fill, stroke, opts = {}) {
        ctx.save();
        ctx.font = `${opts.italic === false ? '' : 'italic '}900 ${size}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (stroke) {
            ctx.lineJoin = 'round';
            ctx.lineWidth = size * 0.16;
            ctx.strokeStyle = stroke;
            ctx.strokeText(text, cx, cy);
        }
        ctx.fillStyle = fill;
        ctx.fillText(text, cx, cy);
        ctx.restore();
    }

    function boltPath(ctx, x, y, len, h, flip) {
        // Молния вдоль оси x: от x до x+len, высота h
        const p = [
            [0, 0.1], [0.46, 0.35], [0.4, 0.05], [1, 0.62], [0.52, 0.42], [0.58, 0.8], [0.02, 0.36]
        ];
        ctx.beginPath();
        p.forEach(([px, py], i) => {
            const X = flip ? x + len - px * len : x + px * len;
            const Y = y + py * h;
            if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        });
        ctx.closePath();
    }

    function drawBolt(ctx, x, y, len, h, flip) {
        ctx.save();
        ctx.lineJoin = 'round';
        boltPath(ctx, x, y, len, h, flip);
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#fff176');
        g.addColorStop(0.5, '#ffd21f');
        g.addColorStop(1, '#ff8f00');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = h * 0.06;
        ctx.strokeStyle = '#e65100';
        ctx.stroke();
        ctx.restore();
    }

    function drawFlames(ctx, x, y, len, h, flip) {
        ctx.save();
        const tongues = 5;
        const make = (scale, color) => {
            ctx.beginPath();
            const sx = (px) => (flip ? x + len - px : x + px);
            ctx.moveTo(sx(0), y + h * 0.5 - (h * scale) / 2);
            for (let i = 0; i < tongues; i++) {
                const t0 = i / tongues, t1 = (i + 1) / tongues;
                const tipX = len * (0.55 + 0.45 * Math.sin(i * 1.7 + 0.6) ** 2) * scale;
                const yy = y + h * 0.5 - (h * scale) / 2 + h * scale * t1;
                ctx.quadraticCurveTo(sx(tipX * 0.6), y + h * 0.5 - (h * scale) / 2 + h * scale * (t0 + 0.1), sx(tipX), y + h * 0.5 - (h * scale) / 2 + h * scale * (t0 + t1) / 2);
                ctx.quadraticCurveTo(sx(tipX * 0.45), yy - h * scale * 0.05, sx(len * 0.05), yy);
            }
            ctx.lineTo(sx(0), y + h * 0.5 + (h * scale) / 2);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        };
        make(1, '#ff6d00');
        make(0.7, '#ffab00');
        make(0.42, '#ffee58');
        ctx.restore();
    }

    function drawSideWindow(ctx, fw, fh, glass, frame, opts = {}) {
        const x0 = fw * (opts.front || 0.16), x1 = fw * (1 - (opts.back || 0.16));
        const y0 = fh * (opts.top || 0.2), y1 = fh * (opts.bottom || 0.78);
        ctx.fillStyle = glass;
        rr(ctx, x0, y0, x1 - x0, y1 - y0, Math.min(fh, fw) * 0.12);
        ctx.fill();
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0.2, 'rgba(255,255,255,0.28)');
        g.addColorStop(0.32, 'rgba(255,255,255,0)');
        g.addColorStop(0.6, 'rgba(255,255,255,0)');
        g.addColorStop(0.68, 'rgba(255,255,255,0.14)');
        g.addColorStop(0.75, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fill();
        if (opts.pillar) {
            ctx.fillStyle = frame;
            ctx.fillRect((x0 + x1) / 2 - fw * 0.02, y0, fw * 0.04, y1 - y0);
        }
    }

    function drawTailLights(ctx, fw, fh, color = '#ff2a2a') {
        ctx.fillStyle = color;
        rr(ctx, fw * 0.1, fh * 0.28, fw * 0.16, fh * 0.26, fh * 0.08); ctx.fill();
        rr(ctx, fw * 0.74, fh * 0.28, fw * 0.16, fh * 0.26, fh * 0.08); ctx.fill();
    }

    function stickerLights(ctx, fw, fh, color) {
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = fh * 0.02;
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(fw / 2 + s * fw * 0.33, fh * 0.26, fw * 0.075, fh * 0.1, s * 0.2, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
    }

    // ---------- Колёса ----------
    function wheel(r, width, o = {}) {
        const g = new T.Group();
        g.name = 'wheel';
        const tubeR = Math.min(width / 2, r * 0.32);
        let rimR = r - tubeR * 1.35;
        if (o.chunky) {
            // Толстая тракторная шина с грунтозацепами
            const pts = CM.G.profile([
                ['M', r * 0.5, -width / 2], ['L', r * 0.9, -width / 2], ['Q', r, -width / 2, r, -width * 0.3],
                ['L', r, width * 0.3], ['Q', r, width / 2, r * 0.9, width / 2], ['L', r * 0.5, width / 2]
            ], 6);
            const tire = CM.G.lathe(pts, 32);
            tire.rotateZ(Math.PI / 2);
            g.add(mesh(tire, Mat.rubber()));
            const lug = new T.BoxGeometry(width * 0.9, r * 0.1, r * 0.16);
            const n = 14;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2;
                g.add(mesh(lug, Mat.rubber(), 0, Math.cos(a) * r * 0.99, Math.sin(a) * r * 0.99, { rx: a + (i % 2 ? 0.35 : -0.35) }));
            }
            rimR = r * 0.5;
        } else {
            const tire = new T.TorusGeometry(r - tubeR, tubeR, 14, 36);
            tire.rotateY(Math.PI / 2);
            tire.scale(width / (tubeR * 2), 1, 1);
            g.add(mesh(tire, Mat.rubber()));
        }
        const rim = new T.CylinderGeometry(rimR, rimR, width * 0.86, 28);
        rim.rotateZ(Math.PI / 2);
        g.add(mesh(rim, o.rim ? Mat.paint(o.rim, 0.3) : Mat.chrome()));
        const side = o.side || 1;
        const cap = ellipsoid(rimR * 0.45, rimR * 0.45, rimR * 0.45, 20, 12);
        cap.scale(0.35, 1, 1);
        g.add(mesh(cap, o.cap ? Mat.paint(o.cap, 0.3) : Mat.chrome(), side * width * 0.43, 0, 0));
        if (o.whitewall) {
            const ww = new T.TorusGeometry(r - tubeR * 0.95, tubeR * 0.32, 8, 36);
            ww.rotateY(Math.PI / 2);
            g.add(mesh(ww, Mat.vinyl('#f5f3ea', 0.5), side * width * 0.36, 0, 0));
        }
        if (o.spokes) {
            const sp = new T.BoxGeometry(width * 0.2, rimR * 1.7, rimR * 0.18);
            for (let i = 0; i < o.spokes; i++) {
                g.add(mesh(sp, Mat.chrome(), side * width * 0.38, 0, 0, { rx: (i / o.spokes) * Math.PI }));
            }
        }
        return g;
    }

    function addWheels(g, s) {
        const list = [];
        for (const [z, rr_, wid] of [[s.wheelZ[0], s.wheelR[0], s.wheelW[0]], [s.wheelZ[1], s.wheelR[1], s.wheelW[1]]]) {
            for (const side of [-1, 1]) {
                const w = wheel(rr_, wid, { rim: s.rim, cap: s.cap, whitewall: s.whitewall, spokes: s.spokes, side, chunky: s.chunky && rr_ > 0.12 });
                w.position.set(side * (s.wheelX || (s.W / 2 - wid * 0.3)), rr_, z);
                g.add(w);
                list.push(w);
            }
        }
        return list;
    }

    // ---------- Общий конструктор легковушки ----------
    /*
     * s — описание машины:
     *  L, W — длина и ширина; bodyH — высота кузова; clear — клиренс; radius — скругление;
     *  hoodDrop / trunkDrop — насколько опущены капот и багажник; topTaper / frontTaper — сужение;
     *  cab: { L, W, H, z, slant, rear, taper, radius } — кабина; paint — цвет;
     *  eyes: { irisColor, expr, look }; mouth: { type, y, w, h };
     *  front(ctx, fw, fh), hood(ctx, fw, fh), side(ctx, fw, fh, dir), roof(ctx, fw, fh) — дорисовка наклеек;
     *  wheelZ: [перед, зад], wheelR, wheelW, rim, whitewall; extras(g, info) — дополнительные детали.
     */
    function buildCar(s) {
        const g = new T.Group();
        const paint = s.paint;
        const lid = s.lid || paint;
        const body = atlasBox(s.W, s.bodyH, s.L, s.radius, 5, {
            front: (ctx, fw, fh) => {
                if (s.headlights) stickerLights(ctx, fw, fh, s.headlights);
                if (s.front) s.front(ctx, fw, fh);
                const m = s.mouth || {};
                if (m.type !== 'none') {
                    drawMouth(ctx, fw / 2, fh * (m.y || 0.46), fw * (m.w || 0.52), fh * (m.h || 0.42), m.type || 'smile', paint);
                }
            },
            top: (ctx, fw, fh) => { if (s.hood) s.hood(ctx, fw, fh); },
            right: (ctx, fw, fh) => { if (s.side) s.side(ctx, fw, fh, 'right'); },
            left: (ctx, fw, fh) => { if (s.side) s.side(ctx, fw, fh, 'left'); },
            back: (ctx, fw, fh) => drawTailLights(ctx, fw, fh)
        }, { background: paint, density: 900 });
        const L2 = s.L / 2;
        deform(body.geometry, (v) => {
            const yn = (v.y + s.bodyH / 2) / s.bodyH;
            const zn = v.z / L2;
            if (yn > 0.35) {
                const k = (yn - 0.35) / 0.65;
                const drop = (s.hoodDrop || 0) * smooth(0.05, 1, zn) + (s.trunkDrop || 0) * smooth(-0.15, -1, zn);
                v.y -= k * drop;
            }
            v.x *= 1 - (s.topTaper || 0) * yn * yn - (s.frontTaper || 0) * Math.max(0, zn) ** 3;
            // Выпуклые крылья над колёсами
            const fl = s.fenders === undefined ? 0.03 : s.fenders;
            if (fl && Math.abs(v.x) > s.W * 0.3 && yn > 0.15 && yn < 0.95) {
                let bump = 0;
                for (const wz of s.wheelZ) bump = Math.max(bump, Math.exp(-(((v.z - wz) / 0.13) ** 2)));
                v.x += Math.sign(v.x) * fl * bump * Math.sin(Math.PI * (yn - 0.15) / 0.8);
            }
        });
        const bodyMat = new T.MeshPhysicalMaterial({
            map: body.texture, roughness: s.rough || 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06
        });
        const bodyY = s.clear + s.bodyH / 2;
        g.add(mesh(body.geometry, bodyMat, 0, bodyY, 0));

        let cabTop = s.clear + s.bodyH;
        if (s.cab) {
            const c = s.cab;
            const cab = atlasBox(c.W, c.H, c.L, c.radius, 5, {
                front: (ctx, fw, fh) => drawEyes(ctx, fw, fh, Object.assign({ lid }, s.eyes)),
                right: (ctx, fw, fh) => drawSideWindow(ctx, fw, fh, s.glass || '#1d2a3a', paint, c.window),
                left: (ctx, fw, fh) => drawSideWindow(ctx, fw, fh, s.glass || '#1d2a3a', paint, c.window),
                back: (ctx, fw, fh) => drawSideWindow(ctx, fw, fh, s.glass || '#1d2a3a', paint, { front: 0.14, back: 0.14, top: 0.18, bottom: 0.7 }),
                top: (ctx, fw, fh) => { if (s.roof) s.roof(ctx, fw, fh); }
            }, { background: paint, density: 1200 });
            const cL2 = c.L / 2;
            deform(cab.geometry, (v) => {
                const yn = (v.y + c.H / 2) / c.H;
                const zn = v.z / cL2;
                if (zn > 0) v.z -= (c.slant || 0) * yn * Math.min(1, zn * 1.4);
                if (zn < 0) v.z += (c.rear || 0) * yn * Math.min(1, -zn * 1.4);
                v.x *= 1 - (c.taper || 0) * yn;
            });
            const cabMat = new T.MeshPhysicalMaterial({
                map: cab.texture, roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04
            });
            const cy = s.clear + s.bodyH - (c.sink || 0.03) + c.H / 2;
            g.add(mesh(cab.geometry, cabMat, 0, cy, c.z || 0));
            cabTop = cy + c.H / 2;
        }

        const wheels = addWheels(g, s);
        const info = { bodyY, cabTop, top: s.clear + s.bodyH, wheels };
        if (s.spoiler) addSpoiler(g, s, info);
        if (s.extras) s.extras(g, info);
        return g;
    }

    function addSpoiler(g, s, info) {
        const sp = s.spoiler;
        const color = sp.color || s.paint;
        const z = -s.L / 2 + (sp.z || 0.06);
        const y = info.top - (s.trunkDrop || 0) + (sp.h || 0.08);
        g.add(mesh(roundedBox(s.W * (sp.w || 0.86), 0.028, sp.d || 0.11, 0.012, 3), Mat.paint(color), 0, y, z, { rx: -0.12 }));
        for (const side of [-1, 1]) {
            g.add(mesh(roundedBox(0.02, sp.h || 0.08, 0.05, 0.008, 2), Mat.paint(sp.post || shade(color, -0.4)), side * s.W * 0.3, y - (sp.h || 0.08) / 2, z));
            g.add(mesh(roundedBox(0.012, 0.07, sp.d || 0.11, 0.005, 2), Mat.paint(color), side * s.W * (sp.w || 0.86) / 2, y + 0.02, z));
        }
    }

    function roundLamp(g, x, y, z, r, rotY = 0, glow = '#fff6c8') {
        const ring = new T.TorusGeometry(r, r * 0.22, 10, 24);
        g.add(mesh(ring, Mat.chrome(), x, y, z, { ry: rotY }));
        const lens = ellipsoid(r, r, r * 0.45, 20, 12);
        g.add(mesh(lens, Mat.glow(glow, 0.6), x, y, z, { ry: rotY }));
    }

    // ---------- Персонажи ----------
    function mcqueen() {
        const paint = '#d4141c';
        return buildCar({
            L: 0.94, W: 0.58, bodyH: 0.2, clear: 0.07, radius: 0.085,
            hoodDrop: 0.06, trunkDrop: 0.02, topTaper: 0.14, frontTaper: 0.1,
            paint, headlights: '#ffe27a',
            cab: { L: 0.44, W: 0.46, H: 0.2, z: -0.08, slant: 0.11, rear: 0.13, taper: 0.2, radius: 0.075 },
            eyes: { irisColor: '#2f86e6', expr: 'confident', look: [0.05, 0] },
            mouth: { type: 'grin', y: 0.44, w: 0.6, h: 0.46 },
            hood: (ctx, fw, fh) => {
                drawBolt(ctx, fw * 0.28, fh * 0.64, fw * 0.44, fh * 0.2, false);
            },
            side: (ctx, fw, fh, dir) => {
                const flip = dir === 'left';
                drawBolt(ctx, fw * 0.08, fh * 0.28, fw * 0.84, fh * 0.46, !flip);
                drawNumber(ctx, '95', fw * 0.5, fh * 0.52, fh * 0.5, '#fff8e1', '#e65100');
            },
            roof: (ctx, fw, fh) => drawNumber(ctx, '95', fw / 2, fh * 0.52, fh * 0.46, '#fff8e1', '#e65100'),
            wheelZ: [0.29, -0.3], wheelR: [0.105, 0.11], wheelW: [0.085, 0.09], rim: '#c4121a', cap: '#ffd21f',
            spoiler: { h: 0.08, w: 0.84 }
        });
    }

    function sally() {
        const paint = '#4fa6e0';
        return buildCar({
            L: 0.88, W: 0.56, bodyH: 0.19, clear: 0.07, radius: 0.09,
            hoodDrop: 0.075, trunkDrop: 0.04, topTaper: 0.16, frontTaper: 0.12,
            paint,
            cab: { L: 0.43, W: 0.44, H: 0.19, z: -0.08, slant: 0.11, rear: 0.2, taper: 0.2, radius: 0.085 },
            eyes: { irisColor: '#1fa99a', expr: 'gentle', look: [-0.05, 0] },
            mouth: { type: 'smile', y: 0.44, w: 0.36, h: 0.32 },
            hood: (ctx, fw, fh) => {
                // Тонкая серебристая линия-«татуировка» на капоте
                ctx.strokeStyle = '#dfe7ee';
                ctx.lineWidth = fh * 0.012;
                ctx.beginPath();
                ctx.moveTo(fw * 0.42, fh * 0.92);
                ctx.bezierCurveTo(fw * 0.38, fh * 0.8, fw * 0.62, fh * 0.78, fw * 0.58, fh * 0.66);
                ctx.stroke();
            },
            side: (ctx, fw, fh) => {
                ctx.strokeStyle = '#dfe7ee';
                ctx.lineWidth = fh * 0.03;
                ctx.beginPath();
                ctx.moveTo(fw * 0.12, fh * 0.42); ctx.lineTo(fw * 0.88, fh * 0.42);
                ctx.stroke();
            },
            wheelZ: [0.27, -0.28], wheelR: [0.1, 0.105], wheelW: [0.08, 0.09], spokes: 5,
            extras(g, info) {
                // Круглые «лягушачьи» фары Porsche на крыльях
                for (const side of [-1, 1]) {
                    const lamp = ellipsoid(0.055, 0.04, 0.07, 20, 14);
                    g.add(mesh(lamp, Mat.paint(paint), side * 0.19, info.top - 0.045, 0.33));
                    g.add(mesh(ellipsoid(0.042, 0.03, 0.035, 18, 12), Mat.glow('#fffbe6', 0.5), side * 0.19, info.top - 0.043, 0.37));
                }
            }
        });
    }

    function docHudson() {
        const paint = '#1b3a73';
        return buildCar({
            L: 0.96, W: 0.6, bodyH: 0.22, clear: 0.065, radius: 0.1,
            hoodDrop: 0.035, trunkDrop: 0.03, topTaper: 0.1, frontTaper: 0.06,
            paint,
            cab: { L: 0.43, W: 0.48, H: 0.19, z: -0.06, slant: 0.09, rear: 0.13, taper: 0.14, radius: 0.085 },
            eyes: { irisColor: '#3d7fd0', expr: 'serious', look: [0, 0.1] },
            mouth: { type: 'serious', y: 0.7, w: 0.34, h: 0.22 },
            front: (ctx, fw, fh) => {
                // Хромированная решётка Hudson
                ctx.fillStyle = '#c9d1d8';
                rr(ctx, fw * 0.2, fh * 0.26, fw * 0.6, fh * 0.3, fh * 0.12); ctx.fill();
                ctx.fillStyle = '#26303a';
                rr(ctx, fw * 0.23, fh * 0.3, fw * 0.54, fh * 0.22, fh * 0.08); ctx.fill();
                ctx.strokeStyle = '#e8edf1';
                ctx.lineWidth = fh * 0.035;
                ctx.beginPath(); ctx.moveTo(fw * 0.23, fh * 0.41); ctx.lineTo(fw * 0.77, fh * 0.41); ctx.stroke();
                ctx.fillStyle = '#e8edf1';
                ctx.beginPath(); ctx.moveTo(fw * 0.46, fh * 0.31); ctx.lineTo(fw * 0.54, fh * 0.31); ctx.lineTo(fw * 0.5, fh * 0.45); ctx.closePath(); ctx.fill();
            },
            side: (ctx, fw, fh, dir) => {
                ctx.fillStyle = '#f4f1e6';
                ctx.beginPath(); ctx.arc(fw * 0.5, fh * 0.5, fh * 0.3, 0, Math.PI * 2); ctx.fill();
                drawNumber(ctx, '51', fw * 0.5, fh * 0.52, fh * 0.34, '#1b3a73', null, { italic: false });
                ctx.strokeStyle = '#d7dde2';
                ctx.lineWidth = fh * 0.04;
                ctx.beginPath(); ctx.moveTo(fw * 0.08, fh * 0.2); ctx.lineTo(fw * 0.92, fh * 0.2); ctx.stroke();
            },
            roof: (ctx, fw, fh) => {
                ctx.fillStyle = '#f4f1e6';
                ctx.beginPath(); ctx.arc(fw / 2, fh * 0.5, fh * 0.3, 0, Math.PI * 2); ctx.fill();
                drawNumber(ctx, '51', fw / 2, fh * 0.52, fh * 0.34, '#1b3a73', null, { italic: false });
            },
            wheelZ: [0.3, -0.3], wheelR: [0.1, 0.1], wheelW: [0.085, 0.085], whitewall: true,
            extras(g, info) {
                for (const side of [-1, 1]) roundLamp(g, side * 0.21, info.top - 0.07, 0.47, 0.04);
                // Хромированный бампер
                g.add(mesh(new T.CapsuleGeometry(0.02, 0.46, 6, 12).rotateZ(Math.PI / 2), Mat.chrome(), 0, 0.095, 0.485));
            }
        });
    }

    function luigi() {
        const paint = '#f3c318';
        return buildCar({
            L: 0.7, W: 0.48, bodyH: 0.2, clear: 0.06, radius: 0.1,
            hoodDrop: 0.06, trunkDrop: 0.05, topTaper: 0.14, frontTaper: 0.1,
            paint,
            cab: { L: 0.38, W: 0.41, H: 0.2, z: -0.04, slant: 0.08, rear: 0.12, taper: 0.14, radius: 0.1 },
            eyes: { irisColor: '#7a4a24', expr: 'happy', look: [0, 0] },
            mouth: { type: 'smile', y: 0.62, w: 0.3, h: 0.26 },
            roof: (ctx, fw, fh) => {
                const w = fw * 0.3;
                ['#1f9d55', '#f7f7f2', '#d62f2f'].forEach((c, i) => {
                    ctx.fillStyle = c;
                    ctx.fillRect(fw / 2 - w * 1.5 + i * w, fh * 0.3, w, fh * 0.4);
                });
            },
            wheelZ: [0.22, -0.22], wheelR: [0.085, 0.085], wheelW: [0.07, 0.07], rim: '#f4efe0',
            extras(g, info) {
                // Хромированные «усы» Fiat 500
                for (const side of [-1, 1]) {
                    const pts = [[0, 0.155, 0.356], [side * 0.06, 0.162, 0.354], [side * 0.12, 0.17, 0.345], [side * 0.17, 0.185, 0.325]];
                    g.add(mesh(tube(pts, 0.009, 16, 8), Mat.chrome()));
                    roundLamp(g, side * 0.15, 0.2, 0.33, 0.036, side * 0.35);
                }
                g.add(mesh(new T.SphereGeometry(0.018, 14, 10), Mat.chrome(), 0, 0.155, 0.36));
            }
        });
    }

    // Чик Хикс — зелёный гонщик с «усами»-решёткой
    function chickHicks() {
        const paint = '#3d9a34';
        return buildCar({
            L: 0.94, W: 0.58, bodyH: 0.2, clear: 0.07, radius: 0.075,
            hoodDrop: 0.06, trunkDrop: 0.02, topTaper: 0.14, frontTaper: 0.1,
            paint,
            cab: { L: 0.44, W: 0.46, H: 0.2, z: -0.08, slant: 0.11, rear: 0.13, taper: 0.2, radius: 0.075 },
            eyes: { irisColor: '#6f8f1f', expr: 'smug', look: [0.12, 0] },
            mouth: { type: 'smirk', y: 0.6, w: 0.5, h: 0.36 },
            front: (ctx, fw, fh) => {
                // «Усы»-решётка
                ctx.fillStyle = '#17200f';
                ctx.beginPath();
                ctx.moveTo(fw * 0.5, fh * 0.26);
                ctx.bezierCurveTo(fw * 0.38, fh * 0.16, fw * 0.22, fh * 0.22, fw * 0.12, fh * 0.4);
                ctx.bezierCurveTo(fw * 0.26, fh * 0.32, fw * 0.36, fh * 0.37, fw * 0.5, fh * 0.37);
                ctx.bezierCurveTo(fw * 0.64, fh * 0.37, fw * 0.74, fh * 0.32, fw * 0.88, fh * 0.4);
                ctx.bezierCurveTo(fw * 0.78, fh * 0.22, fw * 0.62, fh * 0.16, fw * 0.5, fh * 0.26);
                ctx.fill();
                stickerLights(ctx, fw, fh, '#e8f5c8');
            },
            hood: (ctx, fw, fh) => {
                ctx.fillStyle = '#23601d';
                ctx.fillRect(fw * 0.44, fh * 0.55, fw * 0.12, fh * 0.45);
            },
            side: (ctx, fw, fh) => {
                ctx.fillStyle = '#f2f7ea';
                ctx.beginPath(); ctx.ellipse(fw * 0.5, fh * 0.5, fh * 0.42, fh * 0.34, 0, 0, Math.PI * 2); ctx.fill();
                drawNumber(ctx, '86', fw * 0.5, fh * 0.52, fh * 0.46, '#2e7d32', '#0d2b0f');
            },
            roof: (ctx, fw, fh) => drawNumber(ctx, '86', fw / 2, fh * 0.52, fh * 0.46, '#f2f7ea', '#0d2b0f'),
            wheelZ: [0.29, -0.3], wheelR: [0.105, 0.11], wheelW: [0.085, 0.09], rim: '#2f7d29', cap: '#d9e7c8',
            spoiler: { h: 0.08, w: 0.84 }
        });
    }

    // Джексон Шторм — угловатый гонщик нового поколения
    function jacksonStorm() {
        const paint = '#161b25';
        return buildCar({
            L: 0.96, W: 0.6, bodyH: 0.18, clear: 0.06, radius: 0.045,
            hoodDrop: 0.07, trunkDrop: 0.02, topTaper: 0.2, frontTaper: 0.16,
            paint,
            cab: { L: 0.43, W: 0.44, H: 0.185, z: -0.08, slant: 0.14, rear: 0.16, taper: 0.26, radius: 0.055 },
            eyes: { irisColor: '#29b6f6', expr: 'cool', look: [0.1, 0.05], lid: '#1c2330' },
            mouth: { type: 'smirk', y: 0.5, w: 0.46, h: 0.34 },
            front: (ctx, fw, fh) => {
                ctx.fillStyle = '#29c4ff';
                ctx.beginPath();
                ctx.moveTo(fw * 0.08, fh * 0.2); ctx.lineTo(fw * 0.3, fh * 0.2); ctx.lineTo(fw * 0.24, fh * 0.3); ctx.lineTo(fw * 0.08, fh * 0.3); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(fw * 0.92, fh * 0.2); ctx.lineTo(fw * 0.7, fh * 0.2); ctx.lineTo(fw * 0.76, fh * 0.3); ctx.lineTo(fw * 0.92, fh * 0.3); ctx.fill();
            },
            hood: (ctx, fw, fh) => {
                ctx.strokeStyle = '#29c4ff';
                ctx.lineWidth = fh * 0.025;
                for (const s of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(fw / 2 + s * fw * 0.08, fh);
                    ctx.lineTo(fw / 2 + s * fw * 0.2, fh * 0.7);
                    ctx.lineTo(fw / 2 + s * fw * 0.36, fh * 0.62);
                    ctx.stroke();
                }
            },
            side: (ctx, fw, fh) => {
                ctx.fillStyle = '#29c4ff';
                ctx.beginPath();
                ctx.moveTo(fw * 0.05, fh * 0.7); ctx.lineTo(fw * 0.62, fh * 0.34); ctx.lineTo(fw * 0.95, fh * 0.34);
                ctx.lineTo(fw * 0.95, fh * 0.42); ctx.lineTo(fw * 0.64, fh * 0.42); ctx.lineTo(fw * 0.1, fh * 0.76);
                ctx.closePath(); ctx.fill();
                drawNumber(ctx, '20', fw * 0.36, fh * 0.46, fh * 0.44, '#e3f6ff', '#0277bd');
            },
            roof: (ctx, fw, fh) => drawNumber(ctx, '20', fw / 2, fh * 0.52, fh * 0.46, '#29c4ff', '#0b1a2a'),
            wheelZ: [0.3, -0.31], wheelR: [0.1, 0.105], wheelW: [0.09, 0.095], rim: '#10141c', cap: '#29c4ff',
            spoiler: { h: 0.07, w: 0.92, color: '#161b25', post: '#29c4ff' },
            extras(g, info) {
                g.add(mesh(roundedBox(0.52, 0.018, 0.08, 0.008, 2), Mat.glow('#29c4ff', 0.9), 0, 0.045, 0.43));
            }
        });
    }

    // Бууст — тюнингованная машина уличной банды: пламя, огромное антикрыло, неоновая подсветка
    function boost() {
        const paint = '#6b2d93';
        return buildCar({
            L: 0.92, W: 0.6, bodyH: 0.17, clear: 0.045, radius: 0.06,
            hoodDrop: 0.05, trunkDrop: 0.02, topTaper: 0.16, frontTaper: 0.1,
            paint,
            cab: { L: 0.41, W: 0.44, H: 0.18, z: -0.08, slant: 0.12, rear: 0.16, taper: 0.22, radius: 0.065 },
            glass: '#130f1d',
            eyes: { irisColor: '#f2b705', expr: 'mean', look: [0.1, 0.06] },
            mouth: { type: 'smirk', y: 0.5, w: 0.5, h: 0.38 },
            hood: (ctx, fw, fh) => drawFlames(ctx, fw * 0.2, fh * 0.52, fw * 0.6, fh * 0.46, false),
            side: (ctx, fw, fh, dir) => {
                ctx.save();
                ctx.translate(dir === 'left' ? fw : 0, 0);
                ctx.scale(dir === 'left' ? -1 : 1, 1);
                drawFlames(ctx, fw * 0.06, fh * 0.2, fw * 0.6, fh * 0.6, false);
                ctx.restore();
            },
            front: (ctx, fw, fh) => stickerLights(ctx, fw, fh, '#e3d7ff'),
            wheelZ: [0.29, -0.3], wheelR: [0.1, 0.105], wheelW: [0.09, 0.1], rim: '#b0bec5', spokes: 6,
            spoiler: { h: 0.14, w: 0.96, d: 0.13, color: '#8f99a6' },
            extras(g) {
                // Неоновая подсветка днища и воздухозаборник
                const neon = new T.Mesh(new T.PlaneGeometry(0.5, 0.8), new T.MeshBasicMaterial({
                    color: '#c26bff', transparent: true, opacity: 0.55, depthWrite: false
                }));
                neon.rotation.x = -Math.PI / 2;
                neon.position.y = 0.012;
                g.add(neon);
                g.add(mesh(roundedBox(0.14, 0.05, 0.14, 0.02, 3), Mat.paint('#4a1f68'), 0, 0.2, 0.2));
            }
        });
    }

    // Профессор Зет — крошечная пузатая микромашина с моноклем
    function professorZ() {
        const paint = '#6c7a57';
        const g = buildCar({
            L: 0.66, W: 0.48, bodyH: 0.24, clear: 0.05, radius: 0.11,
            hoodDrop: 0.05, trunkDrop: 0.05, topTaper: 0.16, frontTaper: 0.06,
            paint,
            cab: { L: 0.4, W: 0.43, H: 0.2, z: -0.02, slant: 0.06, rear: 0.1, taper: 0.12, radius: 0.1 },
            eyes: { irisColor: '#6b3f1d', expr: 'evil', look: [-0.15, 0.05] },
            mouth: { type: 'evil', y: 0.5, w: 0.44, h: 0.34 },
            side: (ctx, fw, fh) => {
                ctx.strokeStyle = '#e8dcc0';
                ctx.lineWidth = fh * 0.05;
                ctx.beginPath(); ctx.moveTo(fw * 0.08, fh * 0.34); ctx.lineTo(fw * 0.92, fh * 0.34); ctx.stroke();
            },
            front: (ctx, fw, fh) => stickerLights(ctx, fw, fh, '#f7f1d0'),
            wheelZ: [0.2, -0.2], wheelR: [0.07, 0.07], wheelW: [0.06, 0.06],
            extras(g, info) {
                // Монокль у правого глаза и цепочка
                const x = 0.1, y = info.cabTop - 0.075, z = 0.19;
                g.add(mesh(new T.TorusGeometry(0.058, 0.009, 10, 32), Mat.metal('#d4a93a', 0.25), x, y, z, { rx: -0.35 }));
                const lens = new T.Mesh(new T.CircleGeometry(0.056, 28), new T.MeshPhysicalMaterial({
                    color: '#e8f4ff', transparent: true, opacity: 0.25, roughness: 0.05, clearcoat: 1
                }));
                lens.position.set(x, y, z + 0.003); lens.rotation.x = -0.35;
                g.add(lens);
                g.add(mesh(tube([[x + 0.05, y - 0.03, z], [x + 0.1, y - 0.1, z - 0.02], [x + 0.14, y - 0.12, z - 0.08]], 0.004, 16, 6), Mat.metal('#d4a93a', 0.25)));
            }
        });
        return g;
    }

    // Мак — красный тягач (только кабина), с выхлопными трубами-«башнями»
    function mack() {
        const g = new T.Group();
        const paint = '#c8161d';
        const W = 0.64, H = 0.5, L = 0.6, clear = 0.1;
        const cab = atlasBox(W, H, L, 0.07, 5, {
            front: (ctx, fw, fh) => {
                // Верх — глаза-стекло, ниже — решётка, внизу — рот
                ctx.save();
                ctx.beginPath(); ctx.rect(0, 0, fw, fh * 0.48); ctx.clip();
                drawEyes(ctx, fw, fh * 0.48, { lid: paint, irisColor: '#7b5433', expr: 'happy', margin: 0.1, top: 0.24, height: 0.64 });
                ctx.restore();
                ctx.fillStyle = '#d7dde2';
                rr(ctx, fw * 0.18, fh * 0.5, fw * 0.64, fh * 0.26, fh * 0.03); ctx.fill();
                ctx.fillStyle = '#39424c';
                for (let i = 0; i < 9; i++) ctx.fillRect(fw * 0.2 + i * fw * 0.068, fh * 0.52, fw * 0.035, fh * 0.22);
                drawMouth(ctx, fw / 2, fh * 0.86, fw * 0.4, fh * 0.14, 'smile', paint);
                stickerLights(ctx, fw, fh * 0.5, '#fff3c4');
                ctx.save(); ctx.translate(0, fh * 0.55);
                ctx.fillStyle = '#ffe9a3';
                rr(ctx, fw * 0.05, fh * 0.03, fw * 0.1, fh * 0.07, fh * 0.02); ctx.fill();
                rr(ctx, fw * 0.85, fh * 0.03, fw * 0.1, fh * 0.07, fh * 0.02); ctx.fill();
                ctx.restore();
            },
            right: (ctx, fw, fh) => {
                drawSideWindow(ctx, fw, fh, '#1d2a3a', paint, { front: 0.08, back: 0.5, top: 0.1, bottom: 0.42 });
                ctx.fillStyle = '#f2f2f2';
                ctx.fillRect(0, fh * 0.6, fw, fh * 0.06);
            },
            left: (ctx, fw, fh) => {
                drawSideWindow(ctx, fw, fh, '#1d2a3a', paint, { front: 0.5, back: 0.08, top: 0.1, bottom: 0.42 });
                ctx.fillStyle = '#f2f2f2';
                ctx.fillRect(0, fh * 0.6, fw, fh * 0.06);
            },
            top: (ctx, fw, fh) => {
                ctx.fillStyle = '#b11318';
                ctx.fillRect(fw * 0.1, fh * 0.1, fw * 0.8, fh * 0.8);
            }
        }, { background: paint, density: 900 });
        deform(cab.geometry, (v) => {
            const yn = (v.y + H / 2) / H;
            if (v.z > 0) v.z -= 0.05 * yn * yn;
        });
        g.add(mesh(cab.geometry, new T.MeshPhysicalMaterial({ map: cab.texture, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }), 0, clear + H / 2, 0));
        // Козырёк и огни на крыше
        g.add(mesh(roundedBox(W * 0.9, 0.03, 0.09, 0.012, 3), Mat.paint('#a51217'), 0, clear + H - 0.005, L / 2 - 0.045, { rx: 0.25 }));
        for (let i = 0; i < 5; i++) {
            g.add(mesh(roundedBox(0.045, 0.025, 0.03, 0.008, 2), Mat.glow('#ffb300', 0.9), -0.16 + i * 0.08, clear + H + 0.012, L / 2 - 0.07));
        }
        // Бампер
        g.add(mesh(roundedBox(W * 1.02, 0.06, 0.08, 0.025, 3), Mat.chrome(), 0, clear + 0.02, L / 2 + 0.005));
        // Выхлопные трубы
        for (const side of [-1, 1]) {
            g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.62, 18), Mat.chrome(), side * (W / 2 + 0.02), clear + 0.42, -L / 2 + 0.08));
            g.add(mesh(new T.CylinderGeometry(0.036, 0.03, 0.06, 18), Mat.chrome(), side * (W / 2 + 0.02), clear + 0.76, -L / 2 + 0.08));
        }
        addWheels(g, { W, wheelZ: [0.18, -0.2], wheelR: [0.12, 0.12], wheelW: [0.1, 0.1], wheelX: W / 2 - 0.02 });
        return g;
    }

    // Мэтр — ржавый эвакуатор со стрелой и крюком
    function rustTexture() {
        return CM.Tex.canvas(512, 512, (ctx, w, h) => {
            const rnd = CM.Tex.rng(95);
            ctx.fillStyle = '#8c5a33';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 140; i++) {
                const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 46;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                const c = rnd() < 0.3 ? '94,140,138' : rnd() < 0.5 ? '96,55,28' : '166,104,58';
                g.addColorStop(0, `rgba(${c},${0.35 + rnd() * 0.4})`);
                g.addColorStop(1, `rgba(${c},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(x - r, y - r, r * 2, r * 2);
            }
            for (let i = 0; i < 900; i++) {
                ctx.fillStyle = `rgba(60,30,12,${rnd() * 0.35})`;
                ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
            }
        }, { repeat: true });
    }
    let rustTex = null;

    function mater() {
        const g = new T.Group();
        rustTex = rustTex || rustTexture();
        const paint = '#8c5a33';
        const rust = new T.MeshStandardMaterial({ map: rustTex, roughness: 0.82, metalness: 0.15 });
        // Кабина с глазами
        const cabW = 0.46, cabH = 0.3, cabL = 0.28, clear = 0.12;
        const cab = atlasBox(cabW, cabH, cabL, 0.06, 5, {
            front: (ctx, fw, fh) => {
                ctx.save();
                drawEyes(ctx, fw, fh * 0.72, { lid: paint, irisColor: '#6d9a2b', expr: 'goofy', look: [0.12, -0.25], cross: 0.08, top: 0.14, height: 0.8 });
                ctx.restore();
            },
            right: (ctx, fw, fh) => drawSideWindow(ctx, fw, fh, '#1d2a3a', paint, { front: 0.12, back: 0.18, top: 0.12, bottom: 0.55 }),
            left: (ctx, fw, fh) => drawSideWindow(ctx, fw, fh, '#1d2a3a', paint, { front: 0.18, back: 0.12, top: 0.12, bottom: 0.55 })
        }, { background: paint, density: 1100 });
        deform(cab.geometry, (v) => {
            const yn = (v.y + cabH / 2) / cabH;
            if (v.z > 0) v.z -= 0.06 * yn;
            v.x *= 1 - 0.08 * yn;
        });
        const cabMat = new T.MeshStandardMaterial({ map: cab.texture, roughness: 0.6, metalness: 0.1 });
        g.add(mesh(cab.geometry, cabMat, 0, clear + cabH / 2, -0.06));
        // Капот с ртом и зубами
        const hoodW = 0.34, hoodH = 0.2, hoodL = 0.3;
        const hood = atlasBox(hoodW, hoodH, hoodL, 0.06, 5, {
            front: (ctx, fw, fh) => {
                ctx.fillStyle = '#6b4226';
                ctx.fillRect(0, 0, fw, fh);
                drawMouth(ctx, fw / 2, fh * 0.52, fw * 0.8, fh * 0.62, 'buck', '#6b4226');
            }
        }, { background: paint, density: 1000 });
        g.add(mesh(hood.geometry, new T.MeshStandardMaterial({ map: hood.texture, roughness: 0.7, metalness: 0.1 }), 0, clear + hoodH / 2 - 0.01, 0.2));
        // Крылья над передними колёсами
        for (const side of [-1, 1]) {
            const f = ellipsoid(0.09, 0.07, 0.15, 20, 14);
            g.add(mesh(f, rust, side * 0.21, 0.19, 0.25));
        }
        // Единственная фара и маячок на крыше
        roundLamp(g, -0.21, 0.26, 0.33, 0.035);
        g.add(mesh(new T.SphereGeometry(0.045, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), Mat.glow('#ff9800', 1.1), 0, clear + cabH, -0.06));
        g.add(mesh(new T.CylinderGeometry(0.05, 0.05, 0.02, 16), Mat.metal('#666', 0.4), 0, clear + cabH, -0.06));
        // Кузов-платформа и стрела с крюком
        g.add(mesh(roundedBox(0.44, 0.1, 0.26, 0.03, 3), rust, 0, 0.16, -0.33));
        const boomPts = [[0, 0.22, -0.3], [0, 0.42, -0.36], [0, 0.55, -0.44]];
        g.add(mesh(tube(boomPts, 0.025, 20, 10), Mat.metal('#5b4636', 0.5)));
        g.add(mesh(tube([[0, 0.55, -0.44], [0, 0.5, -0.47], [0, 0.4, -0.48]], 0.006, 12, 6), Mat.metal('#333', 0.5)));
        const hook = new T.TorusGeometry(0.035, 0.009, 8, 24, Math.PI * 1.5);
        g.add(mesh(hook, Mat.chrome(), 0, 0.37, -0.48, { ry: Math.PI / 2, rz: Math.PI * 0.25 }));
        addWheels(g, { W: 0.5, wheelZ: [0.25, -0.3], wheelR: [0.1, 0.1], wheelW: [0.08, 0.08], wheelX: 0.21 });
        return g;
    }

    // Фрэнк — грозный красный комбайн с вращающимся мотовилом
    function frank() {
        const g = new T.Group();
        const paint = '#c62828';
        const W = 0.5, H = 0.3, L = 0.5, clear = 0.18;
        g.add(mesh(roundedBox(W, H, L, 0.07, 4), Mat.paint(paint), 0, clear + H / 2, -0.06));
        // Бункер сверху сзади
        g.add(mesh(roundedBox(0.4, 0.14, 0.22, 0.04, 3), Mat.paint('#b71c1c'), 0, clear + H + 0.06, -0.2));
        // Кабина со злыми глазами
        const cW = 0.4, cH = 0.26, cL = 0.26;
        const cab = atlasBox(cW, cH, cL, 0.05, 5, {
            front: (ctx, fw, fh) => drawEyes(ctx, fw, fh, { lid: paint, irisColor: '#ffb300', expr: 'angry', look: [0, 0.25], top: 0.14, height: 0.76 }),
            right: (ctx, fw, fh) => drawSideWindow(ctx, fw, fh, '#1d2a3a', paint, {}),
            left: (ctx, fw, fh) => drawSideWindow(ctx, fw, fh, '#1d2a3a', paint, {})
        }, { background: paint, density: 1100 });
        deform(cab.geometry, (v) => { if (v.z > 0) v.z -= 0.05 * (v.y + cH / 2) / cH; });
        g.add(mesh(cab.geometry, new T.MeshPhysicalMaterial({ map: cab.texture, roughness: 0.3, clearcoat: 1 }), 0, clear + H + cH / 2 - 0.03, 0.08));
        // Жатка — широкий короб-«пасть» с зубьями, внутри вращается мотовило
        const hx = 0.4;
        const back = roundedBox(hx * 2, 0.2, 0.03, 0.012, 2);
        g.add(mesh(back, Mat.paint('#8e1b1b'), 0, 0.17, 0.3));
        g.add(mesh(roundedBox(hx * 2, 0.03, 0.2, 0.012, 2), Mat.paint('#8e1b1b'), 0, 0.075, 0.39));
        for (const sx of [-1, 1]) {
            g.add(mesh(roundedBox(0.03, 0.2, 0.2, 0.012, 2), Mat.paint('#8e1b1b'), sx * hx, 0.17, 0.39));
        }
        for (let i = 0; i < 12; i++) {
            const tooth = new T.ConeGeometry(0.02, 0.07, 8);
            g.add(mesh(tooth, Mat.chrome(), -0.36 + i * 0.065, 0.075, 0.51, { rx: Math.PI / 2 }));
        }
        const reel = new T.Group();
        reel.name = 'reel';
        reel.position.set(0, 0.2, 0.4);
        reel.add(mesh(new T.CylinderGeometry(0.022, 0.022, hx * 2 - 0.04, 12).rotateZ(Math.PI / 2), Mat.metal('#555', 0.4)));
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const bat = roundedBox(hx * 2 - 0.08, 0.016, 0.05, 0.006, 2);
            reel.add(mesh(bat, Mat.paint('#f2c14e'), 0, Math.cos(a) * 0.075, Math.sin(a) * 0.075, { rx: a }));
        }
        g.add(reel);
        // Выхлопная труба
        g.add(mesh(new T.CylinderGeometry(0.026, 0.026, 0.26, 12), Mat.metal('#222', 0.5), 0.15, clear + H + 0.2, -0.26));
        addWheels(g, { W: 0.56, wheelZ: [0.12, -0.24], wheelR: [0.18, 0.1], wheelW: [0.1, 0.08], wheelX: 0.29, rim: '#f2c14e', chunky: true });
        return g;
    }

    // Трактор — сонная «коровка» с большими задними колёсами
    function tractor() {
        const g = new T.Group();
        rustTex = rustTex || rustTexture();
        const paint = '#9c3f25';
        const W = 0.3, H = 0.26, L = 0.42, clear = 0.09;
        const body = atlasBox(W, H, L, 0.07, 5, {
            front: (ctx, fw, fh) => {
                drawEyes(ctx, fw, fh * 0.64, { lid: paint, irisColor: '#4a3322', expr: 'sleepy', margin: 0.03, gap: 0.04, top: 0.2, height: 0.76 });
                ctx.fillStyle = '#3a2418';
                rr(ctx, fw * 0.24, fh * 0.64, fw * 0.52, fh * 0.28, fh * 0.06); ctx.fill();
                ctx.strokeStyle = '#6d4c3a';
                ctx.lineWidth = fh * 0.03;
                for (let i = 1; i < 5; i++) {
                    ctx.beginPath(); ctx.moveTo(fw * 0.24, fh * (0.64 + i * 0.055)); ctx.lineTo(fw * 0.76, fh * (0.64 + i * 0.055)); ctx.stroke();
                }
            },
            top: (ctx, fw, fh) => {
                // Пятна «коровьего» окраса
                ctx.fillStyle = '#6e2a17';
                ctx.beginPath(); ctx.ellipse(fw * 0.3, fh * 0.4, fw * 0.14, fh * 0.1, 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(fw * 0.68, fh * 0.62, fw * 0.12, fh * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
            }
        }, { background: paint, density: 1100 });
        g.add(mesh(body.geometry, new T.MeshStandardMaterial({ map: body.texture, roughness: 0.6, metalness: 0.1 }), 0, clear + H / 2, 0.08));
        // Сиденье
        g.add(mesh(roundedBox(0.2, 0.12, 0.16, 0.035, 3), new T.MeshStandardMaterial({ map: rustTex, roughness: 0.8 }), 0, 0.2, -0.18));
        // Выхлопная труба на капоте
        g.add(mesh(new T.CylinderGeometry(0.018, 0.022, 0.18, 12), Mat.metal('#2b2b2b', 0.5), 0.07, clear + H + 0.08, 0.12));
        g.add(mesh(new T.CylinderGeometry(0.026, 0.018, 0.03, 12), Mat.metal('#2b2b2b', 0.5), 0.07, clear + H + 0.18, 0.12));
        addWheels(g, { W: 0.42, wheelZ: [0.22, -0.15], wheelR: [0.075, 0.17], wheelW: [0.06, 0.1], wheelX: 0.21, rim: '#e0c050', chunky: true });
        // Передние колёса ближе друг к другу
        g.children.filter((o) => o.name === 'wheel' && o.position.z > 0).forEach((w) => { w.position.x = Math.sign(w.position.x) * 0.12; });
        return g;
    }

    const BUILDERS = {
        w: { k: mcqueen, q: sally, r: mack, b: docHudson, n: mater, p: luigi },
        b: { k: chickHicks, q: jacksonStorm, r: frank, b: professorZ, n: boost, p: tractor }
    };

    const NAMES = {
        w: { k: 'Молния Маккуин', q: 'Салли', r: 'Мак', b: 'Док Хадсон', n: 'Мэтр', p: 'Луиджи' },
        b: { k: 'Чик Хикс', q: 'Джексон Шторм', r: 'Фрэнк', b: 'Профессор Зет', n: 'Бууст', p: 'Трактор' }
    };

    function buildPiece(type, color) {
        const root = new T.Group();
        const pod = CM.podium(color, color === 'w' ? '#e2b447' : '#d32f2f', { radius: 0.42 });
        root.add(pod);
        const car = BUILDERS[color][type]();
        car.position.y = pod.userData.top - 0.005;
        root.add(car);
        CM.optimize(root);
        const box = new T.Box3().setFromObject(root);
        root.userData.height = box.max.y;
        root.userData.radius = 0.42;
        return root;
    }

    CM.Themes3D.cars = {
        key: 'cars',
        buildPiece,
        names: NAMES,
        motion: 'drive',
        faceCamera: true,
        elevation: 50,
        fitHeight: 0.85,
        // Машинки стоят вполоборота — видно и «лицо», и наклейки на боку
        yawOffset: -0.42
    };
})();
