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

    function call(cmd, args) {
        if (native) window.webkit.messageHandlers.gc.postMessage(Object.assign({ cmd }, args || {}));
    }

    const CMOnline = {
        available: native || mock,
        native,
        mock,
        on(fn) { listeners.push(fn); },
        /** Вызов из натива */
        _event(ev) {
            if (ev && ev.type === 'data' && typeof ev.msg === 'string') {
                try { ev.msg = JSON.parse(ev.msg); } catch (e) { return; }
            }
            emit(ev);
        },
        auth() { if (native) call('auth'); else if (mock) Mock.init(); },
        /** group — код контроля времени: подбираются только соперники с тем же лимитом */
        find(group) { if (native) call('find', { group }); else if (mock) Mock.find(group); },
        cancel() { if (native) call('cancel'); else if (mock) Mock.cancel(); },
        send(msg) { if (native) call('send', { data: JSON.stringify(msg) }); else if (mock) Mock.send(msg); },
        leave() { if (native) call('leave'); else if (mock) Mock.leave(); },
        leaderboard() { if (native) call('leaderboard'); },
        report(scores) { if (native) call('report', scores); }
    };

    window.CMOnline = CMOnline;
})();
