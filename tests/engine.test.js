/*
 * Тесты шахматного движка ИИ.
 * Запуск: node tests/engine.test.js   (быстрый набор)
 *         node tests/engine.test.js --full   (глубокий perft, ~1 минута)
 */
'use strict';
const path = require('path');
const assert = require('assert');
const ChessEngineModule = require(path.join(__dirname, '..', 'js', 'engine.js'));
const { Chess } = require(path.join(__dirname, '..', 'js', 'vendor', 'chess.js'));

const full = process.argv.includes('--full');
const engine = ChessEngineModule();
let failed = 0;

function test(name, fn) {
    const t0 = Date.now();
    try {
        fn();
        console.log(`✔ ${name} (${Date.now() - t0} мс)`);
    } catch (e) {
        failed++;
        console.log(`✘ ${name}\n   ${e.message}`);
    }
}

// Эталонные значения perft: https://www.chessprogramming.org/Perft_Results
const PERFT = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281, 4865609]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
    ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]]
];

for (const [fen, counts] of PERFT) {
    const maxDepth = full ? counts.length : Math.min(counts.length, 3);
    test(`perft ${fen.split(' ')[0].slice(0, 24)}… до глубины ${maxDepth}`, () => {
        for (let d = 1; d <= maxDepth; d++) {
            assert.strictEqual(engine.perft(fen, d), counts[d - 1], `глубина ${d}`);
        }
    });
}

test('легальные ходы совпадают с chess.js в 60 случайных партиях', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let g = 0; g < 60; g++) {
        const game = new Chess();
        const history = [];
        for (let ply = 0; ply < 160 && !game.isGameOver(); ply++) {
            const ref = game.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || '')).sort();
            const mine = engine.legalMovesUci(undefined, history).sort();
            assert.deepStrictEqual(mine, ref, `партия ${g}, ход ${ply}, FEN ${game.fen()}`);
            const pick = ref[Math.floor(rnd() * ref.length)];
            game.move({ from: pick.slice(0, 2), to: pick.slice(2, 4), promotion: pick[4] });
            history.push(pick);
        }
    }
});

test('находит мат в один ход на всех уровнях', () => {
    // Классический «детский мат»: 1.e4 e5 2.Сc4 Кc6 3.Фh5 Кf6?? 4.Фxf7#
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    for (const level of ['easy', 'medium', 'hard']) {
        const r = engine.search({ fen, moves: [], level, rng: () => 0.99 });
        assert.strictEqual(r.uci, 'h5f7', `уровень ${level}: ${r.uci}`);
    }
});

test('не зевает ферзя на уровне «Тяжёлый»', () => {
    // Чёрный ферзь g5 атакован слоном c1 — его нужно увести, а не делать посторонний ход
    const fen = 'rnb1kbnr/pppp1ppp/8/4p1q1/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 3';
    const game = new Chess(fen);
    const r = engine.search({ fen, moves: [], level: 'hard', timeMs: 800 });
    game.move({ from: r.from, to: r.to, promotion: r.promotion });
    const queenCaptures = game.moves({ verbose: true }).filter((m) => m.captured === 'q');
    assert.strictEqual(queenCaptures.length, 0, `ход ${r.uci} оставляет ферзя под боем`);
});

test('превращает пешку в ферзя, когда это выигрывает', () => {
    const fen = '8/P7/8/8/8/8/k7/4K3 w - - 0 1';
    const r = engine.search({ fen, moves: [], level: 'hard', timeMs: 500 });
    assert.strictEqual(r.uci, 'a7a8q');
});

test('укладывается во время на уровне «Тяжёлый» (миттельшпиль)', () => {
    const fen = 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10';
    const t0 = Date.now();
    const r = engine.search({ fen, moves: [], level: 'hard' });
    const dt = Date.now() - t0;
    console.log(`   глубина ${r.depth}, узлов ${r.nodes}, ${dt} мс, ~${Math.round(r.nodes / Math.max(1, dt))} тыс. узлов/с, ход ${r.uci}`);
    assert.ok(dt < 2600, `слишком долго: ${dt} мс`);
    assert.ok(r.depth >= 4, `слишком мелко: глубина ${r.depth}`);
});

test('учитывает историю партии (повторение позиции)', () => {
    const moves = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const game = new Chess();
    for (const m of moves) game.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
    assert.ok(game.isThreefoldRepetition(), 'chess.js фиксирует троекратное повторение');
    const r = engine.search({ moves, level: 'medium', rng: () => 0.5 });
    assert.ok(r && r.uci.length >= 4);
});

if (failed) {
    console.log(`\nПровалено тестов: ${failed}`);
    process.exit(1);
}
console.log('\nВсе тесты движка пройдены');
