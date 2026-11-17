#!/usr/bin/env node
/* Выгружает из js/themes.js тексты и реплики диктора в JSON для Apple TV (ios/.../tvOS/Resources/themes.json).
 * Функции-шаблоны превращаются в строки с метками: (c) => `${c.side} ...` → "{side} ...", (name) => `${name}` → "{0}".
 * Имена персонажей берутся из js/three/<тема>.js (const NAMES). Запуск: node tools/gen_tv_themes.js */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const win = { CM: { Themes3D: {} } };
global.window = win;
for (const key of ['cars', 'hospital', 'hockey']) {
    const src = fs.readFileSync(path.join(root, 'js/three', key + '.js'), 'utf8');
    const m = src.match(/const NAMES = (\{[\s\S]*?\n    \});/);
    if (!m) throw new Error('NAMES не найдены в ' + key);
    win.CM.Themes3D[key] = { names: eval('(' + m[1] + ')') };
}
eval(fs.readFileSync(path.join(root, 'js/themes.js'), 'utf8'));
const proxy = new Proxy({}, { get: (_, p) => (p === Symbol.toPrimitive ? () => '{0}' : typeof p === 'string' ? '{' + p + '}' : undefined) });
const conv = (v) => {
    if (typeof v === 'function') return v(proxy);
    if (Array.isArray(v)) return v.map(conv);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, conv(x)]));
    return v;
};
const out = {};
for (const [key, T] of Object.entries(win.THEMES)) {
    out[key] = { sides: T.sides, pieceNames: T.pieceNames, texts: conv(T.texts), voice: conv(T.voice) };
}
const dest = path.join(root, 'ios/ChessMultiverse3D/tvOS/Resources/themes.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log('ok', dest, Object.keys(out).join(','), fs.statSync(dest).size, 'байт');
