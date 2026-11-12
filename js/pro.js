/*
 * ChessGM Pro: разовая покупка без подписки, снимает единственное ограничение
 * бесплатной версии — 5 партий в день (любых: с компьютером, вдвоём, онлайн).
 *
 * Покупка — StoreKit 2 в приложении (ios/.../Store.swift, мост WKWebView "store").
 * В обычном браузере покупки нет и ограничения нет. Для проверки в браузере:
 * index.html?promock=1 — покупка «проходит» без магазина.
 *
 * События (CMPro.on(fn)): change — сменился статус Pro, цена или счётчик;
 * purchase {ok, text} — итог покупки; restored — восстановление закончено.
 */
(function () {
    'use strict';

    const LIMIT = 5;
    const listeners = [];
    const emit = (ev) => listeners.forEach((fn) => { try { fn(ev); } catch (e) { console.warn(e); } });

    const native = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.store);
    let mock = false;
    try { mock = !native && new URLSearchParams(location.search).has('promock'); } catch (e) { /* file:// */ }

    const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } };

    function today() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function readDay() {
        try {
            const o = JSON.parse(get('chess-daily') || 'null');
            if (o && o.d === today()) return o;
        } catch (e) { /* испорчено — начнём заново */ }
        return { d: today(), n: 0 };
    }

    function call(cmd) {
        if (native) window.webkit.messageHandlers.store.postMessage({ cmd });
    }

    const CMPro = {
        LIMIT,
        /** Есть ли в этой сборке покупка (а значит, и ограничение) */
        available: native || mock,
        native,
        mock,
        // Последний известный статус: до ответа StoreKit берём сохранённый, чтобы купивший не видел ограничение
        active: get('chess-pro') === '1',
        price: '',
        on(fn) { listeners.push(fn); },

        /** Действует ли ограничение 5 партий в день */
        get limited() { return this.available && !this.active; },
        playedToday() { return readDay().n; },
        remaining() { return this.limited ? Math.max(0, LIMIT - readDay().n) : Infinity; },
        /** Можно ли начать ещё одну партию сегодня */
        canStart() { return this.remaining() > 0; },
        /** Засчитать начатую партию (только в бесплатной версии) */
        countGame() {
            if (!this.limited) return;
            const o = readDay();
            o.n += 1;
            set('chess-daily', JSON.stringify(o));
            emit({ type: 'change' });
        },

        init() {
            if (native) call('init');
            else if (mock) setTimeout(() => this._event({ type: 'product', price: '199 ₽' }), 50);
        },
        buy() {
            if (native) call('buy');
            else if (mock) setTimeout(() => { this._event({ type: 'pro', active: true }); this._event({ type: 'purchase', ok: true }); }, 400);
        },
        restore() {
            if (native) call('restore');
            else if (mock) setTimeout(() => this._event({ type: 'restored' }), 300);
        },

        /** Вызов из натива */
        _event(ev) {
            if (!ev) return;
            if (ev.type === 'pro') {
                this.active = !!ev.active;
                set('chess-pro', this.active ? '1' : '0');
                emit({ type: 'change' });
            } else if (ev.type === 'product') {
                this.price = ev.price || '';
                emit({ type: 'change' });
            } else {
                emit(ev);
            }
        }
    };

    window.CMPro = CMPro;
})();
