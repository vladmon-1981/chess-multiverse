/*
 * Эффекты интерфейса: конфетти и «пепел» на отдельном canvas, печатная машинка для текстов,
 * встряхивание экрана. Для каждой вселенной — свои формы конфетти.
 */
(function () {
    'use strict';

    const PALETTES = {
        classic: { colors: ['#f7d774', '#fff3c4', '#d9a441', '#ffffff', '#b8860b'], shapes: ['rect', 'star', 'circle'] },
        cars: { colors: ['#e53935', '#ffd21f', '#ffffff', '#111111', '#29b6f6'], shapes: ['flag', 'rect', 'bolt'] },
        hospital: { colors: ['#ff8fb1', '#2dd4bf', '#ffffff', '#fde68a', '#a78bfa'], shapes: ['heart', 'cross', 'circle'] },
        // Хоккей: шайбы, звёзды и ленты цветов команды-победителя
        hockey: {
            colors: ['#1f4fa3', '#ffffff', '#d7262e', '#16161b', '#9fd8ff'], shapes: ['puck', 'star', 'rect', 'rect'],
            sides: { w: ['#1f4fa3', '#ffffff', '#d7262e', '#9fd8ff'], b: ['#d4202c', '#ffffff', '#16161b', '#ff8a8a'] }
        }
    };

    class Effects {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.parts = [];
            this.raf = 0;
            this.typing = new WeakMap();
            this.resize = this.resize.bind(this);
            window.addEventListener('resize', this.resize);
            this.resize();
        }

        resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.dpr = dpr;
            this.canvas.width = Math.round(window.innerWidth * dpr);
            this.canvas.height = Math.round(window.innerHeight * dpr);
        }

        /** Праздничные конфетти из двух «пушек» внизу экрана и дождь сверху; o.side — цвета победившей стороны. */
        confetti(theme = 'classic', o = {}) {
            const pal = PALETTES[theme] || PALETTES.classic;
            const colors = (o.side && pal.sides && pal.sides[o.side]) || pal.colors;
            const W = window.innerWidth, H = window.innerHeight;
            const count = o.count || (W < 600 ? 110 : 190);
            for (let i = 0; i < count; i++) {
                const fromLeft = i % 3 === 0, fromRight = i % 3 === 1;
                let x, y, vx, vy;
                if (fromLeft || fromRight) {
                    x = fromLeft ? -10 : W + 10;
                    y = H * 0.85;
                    const a = (fromLeft ? -1 : -1) * (Math.PI / 2) + (fromLeft ? 0.55 : -0.55) + (Math.random() - 0.5) * 0.5;
                    const sp = 11 + Math.random() * 9;
                    vx = Math.cos(a) * sp * (fromLeft ? 1 : 1);
                    vy = Math.sin(a) * sp;
                } else {
                    x = Math.random() * W;
                    y = -20 - Math.random() * H * 0.4;
                    vx = (Math.random() - 0.5) * 2;
                    vy = 1 + Math.random() * 2;
                }
                this.parts.push({
                    x, y, vx, vy,
                    size: 7 + Math.random() * 8,
                    rot: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * 0.3,
                    flip: Math.random() * Math.PI * 2,
                    vflip: 0.08 + Math.random() * 0.12,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    shape: pal.shapes[Math.floor(Math.random() * pal.shapes.length)],
                    life: 0,
                    max: 4.5 + Math.random() * 1.5,
                    gravity: 0.28,
                    drag: 0.985
                });
            }
            this.start();
        }

        /** Медленно падающий «пепел» для поражения. */
        ash(o = {}) {
            const W = window.innerWidth, H = window.innerHeight;
            const count = o.count || 70;
            const colors = o.colors || ['#9ca3af', '#6b7280', '#4b5563', '#d1d5db'];
            for (let i = 0; i < count; i++) {
                this.parts.push({
                    x: Math.random() * W, y: -Math.random() * H * 0.6,
                    vx: (Math.random() - 0.5) * 0.6, vy: 0.6 + Math.random() * 1.1,
                    size: 2 + Math.random() * 4, rot: 0, vr: 0, flip: 0, vflip: 0.02,
                    color: colors[Math.floor(Math.random() * colors.length)], shape: 'circle',
                    life: 0, max: 5 + Math.random() * 2, gravity: 0.004, drag: 1, sway: Math.random() * 6
                });
            }
            this.start();
        }

        start() {
            if (!this.raf) {
                this.last = performance.now();
                this.raf = requestAnimationFrame((t) => this.loop(t));
            }
        }

        clear() {
            this.parts.length = 0;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        loop(now) {
            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            const ctx = this.ctx, dpr = this.dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            const k = dt * 60;
            for (let i = this.parts.length - 1; i >= 0; i--) {
                const p = this.parts[i];
                p.life += dt;
                p.vy += p.gravity * k;
                p.vx *= Math.pow(p.drag, k);
                p.vy *= Math.pow(p.drag, k);
                p.x += p.vx * k + (p.sway ? Math.sin(p.life * 1.5 + p.sway) * 0.4 : 0);
                p.y += p.vy * k;
                p.rot += p.vr * k;
                p.flip += p.vflip * k;
                const fade = Math.min(1, (p.max - p.life) / 0.8);
                if (p.life > p.max || p.y > window.innerHeight + 40) { this.parts.splice(i, 1); continue; }
                ctx.save();
                ctx.globalAlpha = Math.max(0, fade);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.scale(1, Math.cos(p.flip));
                this.drawShape(ctx, p);
                ctx.restore();
            }
            if (this.parts.length) {
                this.raf = requestAnimationFrame((t) => this.loop(t));
            } else {
                this.raf = 0;
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }

        drawShape(ctx, p) {
            const s = p.size;
            ctx.fillStyle = p.color;
            switch (p.shape) {
                case 'circle':
                    ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); break;
                case 'star':
                    ctx.beginPath();
                    for (let i = 0; i < 10; i++) {
                        const r = i % 2 ? s * 0.25 : s * 0.6, a = -Math.PI / 2 + i * Math.PI / 5;
                        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    }
                    ctx.fill(); break;
                case 'heart':
                    ctx.beginPath();
                    ctx.moveTo(0, s * 0.35);
                    ctx.bezierCurveTo(-s * 0.7, -s * 0.1, -s * 0.35, -s * 0.6, 0, -s * 0.25);
                    ctx.bezierCurveTo(s * 0.35, -s * 0.6, s * 0.7, -s * 0.1, 0, s * 0.35);
                    ctx.fill(); break;
                case 'cross':
                    ctx.fillRect(-s * 0.5, -s * 0.16, s, s * 0.32);
                    ctx.fillRect(-s * 0.16, -s * 0.5, s * 0.32, s); break;
                case 'flag': {
                    const c = s * 0.35;
                    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                        ctx.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
                        ctx.fillRect(-s * 0.52 + i * c, -s * 0.52 + j * c, c, c);
                    }
                    break;
                }
                case 'puck':
                    // Шайба сбоку: чёрный диск с рифлёным ободком
                    ctx.fillStyle = '#141417';
                    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#4a4a55';
                    ctx.fillRect(-s * 0.58, -s * 0.04, s * 1.16, s * 0.08);
                    break;
                case 'bolt':
                    ctx.beginPath();
                    ctx.moveTo(-s * 0.1, -s * 0.6); ctx.lineTo(s * 0.35, -s * 0.6); ctx.lineTo(s * 0.05, -s * 0.05);
                    ctx.lineTo(s * 0.35, -s * 0.05); ctx.lineTo(-s * 0.25, s * 0.65); ctx.lineTo(0, s * 0.1); ctx.lineTo(-s * 0.3, s * 0.1);
                    ctx.closePath(); ctx.fill(); break;
                default:
                    ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
            }
        }

        /**
         * Печатная машинка: текст появляется по буквам.
         * onChar вызывается для каждой видимой буквы (для звука клавиш).
         */
        type(el, text, o = {}) {
            if (!el) return Promise.resolve();
            const prev = this.typing.get(el);
            if (prev) prev.cancelled = true;
            const job = { cancelled: false };
            this.typing.set(el, job);
            const speed = o.speed || 24;
            if (o.instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
                el.textContent = text;
                return Promise.resolve();
            }
            el.textContent = '';
            el.classList.add('is-typing');
            return new Promise((resolve) => {
                let i = 0;
                const step = () => {
                    if (job.cancelled) return resolve();
                    i++;
                    el.textContent = text.slice(0, i);
                    if (o.onChar && text[i - 1] && text[i - 1] !== ' ' && i % (o.every || 1) === 0) o.onChar();
                    if (i < text.length) {
                        const ch = text[i - 1];
                        setTimeout(step, /[.,!?…—]/.test(ch) ? speed * 5 : speed);
                    } else {
                        el.classList.remove('is-typing');
                        resolve();
                    }
                };
                step();
            });
        }

        shake(el, strong = false) {
            if (!el) return;
            el.classList.remove('shake', 'shake-strong');
            void el.offsetWidth;
            el.classList.add(strong ? 'shake-strong' : 'shake');
        }
    }

    window.Effects = Effects;
})();
