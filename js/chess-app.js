/*
 * Шахматы: Мультивселенная — главный контроллер.
 * Правила — chess.js, соперник — js/ai.js, показ — CM.Board3D (или Board2D без WebGL),
 * звук и голос — js/sounds.js, эффекты — js/effects.js, тексты — js/themes.js.
 */
(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const other = (c) => (c === 'w' ? 'b' : 'w');

    const store = {
        get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим браузера */ } }
    };

    const DIFF_NAMES = { easy: 'Лёгкий', medium: 'Средний', hard: 'Тяжёлый' };
    const ROLE_NAMES = { k: 'Король', q: 'Ферзь', r: 'Ладья', b: 'Слон', n: 'Конь', p: 'Пешка' };
    const GLYPHS = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
    const PRESETS = [['normal', 'Обычный ракурс'], ['top', 'Вид сверху'], ['low', 'Кинематографичный ракурс']];

    function plural(n, one, few, many) {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
        return many;
    }

    function webglAvailable() {
        try {
            const c = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
        } catch (e) {
            return false;
        }
    }

    class ChessApp {
        constructor() {
            const savedTheme = store.get('chess-theme');
            this.theme = THEMES[savedTheme] ? savedTheme : 'classic';
            this.sound = new SoundManager();
            this.sound.setTheme(this.theme);
            this.fx = new Effects($('#fxCanvas'));
            this.ai = new ChessAI();
            this.hasWebGL = webglAvailable() && !!window.THREE && !!window.CM && !!CM.Board3D;
            this.sprites = this.hasWebGL ? new CM.SpriteMaker(176) : null;

            this.game = null;
            this.view = null;
            this.mode = null;
            this.difficulty = 'medium';
            this.humanColor = 'w';
            this.colorChoice = store.get('chess-color', 'w');
            this.autoFlip = store.get('chess-autoflip', '0') === '1';
            this.cameraPreset = store.get('chess-camera', 'normal');
            // Кинематографичные ходы — по желанию, спецэффекты взятия — по умолчанию включены
            this.cinematic = store.get('chess-cinema', '0') === '1';
            this.captureFx = store.get('chess-fx', '1') === '1';
            this.names = { w: 'Белые', b: 'Чёрные' };
            this.orientation = 'w';
            this.selected = null;
            this.targets = [];
            this.busy = false;
            this.thinking = false;
            this.over = null;
            this.pendingPromotion = null;
            this.gameToken = 0;
            this.aiToken = 0;
            this.lastStatus = '';

            this.fontsReady = this.loadFonts();
            this.bindUI();
            this.restoreInputs();
            this.applyTheme(this.theme, { silent: true });
            this.updateToggles();
            this.fontsReady.then(() => this.refreshSprites());
        }

        // ---------- Загрузка ----------
        loadFonts() {
            if (!document.fonts || !document.fonts.load) return Promise.resolve();
            const faces = ['700 40px "Playfair Display"', '400 40px "Russo One"', '700 40px Comfortaa', '800 20px Nunito', '900 40px Unbounded'];
            return Promise.race([
                Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))),
                sleep(2500)
            ]);
        }

        /** Картинка фигуры для интерфейса: снимок 3D-модели или символ, если 3D недоступно. */
        sprite(color, type, theme = this.theme) {
            if (this.sprites) {
                try { return this.sprites.get(theme, color, type); } catch (e) { console.warn('Снимок фигуры не получился', e); }
            }
            const glyph = GLYPHS[color][type];
            const fill = color === 'w' ? '#fffaf0' : '#20150d';
            const stroke = color === 'w' ? '#3b2a1a' : '#f0e0c0';
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="80" font-size="84" text-anchor="middle" fill="${fill}" stroke="${stroke}" stroke-width="2.5" font-family="serif">${glyph}</text></svg>`;
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        }

        /** Обновить все картинки фигур в меню и на экранах настройки (по одной, не блокируя интерфейс). */
        async refreshSprites() {
            const jobs = [];
            for (const card of $$('.universe-card')) {
                const th = card.dataset.theme;
                jobs.push([card.querySelector('.uc-white'), 'w', 'k', th]);
                jobs.push([card.querySelector('.uc-black'), 'b', 'k', th]);
            }
            for (const img of $$('[data-sprite]')) jobs.push([img, img.dataset.sprite[0], img.dataset.sprite[1], null]);
            // Сначала — текущая вселенная
            jobs.sort((a, b) => (b[3] === this.theme || !b[3]) - (a[3] === this.theme || !a[3]));
            for (const [img, color, type, th] of jobs) {
                const url = this.sprite(color, type, th || this.theme);
                if (img.getAttribute('src') !== url) img.src = url;
                await sleep(0);
            }
        }

        // ---------- Интерфейс ----------
        bindUI() {
            // Меню
            $$('.universe-card').forEach((card) => card.addEventListener('click', () => this.chooseTheme(card.dataset.theme)));
            $('#pveBtn').addEventListener('click', () => { this.saveName(); this.showScreen('pve'); });
            $('#pvpBtn').addEventListener('click', () => {
                this.saveName();
                const w = $('#whiteName'), typed = $('#playerName').value.trim();
                if (!w.value.trim() && typed) w.value = typed;
                this.showScreen('pvp');
            });
            $('#playerName').addEventListener('change', () => this.saveName());
            $('#playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#pveBtn').click(); });
            $$('[data-back]').forEach((b) => b.addEventListener('click', () => this.showScreen('menu')));

            // Игра с компьютером
            $$('#colorChoice button').forEach((b) => b.addEventListener('click', () => {
                this.colorChoice = b.dataset.color;
                store.set('chess-color', this.colorChoice);
                this.updateToggles();
            }));
            $$('.difficulty-card').forEach((b) => b.addEventListener('click', () => {
                this.sound.voice.prime();
                this.startGame('pve', b.dataset.difficulty);
            }));

            // Игра вдвоём
            $('#autoFlip').addEventListener('change', (e) => { this.autoFlip = e.target.checked; store.set('chess-autoflip', this.autoFlip ? '1' : '0'); });
            $('#pvpStartBtn').addEventListener('click', () => {
                this.sound.voice.prime();
                this.startGame('pvp');
            });

            // Партия
            $('#undoBtn').addEventListener('click', () => this.undo());
            $('#flipBtn').addEventListener('click', () => this.flip());
            $('#viewBtn').addEventListener('click', () => this.cycleCamera());
            $('#newGameBtn').addEventListener('click', () => this.newGame());
            $('#resignBtn').addEventListener('click', () => this.resign());
            $('#menuBtn').addEventListener('click', () => this.backToMenu());
            $('#brandBtn').addEventListener('click', () => this.backToMenu());
            $$('.theme-switch button').forEach((b) => b.addEventListener('click', () => this.chooseTheme(b.dataset.theme)));

            // Итоги
            $('#againBtn').addEventListener('click', () => { this.hideResult(); this.startGame(this.mode, this.difficulty, true); });
            $('#reviewBtn').addEventListener('click', () => this.hideResult());
            $('#resultMenuBtn').addEventListener('click', () => { this.hideResult(); this.backToMenu(true); });

            // Звук, голос, полный экран
            $('#soundBtn').addEventListener('click', () => {
                this.sound.setEnabled(!this.sound.enabled);
                this.updateToggles();
                this.toast(this.sound.enabled ? 'Звуковые эффекты включены' : 'Звуковые эффекты выключены');
                if (this.sound.enabled) this.sound.play('uiClick');
            });
            $('#voiceBtn').addEventListener('click', () => {
                if (!this.sound.voice.available) { this.toast('В этом браузере нет синтеза речи'); return; }
                this.sound.voice.setEnabled(!this.sound.voice.enabled);
                this.updateToggles();
                this.toast(this.sound.voice.enabled ? 'Голос диктора включён' : 'Голос диктора выключен');
                if (this.sound.voice.enabled) this.sound.say('Диктор на месте!', { rate: 1.05 });
            });
            $('#fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

            // Камера
            $$('#camControls [data-cam]').forEach((b) => b.addEventListener('click', () => this.cameraAction(b.dataset.cam)));
            $('#cineBtn').addEventListener('click', () => this.setCinematic(!this.cinematic, true));
            document.addEventListener('keydown', (e) => {
                if (document.body.dataset.screen !== 'game' || !this.hasWebGL || !this.view || e.ctrlKey || e.metaKey || e.altKey) return;
                if (e.target.closest && e.target.closest('input, textarea, select') || $$('.modal').some((m) => !m.hidden)) return;
                const act = { ArrowLeft: 'left', ArrowRight: 'right', '+': 'in', '=': 'in', '-': 'out', '_': 'out', '0': 'reset' }[e.key];
                if (!act) return;
                e.preventDefault();
                this.cameraAction(act);
            });

            // Настройки
            $('#settingsBtn').addEventListener('click', () => this.openSettings());
            $('#settingsClose').addEventListener('click', () => this.closeSettings());
            $('#settingsModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) this.closeSettings(); });
            $('#setCinema').addEventListener('change', (e) => this.setCinematic(e.target.checked));
            $('#setFx').addEventListener('change', (e) => this.setCaptureFx(e.target.checked));
            $('#setSound').addEventListener('change', (e) => {
                this.sound.setEnabled(e.target.checked);
                this.updateToggles();
                if (this.sound.enabled) this.sound.play('uiClick');
            });
            $('#setVoice').addEventListener('change', (e) => {
                if (!this.sound.voice.available) return;
                this.sound.voice.setEnabled(e.target.checked);
                this.updateToggles();
                if (this.sound.voice.enabled) this.sound.say('Диктор на месте!', { rate: 1.05 });
            });

            // Модальные окна
            $('#promoCancel').addEventListener('click', () => this.closePromotion(null));
            $('#confirmYes').addEventListener('click', () => this.closeConfirm(true));
            $('#confirmNo').addEventListener('click', () => this.closeConfirm(false));
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                if (!$('#settingsModal').hidden) this.closeSettings();
                else if (this.pendingPromotion) this.closePromotion(null);
                else if (this.confirmResolve) this.closeConfirm(false);
                else if (!$('#resultModal').hidden) this.hideResult();
                else if (this.selected) this.deselect();
            });

            // Звуки интерфейса
            const uiSel = '.btn, .tile-btn, .universe-card, .difficulty-card, .icon-btn, .segmented button, .theme-switch button, .promo-grid button, .brand';
            document.addEventListener('pointerover', (e) => {
                if (e.pointerType !== 'mouse') return;
                const el = e.target.closest(uiSel);
                if (el && el !== this.hovered && !el.disabled) { this.hovered = el; this.sound.play('uiHover'); }
                if (!el) this.hovered = null;
            });
            document.addEventListener('click', (e) => {
                const el = e.target.closest(uiSel);
                if (el && !el.disabled && !el.matches('#soundBtn')) this.sound.play('uiClick');
            });
        }

        restoreInputs() {
            const name = store.get('chess-player-name', '');
            $('#playerName').value = name;
            $('#whiteName').value = store.get('chess-pvp-white', '') || name;
            $('#blackName').value = store.get('chess-pvp-black', '');
            $('#autoFlip').checked = this.autoFlip;
        }

        playerName() { return $('#playerName').value.trim() || 'Игрок'; }

        saveName() { store.set('chess-player-name', $('#playerName').value.trim()); }

        updateToggles() {
            $('#soundBtn').setAttribute('aria-pressed', String(this.sound.enabled));
            const v = $('#voiceBtn');
            v.setAttribute('aria-pressed', String(this.sound.voice.available && this.sound.voice.enabled));
            if (!this.sound.voice.available) v.title = 'Голос диктора недоступен в этом браузере';
            $$('#colorChoice button').forEach((b) => {
                const on = b.dataset.color === this.colorChoice;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-checked', String(on));
            });
            $('#cineBtn').setAttribute('aria-pressed', String(this.cinematic));
            $('#setCinema').checked = this.cinematic;
            $('#setFx').checked = this.captureFx;
            $('#setSound').checked = this.sound.enabled;
            $('#setVoice').checked = this.sound.voice.available && this.sound.voice.enabled;
            $('#setVoice').disabled = !this.sound.voice.available;
        }

        openSettings() {
            this.updateToggles();
            $('#settingsModal').hidden = false;
            setTimeout(() => $('#settingsClose').focus({ preventScroll: true }), 50);
        }

        closeSettings() {
            $('#settingsModal').hidden = true;
        }

        setCinematic(on, announce = false) {
            this.cinematic = !!on;
            store.set('chess-cinema', this.cinematic ? '1' : '0');
            this.updateToggles();
            if (announce) this.toast(this.cinematic ? '🎬 Кинематографичные ходы включены' : 'Кинематографичные ходы выключены', 1600);
        }

        setCaptureFx(on) {
            this.captureFx = !!on;
            store.set('chess-fx', this.captureFx ? '1' : '0');
            if (this.view && this.view.setOptions) this.view.setOptions({ captureFx: this.captureFx });
            this.updateToggles();
        }

        /** Кнопки и клавиши камеры: повороты на 45°, приближение, обычный вид. */
        cameraAction(act) {
            const v = this.view;
            if (!v || !v.rotateBy) return;
            if (act === 'left') v.rotateBy(-Math.PI / 4);
            else if (act === 'right') v.rotateBy(Math.PI / 4);
            else if (act === 'in') v.zoomBy(0.75);
            else if (act === 'out') v.zoomBy(1 / 0.75);
            else if (act === 'reset') v.resetView();
        }

        showScreen(name) {
            document.body.dataset.screen = name;
            $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === name + 'Screen'));
            window.scrollTo(0, 0);
        }

        toast(text, ms = 2200) {
            const t = $('#toast');
            t.textContent = text;
            t.classList.add('show');
            clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
        }

        toggleFullscreen() {
            const d = document;
            try {
                if (!d.fullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen).call(d.documentElement);
                else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
            } catch (e) {
                this.toast('Полноэкранный режим недоступен');
            }
        }

        // ---------- Вселенные ----------
        async chooseTheme(key) {
            if (key === this.theme) return;
            const inGame = document.body.dataset.screen === 'game' && this.view && this.game;
            this.sound.play('portal');
            const wipe = $('#portalWipe');
            wipe.classList.remove('run');
            void wipe.offsetWidth;
            wipe.classList.add('run');
            if (inGame) await sleep(380);
            await this.applyTheme(key);
            if (inGame) this.toast(`Вселенная: ${THEMES[key].name}`);
        }

        async applyTheme(key, o = {}) {
            this.theme = key;
            store.set('chess-theme', key);
            document.body.dataset.theme = key;
            this.sound.setTheme(key);
            $$('.universe-card').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.theme === key)));
            $$('.theme-switch button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === key)));
            $$('[data-side]').forEach((el) => { el.textContent = THEMES[key].sides[el.dataset.side]; });
            if (!o.silent) this.refreshSprites();
            if (this.view && this.game && document.body.dataset.screen === 'game') {
                await this.fontsReady;
                this.view.setTheme(key);
                this.view.setPosition(this.game.board());
                this.syncBoardMarks();
                this.lastStatus = '';
                this.updateAll();
            }
        }

        // ---------- Партия ----------
        ensureView() {
            if (this.view) return this.view;
            const host = $('#board3d');
            const handlers = {
                down: (sq) => this.onDown(sq),
                up: (sq, start) => this.onUp(sq, start),
                drop: (from, to) => this.onDrop(from, to),
                canPick: (sq) => this.canPick(sq)
            };
            if (this.hasWebGL) {
                try {
                    const quality = new URLSearchParams(location.search).get('quality');
                    this.view = new CM.Board3D(host, handlers, { quality });
                    this.view.preset = this.cameraPreset;
                    this.view.setOptions({ captureFx: this.captureFx });
                } catch (e) {
                    console.warn('3D недоступно', e);
                    this.view = null;
                    this.hasWebGL = false;
                }
            }
            if (!this.view) {
                this.view = new Board2D(host, handlers);
                $('#viewBtn').disabled = true;
                $('#camControls').hidden = true;
                this.toast('3D-режим недоступен в этом браузере — включена плоская доска', 4000);
            }
            return this.view;
        }

        async startGame(mode, difficulty, again = false) {
            this.mode = mode;
            if (difficulty) this.difficulty = difficulty;
            const name = this.playerName();
            if (mode === 'pve') {
                this.humanColor = this.colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : this.colorChoice;
                this.names = {};
                this.names[this.humanColor] = name;
                this.names[other(this.humanColor)] = `Компьютер · ${DIFF_NAMES[this.difficulty]}`;
                this.orientation = this.humanColor;
            } else {
                if (!again) {
                    const w = $('#whiteName').value.trim() || name, b = $('#blackName').value.trim() || 'Игрок 2';
                    store.set('chess-pvp-white', w);
                    store.set('chess-pvp-black', b);
                    this.names = { w, b };
                }
                this.humanColor = 'w';
                this.orientation = 'w';
            }
            this.cancelAI();
            const token = ++this.gameToken;
            this.game = new Chess();
            this.over = null;
            this.selected = null;
            this.targets = [];
            this.busy = false;
            this.thinking = false;
            this.startedAt = Date.now();
            this.lastStatus = '';
            document.body.classList.remove('is-gloom');
            this.fx.clear();

            this.showScreen('game');
            const loading = $('#boardLoading');
            loading.classList.remove('is-hidden');
            await this.fontsReady;
            await nextFrame();
            if (token !== this.gameToken) return;
            const view = this.ensureView();
            view.setTheme(this.theme);
            if (view.setPreset) view.setPreset(this.cameraPreset, false);
            view.setOrientation(this.orientation, false);
            view.setPosition(this.game.board());
            view.setHighlights({ selected: null, targets: [], last: null, hover: null });
            view.showCheck(null);
            loading.classList.add('is-hidden');
            if (token !== this.gameToken) return;

            this.updateAll();
            if (this.hasWebGL && store.get('chess-cam-hint') !== '1') {
                store.set('chess-cam-hint', '1');
                const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
                const hint = touch
                    ? 'Доску можно крутить: веди пальцем мимо фигур. Два пальца — приблизить и повернуть'
                    : 'Доску можно крутить: тяни мимо фигур или правой кнопкой. Колёсико — приблизить';
                setTimeout(() => { if (token === this.gameToken) this.toast(hint, 4500); }, 1500);
            }
            const T = THEMES[this.theme];
            this.sound.play('start');
            this.sound.say(T.voice.start, { rate: T.voice.rate, pitch: T.voice.pitch, delay: 350 });
            if (this.isAITurn()) this.scheduleAI(this.theme === 'cars' ? 2300 : 1200);
        }

        async newGame() {
            if (!this.game) return;
            if (this.game.history().length && !this.over && !(await this.confirm('Начать новую партию? Текущая будет потеряна.'))) return;
            this.hideResult();
            this.startGame(this.mode, this.difficulty, true);
        }

        async backToMenu(force = false) {
            if (document.body.dataset.screen !== 'game') { this.showScreen('menu'); return; }
            if (!force && this.game && this.game.history().length && !this.over &&
                !(await this.confirm('Выйти в меню? Текущая партия будет потеряна.'))) return;
            this.cancelAI();
            this.gameToken++;
            this.hideResult();
            this.fx.clear();
            document.body.classList.remove('is-gloom');
            this.sound.voice.cancel();
            this.showScreen('menu');
        }

        isHumanTurn() {
            return this.mode === 'pvp' || (this.game && this.game.turn() === this.humanColor);
        }

        isAITurn() {
            return this.mode === 'pve' && this.game && !this.over && this.game.turn() !== this.humanColor;
        }

        canInteract() {
            return !!this.game && !this.over && !this.thinking && !this.busy && !this.pendingPromotion && this.isHumanTurn();
        }

        canPick(sq) {
            if (!this.canInteract() || !sq) return false;
            const p = this.game.get(sq);
            return !!p && p.color === this.game.turn();
        }

        // ---------- Ввод ----------
        onDown(sq) {
            this.pressWasSelected = !!sq && sq === this.selected;
            if (!this.canInteract()) {
                if (this.game && !this.over && sq && this.thinking) this.toast('Подожди, соперник думает…', 1200);
                return false;
            }
            if (!sq) { this.deselect(); return false; }
            if (this.selected && this.targets.some((m) => m.to === sq)) {
                this.tryMove(this.selected, sq, false);
                return false;
            }
            const p = this.game.get(sq);
            if (p && p.color === this.game.turn()) {
                if (sq !== this.selected) this.select(sq);
                return true;
            }
            if (this.selected) this.deselect();
            return false;
        }

        onUp(sq, startSq) {
            if (this.pressWasSelected && sq && sq === startSq && sq === this.selected) this.deselect();
        }

        onDrop(from, to) {
            if (!this.canInteract()) return false;
            const ok = this.game.moves({ square: from, verbose: true }).some((m) => m.to === to);
            if (!ok) {
                this.sound.play('illegal');
                return false;
            }
            return this.tryMove(from, to, true);
        }

        select(sq) {
            this.selected = sq;
            this.targets = this.game.moves({ square: sq, verbose: true });
            const seen = new Set();
            const marks = [];
            for (const m of this.targets) {
                if (seen.has(m.to)) continue;
                seen.add(m.to);
                marks.push({ sq: m.to, capture: !!m.captured });
            }
            this.view.setHighlights({ selected: sq, targets: marks });
            this.sound.play('select');
            const p = this.game.get(sq);
            const T = THEMES[this.theme];
            const pn = T.pieceNames[p.color][p.type];
            $('#pieceHint').textContent = this.theme === 'classic'
                ? `${pn} · ${marks.length ? plural(marks.length, 'доступен', 'доступно', 'доступно') + ' ' + marks.length + ' ' + plural(marks.length, 'ход', 'хода', 'ходов') : 'ходов нет'}`
                : `${pn} — ${ROLE_NAMES[p.type].toLowerCase()}`;
            if (!marks.length) this.sound.play('illegal');
        }

        deselect() {
            this.selected = null;
            this.targets = [];
            if (this.view) this.view.setHighlights({ selected: null, targets: [] });
            $('#pieceHint').textContent = '';
        }

        tryMove(from, to, dragged) {
            const moves = this.game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
            if (!moves.length) return false;
            if (moves[0].promotion) {
                this.askPromotion(moves[0].color).then((type) => {
                    if (!type) {
                        if (dragged && this.view.returnPiece) this.view.returnPiece(from);
                        this.deselect();
                        return;
                    }
                    this.commitMove({ from, to, promotion: type }, dragged);
                });
                return 'pending';
            }
            this.commitMove({ from, to }, dragged);
            return true;
        }

        /** Звук начала хода; удар при взятии звучит отдельно — в момент столкновения фигур. */
        playMoveSound(move) {
            if (move.promotion) this.sound.play('promote');
            else if (move.flags.includes('k') || move.flags.includes('q')) this.sound.play('castle');
            else this.sound.play('move');
        }

        async commitMove(input, dragged) {
            let move;
            try {
                move = this.game.move(input);
            } catch (e) {
                this.sound.play('illegal');
                return false;
            }
            if (!move) return false;
            const token = this.gameToken;
            this.selected = null;
            this.targets = [];
            $('#pieceHint').textContent = '';
            this.busy = true;
            this.view.setHighlights({ selected: null, targets: [], last: { from: move.from, to: move.to }, hover: null });
            this.view.showCheck(null);
            this.updatePlayers();
            const live = () => token === this.gameToken;
            const cinematic = this.cinematic && this.hasWebGL && !dragged;
            document.body.classList.toggle('is-cine', cinematic);
            try {
                await this.view.applyMove(move, {
                    dragged,
                    board: this.game.board(),
                    cinematic,
                    onStart: () => { if (live()) this.playMoveSound(move); },
                    onImpact: () => {
                        if (!live()) return;
                        this.sound.play('hit');
                        if (this.captureFx && this.hasWebGL) this.sound.play('impact');
                    },
                    onFx: (name) => { if (live()) this.sound.play(name); }
                });
            } catch (e) {
                console.warn(e);
                this.view.setPosition(this.game.board());
            }
            document.body.classList.remove('is-cine');
            if (token !== this.gameToken) return true;
            this.busy = false;
            this.afterMove();
            return true;
        }

        afterMove() {
            this.updateHistory();
            this.updatePlayers();
            this.updateControls();
            if (this.game.isGameOver()) {
                this.finishGame();
                return;
            }
            const T = THEMES[this.theme];
            if (this.game.isCheck()) {
                this.view.showCheck(this.findKing(this.game.turn()));
                this.sound.play('check', 0.05);
                this.banner(T.texts.checkBanner, 'check');
                this.sound.say(T.voice.check, { rate: T.voice.rate, pitch: T.voice.pitch, delay: 250 });
            }
            if (this.mode === 'pvp' && this.autoFlip) this.setOrientation(this.game.turn());
            this.updateStatus();
            if (this.isAITurn()) this.scheduleAI(300);
        }

        // ---------- Компьютер ----------
        uciHistory() {
            return this.game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''));
        }

        async scheduleAI(delay = 300) {
            const token = ++this.aiToken;
            const gameToken = this.gameToken;
            this.thinking = true;
            this.updatePlayers();
            this.updateStatus();
            this.updateControls();
            const started = performance.now();
            await sleep(delay);
            if (token !== this.aiToken || gameToken !== this.gameToken) return;
            let res = null;
            try {
                res = await this.ai.think({ moves: this.uciHistory(), level: this.difficulty });
            } catch (e) {
                console.warn('Ошибка ИИ', e);
            }
            if (token !== this.aiToken || gameToken !== this.gameToken) return;
            const elapsed = performance.now() - started;
            if (elapsed < 700) await sleep(700 - elapsed);
            if (token !== this.aiToken || gameToken !== this.gameToken) return;
            this.thinking = false;
            if (!res) {
                const moves = this.game.moves({ verbose: true });
                if (!moves.length) return;
                res = moves[Math.floor(Math.random() * moves.length)];
            }
            this.commitMove({ from: res.from, to: res.to, promotion: res.promotion }, false);
        }

        cancelAI() {
            this.aiToken++;
            this.thinking = false;
            this.ai.cancel();
        }

        // ---------- Кнопки партии ----------
        canUndo() {
            if (!this.game || this.pendingPromotion) return false;
            const n = this.game.history().length;
            if (!n) return false;
            if (this.mode === 'pve' && this.game.turn() === this.humanColor && n < 2) return false;
            return true;
        }

        undo() {
            if (!this.canUndo()) return;
            let n = 1;
            if (this.mode === 'pve' && this.game.turn() === this.humanColor) n = 2;
            this.cancelAI();
            this.gameToken++;
            for (let i = 0; i < n; i++) this.game.undo();
            this.over = null;
            this.busy = false;
            this.selected = null;
            this.targets = [];
            this.hideResult();
            this.fx.clear();
            document.body.classList.remove('is-gloom');
            this.view.setPosition(this.game.board());
            this.syncBoardMarks();
            this.lastStatus = '';
            this.updateAll();
            this.toast(n === 2 ? 'Отменены твой ход и ответ соперника' : 'Ход отменён', 1500);
        }

        flip() {
            if (!this.view) return;
            this.setOrientation(other(this.orientation));
        }

        setOrientation(color) {
            this.orientation = color;
            this.view.setOrientation(color, true);
            this.updatePlayers();
        }

        cycleCamera() {
            if (!this.view || !this.view.setPreset) return;
            const i = PRESETS.findIndex(([k]) => k === this.cameraPreset);
            const [key, label] = PRESETS[(i + 1) % PRESETS.length];
            this.cameraPreset = key;
            store.set('chess-camera', key);
            this.view.setPreset(key);
            this.toast(label, 1400);
        }

        async resign() {
            if (!this.game || this.over) return;
            const who = this.mode === 'pve' ? this.humanColor : this.game.turn();
            const q = this.mode === 'pve' ? 'Сдаться и признать поражение?' : `${this.names[who]} сдаётся?`;
            if (!(await this.confirm(q))) return;
            if (this.over) return;
            this.cancelAI();
            this.finishGame({ type: 'resign', winner: other(who) });
        }

        // ---------- Конец партии ----------
        findKing(color) {
            const b = this.game.board();
            for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
                const p = b[r][f];
                if (p && p.type === 'k' && p.color === color) return 'abcdefgh'[f] + (8 - r);
            }
            return null;
        }

        async finishGame(forced) {
            const g = this.game;
            let result;
            if (forced) result = forced;
            else if (g.isCheckmate()) result = { type: 'mate', winner: other(g.turn()) };
            else if (g.isStalemate()) result = { type: 'draw', reason: 'Пат' };
            else if (g.isInsufficientMaterial()) result = { type: 'draw', reason: 'Недостаточно фигур для мата' };
            else if (g.isThreefoldRepetition()) result = { type: 'draw', reason: 'Троекратное повторение позиции' };
            else result = { type: 'draw', reason: 'Правило 50 ходов' };
            this.over = result;
            this.thinking = false;
            this.deselect();
            this.updatePlayers();
            this.updateControls();
            this.updateStatus();
            const token = this.gameToken;
            const T = THEMES[this.theme];
            let outcome;
            if (result.type === 'draw') outcome = 'draw';
            else if (this.mode === 'pve') outcome = result.winner === this.humanColor ? 'win' : 'lose';
            else outcome = 'win';

            if (result.type === 'mate') {
                const k = this.findKing(g.turn());
                this.view.showCheck(k);
                this.sound.play('check');
                this.banner(T.texts.mateBanner, 'mate');
                this.fx.shake($('#boardStage'), true);
                this.view.showMate(k, result.winner);
                await sleep(1300);
            } else {
                await sleep(450);
            }
            if (token !== this.gameToken) return;

            this.sound.play(outcome);
            const winnerName = result.winner ? this.names[result.winner] : '';
            let line;
            if (outcome === 'draw') line = T.voice.draw;
            else if (this.mode === 'pvp') line = T.voice.pvpWin(winnerName);
            else if (result.type === 'resign') line = outcome === 'win' ? T.voice.resignWin : T.voice.resignLose;
            else line = outcome === 'win' ? T.voice.win : T.voice.lose;
            this.sound.say(line, { rate: T.voice.rate, pitch: T.voice.pitch, delay: outcome === 'lose' ? 1500 : 1000 });

            if (outcome === 'win') {
                this.fx.confetti(this.theme);
                setTimeout(() => { if (token === this.gameToken) this.fx.confetti(this.theme, { count: 90 }); }, 1400);
            } else if (outcome === 'lose') {
                document.body.classList.add('is-gloom');
                this.fx.ash();
            }
            this.showResult(outcome, result);
        }

        showResult(outcome, result) {
            const T = THEMES[this.theme];
            const modal = $('#resultModal');
            modal.classList.remove('is-win', 'is-lose', 'is-draw');
            modal.classList.add('is-' + outcome);
            let title, sub;
            if (outcome === 'draw') {
                title = T.texts.draw.title;
                sub = `${result.reason}. ${T.texts.draw.sub}`;
            } else if (this.mode === 'pvp') {
                title = T.texts.pvpWin.title;
                sub = result.type === 'resign'
                    ? `${this.names[other(result.winner)]} сдаётся. ${this.names[result.winner]} — победитель!`
                    : T.texts.pvpWin.sub(this.names[result.winner]);
            } else if (outcome === 'win') {
                title = T.texts.win.title;
                sub = result.type === 'resign' ? 'Соперник признал поражение!' : T.texts.win.sub;
            } else {
                title = T.texts.lose.title;
                sub = result.type === 'resign' ? 'Партия сдана — в следующий раз получится!' : T.texts.lose.sub;
            }
            // Буквы вылетают по одной; слова не разрываются при переносе строки
            const titleEl = $('#resultTitle');
            titleEl.textContent = '';
            let li = 0;
            title.split(' ').forEach((word, wi) => {
                if (wi) titleEl.appendChild(document.createTextNode(' '));
                const w = document.createElement('span');
                w.className = 'word';
                for (const ch of word) {
                    const s = document.createElement('span');
                    s.className = 'ch';
                    s.textContent = ch;
                    s.style.animationDelay = (0.25 + li++ * 0.05) + 's';
                    w.appendChild(s);
                }
                titleEl.appendChild(w);
            });
            const winner = result.winner || 'w';
            $('#resultHero').src = this.sprite(winner, 'k');
            $('#resultLoser').src = this.sprite(other(winner), 'k');
            const moves = Math.ceil(this.game.history().length / 2);
            const secs = Math.round((Date.now() - (this.startedAt || Date.now())) / 1000);
            const stats = [`${moves} ${plural(moves, 'ход', 'хода', 'ходов')}`, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`];
            if (this.mode === 'pve') stats.push(`Уровень: ${DIFF_NAMES[this.difficulty]}`);
            $('#resultStats').replaceChildren(...stats.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }));
            $('#resultSub').textContent = '';
            modal.hidden = false;
            this.fx.type($('#resultSub'), sub, { speed: 32, every: 2, onChar: () => this.sound.play('type') });
            setTimeout(() => { if (!modal.hidden) $('#againBtn').focus({ preventScroll: true }); }, 400);
        }

        hideResult() {
            $('#resultModal').hidden = true;
        }

        // ---------- Модальные окна ----------
        askPromotion(color) {
            return new Promise((resolve) => {
                this.pendingPromotion = { resolve };
                const grid = $('#promoGrid');
                const T = THEMES[this.theme];
                grid.replaceChildren();
                for (const t of ['q', 'r', 'b', 'n']) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    const img = document.createElement('img');
                    img.src = this.sprite(color, t);
                    img.alt = '';
                    const name = document.createElement('span');
                    name.className = 'pn';
                    name.textContent = T.pieceNames[color][t];
                    b.append(img, name);
                    if (this.theme !== 'classic') {
                        const role = document.createElement('span');
                        role.className = 'pr';
                        role.textContent = ROLE_NAMES[t];
                        b.append(role);
                    }
                    b.addEventListener('click', () => this.closePromotion(t));
                    grid.appendChild(b);
                }
                $('#promotionModal').hidden = false;
                setTimeout(() => { const f = grid.querySelector('button'); if (f) f.focus({ preventScroll: true }); }, 50);
                this.updateControls();
            });
        }

        closePromotion(type) {
            const p = this.pendingPromotion;
            if (!p) return;
            this.pendingPromotion = null;
            $('#promotionModal').hidden = true;
            this.updateControls();
            p.resolve(type);
        }

        confirm(text) {
            return new Promise((resolve) => {
                if (this.confirmResolve) this.confirmResolve(false);
                this.confirmResolve = resolve;
                $('#confirmText').textContent = text;
                $('#confirmModal').hidden = false;
                setTimeout(() => $('#confirmNo').focus({ preventScroll: true }), 50);
            });
        }

        closeConfirm(v) {
            const r = this.confirmResolve;
            this.confirmResolve = null;
            $('#confirmModal').hidden = true;
            if (r) r(v);
        }

        banner(text, kind) {
            const b = $('#banner');
            b.textContent = text;
            b.className = 'banner ' + (kind === 'mate' ? 'is-mate' : 'is-check');
            void b.offsetWidth;
            b.classList.add('show');
        }

        // ---------- Отрисовка состояния ----------
        updateAll() {
            this.updatePlayers();
            this.updateHistory();
            this.updateStatus();
            this.updateControls();
        }

        syncBoardMarks() {
            const hist = this.game.history({ verbose: true });
            const last = hist[hist.length - 1];
            this.view.setHighlights({ selected: null, targets: [], last: last ? { from: last.from, to: last.to } : null, hover: null });
            this.view.showCheck(this.game.isCheck() ? this.findKing(this.game.turn()) : null);
        }

        capturedBy(color) {
            const list = [];
            for (const m of this.game.history({ verbose: true })) {
                if (m.captured && m.color === color) list.push(m.captured);
            }
            return list.sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a]);
        }

        material(color) {
            let s = 0;
            for (const row of this.game.board()) for (const p of row) if (p && p.color === color) s += PIECE_VALUES[p.type];
            return s;
        }

        updatePlayers() {
            if (!this.game) return;
            const T = THEMES[this.theme];
            const bottom = this.orientation, top = other(bottom);
            for (const [id, color] of [['#bottomPlayer', bottom], ['#topPlayer', top]]) {
                const card = $(id);
                const avatar = card.querySelector('.pc-avatar');
                const url = this.sprite(color, 'k');
                if (avatar.getAttribute('src') !== url) avatar.src = url;
                card.querySelector('.pc-name').textContent = this.names[color];
                const isAI = this.mode === 'pve' && color !== this.humanColor;
                card.querySelector('.pc-sub').textContent = `${T.sides[color]}${this.theme === 'classic' ? '' : color === 'w' ? ' · белые' : ' · чёрные'}${isAI ? '' : this.mode === 'pve' ? ' · это ты' : ''}`;
                card.classList.toggle('is-turn', !this.over && this.game.turn() === color);
                card.classList.toggle('is-thinking', this.thinking && isAI);
                const cap = card.querySelector('.pc-captured');
                const pieces = this.capturedBy(color);
                const frag = document.createDocumentFragment();
                for (const t of pieces) {
                    const img = document.createElement('img');
                    img.src = this.sprite(other(color), t);
                    img.alt = T.pieceNames[other(color)][t];
                    img.title = img.alt;
                    frag.appendChild(img);
                }
                const adv = this.material(color) - this.material(other(color));
                if (adv > 0) {
                    const s = document.createElement('span');
                    s.className = 'adv';
                    s.textContent = '+' + adv;
                    frag.appendChild(s);
                }
                cap.replaceChildren(frag);
            }
        }

        updateHistory() {
            if (!this.game) return;
            const list = $('#moveList');
            const moves = this.game.history();
            list.replaceChildren();
            if (!moves.length) {
                const li = document.createElement('li');
                const s = document.createElement('span');
                s.className = 'empty';
                s.textContent = 'Ходов пока нет — начинают белые';
                li.appendChild(s);
                list.appendChild(li);
            }
            for (let i = 0; i < moves.length; i += 2) {
                const li = document.createElement('li');
                const n = document.createElement('span');
                n.className = 'mn';
                n.textContent = (i / 2 + 1) + '.';
                li.appendChild(n);
                for (const j of [i, i + 1]) {
                    const s = document.createElement('span');
                    s.className = 'mv';
                    if (j < moves.length) {
                        s.textContent = toRussianSan(moves[j]);
                        if (j === moves.length - 1) s.classList.add('is-last');
                    }
                    li.appendChild(s);
                }
                list.appendChild(li);
            }
            list.scrollTop = list.scrollHeight;
            const full = Math.ceil(moves.length / 2);
            $('#moveCount').textContent = moves.length ? `${full} ${plural(full, 'ход', 'хода', 'ходов')}` : '';
        }

        updateStatus() {
            if (!this.game) return;
            const T = THEMES[this.theme];
            const turn = this.game.turn();
            let text, kicker = `Ход ${this.game.moveNumber()} · ${T.sides[turn]}`;
            const card = $('.status-card');
            card.classList.toggle('is-check', !this.over && this.game.isCheck());
            if (this.over) {
                const r = this.over;
                kicker = 'Партия окончена';
                if (r.type === 'draw') text = `${T.texts.draw.title}: ${r.reason.toLowerCase()}`;
                else if (r.type === 'resign') text = `${this.names[other(r.winner)]} сдаётся`;
                else text = `${T.texts.mateBanner} Победа: ${this.names[r.winner]}`;
            } else if (this.thinking) {
                text = T.texts.thinking + '…';
            } else if (this.mode === 'pve') {
                if (turn === this.humanColor) text = this.game.isCheck() ? T.texts.check : T.texts.yourMove;
                else text = T.texts.thinking + '…';
            } else {
                const nm = this.names[turn];
                text = this.game.isCheck() ? `${T.texts.checkBanner} ${nm}, спасай короля!` : `${nm}, твой ход`;
            }
            $('#statusKicker').textContent = kicker;
            if (text !== this.lastStatus) {
                this.lastStatus = text;
                this.fx.type($('#statusText'), text, { speed: 18 });
            }
        }

        updateControls() {
            const inGame = !!this.game;
            $('#undoBtn').disabled = !this.canUndo();
            $('#resignBtn').disabled = !inGame || !!this.over || !!this.pendingPromotion;
            $('#newGameBtn').disabled = !inGame;
            $('#viewBtn').disabled = !this.view || !this.view.setPreset || !this.hasWebGL;
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        window.chessApp = new ChessApp();
    });
})();
