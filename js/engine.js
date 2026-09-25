/*
 * Шахматный движок компьютерного соперника.
 *
 * 0x88-доска, генерация псевдолегальных ходов с проверкой короля,
 * альфа-бета (PVS) с итеративным углублением и ограничением по времени,
 * quiescence-поиск взятий, таблица транспозиций (Zobrist), killer/history-эвристики,
 * нулевой ход и сокращение поздних ходов.
 *
 * Весь код находится внутри одной функции ChessEngineModule, чтобы его можно было
 * запустить и в основном потоке, и внутри Web Worker (исходник передаётся через Blob).
 */
function ChessEngineModule() {
    'use strict';

    // ---------- Константы ----------
    const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
    const WHITE = 0, BLACK = 1;
    const BLACK_BIT = 8;

    const FLAG_DOUBLE = 1 << 20;
    const FLAG_EP = 1 << 21;
    const FLAG_CASTLE = 1 << 22;

    const MATE = 30000;
    const MATE_BOUND = MATE - 1000;
    const INF = 32000;
    const MAX_PLY = 96;

    const KNIGHT_OFFS = [-33, -31, -18, -14, 14, 18, 31, 33];
    const KING_OFFS = [-17, -16, -15, -1, 1, 15, 16, 17];
    const BISHOP_DIRS = [-17, -15, 15, 17];
    const ROOK_DIRS = [-16, -1, 1, 16];

    const VALUE = [0, 100, 320, 330, 500, 900, 0];
    const PHASE_W = [0, 0, 1, 1, 2, 4, 0];

    // Кодирование хода: from | to<<7 | promo<<14 | captured<<17 | флаги | piece<<23
    const mFrom = (m) => m & 127;
    const mTo = (m) => (m >> 7) & 127;
    const mPromo = (m) => (m >> 14) & 7;
    const mCapt = (m) => (m >> 17) & 7;
    const mPiece = (m) => (m >> 23) & 7;

    // ---------- Таблицы позиций (с точки зрения белых, индекс 0 = a8) ----------
    const PST_MG = [];
    const PST_EG = [];
    PST_MG[PAWN] = [
        0, 0, 0, 0, 0, 0, 0, 0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0,
        5, -5, -10, 0, 0, -10, -5, 5,
        5, 10, 10, -20, -20, 10, 10, 5,
        0, 0, 0, 0, 0, 0, 0, 0
    ];
    PST_EG[PAWN] = [
        0, 0, 0, 0, 0, 0, 0, 0,
        90, 90, 90, 90, 90, 90, 90, 90,
        55, 55, 55, 55, 55, 55, 55, 55,
        32, 32, 32, 32, 32, 32, 32, 32,
        18, 18, 18, 18, 18, 18, 18, 18,
        8, 8, 8, 8, 8, 8, 8, 8,
        2, 2, 2, 2, 2, 2, 2, 2,
        0, 0, 0, 0, 0, 0, 0, 0
    ];
    PST_MG[KNIGHT] = PST_EG[KNIGHT] = [
        -50, -40, -30, -30, -30, -30, -40, -50,
        -40, -20, 0, 0, 0, 0, -20, -40,
        -30, 0, 10, 15, 15, 10, 0, -30,
        -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30,
        -30, 5, 10, 15, 15, 10, 5, -30,
        -40, -20, 0, 5, 5, 0, -20, -40,
        -50, -40, -30, -30, -30, -30, -40, -50
    ];
    PST_MG[BISHOP] = PST_EG[BISHOP] = [
        -20, -10, -10, -10, -10, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 10, 10, 5, 0, -10,
        -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10,
        -10, 10, 10, 10, 10, 10, 10, -10,
        -10, 5, 0, 0, 0, 0, 5, -10,
        -20, -10, -10, -10, -10, -10, -10, -20
    ];
    PST_MG[ROOK] = PST_EG[ROOK] = [
        0, 0, 0, 0, 0, 0, 0, 0,
        5, 10, 10, 10, 10, 10, 10, 5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        0, 0, 0, 5, 5, 0, 0, 0
    ];
    PST_MG[QUEEN] = PST_EG[QUEEN] = [
        -20, -10, -10, -5, -5, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 5, 5, 5, 0, -10,
        -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5,
        -10, 5, 5, 5, 5, 5, 0, -10,
        -10, 0, 5, 0, 0, 0, 0, -10,
        -20, -10, -10, -5, -5, -10, -10, -20
    ];
    PST_MG[KING] = [
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20,
        -10, -20, -20, -20, -20, -20, -20, -10,
        20, 20, 0, 0, 0, 0, 20, 20,
        20, 30, 10, 0, 0, 10, 30, 20
    ];
    PST_EG[KING] = [
        -50, -40, -30, -20, -20, -30, -40, -50,
        -30, -20, -10, 0, 0, -10, -20, -30,
        -30, -10, 20, 30, 30, 20, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 20, 30, 30, 20, -10, -30,
        -30, -30, 0, 0, 0, 0, -30, -30,
        -50, -30, -30, -30, -30, -30, -30, -50
    ];
    const PASSED_BONUS = [0, 120, 80, 50, 30, 15, 10, 0]; // по «рядам до превращения»

    // ---------- Zobrist ----------
    let seed = 0x9e3779b9;
    function rand32() {
        seed ^= seed << 13; seed >>>= 0;
        seed ^= seed >>> 17;
        seed ^= seed << 5; seed >>>= 0;
        return seed | 0;
    }
    const ZP_LO = new Int32Array(16 * 128);
    const ZP_HI = new Int32Array(16 * 128);
    for (let i = 0; i < 16 * 128; i++) { ZP_LO[i] = rand32(); ZP_HI[i] = rand32(); }
    const ZC_LO = new Int32Array(16), ZC_HI = new Int32Array(16);
    for (let i = 0; i < 16; i++) { ZC_LO[i] = rand32(); ZC_HI[i] = rand32(); }
    const ZE_LO = new Int32Array(8), ZE_HI = new Int32Array(8);
    for (let i = 0; i < 8; i++) { ZE_LO[i] = rand32(); ZE_HI[i] = rand32(); }
    const ZS_LO = rand32(), ZS_HI = rand32();

    // Права рокировки: 1 = белые O-O, 2 = белые O-O-O, 4 = чёрные O-O, 8 = чёрные O-O-O
    const CASTLE_KEEP = new Int32Array(128).fill(15);
    CASTLE_KEEP[112] = 15 & ~2; // a1
    CASTLE_KEEP[116] = 15 & ~3; // e1
    CASTLE_KEEP[119] = 15 & ~1; // h1
    CASTLE_KEEP[0] = 15 & ~8;   // a8
    CASTLE_KEEP[4] = 15 & ~12;  // e8
    CASTLE_KEEP[7] = 15 & ~4;   // h8

    // ---------- Состояние ----------
    const board = new Int8Array(128);
    let side = WHITE;
    let castle = 0;
    let ep = -1;
    let halfmove = 0;
    let hashLo = 0, hashHi = 0;
    const kingSq = [116, 4];
    const count = new Int32Array(16);

    const HIST_MAX = 2048;
    let hply = 0;
    const uMove = new Int32Array(HIST_MAX);
    const uCapt = new Int8Array(HIST_MAX);
    const uCastle = new Int8Array(HIST_MAX);
    const uEp = new Int16Array(HIST_MAX);
    const uHalf = new Int16Array(HIST_MAX);
    const uHashLo = new Int32Array(HIST_MAX);
    const uHashHi = new Int32Array(HIST_MAX);
    const posLo = new Int32Array(HIST_MAX);
    const posHi = new Int32Array(HIST_MAX);

    // Таблица транспозиций
    const TT_BITS = 19;
    const TT_SIZE = 1 << TT_BITS;
    const TT_MASK = TT_SIZE - 1;
    const ttKey = new Int32Array(TT_SIZE);
    const ttMove = new Int32Array(TT_SIZE);
    const ttScore = new Int32Array(TT_SIZE);
    const ttDepth = new Int8Array(TT_SIZE);
    const ttFlag = new Int8Array(TT_SIZE); // 0 пусто, 1 точная, 2 нижняя граница, 3 верхняя
    const TT_EXACT = 1, TT_LOWER = 2, TT_UPPER = 3;

    // Буферы ходов на каждый уровень поиска
    const moveBuf = [];
    const scoreBuf = [];
    for (let i = 0; i < MAX_PLY + 1; i++) {
        moveBuf.push(new Int32Array(256));
        scoreBuf.push(new Int32Array(256));
    }
    const killers = new Int32Array((MAX_PLY + 1) * 2);
    const historyH = new Int32Array(16 * 128);

    let nodes = 0;
    let stopped = false;
    let deadline = 0;
    const now = (typeof performance !== 'undefined' && performance.now)
        ? () => performance.now()
        : () => Date.now();

    // ---------- Утилиты ----------
    const colorOf = (p) => (p & BLACK_BIT) ? BLACK : WHITE;
    const sqName = (sq) => 'abcdefgh'[sq & 7] + (8 - (sq >> 4));
    const sqFromName = (s) => (8 - parseInt(s[1], 10)) * 16 + (s.charCodeAt(0) - 97);
    const PIECE_CHARS = ' pnbrqk';

    function zPiece(p, sq) {
        const i = p * 128 + sq;
        hashLo ^= ZP_LO[i];
        hashHi ^= ZP_HI[i];
    }

    function computeHash() {
        hashLo = 0; hashHi = 0;
        for (let sq = 0; sq < 128; sq++) {
            if (sq & 0x88) { sq += 7; continue; }
            if (board[sq]) zPiece(board[sq], sq);
        }
        hashLo ^= ZC_LO[castle]; hashHi ^= ZC_HI[castle];
        if (ep >= 0) { hashLo ^= ZE_LO[ep & 7]; hashHi ^= ZE_HI[ep & 7]; }
        if (side === BLACK) { hashLo ^= ZS_LO; hashHi ^= ZS_HI; }
    }

    function loadFen(fen) {
        board.fill(0);
        count.fill(0);
        const parts = fen.trim().split(/\s+/);
        let row = 0, col = 0;
        for (const ch of parts[0]) {
            if (ch === '/') { row++; col = 0; continue; }
            if (ch >= '1' && ch <= '8') { col += parseInt(ch, 10); continue; }
            const lower = ch.toLowerCase();
            const type = PIECE_CHARS.indexOf(lower);
            const p = type | (ch === lower ? BLACK_BIT : 0);
            const sq = row * 16 + col;
            board[sq] = p;
            count[p]++;
            if (type === KING) kingSq[ch === lower ? BLACK : WHITE] = sq;
            col++;
        }
        side = parts[1] === 'b' ? BLACK : WHITE;
        castle = 0;
        const c = parts[2] || '-';
        if (c.includes('K')) castle |= 1;
        if (c.includes('Q')) castle |= 2;
        if (c.includes('k')) castle |= 4;
        if (c.includes('q')) castle |= 8;
        ep = (parts[3] && parts[3] !== '-') ? sqFromName(parts[3]) : -1;
        halfmove = parseInt(parts[4] || '0', 10) || 0;
        hply = 0;
        computeHash();
        posLo[0] = hashLo; posHi[0] = hashHi;
    }

    // ---------- Атаки ----------
    function attacked(sq, by) {
        const bit = by === BLACK ? BLACK_BIT : 0;
        let s;
        if (by === WHITE) {
            s = sq + 15; if (!(s & 0x88) && board[s] === PAWN) return true;
            s = sq + 17; if (!(s & 0x88) && board[s] === PAWN) return true;
        } else {
            s = sq - 15; if (!(s & 0x88) && board[s] === (PAWN | BLACK_BIT)) return true;
            s = sq - 17; if (!(s & 0x88) && board[s] === (PAWN | BLACK_BIT)) return true;
        }
        const kn = KNIGHT | bit;
        for (let i = 0; i < 8; i++) {
            s = sq + KNIGHT_OFFS[i];
            if (!(s & 0x88) && board[s] === kn) return true;
        }
        const kg = KING | bit;
        for (let i = 0; i < 8; i++) {
            s = sq + KING_OFFS[i];
            if (!(s & 0x88) && board[s] === kg) return true;
        }
        const bq = BISHOP | bit, qq = QUEEN | bit, rq = ROOK | bit;
        for (let i = 0; i < 4; i++) {
            const d = BISHOP_DIRS[i];
            s = sq + d;
            while (!(s & 0x88)) {
                const p = board[s];
                if (p) { if (p === bq || p === qq) return true; break; }
                s += d;
            }
        }
        for (let i = 0; i < 4; i++) {
            const d = ROOK_DIRS[i];
            s = sq + d;
            while (!(s & 0x88)) {
                const p = board[s];
                if (p) { if (p === rq || p === qq) return true; break; }
                s += d;
            }
        }
        return false;
    }

    const inCheck = () => attacked(kingSq[side], side ^ 1);

    // ---------- Генерация ходов ----------
    function genMoves(list, capturesOnly) {
        let n = 0;
        const us = side, them = side ^ 1;
        const usBit = us === BLACK ? BLACK_BIT : 0;
        const pawnDir = us === WHITE ? -16 : 16;
        const startRow = us === WHITE ? 6 : 1;
        const promoRow = us === WHITE ? 0 : 7;

        for (let sq = 0; sq < 128; sq++) {
            if (sq & 0x88) { sq += 7; continue; }
            const p = board[sq];
            if (!p || (p & BLACK_BIT) !== usBit) continue;
            const t = p & 7;
            const pieceBits = t << 23;

            if (t === PAWN) {
                const to = sq + pawnDir;
                if (!board[to]) {
                    if ((to >> 4) === promoRow) {
                        list[n++] = sq | (to << 7) | (QUEEN << 14) | pieceBits;
                        if (!capturesOnly) {
                            list[n++] = sq | (to << 7) | (ROOK << 14) | pieceBits;
                            list[n++] = sq | (to << 7) | (BISHOP << 14) | pieceBits;
                            list[n++] = sq | (to << 7) | (KNIGHT << 14) | pieceBits;
                        }
                    } else if (!capturesOnly) {
                        list[n++] = sq | (to << 7) | pieceBits;
                        const to2 = to + pawnDir;
                        if ((sq >> 4) === startRow && !board[to2]) {
                            list[n++] = sq | (to2 << 7) | FLAG_DOUBLE | pieceBits;
                        }
                    }
                }
                for (let k = -1; k <= 1; k += 2) {
                    const tc = to + k;
                    if (tc & 0x88) continue;
                    const q = board[tc];
                    if (q && colorOf(q) === them) {
                        const capBits = (q & 7) << 17;
                        if ((tc >> 4) === promoRow) {
                            list[n++] = sq | (tc << 7) | (QUEEN << 14) | capBits | pieceBits;
                            list[n++] = sq | (tc << 7) | (ROOK << 14) | capBits | pieceBits;
                            list[n++] = sq | (tc << 7) | (BISHOP << 14) | capBits | pieceBits;
                            list[n++] = sq | (tc << 7) | (KNIGHT << 14) | capBits | pieceBits;
                        } else {
                            list[n++] = sq | (tc << 7) | capBits | pieceBits;
                        }
                    } else if (tc === ep) {
                        list[n++] = sq | (tc << 7) | (PAWN << 17) | FLAG_EP | pieceBits;
                    }
                }
                continue;
            }

            if (t === KNIGHT || t === KING) {
                const offs = t === KNIGHT ? KNIGHT_OFFS : KING_OFFS;
                for (let i = 0; i < 8; i++) {
                    const to = sq + offs[i];
                    if (to & 0x88) continue;
                    const q = board[to];
                    if (!q) {
                        if (!capturesOnly) list[n++] = sq | (to << 7) | pieceBits;
                    } else if (colorOf(q) === them) {
                        list[n++] = sq | (to << 7) | ((q & 7) << 17) | pieceBits;
                    }
                }
                if (t === KING && !capturesOnly) {
                    if (us === WHITE && sq === 116) {
                        if ((castle & 1) && !board[117] && !board[118] && board[119] === ROOK &&
                            !attacked(116, BLACK) && !attacked(117, BLACK)) {
                            list[n++] = 116 | (118 << 7) | FLAG_CASTLE | pieceBits;
                        }
                        if ((castle & 2) && !board[115] && !board[114] && !board[113] && board[112] === ROOK &&
                            !attacked(116, BLACK) && !attacked(115, BLACK)) {
                            list[n++] = 116 | (114 << 7) | FLAG_CASTLE | pieceBits;
                        }
                    } else if (us === BLACK && sq === 4) {
                        if ((castle & 4) && !board[5] && !board[6] && board[7] === (ROOK | BLACK_BIT) &&
                            !attacked(4, WHITE) && !attacked(5, WHITE)) {
                            list[n++] = 4 | (6 << 7) | FLAG_CASTLE | pieceBits;
                        }
                        if ((castle & 8) && !board[3] && !board[2] && !board[1] && board[0] === (ROOK | BLACK_BIT) &&
                            !attacked(4, WHITE) && !attacked(3, WHITE)) {
                            list[n++] = 4 | (2 << 7) | FLAG_CASTLE | pieceBits;
                        }
                    }
                }
                continue;
            }

            const dirs = t === BISHOP ? BISHOP_DIRS : t === ROOK ? ROOK_DIRS : KING_OFFS;
            for (let i = 0; i < dirs.length; i++) {
                const d = dirs[i];
                let to = sq + d;
                while (!(to & 0x88)) {
                    const q = board[to];
                    if (!q) {
                        if (!capturesOnly) list[n++] = sq | (to << 7) | pieceBits;
                    } else {
                        if (colorOf(q) === them) list[n++] = sq | (to << 7) | ((q & 7) << 17) | pieceBits;
                        break;
                    }
                    to += d;
                }
            }
        }
        return n;
    }

    // ---------- Сделать / отменить ход ----------
    function makeMove(m) {
        const from = mFrom(m), to = mTo(m);
        const p = board[from];
        const captured = board[to];
        const u = hply;
        uMove[u] = m; uCapt[u] = captured; uCastle[u] = castle; uEp[u] = ep; uHalf[u] = halfmove;
        uHashLo[u] = hashLo; uHashHi[u] = hashHi;

        if (ep >= 0) { hashLo ^= ZE_LO[ep & 7]; hashHi ^= ZE_HI[ep & 7]; }
        hashLo ^= ZC_LO[castle]; hashHi ^= ZC_HI[castle];

        zPiece(p, from);
        board[from] = 0;
        if (captured) { zPiece(captured, to); count[captured]--; }
        let placed = p;
        const promo = mPromo(m);
        if (promo) {
            placed = promo | (p & BLACK_BIT);
            count[p]--; count[placed]++;
        }
        board[to] = placed;
        zPiece(placed, to);

        if (m & FLAG_EP) {
            const capSq = to + (side === WHITE ? 16 : -16);
            const cp = board[capSq];
            zPiece(cp, capSq);
            board[capSq] = 0;
            count[cp]--;
        } else if (m & FLAG_CASTLE) {
            let rFrom, rTo;
            if (to > from) { rFrom = from + 3; rTo = from + 1; } else { rFrom = from - 4; rTo = from - 1; }
            const r = board[rFrom];
            board[rFrom] = 0; board[rTo] = r;
            zPiece(r, rFrom); zPiece(r, rTo);
        }
        if ((p & 7) === KING) kingSq[side] = to;

        castle &= CASTLE_KEEP[from] & CASTLE_KEEP[to];
        hashLo ^= ZC_LO[castle]; hashHi ^= ZC_HI[castle];

        ep = -1;
        if (m & FLAG_DOUBLE) {
            ep = (from + to) >> 1;
            hashLo ^= ZE_LO[ep & 7]; hashHi ^= ZE_HI[ep & 7];
        }
        halfmove = ((p & 7) === PAWN || captured) ? 0 : halfmove + 1;
        side ^= 1;
        hashLo ^= ZS_LO; hashHi ^= ZS_HI;
        hply++;
        posLo[hply] = hashLo; posHi[hply] = hashHi;
    }

    function unmakeMove() {
        hply--;
        const u = hply;
        const m = uMove[u];
        side ^= 1;
        const from = mFrom(m), to = mTo(m);
        let p = board[to];
        const promo = mPromo(m);
        if (promo) {
            count[p]--;
            p = PAWN | (p & BLACK_BIT);
            count[p]++;
        }
        board[from] = p;
        const captured = uCapt[u];
        board[to] = captured;
        if (captured) count[captured]++;
        if (m & FLAG_EP) {
            const capSq = to + (side === WHITE ? 16 : -16);
            const cp = PAWN | (side === WHITE ? BLACK_BIT : 0);
            board[capSq] = cp;
            count[cp]++;
        } else if (m & FLAG_CASTLE) {
            let rFrom, rTo;
            if (to > from) { rFrom = from + 3; rTo = from + 1; } else { rFrom = from - 4; rTo = from - 1; }
            board[rFrom] = board[rTo]; board[rTo] = 0;
        }
        if ((p & 7) === KING) kingSq[side] = from;
        castle = uCastle[u]; ep = uEp[u]; halfmove = uHalf[u];
        hashLo = uHashLo[u]; hashHi = uHashHi[u];
    }

    function makeNull() {
        const u = hply;
        uMove[u] = 0; uCapt[u] = 0; uCastle[u] = castle; uEp[u] = ep; uHalf[u] = halfmove;
        uHashLo[u] = hashLo; uHashHi[u] = hashHi;
        if (ep >= 0) { hashLo ^= ZE_LO[ep & 7]; hashHi ^= ZE_HI[ep & 7]; }
        ep = -1;
        side ^= 1;
        hashLo ^= ZS_LO; hashHi ^= ZS_HI;
        halfmove++;
        hply++;
        posLo[hply] = hashLo; posHi[hply] = hashHi;
    }

    function unmakeNull() {
        hply--;
        const u = hply;
        side ^= 1;
        castle = uCastle[u]; ep = uEp[u]; halfmove = uHalf[u];
        hashLo = uHashLo[u]; hashHi = uHashHi[u];
    }

    // Ход в легальном порядке? (делает ход; если король под боем — откатывает и возвращает false)
    function tryMove(m) {
        makeMove(m);
        if (attacked(kingSq[side ^ 1], side)) { unmakeMove(); return false; }
        return true;
    }

    function legalMoves() {
        const list = new Int32Array(256);
        const n = genMoves(list, false);
        const res = [];
        for (let i = 0; i < n; i++) {
            if (tryMove(list[i])) { unmakeMove(); res.push(list[i]); }
        }
        return res;
    }

    function moveToUci(m) {
        const promo = mPromo(m);
        return sqName(mFrom(m)) + sqName(mTo(m)) + (promo ? PIECE_CHARS[promo] : '');
    }

    function isRepetition() {
        const stop = Math.max(0, hply - halfmove);
        for (let i = hply - 2; i >= stop; i -= 2) {
            if (posLo[i] === hashLo && posHi[i] === hashHi) return true;
        }
        return false;
    }

    // ---------- Оценка позиции ----------
    const pawnFiles = [new Int8Array(10), new Int8Array(10)];
    const pawnMinRow = [new Int8Array(10), new Int8Array(10)]; // самый продвинутый ряд для белых (min row)
    const pawnMaxRow = [new Int8Array(10), new Int8Array(10)];

    function insufficientMaterial() {
        if (count[PAWN] || count[PAWN | BLACK_BIT] || count[ROOK] || count[ROOK | BLACK_BIT] ||
            count[QUEEN] || count[QUEEN | BLACK_BIT]) return false;
        const wMinor = count[KNIGHT] + count[BISHOP];
        const bMinor = count[KNIGHT | BLACK_BIT] + count[BISHOP | BLACK_BIT];
        return wMinor <= 1 && bMinor <= 1;
    }

    function evaluate() {
        if (insufficientMaterial()) return 0;
        let mg = 0, eg = 0, phase = 0;
        let matW = 0, matB = 0;
        const pf0 = pawnFiles[0], pf1 = pawnFiles[1];
        pf0.fill(0); pf1.fill(0);
        pawnMinRow[0].fill(8); pawnMinRow[1].fill(8);
        pawnMaxRow[0].fill(-1); pawnMaxRow[1].fill(-1);

        for (let sq = 0; sq < 128; sq++) {
            if (sq & 0x88) { sq += 7; continue; }
            const p = board[sq];
            if (!p) continue;
            const t = p & 7;
            const row = sq >> 4, col = sq & 7;
            if (p & BLACK_BIT) {
                const idx = (7 - row) * 8 + col;
                mg -= VALUE[t] + PST_MG[t][idx];
                eg -= VALUE[t] + PST_EG[t][idx];
                matB += VALUE[t];
                if (t === PAWN) {
                    pf1[col + 1]++;
                    if (row > pawnMaxRow[1][col + 1]) pawnMaxRow[1][col + 1] = row;
                    if (row < pawnMinRow[1][col + 1]) pawnMinRow[1][col + 1] = row;
                }
            } else {
                const idx = row * 8 + col;
                mg += VALUE[t] + PST_MG[t][idx];
                eg += VALUE[t] + PST_EG[t][idx];
                matW += VALUE[t];
                if (t === PAWN) {
                    pf0[col + 1]++;
                    if (row < pawnMinRow[0][col + 1]) pawnMinRow[0][col + 1] = row;
                    if (row > pawnMaxRow[0][col + 1]) pawnMaxRow[0][col + 1] = row;
                }
            }
            phase += PHASE_W[t];
        }

        // Пешечная структура: сдвоенные, изолированные, проходные
        for (let f = 1; f <= 8; f++) {
            if (pf0[f] > 1) { mg -= 12 * (pf0[f] - 1); eg -= 20 * (pf0[f] - 1); }
            if (pf1[f] > 1) { mg += 12 * (pf1[f] - 1); eg += 20 * (pf1[f] - 1); }
            if (pf0[f] && !pf0[f - 1] && !pf0[f + 1]) { mg -= 10 * pf0[f]; eg -= 12 * pf0[f]; }
            if (pf1[f] && !pf1[f - 1] && !pf1[f + 1]) { mg += 10 * pf1[f]; eg += 12 * pf1[f]; }
            // Белая проходная: самая продвинутая белая пешка на вертикали, перед ней нет чёрных пешек на f-1..f+1
            if (pf0[f]) {
                const r = pawnMinRow[0][f];
                let passed = true;
                for (let g = f - 1; g <= f + 1 && passed; g++) {
                    if (pf1[g] && pawnMinRow[1][g] < r) passed = false;
                }
                if (passed) { mg += PASSED_BONUS[r] >> 1; eg += PASSED_BONUS[r]; }
            }
            if (pf1[f]) {
                const r = pawnMaxRow[1][f];
                let passed = true;
                for (let g = f - 1; g <= f + 1 && passed; g++) {
                    if (pf0[g] && pawnMaxRow[0][g] > r) passed = false;
                }
                if (passed) { mg -= PASSED_BONUS[7 - r] >> 1; eg -= PASSED_BONUS[7 - r]; }
            }
        }

        // Ладьи на открытых вертикалях, пара слонов
        for (let sq = 0; sq < 128; sq++) {
            if (sq & 0x88) { sq += 7; continue; }
            const p = board[sq];
            if ((p & 7) !== ROOK) continue;
            const f = (sq & 7) + 1;
            if (p & BLACK_BIT) {
                if (!pf1[f]) { const b = pf0[f] ? 8 : 18; mg -= b; eg -= b >> 1; }
            } else if (!pf0[f]) { const b = pf1[f] ? 8 : 18; mg += b; eg += b >> 1; }
        }
        if (count[BISHOP] >= 2) { mg += 30; eg += 45; }
        if (count[BISHOP | BLACK_BIT] >= 2) { mg -= 30; eg -= 45; }

        if (phase > 24) phase = 24;
        let score = ((mg * phase) + (eg * (24 - phase))) / 24;

        // Добивание в эндшпиле: гнать короля слабейшей стороны к краю
        const diff = matW - matB;
        if (phase <= 10 && Math.abs(diff) >= 300) {
            const strong = diff > 0 ? WHITE : BLACK;
            const weakK = kingSq[strong ^ 1], strongK = kingSq[strong];
            const wr = weakK >> 4, wc = weakK & 7;
            const centerDist = Math.max(3 - wr, wr - 4) + Math.max(3 - wc, wc - 4);
            const kd = Math.abs((strongK >> 4) - wr) + Math.abs((strongK & 7) - wc);
            const bonus = (12 * centerDist + 6 * (14 - kd)) * (24 - phase) / 24;
            score += strong === WHITE ? bonus : -bonus;
        }

        score = Math.round(score);
        return side === WHITE ? score : -score;
    }

    function hasNonPawnMaterial(s) {
        const b = s === BLACK ? BLACK_BIT : 0;
        return count[KNIGHT | b] + count[BISHOP | b] + count[ROOK | b] + count[QUEEN | b] > 0;
    }

    // ---------- Поиск ----------
    function checkTime() {
        if (now() > deadline) stopped = true;
    }

    function scoreMoves(list, scores, n, ply, ttm) {
        const k0 = killers[ply * 2], k1 = killers[ply * 2 + 1];
        for (let i = 0; i < n; i++) {
            const m = list[i];
            if (m === ttm) { scores[i] = 3000000; continue; }
            const cap = mCapt(m), promo = mPromo(m);
            if (cap || promo) {
                scores[i] = 2000000 + VALUE[cap] * 10 - mPiece(m) + (promo ? VALUE[promo] * 10 : 0);
            } else if (m === k0) {
                scores[i] = 1500000;
            } else if (m === k1) {
                scores[i] = 1400000;
            } else {
                const p = board[mFrom(m)];
                scores[i] = historyH[p * 128 + mTo(m)];
            }
        }
    }

    function pickNext(list, scores, i, n) {
        let best = i;
        for (let j = i + 1; j < n; j++) if (scores[j] > scores[best]) best = j;
        if (best !== i) {
            const tm = list[i]; list[i] = list[best]; list[best] = tm;
            const ts = scores[i]; scores[i] = scores[best]; scores[best] = ts;
        }
        return list[i];
    }

    function quiesce(alpha, beta, ply) {
        if ((++nodes & 1023) === 0) checkTime();
        if (stopped) return 0;
        const check = inCheck();
        if (ply >= MAX_PLY) return evaluate();

        let best = -INF;
        if (!check) {
            const stand = evaluate();
            if (stand >= beta) return stand;
            if (stand > alpha) alpha = stand;
            best = stand;
        }
        const list = moveBuf[ply], scores = scoreBuf[ply];
        const n = genMoves(list, !check);
        scoreMoves(list, scores, n, ply, 0);
        let legal = 0;
        for (let i = 0; i < n; i++) {
            const m = pickNext(list, scores, i, n);
            if (!check && !mPromo(m) && best + VALUE[mCapt(m)] + 200 < alpha) continue; // дельта-отсечение
            if (!tryMove(m)) continue;
            legal++;
            const s = -quiesce(-beta, -alpha, ply + 1);
            unmakeMove();
            if (stopped) return 0;
            if (s > best) {
                best = s;
                if (s > alpha) {
                    alpha = s;
                    if (s >= beta) return s;
                }
            }
        }
        if (check && legal === 0) return -MATE + ply;
        return best;
    }

    function ttStoreScore(s, ply) {
        if (s > MATE_BOUND) return s + ply;
        if (s < -MATE_BOUND) return s - ply;
        return s;
    }
    function ttLoadScore(s, ply) {
        if (s > MATE_BOUND) return s - ply;
        if (s < -MATE_BOUND) return s + ply;
        return s;
    }

    function search(depth, alpha, beta, ply, allowNull) {
        if ((++nodes & 1023) === 0) checkTime();
        if (stopped) return 0;

        const check = inCheck();
        if (check) depth++;
        if (depth <= 0) return quiesce(alpha, beta, ply);
        if (ply >= MAX_PLY) return evaluate();

        if (halfmove >= 100 || isRepetition() || insufficientMaterial()) return 0;
        const ma = -MATE + ply, mb = MATE - ply - 1;
        if (alpha < ma) alpha = ma;
        if (beta > mb) beta = mb;
        if (alpha >= beta) return alpha;

        const idx = hashLo & TT_MASK;
        let ttm = 0;
        if (ttKey[idx] === hashHi && ttFlag[idx]) {
            ttm = ttMove[idx];
            if (ttDepth[idx] >= depth) {
                const s = ttLoadScore(ttScore[idx], ply);
                const f = ttFlag[idx];
                if (f === TT_EXACT) return s;
                if (f === TT_LOWER && s >= beta) return s;
                if (f === TT_UPPER && s <= alpha) return s;
            }
        }

        const pvNode = beta - alpha > 1;
        if (allowNull && !pvNode && !check && depth >= 3 && hasNonPawnMaterial(side) && evaluate() >= beta) {
            makeNull();
            const s = -search(depth - 3, -beta, -beta + 1, ply + 1, false);
            unmakeNull();
            if (stopped) return 0;
            if (s >= beta && s < MATE_BOUND) return beta;
        }

        const list = moveBuf[ply], scores = scoreBuf[ply];
        const n = genMoves(list, false);
        scoreMoves(list, scores, n, ply, ttm);

        const origAlpha = alpha;
        let best = -INF, bestMove = 0, legal = 0;
        for (let i = 0; i < n; i++) {
            const m = pickNext(list, scores, i, n);
            if (!tryMove(m)) continue;
            legal++;
            const quiet = !mCapt(m) && !mPromo(m);
            const givesCheck = attacked(kingSq[side], side ^ 1);
            let s;
            if (legal === 1) {
                s = -search(depth - 1, -beta, -alpha, ply + 1, true);
            } else {
                let r = 0;
                if (depth >= 3 && legal > 3 && quiet && !check && !givesCheck) {
                    r = legal > 8 ? 2 : 1;
                }
                s = -search(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
                if (s > alpha && (r > 0 || s < beta)) {
                    s = -search(depth - 1, -beta, -alpha, ply + 1, true);
                }
            }
            unmakeMove();
            if (stopped) return 0;
            if (s > best) {
                best = s;
                bestMove = m;
                if (s > alpha) {
                    alpha = s;
                    if (s >= beta) {
                        if (quiet) {
                            if (killers[ply * 2] !== m) {
                                killers[ply * 2 + 1] = killers[ply * 2];
                                killers[ply * 2] = m;
                            }
                            const hi = board[mFrom(m)] * 128 + mTo(m);
                            historyH[hi] += depth * depth;
                            if (historyH[hi] > 1000000) {
                                for (let k = 0; k < historyH.length; k++) historyH[k] >>= 1;
                            }
                        }
                        break;
                    }
                }
            }
        }
        if (legal === 0) return check ? -MATE + ply : 0;

        ttKey[idx] = hashHi;
        ttMove[idx] = bestMove;
        ttScore[idx] = ttStoreScore(best, ply);
        ttDepth[idx] = depth;
        ttFlag[idx] = best >= beta ? TT_LOWER : (best > origAlpha ? TT_EXACT : TT_UPPER);
        return best;
    }

    // Поиск по корню. fullWindow — точные оценки всех ходов (для уровней с разбросом).
    // Иначе PVS: точная оценка гарантирована только ходам не хуже (лучший − margin),
    // у остальных — лишь верхняя граница, поэтому выбирать из них случайно нельзя.
    function rootSearch(rootMoves, depth, fullWindow, margin) {
        let alpha = -INF;
        const beta = INF;
        let bestScore = -INF, bestMove = rootMoves[0].move;
        for (let i = 0; i < rootMoves.length; i++) {
            const rm = rootMoves[i];
            makeMove(rm.move);
            let s;
            if (fullWindow) {
                s = -search(depth - 1, -INF, INF, 1, true);
            } else if (i === 0) {
                s = -search(depth - 1, -beta, -alpha, 1, true);
            } else {
                const bound = alpha - margin;
                s = -search(depth - 1, -bound - 1, -bound, 1, true);
                if (s > bound && !stopped) s = -search(depth - 1, -beta, -bound, 1, true);
            }
            unmakeMove();
            if (stopped) break;
            rm.score = s;
            rm.depth = depth;
            if (s > bestScore) { bestScore = s; bestMove = rm.move; }
            if (s > alpha) alpha = s;
        }
        return { bestMove, bestScore };
    }

    // Уровни сложности
    const LEVELS = {
        easy: { maxDepth: 1, timeMs: 400, noise: 160, blunder: 0.22, fullWindow: true },
        medium: { maxDepth: 3, timeMs: 900, noise: 35, blunder: 0.04, fullWindow: true },
        hard: { maxDepth: 64, timeMs: 1800, noise: 0, blunder: 0, fullWindow: false }
    };

    function think(levelName, timeOverride, rng) {
        const level = LEVELS[levelName] || LEVELS.medium;
        const random = rng || Math.random;
        const t0 = now();
        deadline = t0 + (timeOverride || level.timeMs);
        stopped = false;
        nodes = 0;
        killers.fill(0);
        historyH.fill(0);

        const legal = legalMoves();
        if (!legal.length) return null;
        const rootMoves = legal.map((m) => ({ move: m, score: -INF, depth: 0 }));
        if (legal.length === 1) {
            return finish(rootMoves[0].move, 0, 0, t0);
        }

        // Небольшое разнообразие в дебюте на «Тяжёлом» (только среди точно посчитанных ходов)
        const openingNoise = !level.noise && hply < 8 ? 12 : 0;
        const margin = level.fullWindow ? 0 : openingNoise;

        let completed = null;
        let depthDone = 0;
        for (let depth = 1; depth <= level.maxDepth; depth++) {
            // Порядок корневых ходов: по оценкам прошлой итерации
            rootMoves.sort((a, b) => b.score - a.score);
            const res = rootSearch(rootMoves, depth, level.fullWindow, margin);
            if (stopped) {
                // Итерация прервана. Если прежний лучший ход (он считается первым) успел досчитаться
                // на новой глубине, то лучший из досчитанных ходов надёжнее результата прошлой итерации.
                if (!level.fullWindow && completed && rootMoves[0].depth === depth && res.bestScore > -INF) {
                    completed = { bestMove: res.bestMove, bestScore: res.bestScore, scores: completed.scores };
                }
                break;
            }
            completed = { bestMove: res.bestMove, bestScore: res.bestScore, scores: rootMoves.map((r) => ({ move: r.move, score: r.score })) };
            depthDone = depth;
            if (Math.abs(res.bestScore) > MATE_BOUND) break; // мат найден
            if (now() - t0 > (timeOverride || level.timeMs) * 0.55) break; // следующая итерация не успеет
        }
        if (!completed) {
            completed = { bestMove: rootMoves[0].move, bestScore: 0, scores: rootMoves.map((r) => ({ move: r.move, score: 0 })) };
        }

        let chosen = completed.bestMove;
        const scored = completed.scores.filter((r) => r.score > -INF).sort((a, b) => b.score - a.score);

        // Разброс для слабых уровней: иногда случайный ход, иначе — выбор среди близких по оценке
        const mateAvailable = scored.length && scored[0].score > MATE_BOUND;
        if (!mateAvailable && level.blunder && random() < level.blunder) {
            chosen = legal[Math.floor(random() * legal.length)];
        } else if (!mateAvailable && scored.length > 1) {
            const noise = level.noise || openingNoise;
            if (noise) {
                const top = scored[0].score;
                const pool = scored.filter((r) => r.score > top - noise);
                const weights = pool.map((r) => Math.exp((r.score - top) / Math.max(10, noise / 2)));
                const sum = weights.reduce((a, b) => a + b, 0);
                let x = random() * sum;
                for (let i = 0; i < pool.length; i++) {
                    x -= weights[i];
                    if (x <= 0) { chosen = pool[i].move; break; }
                }
            }
        }
        return finish(chosen, completed.bestScore, depthDone, t0);
    }

    function finish(m, score, depth, t0) {
        const promo = mPromo(m);
        return {
            from: sqName(mFrom(m)),
            to: sqName(mTo(m)),
            promotion: promo ? PIECE_CHARS[promo] : undefined,
            uci: moveToUci(m),
            score: side === WHITE ? score : -score,
            depth,
            nodes,
            timeMs: Math.round(now() - t0)
        };
    }

    function setPosition(fen, moves) {
        loadFen(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        for (const uci of (moves || [])) {
            const legal = legalMoves();
            const m = legal.find((x) => moveToUci(x) === uci);
            if (!m) throw new Error('Недопустимый ход в истории: ' + uci);
            makeMove(m);
        }
    }

    function perft(depth) {
        if (depth === 0) return 1;
        const list = new Int32Array(256);
        const n = genMoves(list, false);
        let total = 0;
        for (let i = 0; i < n; i++) {
            if (!tryMove(list[i])) continue;
            total += depth === 1 ? 1 : perft(depth - 1);
            unmakeMove();
        }
        return total;
    }

    return {
        LEVELS,
        search(params) {
            setPosition(params.fen, params.moves);
            return think(params.level, params.timeMs, params.rng);
        },
        perft(fen, depth) {
            loadFen(fen);
            return perft(depth);
        },
        legalMovesUci(fen, moves) {
            setPosition(fen, moves);
            return legalMoves().map(moveToUci);
        },
        evaluateFen(fen) {
            loadFen(fen);
            return evaluate();
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessEngineModule;
}
