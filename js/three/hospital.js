/*
 * Тема «Animal Hospital» (по мотивам игры в Roblox): большеголовые звери-персонажи.
 * Белые — персонал больницы: Доктор Харлоу, Медсестра, Офицер Дакман, Рон из бухгалтерии,
 * Лиз и Рэттью. Чёрные — аномалии: Барни и жуткие двойники персонала с пустыми глазами
 * и острыми зубами, пешки — слизни-аномалии.
 * Лица рисуются на canvas и натягиваются на сферу головы (развёртка «широта/долгота»).
 */
(function () {
    'use strict';
    const CM = window.CM;
    const T = THREE;
    const { profile, lathe, ellipsoid, taperedTube, tube, roundedBox, extrude, deform } = CM.G;
    const { mesh, Mat } = CM;

    function shade(hex, k) {
        const c = new T.Color(hex);
        if (k < 0) c.lerp(new T.Color('#000000'), -k); else c.lerp(new T.Color('#ffffff'), k);
        return '#' + c.getHexString();
    }

    // ---------- Текстуры ----------
    /** Текстура головы: fur — цвет шерсти, draw(ctx) рисует лицо в радианах (0,0 — центр лица). */
    function headTexture(fur, draw) {
        return CM.Tex.canvas(1024, 512, (ctx, w, h) => {
            ctx.fillStyle = fur;
            ctx.fillRect(0, 0, w, h);
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, 'rgba(255,255,255,0.12)');
            g.addColorStop(0.5, 'rgba(255,255,255,0)');
            g.addColorStop(1, 'rgba(0,0,0,0.12)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
            const S = w / (Math.PI * 2);
            ctx.save();
            ctx.translate(w * 0.25, h * 0.5);
            ctx.scale(S, S);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            draw(ctx);
            ctx.restore();
        });
    }

    /** Текстура одежды на токарном теле: перед — в центре (u = 0.5). draw(ctx, w, h) */
    function bodyTexture(base, draw) {
        return CM.Tex.canvas(512, 256, (ctx, w, h) => {
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, w, h);
            if (draw) draw(ctx, w, h);
        });
    }

    // Глаза персонала: белок, зрачок, блики; opt: { r, lid, lash, liner, ring, look, color }
    function eyes(ctx, o) {
        const r = o.r || 0.11;
        const y = o.y === undefined ? -0.1 : o.y;
        const dx = o.dx || 0.3;
        for (const s of [-1, 1]) {
            const x = s * dx;
            if (o.ring) {
                ctx.fillStyle = o.ring;
                ctx.beginPath(); ctx.ellipse(x, y, r * 1.35, r * 1.45, 0, 0, Math.PI * 2); ctx.fill();
            }
            if (o.liner) {
                ctx.fillStyle = '#16121a';
                ctx.beginPath();
                ctx.moveTo(x + s * r * 0.6, y - r * 0.55);
                ctx.lineTo(x + s * r * 1.75, y - r * 0.95);
                ctx.lineTo(x + s * r * 0.95, y + r * 0.1);
                ctx.closePath(); ctx.fill();
            }
            ctx.fillStyle = '#fdfcf8';
            ctx.beginPath(); ctx.ellipse(x, y, r, r * (o.tall || 1.12), 0, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = r * 0.14;
            ctx.strokeStyle = '#1b1620';
            ctx.stroke();
            const lx = (o.look ? o.look[0] : 0) * r * 0.3, ly = (o.look ? o.look[1] : 0) * r * 0.3;
            const pr = r * (o.pupil || 0.62);
            ctx.fillStyle = o.color || '#1b1620';
            ctx.beginPath(); ctx.ellipse(x + lx, y + ly + r * 0.12, pr, pr * 1.08, 0, 0, Math.PI * 2); ctx.fill();
            if (o.color) {
                ctx.fillStyle = '#0d0b10';
                ctx.beginPath(); ctx.arc(x + lx, y + ly + r * 0.12, pr * 0.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x + lx - pr * 0.35, y + ly - pr * 0.2, pr * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + lx + pr * 0.3, y + ly + pr * 0.45, pr * 0.13, 0, Math.PI * 2); ctx.fill();
            if (o.lid) {
                // Полуприкрытые веки («прищур»)
                ctx.fillStyle = o.lidColor;
                ctx.beginPath();
                ctx.ellipse(x, y - r * 0.9, r * 1.2, r * (0.3 + o.lid), 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#1b1620';
                ctx.lineWidth = r * 0.14;
                ctx.beginPath(); ctx.moveTo(x - r * 0.98, y - r * (0.62 - o.lid)); ctx.quadraticCurveTo(x, y - r * (0.5 - o.lid * 1.6), x + r * 0.98, y - r * (0.62 - o.lid)); ctx.stroke();
            }
            if (o.lash) {
                ctx.strokeStyle = '#1b1620';
                ctx.lineWidth = r * 0.12;
                for (let i = 0; i < 3; i++) {
                    const a = -Math.PI / 2 + s * (0.5 + i * 0.32);
                    ctx.beginPath();
                    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.1);
                    ctx.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.5);
                    ctx.stroke();
                }
            }
            if (o.brow) {
                ctx.strokeStyle = o.brow;
                ctx.lineWidth = r * 0.22;
                ctx.beginPath();
                ctx.moveTo(x - r * 0.8, y - r * 1.55 + s * (o.browTilt || 0) * r);
                ctx.quadraticCurveTo(x, y - r * 1.85, x + r * 0.8, y - r * 1.55 - s * (o.browTilt || 0) * r);
                ctx.stroke();
            }
        }
    }

    // Глаза аномалии: пустые чёрные провалы с крошечными белыми зрачками
    function anomalyEyes(ctx, o) {
        const r = (o.r || 0.11) * 1.25;
        const y = o.y === undefined ? -0.1 : o.y;
        const dx = o.dx || 0.3;
        for (const s of [-1, 1]) {
            const x = s * dx;
            if (o.rim) {
                ctx.fillStyle = o.rim;
                ctx.beginPath(); ctx.ellipse(x, y, r * 1.18, r * 1.3, s * 0.15, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#050307';
            ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.15, s * 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x + s * r * 0.1, y + r * 0.05, r * 0.16, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Широкая улыбка аномалии с острыми зубами
    function sharpGrin(ctx, o) {
        const w = o.w || 0.62, y = o.y || 0.2, h = o.h || 0.2;
        ctx.fillStyle = '#12060c';
        ctx.beginPath();
        ctx.moveTo(-w / 2, y - h * 0.3);
        ctx.quadraticCurveTo(0, y + h * 0.1, w / 2, y - h * 0.3);
        ctx.quadraticCurveTo(0, y + h * 1.4, -w / 2, y - h * 0.3);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#f7f3ea';
        const n = 9;
        for (let i = 0; i < n; i++) {
            const x0 = -w / 2 + (w * i) / n;
            ctx.beginPath();
            ctx.moveTo(x0, y - h * 0.4);
            ctx.lineTo(x0 + w / n, y - h * 0.4);
            ctx.lineTo(x0 + w / n / 2, y + h * 0.28);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x0 + w / n * 0.15, y + h * 1.1);
            ctx.lineTo(x0 + w / n * 0.85, y + h * 1.1);
            ctx.lineTo(x0 + w / n / 2, y + h * 0.45);
            ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = '#12060c';
        ctx.lineWidth = 0.02;
        ctx.stroke();
    }

    function smallMouth(ctx, y, w, curve, color = '#3b1f2b') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.028;
        ctx.beginPath();
        ctx.moveTo(-w / 2, y);
        ctx.quadraticCurveTo(0, y + curve, w / 2, y);
        ctx.stroke();
    }

    // ---------- Общий конструктор персонажа ----------
    /*
     * spec: fur, headR, headScale [x,y,z], headY, face(ctx) — рисование лица,
     *       body: { color, draw(ctx,w,h), r (радиус), h (высота) }, arms: { color, hand }, legs: цвет,
     *       extras(g, info) — уши, шапки, аксессуары.
     */
    function buildCharacter(spec) {
        const g = new T.Group();
        const base = spec.base || 0.085;
        const bodyR = spec.body.r || 0.13;
        const bodyH = spec.body.h || 0.27;
        const legH = spec.legH === undefined ? 0.07 : spec.legH;
        const bodyBottom = base + legH;

        // Ноги
        if (legH > 0) {
            for (const s of [-1, 1]) {
                g.add(mesh(new T.CapsuleGeometry(0.045, legH * 0.6, 6, 12), Mat.vinyl(spec.legs || '#2a2a2e'), s * 0.055, base + legH * 0.55, 0.01));
                g.add(mesh(ellipsoid(0.055, 0.035, 0.07, 16, 10), Mat.vinyl(spec.shoes || '#1d1b20', 0.4), s * 0.058, base + 0.02, 0.025));
            }
        }
        // Туловище — токарный «боб» с текстурой одежды
        const pts = profile([
            ['M', 0, 0],
            ['L', bodyR * 0.8, 0],
            ['Q', bodyR * 1.08, bodyH * 0.12, bodyR * 1.05, bodyH * 0.45],
            ['Q', bodyR * 1.0, bodyH * 0.85, bodyR * 0.62, bodyH * 0.98],
            ['L', bodyR * 0.3, bodyH],
            ['L', 0, bodyH]
        ], 10);
        const bodyTex = bodyTexture(spec.body.color, spec.body.draw);
        const body = lathe(pts, 40, -Math.PI, Math.PI * 2);
        g.add(mesh(body, Mat.textured(bodyTex, { roughness: 0.6, clearcoat: 0.15 }), 0, bodyBottom, 0));

        // Руки
        const armColor = spec.arms ? spec.arms.color : spec.body.color;
        const handColor = spec.arms && spec.arms.hand ? spec.arms.hand : spec.fur;
        for (const s of [-1, 1]) {
            const arm = new T.CapsuleGeometry(0.038, 0.13, 6, 12);
            g.add(mesh(arm, Mat.vinyl(armColor, 0.6), s * (bodyR + 0.02), bodyBottom + bodyH * 0.55, 0.01, { rz: s * 0.35 }));
            g.add(mesh(new T.SphereGeometry(0.042, 16, 12), Mat.vinyl(handColor), s * (bodyR + 0.055), bodyBottom + bodyH * 0.25, 0.03));
        }

        // Голова с лицом
        const headR = spec.headR || 0.2;
        const headY = bodyBottom + bodyH + headR * 0.82;
        const hs = spec.headScale || [1, 0.94, 0.96];
        const headTex = headTexture(spec.fur, spec.face);
        const head = new T.SphereGeometry(headR, 48, 32);
        head.scale(hs[0], hs[1], hs[2]);
        g.add(mesh(head, Mat.textured(headTex, { roughness: 0.55, clearcoat: 0.25 }), 0, headY, 0));

        const info = { headY, headR, hs, bodyBottom, bodyH, bodyR, base, top: headY + headR * hs[1] };
        if (spec.extras) spec.extras(g, info);
        return g;
    }

    // Точка на поверхности головы по углам (радианы): az — вправо, el — вверх
    function onHead(info, az, el, out = 0) {
        const r = info.headR + out;
        return new T.Vector3(
            Math.sin(az) * Math.cos(el) * r * info.hs[0],
            info.headY + Math.sin(el) * r * info.hs[1],
            Math.cos(az) * Math.cos(el) * r * info.hs[2]
        );
    }

    function ear(g, info, side, o) {
        const geo = ellipsoid(o.w || 0.06, o.h || 0.15, o.d || 0.035, 20, 14);
        const p = onHead(info, side * (o.az || 0.75), o.el || 0.75, -0.02);
        const m = mesh(geo, Mat.vinyl(o.color), p.x, p.y + (o.h || 0.15) * 0.6 * (o.down ? -1 : 1), p.z + (o.dz || 0), {
            rz: -side * (o.tilt || 0.35), rx: o.rx || 0
        });
        g.add(m);
        if (o.inner) {
            const inner = ellipsoid((o.w || 0.06) * 0.6, (o.h || 0.15) * 0.75, 0.01, 16, 10);
            const m2 = mesh(inner, Mat.vinyl(o.inner), 0, 0, (o.d || 0.035) * 0.75);
            m.add(m2);
        }
        return m;
    }

    // ---------- Персонажи ----------
    function palette(anomaly, normal, dark) { return anomaly ? dark : normal; }

    // Доктор Харлоу — оранжевый мунтжак: рога, зеркало-рефлектор, голубая маска, халат, стетоскоп
    function harlow() {
        const fur = '#f08a3c';
        return buildCharacter({
            fur,
            headR: 0.2,
            body: {
                color: '#f7f8fb', r: 0.135, h: 0.28,
                draw: (ctx, w, h) => {
                    // Разрез халата: голубой костюм и красный галстук
                    ctx.fillStyle = '#3a79c9';
                    ctx.beginPath();
                    ctx.moveTo(w * 0.43, 0); ctx.lineTo(w * 0.57, 0); ctx.lineTo(w * 0.53, h * 0.75); ctx.lineTo(w * 0.47, h * 0.75);
                    ctx.closePath(); ctx.fill();
                    ctx.fillStyle = '#d32f2f';
                    ctx.beginPath();
                    ctx.moveTo(w * 0.49, h * 0.06); ctx.lineTo(w * 0.51, h * 0.06); ctx.lineTo(w * 0.515, h * 0.5); ctx.lineTo(w * 0.5, h * 0.58); ctx.lineTo(w * 0.485, h * 0.5);
                    ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = '#c9ced8';
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(w * 0.43, 0); ctx.lineTo(w * 0.47, h * 0.75); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(w * 0.57, 0); ctx.lineTo(w * 0.53, h * 0.75); ctx.stroke();
                    ctx.fillStyle = '#c9ced8';
                    ctx.fillRect(w * 0.6, h * 0.45, w * 0.06, h * 0.12);
                }
            },
            arms: { color: '#f7f8fb', hand: fur },
            legs: '#3a79c9',
            face: (ctx) => {
                // Тёмные «V»-полосы мунтжака на лбу
                ctx.strokeStyle = '#7a3a12';
                ctx.lineWidth = 0.05;
                ctx.beginPath(); ctx.moveTo(-0.1, -0.2); ctx.lineTo(-0.2, -0.62); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0.1, -0.2); ctx.lineTo(0.2, -0.62); ctx.stroke();
                ctx.fillStyle = '#fbe0bf';
                ctx.beginPath(); ctx.ellipse(0, 0.22, 0.3, 0.2, 0, 0, Math.PI * 2); ctx.fill();
                eyes(ctx, { r: 0.1, y: -0.08, dx: 0.28, brow: '#7a3a12', color: '#5b3a1a' });
            },
            extras(g, info) {
                // Маска
                const maskP = onHead(info, 0, -0.32, 0.0);
                const mask = roundedBox(0.2, 0.12, 0.11, 0.05, 4);
                g.add(mesh(mask, Mat.vinyl('#2fa6ff', 0.55), 0, maskP.y, maskP.z - 0.02));
                for (let i = 0; i < 2; i++) {
                    g.add(mesh(roundedBox(0.19, 0.006, 0.01, 0.003, 1), Mat.vinyl('#1d86d6', 0.6), 0, maskP.y + 0.02 - i * 0.035, maskP.z + 0.035));
                }
                for (const s of [-1, 1]) {
                    const a = onHead(info, s * 0.6, -0.1, 0.004);
                    g.add(mesh(tube([[s * 0.095, maskP.y + 0.03, maskP.z + 0.01], [a.x, a.y, a.z], [s * info.headR * 0.95, info.headY + 0.02, 0]], 0.005, 12, 6), Mat.vinyl('#e8f5ff')));
                }
                // Уши
                for (const s of [-1, 1]) {
                    ear(g, info, s, { color: fur, inner: '#fbe0bf', w: 0.07, h: 0.13, az: 1.05, el: 0.35, tilt: 1.05 });
                }
                // Рога
                for (const s of [-1, 1]) {
                    const b = onHead(info, s * 0.42, 1.05, -0.01);
                    const pts = [[b.x, b.y, b.z], [b.x + s * 0.03, b.y + 0.1, b.z - 0.03], [b.x + s * 0.04, b.y + 0.2, b.z - 0.08], [b.x + s * 0.02, b.y + 0.26, b.z - 0.14]];
                    g.add(mesh(taperedTube(pts, (t) => 0.024 * (1 - t * 0.75), 24, 10), Mat.vinyl('#9ea3a8', 0.45)));
                    const pts2 = [[b.x + s * 0.035, b.y + 0.12, b.z - 0.035], [b.x + s * 0.08, b.y + 0.16, b.z - 0.0], [b.x + s * 0.1, b.y + 0.2, b.z + 0.02]];
                    g.add(mesh(taperedTube(pts2, (t) => 0.014 * (1 - t * 0.7), 12, 8), Mat.vinyl('#9ea3a8', 0.45)));
                }
                // Налобное зеркало на коричневом ремешке
                const bandY = 0.12;
                const bandR = info.headR * Math.sqrt(1 - (bandY / (info.headR * info.hs[1])) ** 2) + 0.006;
                const band = new T.TorusGeometry(bandR, 0.011, 8, 48);
                band.scale(info.hs[0], 1, info.hs[2]);
                g.add(mesh(band, Mat.vinyl('#6b4226', 0.6), 0, info.headY + bandY, 0, { rx: Math.PI / 2 }));
                const mp = onHead(info, 0.35, Math.asin(0.12 / (info.headR * info.hs[1])), 0.03);
                const mirror = new T.Group();
                mirror.position.copy(mp);
                mirror.lookAt(mp.x * 3, mp.y + 0.2, mp.z * 3);
                mirror.add(mesh(new T.CylinderGeometry(0.055, 0.055, 0.012, 32).rotateX(Math.PI / 2), Mat.chrome()));
                mirror.add(mesh(new T.CylinderGeometry(0.015, 0.015, 0.014, 16).rotateX(Math.PI / 2), Mat.matte('#222'), 0, 0, 0.001));
                g.add(mirror);
                // Стетоскоп
                const n = info.bodyBottom + info.bodyH;
                g.add(mesh(tube([[-0.085, n - 0.01, 0.03], [-0.1, n - 0.08, 0.1], [-0.05, n - 0.16, 0.13], [0.0, n - 0.19, 0.135]], 0.009, 20, 8), Mat.vinyl('#1c1c20', 0.4)));
                g.add(mesh(tube([[0.085, n - 0.01, 0.03], [0.1, n - 0.08, 0.1], [0.07, n - 0.14, 0.13]], 0.009, 16, 8), Mat.vinyl('#1c1c20', 0.4)));
                g.add(mesh(new T.CylinderGeometry(0.028, 0.028, 0.014, 20).rotateX(Math.PI / 2), Mat.chrome(), 0.0, n - 0.2, 0.14));
                // Чемоданчик «TOP SECRET»
                addBriefcase(g, info, 1);
            }
        });
    }

    function addBriefcase(g, info, side) {
        const tex = CM.Tex.canvas(256, 128, (ctx, w, h) => {
            ctx.fillStyle = '#17161b'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#e53935';
            ctx.font = '900 34px "Arial Black", Impact, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('TOP', w / 2, h * 0.33);
            ctx.fillText('SECRET', w / 2, h * 0.7);
        });
        const caseGeo = roundedBox(0.2, 0.14, 0.05, 0.015, 3);
        const mats = new T.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.6 });
        const x = side * (info.bodyR + 0.075);
        const y = info.bodyBottom + 0.02;
        const c = mesh(caseGeo, mats, x, y, 0.04, { ry: side * 1.25 });
        g.add(c);
        g.add(mesh(new T.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), Mat.matte('#222'), x, y + 0.075, 0.04, { ry: side * 1.25 }));
    }

    // Медсестра — розовая собачка-зайка в голубой форме и шапочке с сердцем
    function nurse(anomaly) {
        const fur = palette(anomaly, '#f7a9c4', '#8a5877');
        const earC = palette(anomaly, '#d9648f', '#5a2f4c');
        const scrubs = palette(anomaly, '#a9d9f6', '#4d6878');
        return buildCharacter({
            fur,
            headR: 0.205,
            body: {
                color: scrubs, r: 0.13, h: 0.27,
                draw: (ctx, w, h) => {
                    ctx.fillStyle = anomaly ? '#9aa6ac' : '#ffffff';
                    ctx.beginPath(); ctx.moveTo(w * 0.4, 0); ctx.lineTo(w * 0.5, h * 0.2); ctx.lineTo(w * 0.6, 0); ctx.fill();
                    for (let i = 0; i < 4; i++) {
                        ctx.beginPath(); ctx.arc(w * 0.5, h * (0.3 + i * 0.15), 6, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.fillRect(w * 0.56, h * 0.28, w * 0.06, h * 0.1);
                }
            },
            arms: { color: scrubs, hand: fur },
            legs: scrubs,
            shoes: '#f4f4f6',
            face: (ctx) => {
                // Полоски на щеках
                ctx.strokeStyle = palette(anomaly, '#e0719a', '#4a2140');
                ctx.lineWidth = 0.028;
                for (const s of [-1, 1]) {
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(s * 0.42, 0.06 + i * 0.07);
                        ctx.lineTo(s * 0.6, 0.04 + i * 0.07);
                        ctx.stroke();
                    }
                }
                ctx.fillStyle = palette(anomaly, '#fcd3e0', '#a57594');
                ctx.beginPath(); ctx.ellipse(0, 0.17, 0.2, 0.14, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = palette(anomaly, '#c2456f', '#2a0f20');
                ctx.beginPath(); ctx.ellipse(0, 0.09, 0.06, 0.04, 0, 0, Math.PI * 2); ctx.fill();
                if (anomaly) {
                    anomalyEyes(ctx, { r: 0.11, y: -0.1, dx: 0.28, rim: '#2a0f20' });
                    sharpGrin(ctx, { w: 0.5, y: 0.2, h: 0.16 });
                } else {
                    eyes(ctx, { r: 0.12, y: -0.1, dx: 0.28, liner: true, lash: true, color: '#3a7bc8' });
                    smallMouth(ctx, 0.23, 0.1, -0.035);
                }
            },
            extras(g, info) {
                for (const s of [-1, 1]) {
                    ear(g, info, s, { color: earC, w: 0.07, h: 0.17, d: 0.04, az: 1.1, el: 0.35, tilt: 0.25, down: true, dz: -0.02 });
                }
                // Шапочка медсестры с сердцем и крестом
                const capY = info.top - 0.035;
                const cap = roundedBox(0.2, 0.09, 0.14, 0.03, 3);
                deform(cap, (v) => { v.x *= 1 - (v.y + 0.045) * 1.2; });
                g.add(mesh(cap, Mat.vinyl(anomaly ? '#b8b2b8' : '#ffffff', 0.45), 0, capY, 0.03, { rx: -0.3 }));
                const heart = new T.Shape();
                heart.moveTo(0, -0.03);
                heart.bezierCurveTo(-0.05, 0.0, -0.045, 0.045, -0.02, 0.045);
                heart.bezierCurveTo(-0.005, 0.045, 0, 0.03, 0, 0.022);
                heart.bezierCurveTo(0, 0.03, 0.005, 0.045, 0.02, 0.045);
                heart.bezierCurveTo(0.045, 0.045, 0.05, 0.0, 0, -0.03);
                const hg = extrude(heart, 0.012, 0.006, 3, 16);
                const hy = capY + 0.005, hz = 0.03 + 0.08;
                g.add(mesh(hg, Mat.vinyl(anomaly ? '#6b0f1a' : '#e53935', 0.35), 0, hy, hz, { rx: -0.3 }));
                const cross = new T.Group();
                cross.position.set(0, hy + 0.004, hz + 0.012);
                cross.rotation.x = -0.3;
                cross.add(mesh(new T.BoxGeometry(0.036, 0.011, 0.006), Mat.vinyl('#ffffff', 0.4)));
                cross.add(mesh(new T.BoxGeometry(0.011, 0.036, 0.006), Mat.vinyl('#ffffff', 0.4)));
                g.add(cross);
            }
        });
    }

    // Офицер Дакман — чёрная утка в синей полицейской фуражке со значком
    function duckman(anomaly) {
        const fur = palette(anomaly, '#2b2b31', '#141418');
        const shirt = palette(anomaly, '#3d74d6', '#223963');
        return buildCharacter({
            fur,
            headR: 0.2,
            headScale: [1, 0.95, 0.95],
            body: {
                color: shirt, r: 0.14, h: 0.27,
                draw: (ctx, w, h) => {
                    ctx.fillStyle = '#131316';
                    ctx.beginPath();
                    ctx.moveTo(w * 0.485, h * 0.04); ctx.lineTo(w * 0.515, h * 0.04); ctx.lineTo(w * 0.525, h * 0.52); ctx.lineTo(w * 0.5, h * 0.6); ctx.lineTo(w * 0.475, h * 0.52);
                    ctx.closePath(); ctx.fill();
                    ctx.fillStyle = shade(shirt, 0.25);
                    ctx.beginPath(); ctx.moveTo(w * 0.42, 0); ctx.lineTo(w * 0.49, h * 0.14); ctx.lineTo(w * 0.47, 0); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(w * 0.58, 0); ctx.lineTo(w * 0.51, h * 0.14); ctx.lineTo(w * 0.53, 0); ctx.fill();
                    ctx.fillStyle = '#d7dde3';
                    ctx.beginPath(); ctx.arc(w * 0.44, h * 0.3, 9, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#1b1b20';
                    ctx.fillRect(0, h * 0.86, w, h * 0.14);
                }
            },
            arms: { color: shirt, hand: fur },
            legs: '#1b1b20',
            face: (ctx) => {
                if (anomaly) {
                    anomalyEyes(ctx, { r: 0.1, y: -0.12, dx: 0.27, rim: '#8a1f1f' });
                } else {
                    // Прищуренные «щёлки»
                    eyes(ctx, { r: 0.105, y: -0.12, dx: 0.27, lid: 0.2, lidColor: fur });
                }
            },
            extras(g, info) {
                // Клюв: верхняя и нижняя половинки
                const bill = palette(anomaly, '#ff9b1f', '#b55a0c');
                const bp = onHead(info, 0, -0.36, 0.0);
                g.add(mesh(ellipsoid(0.105, 0.032, 0.11, 24, 14), Mat.vinyl(bill, 0.4), 0, bp.y + 0.012, bp.z + 0.02));
                g.add(mesh(ellipsoid(0.088, 0.026, 0.095, 24, 14), Mat.vinyl(shade(bill, -0.12), 0.4), 0, bp.y - 0.025, bp.z + 0.005));
                if (anomaly) {
                    for (let i = 0; i < 7; i++) {
                        const x = -0.075 + i * 0.025;
                        g.add(mesh(new T.ConeGeometry(0.009, 0.03, 6), Mat.vinyl('#f4efe4', 0.4), x, bp.y - 0.008, bp.z + 0.09, { rx: Math.PI }));
                    }
                }
                // Фуражка
                const capY = info.top + 0.015;
                g.add(mesh(new T.CylinderGeometry(0.2, 0.17, 0.09, 36), Mat.vinyl(palette(anomaly, '#1f4aa0', '#101c3d'), 0.5), 0, capY, -0.01, { rx: -0.12 }));
                g.add(mesh(new T.CylinderGeometry(0.175, 0.175, 0.03, 36), Mat.vinyl('#15161a', 0.4), 0, capY - 0.045, 0.0, { rx: -0.12 }));
                const visor = new T.CylinderGeometry(0.15, 0.15, 0.012, 36, 1, false, -Math.PI / 2, Math.PI);
                visor.scale(1, 1, 0.7);
                g.add(mesh(visor, Mat.vinyl('#101114', 0.25), 0, capY - 0.058, 0.06, { rx: -0.25 }));
                const star = new T.Shape();
                for (let i = 0; i < 10; i++) {
                    const a = Math.PI / 2 + (i * Math.PI) / 5;
                    const r = i % 2 ? 0.018 : 0.04;
                    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                g.add(mesh(extrude(star, 0.01, 0.004, 2, 4), Mat.metal(anomaly ? '#8a8f96' : '#dfe4ea', 0.25), 0, capY + 0.005, 0.18, { rx: -0.12 }));
            }
        });
    }

    // Рон из бухгалтерии — голубой вислоухий кролик в рубашке с галстуком и чемоданчиком
    function ron(anomaly) {
        const fur = palette(anomaly, '#6f9fd8', '#465873');
        const shirt = palette(anomaly, '#cfe2f7', '#6d7c93');
        return buildCharacter({
            fur,
            headR: 0.195,
            body: {
                color: shirt, r: 0.13, h: 0.27,
                draw: (ctx, w, h) => {
                    ctx.fillStyle = '#121215';
                    ctx.beginPath();
                    ctx.moveTo(w * 0.487, h * 0.05); ctx.lineTo(w * 0.513, h * 0.05); ctx.lineTo(w * 0.522, h * 0.55); ctx.lineTo(w * 0.5, h * 0.63); ctx.lineTo(w * 0.478, h * 0.55);
                    ctx.closePath(); ctx.fill();
                    ctx.fillStyle = shade(shirt, 0.35);
                    ctx.beginPath(); ctx.moveTo(w * 0.43, 0); ctx.lineTo(w * 0.49, h * 0.12); ctx.lineTo(w * 0.47, 0); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(w * 0.57, 0); ctx.lineTo(w * 0.51, h * 0.12); ctx.lineTo(w * 0.53, 0); ctx.fill();
                    ctx.fillStyle = '#34495e';
                    ctx.fillRect(0, h * 0.8, w, h * 0.2);
                }
            },
            arms: { color: shirt, hand: fur },
            legs: '#34495e',
            face: (ctx) => {
                ctx.fillStyle = palette(anomaly, '#bcd4f0', '#6f7f99');
                ctx.beginPath(); ctx.ellipse(0, 0.16, 0.2, 0.14, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = palette(anomaly, '#f08fb0', '#3a1a2a');
                ctx.beginPath(); ctx.ellipse(0, 0.08, 0.05, 0.035, 0, 0, Math.PI * 2); ctx.fill();
                if (anomaly) {
                    anomalyEyes(ctx, { r: 0.1, y: -0.1, dx: 0.27 });
                    sharpGrin(ctx, { w: 0.48, y: 0.2, h: 0.15 });
                } else {
                    eyes(ctx, { r: 0.105, y: -0.1, dx: 0.27, color: '#2e4a7a', lid: 0.12, lidColor: fur });
                    smallMouth(ctx, 0.2, 0.09, 0.03);
                }
            },
            extras(g, info) {
                const earC = shade(fur, -0.15);
                for (const s of [-1, 1]) {
                    ear(g, info, s, { color: earC, inner: shade(fur, 0.35), w: 0.07, h: 0.2, d: 0.035, az: 1.2, el: 0.55, tilt: 0.15, down: true, dz: -0.01 });
                }
                addBriefcase(g, info, -1);
            }
        });
    }

    // Лиз — каракал-журналистка в голубой кепке, тёмной куртке, с фотоаппаратом
    function liz(anomaly) {
        const fur = palette(anomaly, '#d9a066', '#7e5634');
        const jacket = palette(anomaly, '#1d3557', '#101a2c');
        return buildCharacter({
            fur,
            headR: 0.195,
            body: {
                color: jacket, r: 0.13, h: 0.27,
                draw: (ctx, w, h) => {
                    ctx.fillStyle = '#141416';
                    ctx.beginPath(); ctx.moveTo(w * 0.44, 0); ctx.lineTo(w * 0.56, 0); ctx.lineTo(w * 0.53, h); ctx.lineTo(w * 0.47, h); ctx.fill();
                    ctx.strokeStyle = shade(jacket, 0.3);
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(w * 0.44, 0); ctx.lineTo(w * 0.47, h); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(w * 0.56, 0); ctx.lineTo(w * 0.53, h); ctx.stroke();
                }
            },
            arms: { color: jacket, hand: fur },
            legs: '#c9ccd2',
            face: (ctx) => {
                ctx.fillStyle = palette(anomaly, '#f6e3c6', '#b58d6a');
                ctx.beginPath(); ctx.ellipse(0, 0.16, 0.19, 0.13, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#3b2415';
                ctx.beginPath(); ctx.moveTo(-0.035, 0.07); ctx.lineTo(0.035, 0.07); ctx.lineTo(0, 0.11); ctx.fill();
                ctx.strokeStyle = palette(anomaly, '#f6ead4', '#d9c3a8');
                ctx.lineWidth = 0.012;
                for (const s of [-1, 1]) {
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath(); ctx.moveTo(s * 0.12, 0.15 + i * 0.03); ctx.lineTo(s * 0.34, 0.1 + i * 0.05); ctx.stroke();
                    }
                }
                if (anomaly) {
                    anomalyEyes(ctx, { r: 0.1, y: -0.11, dx: 0.27, rim: '#f4efe6' });
                    sharpGrin(ctx, { w: 0.46, y: 0.22, h: 0.14 });
                } else {
                    eyes(ctx, { r: 0.1, y: -0.11, dx: 0.27, ring: '#fff7ea', lash: true, color: '#3f7d3a' });
                    ctx.strokeStyle = '#3b2415';
                    ctx.lineWidth = 0.022;
                    ctx.beginPath(); ctx.moveTo(-0.05, 0.2); ctx.lineTo(0, 0.17); ctx.lineTo(0.05, 0.2); ctx.stroke();
                }
            },
            extras(g, info) {
                // Высокие уши каракала с кисточками
                const earC = palette(anomaly, '#6b3f1f', '#3a2211');
                for (const s of [-1, 1]) {
                    const p = onHead(info, s * 1.15, 0.38, -0.02);
                    const e = new T.ConeGeometry(0.07, 0.22, 16);
                    e.scale(1, 1, 0.45);
                    e.translate(0, 0.1, 0);
                    const m = mesh(e, Mat.vinyl(earC), p.x, p.y, p.z, { rz: -s * 2.25 });
                    g.add(m);
                    m.add(mesh(new T.ConeGeometry(0.016, 0.08, 8), Mat.vinyl('#141414'), 0, 0.24, 0));
                }
                // Голубая кепка
                const capY = info.top - 0.075;
                const cap = new T.SphereGeometry(0.17, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
                g.add(mesh(cap, Mat.vinyl(palette(anomaly, '#8ecae6', '#3c6576'), 0.5), 0, capY, 0.0, { rx: -0.25 }));
                const visor = new T.CylinderGeometry(0.14, 0.14, 0.014, 32, 1, false, -Math.PI / 2, Math.PI);
                g.add(mesh(visor, Mat.vinyl(palette(anomaly, '#6fb3d6', '#2e5260'), 0.5), 0, capY + 0.02, 0.13, { rx: 0.08 }));
                // Белый фотоаппарат на шее
                const n = info.bodyBottom + info.bodyH;
                const cam = new T.Group();
                cam.position.set(0, n - 0.12, info.bodyR + 0.025);
                cam.add(mesh(roundedBox(0.12, 0.075, 0.05, 0.015, 3), Mat.vinyl('#f3f3f5', 0.35)));
                cam.add(mesh(new T.CylinderGeometry(0.026, 0.028, 0.035, 20).rotateX(Math.PI / 2), Mat.vinyl('#1b1b1f', 0.3), 0, -0.003, 0.035));
                cam.add(mesh(new T.CircleGeometry(0.02, 20), anomaly ? Mat.glow('#ff1744', 2) : Mat.glass('#3a5068'), 0, -0.003, 0.0535));
                g.add(cam);
                g.add(mesh(tube([[-0.05, n - 0.1, info.bodyR], [-0.09, n - 0.02, 0.05], [0, n + 0.005, -0.02], [0.09, n - 0.02, 0.05], [0.05, n - 0.1, info.bodyR]], 0.006, 24, 6), Mat.vinyl('#222')));
            }
        });
    }

    // Рэттью — маленький чёрный крыс с белой мордочкой, зубками и розовым хвостом-завитком
    function ratthew() {
        const fur = '#2e2a35';
        return buildCharacter({
            fur,
            headR: 0.175,
            body: { color: fur, r: 0.11, h: 0.21 },
            arms: { color: fur, hand: '#f1a7bb' },
            legs: fur,
            shoes: '#f1a7bb',
            face: (ctx) => {
                eyes(ctx, { r: 0.12, y: -0.12, dx: 0.29, color: '#3a2a1a' });
            },
            extras(g, info) {
                // Белая мордочка, розовый нос и два белых зуба
                const sp = onHead(info, 0, -0.25, -0.03);
                g.add(mesh(ellipsoid(0.1, 0.075, 0.11, 24, 16), Mat.vinyl('#f4f2ef', 0.45), 0, sp.y, sp.z + 0.02));
                g.add(mesh(new T.SphereGeometry(0.025, 16, 12), Mat.vinyl('#f07c9c', 0.35), 0, sp.y + 0.02, sp.z + 0.125));
                for (const s of [-1, 1]) {
                    g.add(mesh(roundedBox(0.022, 0.04, 0.012, 0.005, 2), Mat.vinyl('#ffffff', 0.3), s * 0.013, sp.y - 0.06, sp.z + 0.1));
                }
                // Длинные «кроличьи» уши
                for (const s of [-1, 1]) {
                    ear(g, info, s, { color: fur, inner: '#f1a7bb', w: 0.05, h: 0.15, d: 0.03, az: 0.5, el: 0.9, tilt: 0.3 });
                }
                // Хвост-завиток
                const pts = [];
                for (let i = 0; i <= 16; i++) {
                    const t = i / 16;
                    const a = t * Math.PI * 2.4;
                    const r = 0.1 * (1 - t * 0.55);
                    pts.push([Math.sin(a) * r + 0.1, info.bodyBottom + 0.02 + t * 0.2, -0.12 - Math.cos(a) * r * 0.6]);
                }
                g.add(mesh(taperedTube(pts, (t) => 0.018 * (1 - t * 0.6), 60, 8), Mat.vinyl('#f1a7bb', 0.45)));
            }
        });
    }

    // Барни — белый кролик с чёрными усами и беретом; в форме аномалии
    function barney() {
        const fur = '#f2f0ec';
        return buildCharacter({
            fur,
            headR: 0.205,
            body: {
                color: fur, r: 0.135, h: 0.28,
                draw: (ctx, w, h) => {
                    // Клетчатые коричневые штаны
                    ctx.fillStyle = '#7b5a3a';
                    ctx.fillRect(0, h * 0.55, w, h * 0.45);
                    ctx.strokeStyle = '#4e3522';
                    ctx.lineWidth = 4;
                    for (let x = 0; x < w; x += 22) { ctx.beginPath(); ctx.moveTo(x, h * 0.55); ctx.lineTo(x, h); ctx.stroke(); }
                    for (let y = h * 0.55; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
                    ctx.strokeStyle = '#b08a5c';
                    ctx.lineWidth = 2;
                    for (let x = 11; x < w; x += 22) { ctx.beginPath(); ctx.moveTo(x, h * 0.55); ctx.lineTo(x, h); ctx.stroke(); }
                }
            },
            arms: { color: fur, hand: fur },
            legs: '#7b5a3a',
            face: (ctx) => {
                ctx.fillStyle = '#f7d6de';
                ctx.beginPath(); ctx.ellipse(0, 0.08, 0.05, 0.035, 0, 0, Math.PI * 2); ctx.fill();
                anomalyEyes(ctx, { r: 0.115, y: -0.12, dx: 0.28, rim: '#3a2a2a' });
                sharpGrin(ctx, { w: 0.6, y: 0.24, h: 0.18 });
            },
            extras(g, info) {
                for (const s of [-1, 1]) {
                    ear(g, info, s, { color: fur, inner: '#f3b5c6', w: 0.06, h: 0.2, d: 0.035, az: 0.4, el: 1.0, tilt: 0.18 });
                }
                // Чёрные «имперские» усы с закрученными кончиками
                const mp = onHead(info, 0, -0.05, 0.005);
                for (const s of [-1, 1]) {
                    const pts = [[s * 0.01, mp.y, mp.z + 0.01], [s * 0.07, mp.y - 0.01, mp.z - 0.01], [s * 0.14, mp.y + 0.02, mp.z - 0.05], [s * 0.16, mp.y + 0.07, mp.z - 0.06], [s * 0.13, mp.y + 0.08, mp.z - 0.05]];
                    g.add(mesh(taperedTube(pts, (t) => 0.024 * (1 - t * 0.8), 28, 10), Mat.vinyl('#141216', 0.45)));
                }
                // Берет из мешковины
                const beret = ellipsoid(0.17, 0.065, 0.17, 28, 14);
                const beretTex = CM.Tex.canvas(256, 128, (ctx, w, h) => {
                    ctx.fillStyle = '#9b7b52'; ctx.fillRect(0, 0, w, h);
                    const rnd = CM.Tex.rng(7);
                    for (let i = 0; i < 1400; i++) {
                        ctx.fillStyle = rnd() < 0.5 ? 'rgba(70,50,30,0.35)' : 'rgba(200,170,120,0.35)';
                        ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
                    }
                    ctx.strokeStyle = 'rgba(60,40,20,0.3)';
                    for (let x = 0; x < w; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
                });
                g.add(mesh(beret, Mat.textured(beretTex, { roughness: 0.9, clearcoat: 0 }), -0.05, info.top - 0.015, -0.01, { rz: 0.35, rx: -0.1 }));
                g.add(mesh(new T.CylinderGeometry(0.008, 0.012, 0.03, 8), Mat.matte('#6b4f33'), -0.06, info.top + 0.05, -0.01, { rz: 0.25 }));
                // Кружка кофе
                const cup = new T.Group();
                cup.position.set(info.bodyR + 0.06, info.bodyBottom + 0.08, 0.05);
                cup.add(mesh(new T.CylinderGeometry(0.035, 0.03, 0.07, 20), Mat.vinyl('#f5f1e8', 0.4)));
                cup.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.005, 20), Mat.vinyl('#4a2a14', 0.3), 0, 0.034, 0));
                cup.add(mesh(new T.TorusGeometry(0.018, 0.006, 8, 16), Mat.vinyl('#f5f1e8', 0.4), 0.04, 0, 0, { ry: Math.PI / 2 }));
                g.add(cup);
            }
        });
    }

    // Слизень-аномалия — пешка чёрных
    function slime() {
        const g = new T.Group();
        const geo = new T.SphereGeometry(0.26, 48, 32);
        const rnd = CM.Tex.rng(33);
        const drips = [0.4, 1.7, 2.9, 4.2, 5.4].map((a) => ({ a, len: 0.02 + rnd() * 0.03 }));
        deform(geo, (v) => {
            // Приплюснутая «капля»: широкое основание, узкий верх, подтёки
            const y = v.y / 0.26;
            const k = 1 + 0.25 * Math.max(0, -y) - 0.18 * Math.max(0, y);
            v.x *= k; v.z *= k;
            if (v.y < -0.06) v.y = -0.06 - (v.y + 0.06) * 0.25;
            const ang = Math.atan2(v.z, v.x) + Math.PI;
            if (y < 0.1 && y > -0.6) {
                for (const d of drips) {
                    const da = Math.abs(((ang - d.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                    if (da < 0.3) v.y -= d.len * (1 - da / 0.3) * (1 - Math.abs(y + 0.25) * 1.5);
                }
            }
            v.y += 0.26 * 0.3;
        });
        const tex = headTexture('#6a2fa0', (ctx) => {
            anomalyEyes(ctx, { r: 0.13, y: -0.25, dx: 0.3, rim: '#2b0a45' });
            sharpGrin(ctx, { w: 0.62, y: 0.02, h: 0.18 });
        });
        const mat = new T.MeshPhysicalMaterial({
            map: tex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05,
            emissive: '#3b0f66', emissiveIntensity: 0.35, sheen: 0.6, sheenColor: '#c77dff'
        });
        g.add(mesh(geo, mat, 0, 0.085 + 0.02, 0));
        // Блестящие пузырьки
        for (const [x, y, z, r] of [[0.1, 0.33, 0.1, 0.025], [-0.12, 0.3, 0.06, 0.018], [0.05, 0.37, -0.1, 0.02]]) {
            g.add(mesh(new T.SphereGeometry(r, 12, 10), new T.MeshPhysicalMaterial({ color: '#d7b4ff', roughness: 0.1, transmission: 0, clearcoat: 1, emissive: '#7c3aed', emissiveIntensity: 0.4 }), x, y, z));
        }
        return g;
    }

    const BUILDERS = {
        w: { k: harlow, q: () => nurse(false), r: () => duckman(false), b: () => ron(false), n: () => liz(false), p: ratthew },
        b: { k: barney, q: () => nurse(true), r: () => duckman(true), b: () => ron(true), n: () => liz(true), p: slime }
    };

    const NAMES = {
        w: { k: 'Доктор Харлоу', q: 'Медсестра', r: 'Офицер Дакман', b: 'Рон из бухгалтерии', n: 'Лиз', p: 'Рэттью' },
        b: { k: 'Барни', q: 'Аномалия-медсестра', r: 'Аномалия-Дакман', b: 'Аномалия-Рон', n: 'Аномалия-Лиз', p: 'Слизень-аномалия' }
    };

    const SCALE = { k: 1.2, q: 1.15, r: 1.12, b: 1.1, n: 1.1, p: 0.95 };

    function buildPiece(type, color) {
        const root = new T.Group();
        const pod = CM.podium(color, color === 'w' ? '#e2b447' : '#8e44ad', { radius: 0.4 });
        root.add(pod);
        const ch = BUILDERS[color][type]();
        ch.scale.setScalar(SCALE[type]);
        ch.position.y = pod.userData.top - 0.085 * SCALE[type];
        root.add(ch);
        CM.optimize(root);
        const box = new T.Box3().setFromObject(root);
        root.userData.height = box.max.y;
        root.userData.radius = 0.4;
        return root;
    }

    CM.Themes3D.hospital = {
        key: 'hospital',
        buildPiece,
        names: NAMES,
        motion: 'hop',
        // На доске персонажи стоят лицом к соперникам
        faceOpponent: true,
        elevation: 46,
        fitHeight: 1.2,
        // Снимки для интерфейса — почти анфас
        portraitYaw: 0.13
    };
})();
