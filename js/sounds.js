/*
 * Звук и озвучка.
 * Все эффекты и музыкальные заставки синтезируются через Web Audio API (без файлов):
 * у каждой вселенной свой набор — дерево и колокола в «Классике», моторы и клаксоны
 * в «Тачках», кардиомонитор и маримба в «Animal Hospital».
 * Диктор говорит по-русски через Web Speech API (speechSynthesis), если он есть в браузере.
 */
(function () {
    'use strict';

    const store = {
        get(key, def) {
            try { const v = localStorage.getItem(key); return v === null ? def : v === '1'; } catch (e) { return def; }
        },
        set(key, v) {
            try { localStorage.setItem(key, v ? '1' : '0'); } catch (e) { /* приватный режим */ }
        }
    };

    // Частота ноты: 'C4', 'F#3', 'Bb5'
    const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    function hz(name) {
        const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
        const n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
        return 440 * Math.pow(2, (n - 69) / 12);
    }

    // ---------- Синтезатор ----------
    class Synth {
        constructor(ctx, dry, wet) {
            this.ctx = ctx;
            this.dry = dry;
            this.wet = wet;
            const len = ctx.sampleRate * 2;
            this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            this.shaper = ctx.createWaveShaper();
            const curve = new Float32Array(1024);
            for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); }
            this.shaperCurve = curve;
        }

        // Огибающая громкости: атака a, спад до нуля за d
        env(g, t, peak, a, d, hold = 0) {
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(peak, t + a);
            if (hold) g.gain.setValueAtTime(peak, t + a + hold);
            g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
        }

        route(node, send = 0.12, pan = 0) {
            let out = node;
            if (pan && this.ctx.createStereoPanner) {
                const p = this.ctx.createStereoPanner();
                p.pan.value = pan;
                node.connect(p);
                out = p;
            }
            out.connect(this.dry);
            if (send > 0) {
                const s = this.ctx.createGain();
                s.gain.value = send;
                out.connect(s);
                s.connect(this.wet);
            }
        }

        /** Тон: type, f → f2 (glide), dur, g (громкость), a (атака), filter {type,f,f2,q}, vib (центы), send, pan */
        tone(t, o) {
            const c = this.ctx;
            // Обертоны выше частоты Найквиста не слышны и дают предупреждения — пропускаем
            const nyq = c.sampleRate * 0.45;
            if (o.f > nyq) return null;
            if (o.f2 && o.f2 > nyq) o = Object.assign({}, o, { f2: nyq });
            const osc = c.createOscillator();
            osc.type = o.type || 'sine';
            osc.frequency.setValueAtTime(o.f, t);
            if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
            if (o.detune) osc.detune.value = o.detune;
            if (o.vib) {
                const lfo = c.createOscillator(), lg = c.createGain();
                lfo.frequency.value = o.vibRate || 5.5;
                lg.gain.setValueAtTime(0, t);
                lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(0.35, o.dur * 0.5));
                lfo.connect(lg); lg.connect(osc.detune);
                lfo.start(t); lfo.stop(t + o.dur + 0.1);
            }
            let node = osc;
            if (o.filter) {
                const f = c.createBiquadFilter();
                f.type = o.filter.type || 'lowpass';
                f.frequency.setValueAtTime(o.filter.f, t);
                if (o.filter.f2) f.frequency.exponentialRampToValueAtTime(o.filter.f2, t + (o.filter.time || o.dur));
                f.Q.value = o.filter.q || 0.8;
                node.connect(f);
                node = f;
            }
            if (o.drive) {
                const ws = c.createWaveShaper();
                ws.curve = this.shaperCurve;
                node.connect(ws);
                node = ws;
            }
            const g = c.createGain();
            this.env(g, t, o.g || 0.2, o.a || 0.005, o.d || o.dur, o.hold || 0);
            node.connect(g);
            this.route(g, o.send === undefined ? 0.12 : o.send, o.pan || 0);
            osc.start(t);
            osc.stop(t + (o.a || 0.005) + (o.hold || 0) + (o.d || o.dur) + 0.05);
            return osc;
        }

        noise(t, o) {
            const c = this.ctx;
            const src = c.createBufferSource();
            src.buffer = this.noiseBuf;
            src.loop = true;
            if (o.rate) src.playbackRate.value = o.rate;
            let node = src;
            const filters = o.filters || (o.filter ? [o.filter] : []);
            for (const fo of filters) {
                const f = c.createBiquadFilter();
                f.type = fo.type || 'bandpass';
                f.frequency.setValueAtTime(fo.f, t);
                if (fo.f2) f.frequency.exponentialRampToValueAtTime(fo.f2, t + (fo.time || o.dur));
                f.Q.value = fo.q || 1;
                node.connect(f);
                node = f;
            }
            const g = c.createGain();
            this.env(g, t, o.g || 0.2, o.a || 0.002, o.d || o.dur, o.hold || 0);
            node.connect(g);
            this.route(g, o.send === undefined ? 0.08 : o.send, o.pan || 0);
            src.start(t, Math.random() * 1.5);
            src.stop(t + (o.a || 0.002) + (o.hold || 0) + (o.d || o.dur) + 0.05);
        }

        // ---------- Инструменты ----------
        wood(t, pitch = 1, g = 1) {
            this.noise(t, { dur: 0.014, g: 0.45 * g, filter: { type: 'bandpass', f: 2600 * pitch, q: 1.6 }, send: 0.05 });
            this.tone(t, { type: 'sine', f: 760 * pitch, f2: 540 * pitch, dur: 0.08, g: 0.3 * g, a: 0.001, send: 0.06 });
            this.tone(t, { type: 'triangle', f: 230 * pitch, f2: 150 * pitch, dur: 0.12, g: 0.28 * g, a: 0.002, send: 0.04 });
        }

        bell(t, f, dur = 1.4, g = 0.2, send = 0.35, pan = 0) {
            const partials = [[1, 1], [2.01, 0.45], [2.76, 0.32], [5.4, 0.16], [8.93, 0.07]];
            for (const [r, k] of partials) {
                this.tone(t, { type: 'sine', f: f * r, dur: dur / (1 + r * 0.25), g: g * k, a: 0.002, send, pan });
            }
        }

        piano(t, f, dur = 1.2, g = 0.18, send = 0.2) {
            this.tone(t, { type: 'triangle', f, dur, g, a: 0.004, send });
            this.tone(t, { type: 'sine', f: f * 2, dur: dur * 0.6, g: g * 0.35, a: 0.004, send });
            this.tone(t, { type: 'sine', f: f * 3, dur: dur * 0.35, g: g * 0.12, a: 0.004, send });
        }

        pluck(t, f, dur = 0.9, g = 0.16, send = 0.3) {
            this.tone(t, { type: 'triangle', f, dur, g, a: 0.002, send, filter: { type: 'lowpass', f: f * 8, f2: f * 2, time: dur * 0.6, q: 0.5 } });
            this.tone(t, { type: 'sine', f: f * 2, dur: dur * 0.4, g: g * 0.25, a: 0.002, send });
        }

        marimba(t, f, g = 0.22, send = 0.18) {
            this.tone(t, { type: 'sine', f, dur: 0.45, g, a: 0.002, send });
            this.tone(t, { type: 'sine', f: f * 4, dur: 0.12, g: g * 0.3, a: 0.001, send });
            this.noise(t, { dur: 0.01, g: g * 0.25, filter: { type: 'bandpass', f: f * 3, q: 2 }, send: 0 });
        }

        brass(t, f, dur, g = 0.12, o = {}) {
            for (const det of [-7, 7]) {
                this.tone(t, {
                    type: 'sawtooth', f, detune: det, a: o.a || 0.05, hold: Math.max(0, dur - 0.12), d: o.release || 0.18, dur,
                    g, vib: dur > 0.5 ? 9 : 0, send: o.send === undefined ? 0.22 : o.send, pan: o.pan || 0,
                    filter: { type: 'lowpass', f: 500, f2: o.bright || 2600, time: 0.08, q: 1.2 }
                });
            }
        }

        timpani(t, f = 98, g = 0.4) {
            this.tone(t, { type: 'sine', f: f * 1.1, f2: f, glide: 0.08, dur: 1.1, g, a: 0.003, send: 0.25 });
            this.noise(t, { dur: 0.2, g: g * 0.35, filter: { type: 'lowpass', f: 700 }, send: 0.2 });
        }

        kick(t, g = 0.45) {
            this.tone(t, { type: 'sine', f: 140, f2: 45, glide: 0.12, dur: 0.28, g, a: 0.002, send: 0.02 });
        }

        snare(t, g = 0.25) {
            this.noise(t, { dur: 0.16, g, filter: { type: 'bandpass', f: 1900, q: 0.8 }, send: 0.15 });
            this.tone(t, { type: 'triangle', f: 190, f2: 140, dur: 0.08, g: g * 0.6, send: 0.05 });
        }

        cymbal(t, dur = 1.6, g = 0.12) {
            this.noise(t, { dur, g, filters: [{ type: 'highpass', f: 5200 }, { type: 'peaking', f: 8000, q: 0.7 }], send: 0.3, a: 0.004 });
        }

        clap(t, g = 0.2) {
            for (let i = 0; i < 3; i++) {
                this.noise(t + i * 0.009, { dur: 0.05, g: g * (1 - i * 0.2), filter: { type: 'bandpass', f: 1400, q: 1.1 }, send: 0.2 });
            }
        }

        engine(t, o = {}) {
            const c = this.ctx;
            const dur = o.dur || 0.5;
            const f0 = o.f0 || 60, f1 = o.f1 || 140, f2 = o.f2 || 90;
            const mk = (type, mult, gain) => {
                const osc = c.createOscillator();
                osc.type = type;
                osc.frequency.setValueAtTime(f0 * mult, t);
                osc.frequency.linearRampToValueAtTime(f1 * mult, t + dur * (o.peak || 0.45));
                osc.frequency.linearRampToValueAtTime(f2 * mult, t + dur);
                const g = c.createGain();
                g.gain.value = gain;
                osc.connect(g);
                osc.start(t);
                osc.stop(t + dur + 0.1);
                return g;
            };
            const mix = c.createGain();
            mk('sawtooth', 1, 0.6).connect(mix);
            mk('square', 0.5, 0.45).connect(mix);
            mk('sawtooth', 2.01, 0.2).connect(mix);
            const ws = c.createWaveShaper();
            ws.curve = this.shaperCurve;
            const lp = c.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(f0 * 7, t);
            lp.frequency.linearRampToValueAtTime(f1 * 9, t + dur * (o.peak || 0.45));
            lp.frequency.linearRampToValueAtTime(f2 * 6, t + dur);
            lp.Q.value = 2;
            const g = c.createGain();
            this.env(g, t, o.g || 0.16, 0.03, dur * 0.4, dur * 0.55);
            mix.connect(ws); ws.connect(lp); lp.connect(g);
            this.route(g, 0.06, o.pan || 0);
        }

        horn(t, dur = 0.16, g = 0.14) {
            for (const f of [415, 523]) {
                this.tone(t, { type: 'square', f, dur, hold: dur * 0.8, d: 0.04, g, a: 0.008, send: 0.1, filter: { type: 'lowpass', f: 1800, q: 1 } });
            }
        }

        screech(t, dur = 0.35, g = 0.12) {
            this.noise(t, { dur, g, hold: dur * 0.6, d: dur * 0.4, filter: { type: 'bandpass', f: 3100, f2: 2600, q: 10 }, send: 0.1 });
            this.tone(t, { type: 'sine', f: 2500, f2: 2200, dur, hold: dur * 0.6, d: dur * 0.4, g: g * 0.35, vib: 60, vibRate: 22, send: 0.1 });
        }

        crowd(t, dur = 2.6, g = 0.14) {
            for (const [f, q] of [[650, 1.2], [1200, 1.4], [2300, 1.6]]) {
                const c = this.ctx;
                const src = c.createBufferSource();
                src.buffer = this.noiseBuf; src.loop = true;
                const bp = c.createBiquadFilter();
                bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
                const am = c.createGain();
                const steps = 40, curve = new Float32Array(steps);
                for (let i = 0; i < steps; i++) curve[i] = 0.55 + Math.random() * 0.45;
                am.gain.setValueCurveAtTime(curve, t, dur);
                const g2 = c.createGain();
                this.env(g2, t, g, 0.35, 0.9, Math.max(0, dur - 1.25));
                src.connect(bp); bp.connect(am); am.connect(g2);
                this.route(g2, 0.3);
                src.start(t, Math.random()); src.stop(t + dur + 0.2);
            }
            for (let i = 0; i < 3; i++) {
                const w = t + 0.2 + Math.random() * (dur - 0.8);
                this.tone(w, { type: 'sine', f: 1900 + Math.random() * 500, f2: 2900 + Math.random() * 600, glide: 0.25, dur: 0.4, g: g * 0.35, a: 0.03, send: 0.3 });
            }
        }

        monitorBeep(t, g = 0.16, dur = 0.1) {
            this.tone(t, { type: 'sine', f: 1000, dur, hold: dur * 0.7, d: 0.03, g, a: 0.004, send: 0.12 });
        }

        chord(t, notes, fn) { notes.forEach((n, i) => fn(t, hz(n), i)); }
    }

    // ---------- Наборы звуков вселенных ----------
    const rnd = (k) => 1 + (Math.random() - 0.5) * k;

    const COMMON = {
        uiClick(S, t) {
            S.tone(t, { type: 'sine', f: 880, f2: 620, dur: 0.05, g: 0.08, send: 0.05 });
            S.noise(t, { dur: 0.008, g: 0.05, filter: { type: 'highpass', f: 3000 }, send: 0 });
        },
        uiHover(S, t) { S.tone(t, { type: 'sine', f: 1500, dur: 0.02, g: 0.018, send: 0 }); },
        type(S, t) { S.noise(t, { dur: 0.006, g: 0.04 * rnd(0.6), filter: { type: 'highpass', f: 2800 * rnd(0.3) }, send: 0 }); },
        portal(S, t) {
            S.noise(t, { dur: 0.7, g: 0.18, a: 0.25, filter: { type: 'bandpass', f: 300, f2: 3000, q: 1.5 }, send: 0.4 });
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => S.tone(t + 0.08 * i, { type: 'sine', f, dur: 0.6, g: 0.05, send: 0.5 }));
        }
    };

    const CLASSIC = {
        select(S, t) { S.wood(t, 1.6, 0.25); },
        move(S, t) { S.wood(t, rnd(0.08)); },
        capture(S, t) {
            S.wood(t, rnd(0.06) * 0.92, 1.1);
            S.wood(t + 0.085, rnd(0.06) * 0.8, 0.9);
            S.noise(t + 0.02, { dur: 0.12, g: 0.06, filter: { type: 'bandpass', f: 1500, q: 0.7 }, send: 0.05 });
        },
        castle(S, t) { S.wood(t, 1.02); S.wood(t + 0.17, 0.9); },
        check(S, t) { S.bell(t, 1318.5, 1.8, 0.2); S.bell(t + 0.14, 1760, 1.4, 0.1); },
        promote(S, t) {
            ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => S.pluck(t + i * 0.055, hz(n), 1.1, 0.12));
            S.bell(t + 0.42, 2093, 1.6, 0.1);
        },
        illegal(S, t) { S.tone(t, { type: 'triangle', f: 196, f2: 150, dur: 0.12, g: 0.22 }); S.tone(t + 0.13, { type: 'triangle', f: 175, f2: 130, dur: 0.14, g: 0.2 }); },
        start(S, t) {
            ['C4', 'E4', 'G4', 'C5'].forEach((n, i) => S.piano(t + i * 0.11, hz(n), 1.6, 0.13));
            S.chord(t + 0.5, ['C3', 'G3', 'E4'], (tt, f) => S.piano(tt, f, 2.2, 0.08));
        },
        win(S, t) {
            S.cymbal(t, 1.2, 0.05);
            for (let i = 0; i < 8; i++) S.timpani(t + i * 0.05, 98, 0.12 + i * 0.015);
            const mel = [['G4', 0.14], ['C5', 0.14], ['E5', 0.14], ['G5', 0.42], ['E5', 0.16], ['G5', 1.3]];
            let tt = t + 0.45;
            for (const [n, d] of mel) { S.brass(tt, hz(n), d, 0.07, { bright: 3200 }); tt += d; }
            const hit = t + 0.45 + 0.14 * 3;
            S.timpani(hit, 131, 0.35);
            S.chord(hit, ['C4', 'E4', 'G4'], (x, f) => S.brass(x, f, 1.9, 0.045, { send: 0.3 }));
            const big = tt - 1.3;
            S.timpani(big, 98, 0.45);
            S.cymbal(big, 2.2, 0.14);
            S.chord(big, ['C3', 'C4', 'E4', 'G4', 'C5'], (x, f) => S.brass(x, f, 1.5, 0.045, { send: 0.35 }));
            S.bell(big + 0.1, 2093, 2, 0.08);
            S.bell(big + 0.25, 2637, 2, 0.06);
        },
        lose(S, t) {
            S.tone(t, { type: 'sawtooth', f: hz('A2'), dur: 3.2, a: 0.4, hold: 2.2, d: 0.8, g: 0.05, send: 0.4, filter: { type: 'lowpass', f: 420, q: 0.7 }, vib: 6 });
            [['E4', 0.6], ['D4', 0.6], ['C4', 0.6], ['B3', 1.6]].reduce((tt, [n, d]) => {
                S.piano(tt, hz(n), d + 0.8, 0.13, 0.35);
                return tt + d;
            }, t + 0.2);
            S.chord(t + 0.2, ['A2', 'E3', 'C4'], (x, f) => S.piano(x, f, 2.2, 0.06, 0.35));
            S.chord(t + 2.0, ['E2', 'B2', 'G#3'], (x, f) => S.piano(x, f, 2.4, 0.06, 0.4));
        },
        draw(S, t) {
            S.chord(t, ['C4', 'F4', 'G4', 'C5'], (x, f) => S.piano(x, f, 1.2, 0.08));
            S.chord(t + 0.8, ['C4', 'E4', 'G4', 'C5'], (x, f) => S.piano(x, f, 2, 0.08));
        }
    };

    const CARS = {
        select(S, t) { S.engine(t, { f0: 55, f1: 95, f2: 60, dur: 0.22, g: 0.08 }); },
        move(S, t) {
            S.engine(t, { f0: 50 * rnd(0.1), f1: 150 * rnd(0.1), f2: 85, dur: 0.55, g: 0.13 });
            S.noise(t + 0.05, { dur: 0.3, g: 0.025, filter: { type: 'bandpass', f: 1800, q: 1.5 }, send: 0.05 });
        },
        capture(S, t) {
            S.engine(t, { f0: 60, f1: 170, f2: 120, dur: 0.4, g: 0.12 });
            const h = t + 0.32;
            S.noise(h, { dur: 0.45, g: 0.32, filter: { type: 'lowpass', f: 3500, f2: 500, q: 0.8 }, send: 0.2 });
            S.tone(h, { type: 'sine', f: 110, f2: 42, dur: 0.3, g: 0.4, send: 0.05 });
            for (const f of [430, 1130, 2390, 3710]) S.tone(h + 0.01, { type: 'sine', f: f * rnd(0.05), dur: 0.35, g: 0.06, send: 0.2 });
        },
        castle(S, t) {
            for (let i = 0; i < 9; i++) S.noise(t + i * 0.034, { dur: 0.018, g: 0.16, filter: { type: 'bandpass', f: 3800, q: 2 }, send: 0.05 });
            S.engine(t + 0.34, { f0: 60, f1: 130, f2: 90, dur: 0.4, g: 0.1 });
        },
        check(S, t) { S.horn(t, 0.13, 0.12); S.horn(t + 0.2, 0.22, 0.12); },
        promote(S, t) {
            S.noise(t, { dur: 0.6, g: 0.25, a: 0.25, filter: { type: 'bandpass', f: 400, f2: 5000, q: 2 }, send: 0.25 });
            S.tone(t, { type: 'sawtooth', f: 200, f2: 1300, dur: 0.6, g: 0.08, filter: { type: 'lowpass', f: 2500 }, send: 0.2 });
            S.bell(t + 0.55, 1760, 1.2, 0.12);
        },
        illegal(S, t) { S.screech(t, 0.3, 0.2); },
        start(S, t) {
            for (let i = 0; i < 3; i++) S.tone(t + i * 0.55, { type: 'square', f: 440, dur: 0.18, hold: 0.14, d: 0.04, g: 0.07, filter: { type: 'lowpass', f: 2000 }, send: 0.15 });
            S.tone(t + 1.65, { type: 'square', f: 880, dur: 0.55, hold: 0.5, d: 0.08, g: 0.08, filter: { type: 'lowpass', f: 2600 }, send: 0.2 });
            S.engine(t + 1.7, { f0: 55, f1: 210, f2: 150, dur: 1.1, g: 0.14, peak: 0.6 });
            S.screech(t + 1.72, 0.4, 0.05);
        },
        win(S, t) {
            S.crowd(t, 3.4, 0.12);
            S.horn(t + 0.05, 0.12, 0.1); S.horn(t + 0.24, 0.2, 0.1);
            const beat = 0.24, st = t + 0.5;
            for (let i = 0; i < 12; i++) {
                if (i % 2 === 0) S.kick(st + i * beat, 0.35); else S.snare(st + i * beat, 0.16);
            }
            const riff = [['C5', 1], ['C5', 1], ['G4', 1], ['C5', 2], ['E5', 2], ['G5', 5]];
            let tt = st;
            for (const [n, k] of riff) { S.brass(tt, hz(n), k * beat * 0.95, 0.065, { bright: 3600 }); tt += k * beat; }
            S.chord(st + 7 * beat, ['C4', 'E4', 'G4'], (x, f) => S.brass(x, f, 5 * beat, 0.04));
            S.cymbal(st + 7 * beat, 2, 0.12);
            S.engine(t + 2.9, { f0: 70, f1: 220, f2: 180, dur: 0.9, g: 0.1, peak: 0.5 });
        },
        lose(S, t) {
            // Мотор чихает и глохнет
            let tt = t;
            const gaps = [0.1, 0.12, 0.15, 0.2, 0.27, 0.36];
            gaps.forEach((gap, i) => {
                S.engine(tt, { f0: 70 - i * 6, f1: 95 - i * 8, f2: 50 - i * 5, dur: 0.12, g: 0.12, peak: 0.3 });
                tt += gap;
            });
            S.noise(tt, { dur: 0.25, g: 0.12, filter: { type: 'lowpass', f: 500 }, send: 0.1 });
            // «Грустный тромбон»
            const tb = tt + 0.45;
            [['G3', 0.42], ['F#3', 0.42], ['F3', 0.42], ['E3', 1.4]].reduce((x, [n, d], i) => {
                S.tone(x, {
                    type: 'sawtooth', f: hz(n), dur: d, a: 0.04, hold: d * 0.75, d: d * 0.25, g: 0.12, send: 0.25,
                    vib: i === 3 ? 35 : 8, vibRate: i === 3 ? 5 : 4,
                    filter: { type: 'lowpass', f: 900, f2: 450, q: 3 }
                });
                return x + d;
            }, tb);
        },
        draw(S, t) {
            S.horn(t, 0.14, 0.08);
            S.chord(t + 0.3, ['C4', 'F4', 'A4'], (x, f) => S.brass(x, f, 0.9, 0.04));
            S.chord(t + 1.2, ['C4', 'E4', 'G4'], (x, f) => S.brass(x, f, 1.2, 0.04));
        }
    };

    const HOSPITAL = {
        select(S, t) { S.tone(t, { type: 'sine', f: 1250, dur: 0.05, g: 0.06, send: 0.1 }); },
        move(S, t) {
            S.tone(t, { type: 'sine', f: 640 * rnd(0.1), f2: 430, dur: 0.1, g: 0.3, send: 0.1 });
            S.tone(t + 0.16, { type: 'sine', f: 700 * rnd(0.1), f2: 470, dur: 0.09, g: 0.21, send: 0.1 });
        },
        capture(S, t) {
            S.tone(t, { type: 'sine', f: 900, f2: 180, dur: 0.16, g: 0.36, send: 0.08 });
            S.noise(t + 0.08, { dur: 0.4, g: 0.32, filter: { type: 'bandpass', f: 1800, f2: 280, q: 1.3 }, send: 0.25 });
            S.bell(t + 0.12, 1568, 0.6, 0.06);
        },
        castle(S, t) { S.noise(t, { dur: 0.36, g: 0.42, a: 0.12, filter: { type: 'bandpass', f: 500, f2: 2600, q: 1.8 }, send: 0.2 }); },
        check(S, t) { for (let i = 0; i < 3; i++) S.monitorBeep(t + i * 0.2, 0.14); },
        promote(S, t) {
            ['C6', 'E6', 'G6', 'C7', 'E7'].forEach((n, i) => S.bell(t + i * 0.06, hz(n), 0.9, 0.06, 0.5));
            S.noise(t, { dur: 0.5, g: 0.05, filter: { type: 'highpass', f: 6000 }, send: 0.4, a: 0.1 });
        },
        illegal(S, t) {
            for (let i = 0; i < 2; i++) S.tone(t + i * 0.15, { type: 'square', f: 140, dur: 0.11, hold: 0.08, d: 0.03, g: 0.08, filter: { type: 'lowpass', f: 900 }, send: 0.05 });
        },
        start(S, t) {
            // Сигнал больничного интеркома «динь-дон-дон»
            [['E5', 0], ['C5', 0.45], ['G4', 0.9]].forEach(([n, d]) => S.bell(t + d, hz(n), 1.6, 0.14, 0.4));
        },
        win(S, t) {
            [['E5', 0], ['C5', 0.32]].forEach(([n, d]) => S.bell(t + d, hz(n), 1.2, 0.1, 0.4));
            const st = t + 0.75;
            const tune = ['C5', 'E5', 'G5', 'C6', null, 'G5', 'C6', 'E6'];
            tune.forEach((n, i) => { if (n) S.marimba(st + i * 0.13, hz(n), 0.32); });
            S.chord(st + 1.05, ['C5', 'E5', 'G5'], (x, f) => S.marimba(x, f, 0.12));
            for (let i = 0; i < 8; i++) S.clap(st + 1.2 + i * 0.22 + Math.random() * 0.03, 0.17);
            S.crowd(st + 1.1, 2.2, 0.07);
            ['C7', 'E7', 'G7'].forEach((n, i) => S.bell(st + 1.1 + i * 0.07, hz(n), 1, 0.04, 0.5));
        },
        lose(S, t) {
            // Пульс замедляется — и линия на мониторе становится ровной
            [0, 0.55, 1.2].forEach((d) => S.monitorBeep(t + d, 0.13));
            S.tone(t + 2.0, { type: 'sine', f: 1000, dur: 2.4, a: 0.01, hold: 2.0, d: 0.4, g: 0.1, send: 0.15 });
            S.tone(t + 0.3, { type: 'sawtooth', f: 55, dur: 4, a: 1.2, hold: 1.8, d: 1.0, g: 0.05, filter: { type: 'lowpass', f: 300 }, send: 0.4 });
            S.tone(t + 0.3, { type: 'sawtooth', f: 58.3, dur: 4, a: 1.2, hold: 1.8, d: 1.0, g: 0.05, filter: { type: 'lowpass', f: 300 }, send: 0.4 });
            // Сбой-«аномалия»
            for (let i = 0; i < 10; i++) {
                const x = t + 1.4 + i * 0.045;
                S.tone(x, { type: 'square', f: 180 + Math.random() * 900, dur: 0.04, g: 0.035, send: 0.1, filter: { type: 'lowpass', f: 2500 } });
            }
            S.noise(t + 1.4, { dur: 0.5, g: 0.06, filter: { type: 'bandpass', f: 1200, q: 3 }, send: 0.3 });
        },
        draw(S, t) {
            [['G5', 0], ['E5', 0.4]].forEach(([n, d]) => S.bell(t + d, hz(n), 1.4, 0.1, 0.4));
            S.chord(t + 0.8, ['C5', 'E5', 'G5'], (x, f) => S.marimba(x, f, 0.12));
        }
    };

    const SFX = { classic: CLASSIC, cars: CARS, hospital: HOSPITAL };

    // ---------- Голос диктора ----------
    class Voice {
        constructor() {
            this.synth = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
            this.voice = null;
            this.enabled = store.get('chess-voice', true);
            this.onstart = null;
            this.onend = null;
            if (this.synth) {
                this.pick();
                if (typeof this.synth.addEventListener === 'function') {
                    this.synth.addEventListener('voiceschanged', () => this.pick());
                } else {
                    this.synth.onvoiceschanged = () => this.pick();
                }
            }
        }

        get available() { return !!this.synth; }

        pick() {
            try {
                const all = this.synth.getVoices() || [];
                const ru = all.filter((v) => /^ru/i.test(v.lang));
                const score = (v) => (/natural|online|neural/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) +
                    (/milena|irina|svetlana|dariya|yuri|pavel|dmitry/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
                ru.sort((a, b) => score(b) - score(a));
                this.voice = ru[0] || null;
            } catch (e) { this.voice = null; }
        }

        setEnabled(v) {
            this.enabled = v;
            store.set('chess-voice', v);
            if (!v) this.cancel();
        }

        /** iOS разрешает речь только из жеста пользователя — «будим» синтезатор беззвучной фразой. */
        prime() {
            if (this.primed || !this.synth || !this.enabled) return;
            this.primed = true;
            try {
                const u = new SpeechSynthesisUtterance(' ');
                u.volume = 0;
                this.synth.speak(u);
            } catch (e) { /* не критично */ }
        }

        say(text, o = {}) {
            if (!this.enabled || !this.synth || !text) return;
            const go = () => {
                try {
                    this.synth.cancel();
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = 'ru-RU';
                    if (this.voice) u.voice = this.voice;
                    u.rate = o.rate || 1;
                    u.pitch = o.pitch || 1;
                    u.volume = 1;
                    u.onstart = () => this.onstart && this.onstart();
                    u.onend = u.onerror = () => this.onend && this.onend();
                    this.synth.speak(u);
                } catch (e) { /* голос недоступен — просто молчим */ }
            };
            if (o.delay) setTimeout(go, o.delay); else go();
        }

        cancel() {
            try { if (this.synth) this.synth.cancel(); } catch (e) { /* ничего */ }
        }
    }

    // ---------- Звуковой движок ----------
    class SoundManager {
        constructor() {
            this.enabled = store.get('chess-sound', true);
            this.theme = 'classic';
            this.ctx = null;
            this.voice = new Voice();
            this.voice.onstart = () => this.duck(true);
            this.voice.onend = () => this.duck(false);
            const unlock = () => this.ensure();
            window.addEventListener('pointerdown', unlock, { passive: true });
            window.addEventListener('keydown', unlock);
        }

        ensure() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                try {
                    const ctx = new AC();
                    const comp = ctx.createDynamicsCompressor();
                    comp.threshold.value = -16;
                    comp.knee.value = 12;
                    comp.ratio.value = 3.5;
                    comp.attack.value = 0.004;
                    comp.release.value = 0.2;
                    this.master = ctx.createGain();
                    this.master.gain.value = 0.9;
                    this.master.connect(comp);
                    comp.connect(ctx.destination);
                    const dry = ctx.createGain();
                    dry.connect(this.master);
                    const conv = ctx.createConvolver();
                    conv.buffer = this.impulse(ctx, 2.4, 3);
                    const wet = ctx.createGain();
                    wet.gain.value = 0.6;
                    conv.connect(wet);
                    wet.connect(this.master);
                    this.ctx = ctx;
                    this.S = new Synth(ctx, dry, conv);
                } catch (e) {
                    this.ctx = null;
                    return null;
                }
            }
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            return this.ctx;
        }

        // Импульсный отклик для реверберации: затухающий стереошум
        impulse(ctx, seconds, decay) {
            const len = Math.floor(ctx.sampleRate * seconds);
            const buf = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = buf.getChannelData(ch);
                for (let i = 0; i < len; i++) {
                    const k = i / len;
                    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, decay) * (i < 400 ? i / 400 : 1);
                }
            }
            return buf;
        }

        duck(on) {
            if (!this.ctx || !this.master) return;
            const t = this.ctx.currentTime;
            this.master.gain.cancelScheduledValues(t);
            this.master.gain.setTargetAtTime(on ? 0.45 : 0.9, t, 0.15);
        }

        setTheme(key) { this.theme = SFX[key] ? key : 'classic'; }

        setEnabled(v) {
            this.enabled = v;
            store.set('chess-sound', v);
        }

        /** Сыграть звук name текущей вселенной (или общий звук интерфейса). */
        play(name, delay = 0) {
            if (!this.enabled) return;
            const ctx = this.ensure();
            if (!ctx) return;
            const fn = (SFX[this.theme] && SFX[this.theme][name]) || COMMON[name];
            if (!fn) return;
            try {
                fn(this.S, ctx.currentTime + 0.015 + delay);
            } catch (e) {
                /* звук не критичен для игры */
            }
        }

        say(text, o) { this.voice.say(text, o); }
    }

    window.SoundManager = SoundManager;
    window.SoundLib = { SFX, COMMON, Synth, hz };
})();
