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

    const DIFF_NAMES = { easy: tr('Лёгкий'), medium: tr('Средний'), hard: tr('Тяжёлый') };
    const ROLE_NAMES = { k: tr('Король'), q: tr('Ферзь'), r: tr('Ладья'), b: tr('Слон'), n: tr('Конь'), p: tr('Пешка') };
    const GLYPHS = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
    const PRESETS = [['normal', tr('Обычный ракурс')], ['top', tr('Вид сверху')], ['low', tr('Кинематографичный ракурс')]];

    const plural = (n, one, few, many) => I18N.plural(n, one, few, many);
    /** «N ход / хода / ходов» или «N move / moves» */
    const movesWord = (n) => I18N.plural(n, 'ход', 'хода', 'ходов', 'move', 'moves');

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
            this.names = { w: tr('Белые'), b: tr('Чёрные') };
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
            // Сетевая игра
            this.net = null;              // текущий соперник и партия (см. onNetMatch)
            this.netQueue = [];           // ходы соперника, пришедшие во время анимации
            this.moveTime = [30, 60, 120, 300].includes(+store.get('chess-move-time')) ? +store.get('chess-move-time') : 60;
            this.gcName = '';
            this.clock = null;            // { color, deadline } — кто ходит и до какого момента
            this.stats = this.loadStats();

            this.fontsReady = this.loadFonts();
            this.bindUI();
            this.restoreInputs();
            this.applyTheme(this.theme, { silent: true });
            this.updateToggles();
            this.fontsReady.then(() => this.refreshSprites());
            this.initOnline();
            this.initPro();
        }

        // ---------- Загрузка ----------
        loadFonts() {
            if (!document.fonts || !document.fonts.load) return Promise.resolve();
            const faces = ['700 40px "Playfair Display"', '400 40px "Russo One"', '700 40px Comfortaa', '800 20px Nunito', '900 40px Unbounded', '700 40px Oswald'];
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
            $('#onlineBtn').addEventListener('click', () => { this.saveName(); this.openOnline(); });
            $$('#moveTime button').forEach((b) => b.addEventListener('click', () => {
                this.moveTime = +b.dataset.sec;
                store.set('chess-move-time', String(this.moveTime));
                this.updateToggles();
            }));
            $('#findBtn').addEventListener('click', () => this.findOpponent());
            $('#searchCancel').addEventListener('click', () => CMOnline.cancel());
            $('#leaderBtn').addEventListener('click', () => this.showLeaderboard());
            $('#playerName').addEventListener('change', () => this.saveName());
            $('#playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#pveBtn').click(); });
            $$('[data-back]').forEach((b) => b.addEventListener('click', () => {
                if (document.body.dataset.screen === 'online') this.stopSearch();
                this.showScreen('menu');
            }));

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
            $('#historyToggle').addEventListener('click', () => {
                const list = $('#moveList');
                const open = list.hidden;
                list.hidden = !open;
                $('#historyToggle').textContent = open ? tr('Свернуть') : tr('Раскрыть');
                $('#historyToggle').setAttribute('aria-expanded', String(open));
            });

            // Итоги
            $('#againBtn').addEventListener('click', () => {
                if (this.mode === 'online') { this.requestRematch(); return; }
                this.hideResult(); this.startGame(this.mode, this.difficulty, true);
            });
            $('#reviewBtn').addEventListener('click', () => this.hideResult());
            $('#resultMenuBtn').addEventListener('click', () => { this.hideResult(); this.backToMenu(true); });

            // Звук, голос, полный экран
            $('#soundBtn').addEventListener('click', () => {
                this.sound.setEnabled(!this.sound.enabled);
                this.updateToggles();
                this.toast(this.sound.enabled ? tr('Звуковые эффекты включены') : tr('Звуковые эффекты выключены'));
                if (this.sound.enabled) this.sound.play('uiClick');
            });
            $('#voiceBtn').addEventListener('click', () => {
                if (!this.sound.voice.available) { this.toast(tr('В этом браузере нет синтеза речи')); return; }
                this.sound.voice.setEnabled(!this.sound.voice.enabled);
                this.updateToggles();
                this.toast(this.sound.voice.enabled ? tr('Голос диктора включён') : tr('Голос диктора выключен'));
                if (this.sound.voice.enabled) this.sound.say(tr('Диктор на месте!'), { rate: 1.05 });
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
                if (this.sound.voice.enabled) this.sound.say(tr('Диктор на месте!'), { rate: 1.05 });
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

        playerName() { return $('#playerName').value.trim() || tr('Игрок'); }

        saveName() { store.set('chess-player-name', $('#playerName').value.trim()); }

        updateToggles() {
            $('#soundBtn').setAttribute('aria-pressed', String(this.sound.enabled));
            const v = $('#voiceBtn');
            v.setAttribute('aria-pressed', String(this.sound.voice.available && this.sound.voice.enabled));
            if (!this.sound.voice.available) v.title = tr('Голос диктора недоступен в этом браузере');
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
            $$('#moveTime button').forEach((b) => {
                const on = +b.dataset.sec === this.moveTime;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-checked', String(on));
            });
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
            if (announce) this.toast(this.cinematic ? tr('🎬 Кинематографичные ходы включены') : tr('Кинематографичные ходы выключены'), 1600);
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
            if (name === 'menu' && this.renderPro && $('#freeLeft')) this.renderPro();   // счётчик мог смениться (новый день)
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
                this.toast(tr('Полноэкранный режим недоступен'));
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
            if (inGame) this.toast(tr('Вселенная: {name}', { name: THEMES[key].name }));
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
                this.toast(tr('3D-режим недоступен в этом браузере — включена плоская доска'), 4000);
            }
            return this.view;
        }

        async startGame(mode, difficulty, again = false) {
            if (!this.allowGame(mode)) return;
            this.mode = mode;
            if (difficulty) this.difficulty = difficulty;
            const name = this.playerName();
            if (mode === 'pve') {
                this.humanColor = this.colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : this.colorChoice;
                this.names = {};
                this.names[this.humanColor] = name;
                this.names[other(this.humanColor)] = tr('Компьютер · {level}', { level: DIFF_NAMES[this.difficulty] });
                this.orientation = this.humanColor;
            } else if (mode === 'online') {
                const n = this.net;
                this.humanColor = n.color;
                this.names = {};
                this.names[n.color] = n.myName;
                this.names[other(n.color)] = n.oppName;
                this.orientation = n.color;
                this.netQueue = [];
                n.over = false;
                n.recorded = false;
                n.rematchMe = n.rematchThem = false;
            } else {
                if (!again) {
                    const w = $('#whiteName').value.trim() || name, b = $('#blackName').value.trim() || tr('Игрок 2');
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
            this.stopClock();
            document.body.classList.toggle('is-online', mode === 'online');
            document.body.classList.remove('is-gloom');
            this.fx.clear();

            this.showScreen('game');
            this.busy = true;   // ходы соперника ждут, пока доска не готова
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
            this.busy = false;

            this.updateAll();
            if (this.hasWebGL && store.get('chess-cam-hint') !== '1') {
                store.set('chess-cam-hint', '1');
                const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
                const hint = touch
                    ? tr('Доску можно крутить: веди пальцем мимо фигур. Два пальца — приблизить и повернуть')
                    : tr('Доску можно крутить: тяни мимо фигур или правой кнопкой. Колёсико — приблизить');
                setTimeout(() => { if (token === this.gameToken) this.toast(hint, 4500); }, 1500);
            }
            const T = THEMES[this.theme];
            this.sound.play('start');
            this.speak(T, T.voice.start, 350);
            if (this.isAITurn()) this.scheduleAI(this.theme === 'cars' ? 2300 : 1200);
            if (mode === 'online') {
                this.startClock();
                this.drainNet();
            }
        }

        async newGame() {
            if (!this.game) return;
            if (this.game.history().length && !this.over && !(await this.confirm(tr('Начать новую партию? Текущая будет потеряна.')))) return;
            this.hideResult();
            this.startGame(this.mode, this.difficulty, true);
        }

        async backToMenu(force = false) {
            if (document.body.dataset.screen !== 'game') { this.showScreen('menu'); return; }
            if (this.mode === 'online' && this.game && !this.over) {
                if (!force && !(await this.confirm(tr('Выйти из сетевой партии? Это засчитается как поражение.')))) return;
                if (!this.over) {
                    this.netSend({ t: 'resign' });
                    this.over = { type: 'resign', winner: other(this.humanColor) };
                    this.recordOnline('lose');
                }
            } else if (!force && this.game && this.game.history().length && !this.over &&
                !(await this.confirm(tr('Выйти в меню? Текущая партия будет потеряна.')))) return;
            if (this.mode === 'online') this.leaveNet();
            this.cancelAI();
            this.gameToken++;
            this.hideResult();
            this.fx.clear();
            document.body.classList.remove('is-gloom');
            this.sound.voice.cancel();
            const wasOnline = this.mode === 'online';
            this.stopClock();
            document.body.classList.remove('is-online');
            this.mode = null;
            if (wasOnline) this.openOnline(); else this.showScreen('menu');
        }

        isHumanTurn() {
            return this.mode === 'pvp' || (!!this.game && this.game.turn() === this.humanColor);
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
                if (this.game && !this.over && sq && this.thinking) this.toast(tr('Подожди, соперник думает…'), 1200);
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
                ? (marks.length
                    ? (I18N.lang === 'en' ? tr('{pn} · доступно ходов: {n}', { pn, n: marks.length, moves: movesWord(marks.length) })
                        : `${pn} · ${plural(marks.length, 'доступен', 'доступно', 'доступно')} ${marks.length} ${movesWord(marks.length)}`)
                    : tr('{pn} · ходов нет', { pn }))
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
            if (this.mode === 'online') {
                if (move.color === this.humanColor) {
                    this.netSend({ t: 'move', r: this.net.round, ply: this.game.history().length, from: move.from, to: move.to, promotion: move.promotion || null });
                }
                if (!this.game.isGameOver()) this.startClock(); else this.stopClock();
            }
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
            this.afterMove(move);
            return true;
        }

        /** Реплика диктора темы: строка, массив вариантов (берётся случайный) или функция. */
        speak(T, line, delay = 0, ...args) {
            if (Array.isArray(line)) line = line[Math.floor(Math.random() * line.length)];
            if (typeof line === 'function') line = line(...args);
            if (!line) return false;
            this.sound.say(line, { rate: T.voice.rate, pitch: T.voice.pitch, gender: T.voice.gender, delay });
            return true;
        }

        /**
         * Комментарий к ходу (есть не у всех тем — в хоккее ведёт репортаж комментатор).
         * Шах, превращение и крупное взятие комментируются всегда, обычные ходы — через раз.
         */
        commentMove(T, move) {
            const C = T.voice.comments;
            if (!C || !move) return false;
            const opp = move.color === 'w' ? 'b' : 'w';
            const ctx = {
                side: T.sides[move.color], opp: T.sides[opp],
                actor: T.pieceNames[move.color][move.piece],
                victim: move.captured ? T.pieceNames[opp][move.captured] : ''
            };
            let pool = null;
            if (this.game.isCheck()) pool = C.check;
            else if (move.promotion) pool = C.promote;
            else if (move.captured && PIECE_VALUES[move.captured] >= 5) pool = C.bigCapture;
            else if (move.captured) pool = Math.random() < 0.75 ? C.capture : null;
            else if (move.flags.includes('k') || move.flags.includes('q')) pool = C.castle;
            else if (Math.random() < (C.moveChance || 0.3)) pool = C.move;
            if (!pool) return false;
            return this.speak(T, pool, this.game.isCheck() ? 250 : 450, ctx);
        }

        afterMove(move) {
            this.updateHistory();
            this.updatePlayers();
            this.updateControls();
            if (this.game.isGameOver()) {
                this.finishGame();
                return;
            }
            const T = THEMES[this.theme];
            const commented = this.commentMove(T, move);
            if (this.game.isCheck()) {
                this.view.showCheck(this.findKing(this.game.turn()));
                this.sound.play('check', 0.05);
                this.banner(T.texts.checkBanner, 'check');
                if (!commented) this.speak(T, T.voice.check, 250);
            }
            if (this.mode === 'pvp' && this.autoFlip) this.setOrientation(this.game.turn());
            this.updateStatus();
            if (this.isAITurn()) this.scheduleAI(300);
            if (this.mode === 'online') this.drainNet();
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
            if (!this.game || this.pendingPromotion || this.mode === 'online') return false;
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
            this.toast(n === 2 ? tr('Отменены твой ход и ответ соперника') : tr('Ход отменён'), 1500);
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
            const solo = this.mode === 'pve' || this.mode === 'online';
            const who = solo ? this.humanColor : this.game.turn();
            const q = solo ? tr('Сдаться и признать поражение?') : tr('{name} сдаётся?', { name: this.names[who] });
            if (!(await this.confirm(q))) return;
            if (this.over) return;
            this.cancelAI();
            if (this.mode === 'online') this.netSend({ t: 'resign' });
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
            else if (g.isStalemate()) result = { type: 'draw', reason: tr('Пат') };
            else if (g.isInsufficientMaterial()) result = { type: 'draw', reason: tr('Недостаточно фигур для мата') };
            else if (g.isThreefoldRepetition()) result = { type: 'draw', reason: tr('Троекратное повторение позиции') };
            else result = { type: 'draw', reason: tr('Правило 50 ходов') };
            this.over = result;
            this.thinking = false;
            this.stopClock();
            if (this.pendingPromotion) this.closePromotion(null);
            this.deselect();
            this.updatePlayers();
            this.updateControls();
            this.updateStatus();
            const token = this.gameToken;
            const T = THEMES[this.theme];
            let outcome;
            if (result.type === 'draw') outcome = 'draw';
            else if (this.mode === 'pve' || this.mode === 'online') outcome = result.winner === this.humanColor ? 'win' : 'lose';
            else outcome = 'win';
            if (this.mode === 'online') this.recordOnline(outcome);

            if (result.type === 'mate') {
                const k = this.findKing(g.turn());
                this.view.showCheck(k);
                this.sound.play('check');
                this.banner(T.texts.mateBanner, 'mate');
                this.fx.shake($('#boardStage'), true);
                this.view.showMate(k, result.winner);
                // В хоккее мат — это гол: даём шайбе влететь в ворота и фонарю помигать
                await sleep(this.theme === 'hockey' && this.hasWebGL ? 2100 : 1300);
            } else {
                await sleep(450);
            }
            if (token !== this.gameToken) return;

            this.sound.play(outcome);
            const winnerName = result.winner ? this.names[result.winner] : '';
            let line;
            if (outcome === 'draw') line = T.voice.draw;
            else if (this.mode === 'pvp') line = T.voice.pvpWin;
            else if (result.type !== 'mate') line = outcome === 'win' ? T.voice.resignWin : T.voice.resignLose;
            else line = outcome === 'win' ? T.voice.win : T.voice.lose;
            this.speak(T, line, outcome === 'lose' ? 1500 : 1000, winnerName);

            if (outcome === 'win') {
                this.fx.confetti(this.theme, { side: result.winner });
                setTimeout(() => { if (token === this.gameToken) this.fx.confetti(this.theme, { count: 90, side: result.winner }); }, 1400);
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
                    ? tr('{loser} сдаётся. {winner} — победитель!', { loser: this.names[other(result.winner)], winner: this.names[result.winner] })
                    : T.texts.pvpWin.sub(this.names[result.winner]);
            } else if (outcome === 'win') {
                title = T.texts.win.title;
                sub = result.type === 'resign' ? tr('Соперник признал поражение!')
                    : result.type === 'timeout' ? tr('У соперника вышло время на ход!')
                    : result.type === 'left' ? tr('Соперник покинул партию.')
                    : T.texts.win.sub;
            } else {
                title = T.texts.lose.title;
                sub = result.type === 'resign' ? tr('Партия сдана — в следующий раз получится!')
                    : result.type === 'timeout' ? tr('Время на ход вышло — в следующий раз получится!')
                    : T.texts.lose.sub;
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
            const stats = [`${moves} ${movesWord(moves)}`, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`];
            if (this.mode === 'pve') stats.push(tr('Уровень: {level}', { level: DIFF_NAMES[this.difficulty] }));
            if (this.mode === 'online' && this.net && this.net.delta !== undefined) {
                const d = this.net.delta;
                stats.push(tr('Рейтинг: {r}', { r: this.stats.rating }) + ` (${d >= 0 ? '+' : ''}${d})`);
            }
            const again = $('#againBtn');
            again.lastChild.textContent = this.mode === 'online' ? tr('Реванш') : tr('Сыграть ещё');
            again.disabled = this.mode === 'online' && !!this.net && this.net.gone;
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
                const isOpp = this.mode === 'online' && color !== this.humanColor;
                const solo = this.mode === 'pve' || this.mode === 'online';
                const sideTxt = `${T.sides[color]}${this.theme === 'classic' ? '' : color === 'w' ? tr(' · белые') : tr(' · чёрные')}`;
                const oppTxt = isOpp && this.net && this.net.oppRating ? tr(' · рейтинг {r}', { r: this.net.oppRating }) : '';
                card.querySelector('.pc-sub').textContent = `${sideTxt}${isAI || isOpp ? oppTxt : solo ? tr(' · это ты') : ''}`;
                card.dataset.color = color;
                card.classList.toggle('is-turn', !this.over && this.game.turn() === color);
                card.classList.toggle('is-thinking', (this.thinking && isAI) || (isOpp && !this.over && this.game.turn() === color));
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
                s.textContent = tr('Ходов пока нет — начинают белые');
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
            $('#moveCount').textContent = moves.length ? `${full} ${movesWord(full)}` : '';
        }

        updateStatus() {
            if (!this.game) return;
            const T = THEMES[this.theme];
            const turn = this.game.turn();
            let text, kicker = tr('Ход {n} · {side}', { n: this.game.moveNumber(), side: T.sides[turn] });
            const card = $('.status-card');
            card.classList.toggle('is-check', !this.over && this.game.isCheck());
            if (this.over) {
                const r = this.over;
                kicker = tr('Партия окончена');
                if (r.type === 'draw') text = `${T.texts.draw.title}: ${r.reason.toLowerCase()}`;
                else if (r.type === 'resign') text = tr('{loser} сдаётся', { loser: this.names[other(r.winner)] });
                else if (r.type === 'timeout') text = tr('{loser}: время на ход вышло', { loser: this.names[other(r.winner)] });
                else if (r.type === 'left') text = tr('{loser} покидает партию', { loser: this.names[other(r.winner)] });
                else text = tr('{mate} Победа: {name}', { mate: T.texts.mateBanner, name: this.names[r.winner] });
            } else if (this.thinking) {
                text = T.texts.thinking + '…';
            } else if (this.mode === 'pve') {
                if (turn === this.humanColor) text = this.game.isCheck() ? T.texts.check : T.texts.yourMove;
                else text = T.texts.thinking + '…';
            } else if (this.mode === 'online') {
                if (turn === this.humanColor) text = this.game.isCheck() ? T.texts.check : T.texts.yourMove;
                else text = tr('{name} думает…', { name: this.names[turn] });
            } else {
                const nm = this.names[turn];
                text = this.game.isCheck() ? tr('{banner} {name}, спасай короля!', { banner: T.texts.checkBanner, name: nm }) : tr('{name}, твой ход', { name: nm });
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
            $('#newGameBtn').disabled = !inGame || this.mode === 'online';
            $('#viewBtn').disabled = !this.view || !this.view.setPreset || !this.hasWebGL;
        }

        // ---------- ChessGM Pro: 5 бесплатных партий в день ----------
        initPro() {
            if (!window.CMPro) return;
            $('#proBuy').addEventListener('click', () => {
                if (CMPro.active) { this.hidePro(); return; }
                $('#proBuy').disabled = true;
                CMPro.buy();
            });
            $('#proRestore').addEventListener('click', () => {
                $('#proRestore').disabled = true;
                this.proRestoring = true;
                CMPro.restore();
            });
            $('#proClose').addEventListener('click', () => this.hidePro());
            $('#proModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) this.hidePro(); });
            $('#freeLeftPro').addEventListener('click', () => this.showPro(false));
            $('#settingsPro').addEventListener('click', () => { this.closeSettings(); this.showPro(false); });
            CMPro.on((ev) => {
                if (ev.type === 'purchase') {
                    $('#proBuy').disabled = false;
                    if (ev.ok) { this.hidePro(); this.toast(tr('👑 Pro открыт: играй сколько хочешь!'), 3000); this.sound.play('promote'); }
                    else if (ev.text) this.toast(tr(ev.text), 3500);
                } else if (ev.type === 'restored') {
                    $('#proRestore').disabled = false;
                    if (this.proRestoring) this.toast(CMPro.active ? tr('Покупка восстановлена: Pro активен') : tr('Покупок Pro на этом Apple ID не найдено'), 3500);
                    this.proRestoring = false;
                    if (CMPro.active) this.hidePro();
                }
                this.renderPro();
            });
            this.renderPro();
            CMPro.init();
        }

        /** Можно ли начать партию: в бесплатной версии — не больше 5 в день. */
        allowGame(mode) {
            if (!window.CMPro) return true;
            // Соперник онлайн уже найден — партию не обрываем, лимит проверен до поиска и реванша
            if (mode !== 'online' && !CMPro.canStart()) { this.showPro(true); return false; }
            CMPro.countGame();
            return true;
        }

        renderPro() {
            const P = window.CMPro;
            const limited = !!(P && P.limited);
            const left = limited ? P.remaining() : 0;
            $('#freeLeft').hidden = !limited;
            if (limited) {
                $('#freeLeftText').textContent = left > 0
                    ? tr('Бесплатно сегодня: {n} из {max}', { n: left, max: P.LIMIT })
                    : tr('Бесплатные партии на сегодня закончились');
            }
            $('#settingsPro').hidden = !(P && P.available);
            $('#settingsProText').textContent = P && P.active ? tr('👑 Pro активен') : tr('👑 ChessGM Pro');
            $('#proPrice').textContent = (P && P.price) || '199 ₽';
            $('#proBuyText').textContent = P && P.active ? tr('Pro уже активен') : tr('Купить Pro за');
            $('#proPrice').hidden = !!(P && P.active);
        }

        showPro(limit) {
            this.renderPro();
            $('#proLead').textContent = limit
                ? tr('Бесплатно можно сыграть {max} партий в день — на сегодня они закончились. Новые появятся завтра, а с Pro — прямо сейчас.', { max: CMPro.LIMIT })
                : tr('В бесплатной версии — {max} партий в день. Pro снимает ограничение навсегда.', { max: CMPro.LIMIT });
            $('#proModal').hidden = false;
            setTimeout(() => $('#proBuy').focus({ preventScroll: true }), 50);
        }

        hidePro() { $('#proModal').hidden = true; }

        // ---------- Сетевая игра (Game Center) ----------
        initOnline() {
            if (!window.CMOnline || !CMOnline.available) return;
            $('#onlineBtn').hidden = false;
            CMOnline.on((ev) => this.onNetEvent(ev));
            this.renderStats();
            this.updateToggles();
            CMOnline.auth();
        }

        loadStats() {
            let s = null;
            try { s = JSON.parse(store.get('chess-online', 'null')); } catch (e) { /* */ }
            return Object.assign({ rating: 1200, wins: 0, losses: 0, draws: 0, games: 0 }, s || {});
        }

        saveStats() { store.set('chess-online', JSON.stringify(this.stats)); }

        renderStats(delta) {
            $('#statRating').textContent = this.stats.rating;
            $('#statWins').textContent = this.stats.wins;
            $('#statLosses').textContent = this.stats.losses;
            $('#statDraws').textContent = this.stats.draws;
            if (delta) {
                const d = document.createElement('span');
                d.className = 'os-delta ' + (delta > 0 ? 'up' : 'down');
                d.textContent = (delta > 0 ? '+' : '') + delta;
                $('#statRating').appendChild(d);
            }
        }

        openOnline() {
            $('#searchBox').hidden = true;
            $('#findBtn').disabled = false;
            this.renderStats(this.lastDelta || 0);
            this.lastDelta = 0;
            this.showScreen('online');
        }

        setGcStatus(text, bad = false) {
            const el = $('#gcStatus');
            el.textContent = text;
            el.classList.toggle('is-bad', bad);
        }

        findOpponent() {
            if (!CMPro.canStart()) { this.showPro(true); return; }
            if (!this.gcName) { this.toast(tr('Сначала войди в Game Center: Настройки → Game Center')); CMOnline.auth(); return; }
            this.leaveNet();
            this.sound.voice.prime();
            if (CMOnline.mock) $('#searchBox').hidden = false;
            $('#findBtn').disabled = true;
            CMOnline.find(this.moveTime);
        }

        stopSearch() {
            if (!$('#searchBox').hidden) CMOnline.cancel();
            $('#searchBox').hidden = true;
            $('#findBtn').disabled = false;
        }

        showLeaderboard() {
            if (CMOnline.native) { CMOnline.leaderboard(); return; }
            this.toast(tr('Доска почёта открывается в приложении (Game Center)'), 2600);
        }

        netSend(msg) { if (this.net && !this.net.gone) CMOnline.send(msg); }

        leaveNet() {
            if (this.net) { this.net.gone = true; CMOnline.leave(); }
            this.net = null;
            this.netQueue = [];
        }

        onNetEvent(ev) {
            switch (ev.type) {
                case 'auth':
                    if (ev.ok) {
                        this.gcName = ev.name || this.playerName();
                        this.setGcStatus(tr('Game Center: {name}', { name: this.gcName }));
                    } else {
                        this.gcName = '';
                        this.setGcStatus(tr('Нет входа в Game Center — войди в Настройках iPhone, раздел Game Center'), true);
                    }
                    $('#findBtn').disabled = false;
                    break;
                case 'scores':
                    // Новое устройство: локальной истории нет, а в Game Center результаты есть
                    if ((ev.wins || 0) > this.stats.wins) {
                        this.stats.wins = ev.wins;
                        if (ev.rating) this.stats.rating = ev.rating;
                        this.saveStats();
                        this.renderStats();
                    }
                    break;
                case 'match': this.sound.ensure(); this.onNetMatch(ev); break;
                // Натив вернул звук приложению (Game Center перенастраивает его при начале партии)
                case 'audio': this.sound.ensure(); break;
                case 'data': this.onNetData(ev.msg); break;
                case 'left': this.onNetLeft(); break;
                case 'cancelled':
                    $('#searchBox').hidden = true;
                    $('#findBtn').disabled = false;
                    break;
                case 'error':
                    $('#searchBox').hidden = true;
                    $('#findBtn').disabled = false;
                    if (ev.text) this.toast(ev.text, 3500);
                    break;
            }
        }

        /** Соперник найден: обмениваемся приветствием, цвет решает жребий (у кого число больше — белые). */
        onNetMatch(ev) {
            $('#searchBox').hidden = true;
            this.net = {
                oppName: ev.opponent || tr('Соперник'),
                myName: this.gcName || this.playerName(),
                nonce: Math.floor(Math.random() * 2 ** 31),
                round: 0, hello: null, color: null, gone: false
            };
            this.netSend({ t: 'hello', v: 1, nonce: this.net.nonce, tc: this.moveTime, name: this.net.myName, rating: this.stats.rating });
            const early = this.pendingHello;
            this.pendingHello = null;
            if (early) this.onNetData(early);
        }

        onNetData(m) {
            const n = this.net;
            if (!m || typeof m !== 'object') return;
            if (!n) { if (m.t === 'hello') this.pendingHello = m; return; }
            if (m.t === 'hello') {
                if (n.hello) return;
                n.hello = m;
                if (m.name) n.oppName = String(m.name).slice(0, 24);
                n.oppRating = Math.round(+m.rating) || 1200;
                if (m.nonce === n.nonce) {   // ничья в жребии — перебросить
                    n.hello = null;
                    n.nonce = Math.floor(Math.random() * 2 ** 31);
                    this.netSend({ t: 'hello', v: 1, nonce: n.nonce, tc: this.moveTime, name: n.myName, rating: this.stats.rating });
                    return;
                }
                n.color = n.nonce > m.nonce ? 'w' : 'b';
                // Лимит времени берётся у белых (при автоподборе он и так одинаковый)
                n.tc = n.color === 'w' ? this.moveTime : ([30, 60, 120, 300].includes(+m.tc) ? +m.tc : 60);
                this.toast(tr('Соперник: {name}', { name: n.oppName }), 2200);
                this.startGame('online');
                return;
            }
            if (this.mode !== 'online' || !this.game) return;
            if (m.r !== undefined && m.r !== n.round) return;
            if (m.t === 'move') {
                this.netQueue.push(m);
                this.drainNet();
            } else if (m.t === 'resign') {
                if (!this.over) this.finishGame({ type: 'resign', winner: this.humanColor });
            } else if (m.t === 'timeout') {
                if (!this.over) this.finishGame({ type: 'timeout', winner: this.humanColor, ...this.timeoutResult(this.humanColor) });
            } else if (m.t === 'flag') {
                // Соперник фиксирует, что моё время вышло (его часы — решающие при задержке сети)
                if (!this.over) this.finishGame({ type: 'timeout', winner: other(this.humanColor), ...this.timeoutResult(other(this.humanColor)) });
            } else if (m.t === 'rematch') {
                n.rematchThem = true;
                if (n.rematchMe) this.startRematch();
                else this.toast(tr('{name} предлагает реванш', { name: n.oppName }), 3000);
            }
        }

        /** Применить ходы соперника по очереди, когда доска свободна. */
        drainNet() {
            if (this.mode !== 'online' || !this.game || this.busy || this.over) return;
            const m = this.netQueue.shift();
            if (!m) return;
            const ply = this.game.history().length;
            if (m.ply !== ply + 1 || this.game.turn() === this.humanColor) {
                if (m.ply > ply + 1) this.netQueue.unshift(m);   // пришёл раньше времени — подождать
                return;
            }
            this.deselect();
            this.commitMove({ from: m.from, to: m.to, promotion: m.promotion || undefined }, false);
        }

        onNetLeft() {
            const n = this.net;
            if (!n) return;
            n.gone = true;
            if (this.mode === 'online' && this.game && !this.over) {
                this.finishGame({ type: 'left', winner: this.humanColor });
            } else if (this.mode === 'online') {
                this.toast(tr('{name} вышел из игры', { name: n.oppName }), 2600);
                $('#againBtn').disabled = true;
                $('#findBtn').disabled = false;
            }
        }

        requestRematch() {
            const n = this.net;
            if (!n || n.gone) { this.hideResult(); this.backToMenu(true); return; }
            if (!CMPro.canStart()) { this.showPro(true); return; }
            n.rematchMe = true;
            this.netSend({ t: 'rematch', r: n.round });
            $('#againBtn').disabled = true;
            if (n.rematchThem) this.startRematch();
            else this.toast(tr('Ждём ответа соперника…'), 3000);
        }

        startRematch() {
            const n = this.net;
            n.round++;
            n.color = other(n.color);
            $('#againBtn').disabled = false;
            this.hideResult();
            this.startGame('online');
        }

        /** Время вышло, но у победителя нечем ставить мат — ничья (как в настоящих шахматах). */
        timeoutResult(winner) {
            let minors = 0, heavy = false;
            for (const row of this.game.board()) for (const p of row) {
                if (!p || p.color !== winner || p.type === 'k') continue;
                if (p.type === 'b' || p.type === 'n') minors++; else heavy = true;
            }
            return heavy || minors >= 2 ? {} : { type: 'draw', winner: undefined, reason: tr('Время вышло, но матовать нечем') };
        }

        startClock() {
            if (this.mode !== 'online' || !this.net || this.over) return;
            this.clock = { color: this.game.turn(), deadline: Date.now() + this.net.tc * 1000, flagged: false };
            if (!this.clockTimer) this.clockTimer = setInterval(() => this.tickClock(), 200);
            this.tickClock();
        }

        stopClock() {
            clearInterval(this.clockTimer);
            this.clockTimer = null;
            this.clock = null;
            $$('.pc-clock').forEach((el) => { el.textContent = ''; el.classList.remove('is-low'); });
        }

        tickClock() {
            const c = this.clock;
            if (!c || this.over || this.mode !== 'online') return;
            const left = c.deadline - Date.now();
            const secs = Math.max(0, Math.ceil(left / 1000));
            for (const card of $$('.player-card')) {
                const el = card.querySelector('.pc-clock');
                if (card.dataset.color !== c.color) { el.textContent = ''; continue; }
                el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
                el.classList.toggle('is-low', secs <= 10);
            }
            if (c.color === this.humanColor && secs <= 5 && secs > 0 && c.warned !== secs) {
                c.warned = secs;
                this.sound.play('uiClick');
            }
            if (left > 0) return;
            if (c.color === this.humanColor) {
                // Своё время вышло: признаём сразу
                this.netSend({ t: 'timeout', r: this.net.round });
                this.finishGame({ type: 'timeout', winner: other(this.humanColor), ...this.timeoutResult(other(this.humanColor)) });
            } else if (left < -5000 && !c.flagged) {
                // У соперника вышло время, и 5 секунд запаса на задержку сети тоже
                c.flagged = true;
                this.netSend({ t: 'flag', r: this.net.round });
                this.finishGame({ type: 'timeout', winner: this.humanColor, ...this.timeoutResult(this.humanColor) });
            }
        }

        /** Итог сетевой партии: рейтинг Эло, счёт, отправка в таблицы Game Center. */
        recordOnline(outcome) {
            const n = this.net;
            if (!n || n.recorded) return;
            n.recorded = true;
            const s = this.stats;
            const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
            const opp = n.oppRating || 1200;
            const expected = 1 / (1 + Math.pow(10, (opp - s.rating) / 400));
            const k = s.games < 20 ? 40 : 24;
            const delta = Math.round(k * (score - expected));
            s.rating = Math.max(100, s.rating + delta);
            s.games++;
            if (outcome === 'win') s.wins++; else if (outcome === 'lose') s.losses++; else s.draws++;
            n.delta = delta;
            this.lastDelta = delta;
            this.saveStats();
            this.renderStats(delta);
            CMOnline.report({ rating: s.rating, wins: s.wins });
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        window.chessApp = new ChessApp();
    });
})();
