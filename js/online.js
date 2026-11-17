/*
 * Сетевая игра: транспорт.
 * В приложении — Game Center через мост WKWebView (ContentView.swift, обработчик "gc"):
 * веб шлёт команды window.webkit.messageHandlers.gc.postMessage({cmd, ...}),
 * натив отвечает событиями window.CMOnline._event({type, ...}).
 * В браузере с ?gcmock=1 — тестовая «сеть» между вкладками одного браузера (BroadcastChannel):
 * так логика сетевой партии проверяется без двух устройств и аккаунтов Game Center.
 *
 * События для игры (CMOnline.on(fn)):
 *   auth {ok, name}                    — вход в Game Center (ok=false — не вошёл)
 *   scores {rating, wins}              — мои результаты из таблиц Game Center (для переноса на новое устройство)
 *   match {opponent}                   — соперник найден, можно слать данные
 *   data {msg}                         — сообщение соперника (объект)
 *   left                               — соперник отключился
 *   cancelled                          — поиск отменён
 *   error {text}
 */
(function () {
    'use strict';

    const listeners = [];
    const emit = (ev) => listeners.forEach((fn) => { try { fn(ev); } catch (e) { console.warn(e); } });

    const native = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gc);
    let mock = false;
    try { mock = !native && new URLSearchParams(location.search).has('gcmock') && 'BroadcastChannel' in window; } catch (e) { /* file:// */ }

    // ---------- Тестовая сеть между вкладками ----------
    const Mock = {
        id: Math.random().toString(36).slice(2, 8),
        ch: null, peer: null, searching: null, name: '',
        init() {
            this.ch = new BroadcastChannel('chessgm-mock');
            this.ch.onmessage = (e) => this.onMsg(e.data);
            window.addEventListener('beforeunload', () => this.leave());
            let n = '';
            try { n = new URLSearchParams(location.search).get('gcname') || ''; } catch (e) { /* */ }
            this.name = n || 'Tester-' + this.id.slice(0, 3);
            setTimeout(() => emit({ type: 'auth', ok: true, name: this.name }), 50);
        },
        post(o) { this.ch.postMessage(Object.assign({ from: this.id }, o)); },
        onMsg(m) {
            if (m.from === this.id) return;
            if (m.to && m.to !== this.id) return;
            if (m.k === 'seek' && this.searching !== null && !this.peer && m.group === this.searching) {
                this.post({ k: 'accept', to: m.from, name: this.name });
            } else if (m.k === 'accept' && this.searching !== null && !this.peer) {
                this.peer = m.from; this.searching = null;
                this.post({ k: 'ack', to: m.from, name: this.name });
                emit({ type: 'match', opponent: m.name });
            } else if (m.k === 'ack' && this.searching !== null && !this.peer) {
                this.peer = m.from; this.searching = null;
                emit({ type: 'match', opponent: m.name });
            } else if (m.k === 'data' && m.from === this.peer) {
                emit({ type: 'data', msg: m.msg });
            } else if (m.k === 'bye' && m.from === this.peer) {
                this.peer = null;
                emit({ type: 'left' });
            }
        },
        find(group) {
            this.peer = null; this.searching = group;
            this.post({ k: 'seek', group });
        },
        cancel() { this.searching = null; emit({ type: 'cancelled' }); },
        send(msg) { if (this.peer) this.post({ k: 'data', to: this.peer, msg }); },
        leave() { if (this.peer) this.post({ k: 'bye', to: this.peer }); this.peer = null; this.searching = null; }
    };

    // ---------- Свой сервер-ретранслятор (WebSocket) ----------
    // Game Center не всегда соединяет два телефона напрямую (NAT/оператор), поэтому подбор и ходы идут через
    // небольшой сервер (server/relay.py на VPS, nginx + Cloudflare). Game Center остаётся для входа, имени и доски почёта.
    const RELAY_URL = 'wss://cdn-se.birdhot.ru/chessgm-ws';
    const relay = native || (function () { try { return new URLSearchParams(location.search).has('relay'); } catch (e) { return false; } })();
    const Relay = {
        ws: null, name: '', inMatch: false, searching: false, inLobby: false, retry: null,
        cid() {
            try { const q = new URLSearchParams(location.search).get('cid'); if (q) return q.slice(0, 32); } catch (e) { /* проверка двух вкладок в одном браузере */ }
            let id = '';
            try { id = localStorage.getItem('chess-cid') || ''; } catch (e) { /* */ }
            if (!id) {
                id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
                try { localStorage.setItem('chess-cid', id); } catch (e) { /* */ }
            }
            return id;
        },
        open() {
            return new Promise((resolve, reject) => {
                if (this.ws && this.ws.readyState === 1) { resolve(this.ws); return; }
                if (this.ws && this.ws.readyState === 0) {   // уже соединяется — дождаться, не рвать
                    const w = this.ws, t0 = Date.now();
                    const iv = setInterval(() => {
                        if (w.readyState === 1) { clearInterval(iv); resolve(w); }
                        else if (w.readyState > 1 || Date.now() - t0 > 9000) { clearInterval(iv); reject(new Error('error')); }
                    }, 50);
                    return;
                }
                const keepLobby = this.inLobby;
                this.close();
                this.inLobby = keepLobby;
                let done = false;
                const ws = new WebSocket(RELAY_URL);
                this.ws = ws;
                const timer = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (e) { /* */ } reject(new Error('timeout')); } }, 9000);
                ws.onopen = () => { if (!done) { done = true; clearTimeout(timer); resolve(ws); } };
                ws.onmessage = (e) => this.onMsg(e.data);
                ws.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject(new Error('error')); } };
                ws.onclose = () => {
                    if (this.ws !== ws) return;
                    this.ws = null;
                    if (this.inMatch) { this.inMatch = false; emit({ type: 'left' }); }
                    else if (this.inLobby) { emit({ type: 'players', list: [] }); this.reconnectLobby(); }
                    else if (this.searching) { this.searching = false; emit({ type: 'error', text: 'Нет связи с сервером игры' }); }
                };
            });
        },
        close() {
            const ws = this.ws;
            this.ws = null;
            this.inMatch = false;
            this.searching = false;
            this.inLobby = false;
            if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* */ } }
        },
        onMsg(raw) {
            let m;
            try { m = JSON.parse(raw); } catch (e) { return; }
            if (m.t === 'players') emit({ type: 'players', list: m.list || [] });
            else if (m.t === 'invite') emit({ type: 'invite', from: m.from, name: m.name, tc: m.tc });
            else if (m.t === 'declined') emit({ type: 'declined', name: m.name });
            else if (m.t === 'match') { this.searching = false; this.inLobby = false; this.inMatch = true; emit({ type: 'match', opponent: m.opponent }); }
            else if (m.t === 'data') emit({ type: 'data', msg: m.msg });
            else if (m.t === 'left') { this.inMatch = false; emit({ type: 'left' }); }
            else if (m.t === 'cancelled') { this.searching = false; emit({ type: 'cancelled' }); }
            else if (m.t === 'room') emit({ type: 'room', code: m.code });
            else if (m.t === 'error') { this.searching = false; emit({ type: 'error', text: m.text === 'no room' ? 'Комната не найдена' : m.text === 'gone' ? 'Игрок уже вышел' : (m.text || '') }); }
        },
        tx(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); },
        async find(group) {
            this.searching = true;
            try { await this.open(); } catch (e) { this.searching = false; emit({ type: 'error', text: 'Нет связи с сервером игры' }); return; }
            if (!this.searching) return;      // успели отменить, пока соединялись
            this.tx({ t: 'find', group, name: this.name, id: this.cid() });
        },
        /** Встать в список «игроки в сети»: пока экран открыт, соединение держится и переподключается само. */
        async lobby() {
            try { await this.open(); } catch (e) { this.inLobby = true; emit({ type: 'players', list: [] }); this.reconnectLobby(); return; }
            this.inLobby = true;
            this.tx({ t: 'lobby', name: this.name, id: this.cid() });
        },
        async openThen(obj) {
            try { await this.open(); } catch (e) { emit({ type: 'error', text: 'Нет связи с сервером игры' }); return; }
            this.tx(Object.assign({ name: this.name, id: this.cid() }, obj));
        },
        reconnectLobby() {
            clearTimeout(this.retry);
            this.retry = setTimeout(() => { if (this.inLobby && !this.inMatch && !(this.ws && this.ws.readyState === 1)) this.lobby(); }, 1500);
        },
        leaveLobby() {
            const was = this.inLobby;
            this.inLobby = false;
            clearTimeout(this.retry);
            if (was && this.ws && this.ws.readyState === 1 && !this.inMatch) this.tx({ t: 'cancel' });
        },
        cancel() {
            if (this.ws && this.ws.readyState === 1) this.tx({ t: 'cancel' });
            else { this.searching = false; emit({ type: 'cancelled' }); }
            this.searching = false;
        },
        send(msg) { this.tx({ t: 'data', msg }); },
        leave() { this.tx({ t: 'leave' }); this.close(); }
    };

    // Вернулись в приложение — сокет мог умереть, пока экран был выключен
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Relay.inLobby && !(Relay.ws && Relay.ws.readyState === 1)) Relay.lobby();
    });

    function call(cmd, args) {
        if (native) window.webkit.messageHandlers.gc.postMessage(Object.assign({ cmd }, args || {}));
    }

    const CMOnline = {
        available: native || mock || relay,
        native,
        mock,
        relay,
        on(fn) { listeners.push(fn); },
        /** Вызов из натива */
        _event(ev) {
            if (ev && ev.type === 'auth' && ev.ok && ev.name) Relay.name = String(ev.name).slice(0, 24);
            if (ev && ev.type === 'data' && typeof ev.msg === 'string') {
                try { ev.msg = JSON.parse(ev.msg); } catch (e) { return; }
            }
            emit(ev);
        },
        auth() {
            if (native) call('auth');
            else if (mock) Mock.init();
            else if (relay) setTimeout(() => emit({ type: 'auth', ok: true, name: Relay.name || 'Игрок' }), 0);
        },
        /** group — код контроля времени: подбираются только соперники с тем же лимитом */
        find(group) { if (relay) Relay.find(group); else if (mock) Mock.find(group); },
        lobby() { if (relay) Relay.lobby(); },
        createRoom() { if (relay) { Relay.inLobby = false; Relay.openThen({ t: 'room' }); } },
        joinRoom(code) { if (relay) { Relay.inLobby = false; Relay.openThen({ t: 'join', code }); } },
        leaveLobby() { if (relay) Relay.leaveLobby(); },
        invite(to, tc) { if (relay) Relay.tx({ t: 'invite', to, tc }); },
        accept(to) { if (relay) Relay.tx({ t: 'accept', to }); },
        decline(to) { if (relay) Relay.tx({ t: 'decline', to }); },
        cancel() { if (relay) Relay.cancel(); else if (mock) Mock.cancel(); },
        send(msg) { if (relay) Relay.send(msg); else if (mock) Mock.send(msg); },
        leave() { if (relay) Relay.leave(); else if (mock) Mock.leave(); },
        leaderboard() { if (native) call('leaderboard'); },
        report(scores) { if (native) call('report', scores); }
    };

    window.CMOnline = CMOnline;
})();
