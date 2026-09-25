/*
 * Оформление 3D-доски для каждой темы: текстура игрового поля с рамкой и координатами,
 * материал боковин и освещение сцены.
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
        layout
    };
})();
