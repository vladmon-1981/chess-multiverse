/*
 * Список всех фраз диктора для записи нейроголосом (tools/gen_voice.py).
 * Запуск: открыть игру в браузере (index.html или index.html?lang=en), подождать загрузку,
 * подключить этот файл и вызвать voicePhrases() — вернёт {ключ: текст} для текущего языка.
 * Ключ — Voice.key(Voice.clean(текст)), тот же, по которому игра ищет запись.
 *
 * Комментарии по ходу раскрываются по всем сторонам, фигурам и взятиям, которые реально
 * возможны (взятие — фигура соперника без короля, крупное взятие — ладья или ферзь).
 * pvpWin не пишется: в нём имя игрока, записанный диктор объявляет победу фразой win.
 */
window.voicePhrases = function () {
    const clean = (t) => String(t).replace(/[\\/«»"“”„*_#<>|~^]/g, ' ').replace(/\s+/g, ' ').trim();
    const key = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36); };
    const out = {};
    const add = (t) => { if (!t) return; const c = clean(t); if (c) out[key(c)] = c; };
    add(tr('Диктор на месте!'));
    for (const T of Object.values(THEMES)) {
        const V = T.voice;
        for (const k of ['start', 'check', 'win', 'lose', 'draw', 'resignWin', 'resignLose']) {
            const l = V[k];
            (Array.isArray(l) ? l : [l]).forEach((x) => add(typeof x === 'function' ? x() : x));
        }
        const C = V.comments || {};
        const victims = { capture: 'pnbrq', bigCapture: 'rq' };
        for (const pk of ['move', 'capture', 'bigCapture', 'check', 'castle', 'promote']) {
            for (const fn of C[pk] || []) {
                for (const col of ['w', 'b']) {
                    const opp = col === 'w' ? 'b' : 'w';
                    for (const a of 'pnbrqk') {
                        for (const v of (victims[pk] || ' ')) {
                            add(fn({
                                side: T.sides[col], opp: T.sides[opp],
                                actor: T.pieceNames[col][a],
                                victim: v.trim() ? T.pieceNames[opp][v] : ''
                            }));
                        }
                    }
                }
            }
        }
    }
    return out;
};
