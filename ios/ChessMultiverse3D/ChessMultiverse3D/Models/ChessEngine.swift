import Foundation

/// Шахматный движок компьютерного соперника — честный порт js/engine.js.
///
/// 0x88-доска, генерация псевдолегальных ходов с проверкой короля, альфа-бета (PVS)
/// с итеративным углублением и ограничением по времени, quiescence-поиск взятий,
/// таблица транспозиций (Zobrist), killer/history-эвристики, нулевой ход и
/// сокращение поздних ходов (LMR). Три уровня сложности с тем же разбросом (noise)
/// и шансом «зевка» (blunder), что и в оригинале.
final class ChessEngine {

    // ---------- Константы ----------
    static let PAWN: Int32 = 1, KNIGHT: Int32 = 2, BISHOP: Int32 = 3, ROOK: Int32 = 4, QUEEN: Int32 = 5, KING: Int32 = 6
    static let WHITE: Int32 = 0, BLACK: Int32 = 1
    static let BLACK_BIT: Int32 = 8

    static let FLAG_DOUBLE: Int32 = 1 << 20
    static let FLAG_EP: Int32 = 1 << 21
    static let FLAG_CASTLE: Int32 = 1 << 22

    static let MATE: Int32 = 30000
    static let MATE_BOUND: Int32 = MATE - 1000
    static let INF: Int32 = 32000
    static let MAX_PLY = 96

    static let KNIGHT_OFFS: [Int32] = [-33, -31, -18, -14, 14, 18, 31, 33]
    static let KING_OFFS: [Int32] = [-17, -16, -15, -1, 1, 15, 16, 17]
    static let BISHOP_DIRS: [Int32] = [-17, -15, 15, 17]
    static let ROOK_DIRS: [Int32] = [-16, -1, 1, 16]

    static let VALUE: [Int32] = [0, 100, 320, 330, 500, 900, 0]
    static let PHASE_W: [Int32] = [0, 0, 1, 1, 2, 4, 0]

    // Кодирование хода: from | to<<7 | promo<<14 | captured<<17 | флаги | piece<<23
    static func mFrom(_ m: Int32) -> Int32 { m & 127 }
    static func mTo(_ m: Int32) -> Int32 { (m >> 7) & 127 }
    static func mPromo(_ m: Int32) -> Int32 { (m >> 14) & 7 }
    static func mCapt(_ m: Int32) -> Int32 { (m >> 17) & 7 }
    static func mPiece(_ m: Int32) -> Int32 { (m >> 23) & 7 }

    // ---------- Таблицы позиций (с точки зрения белых, индекс 0 = a8) ----------
    static let PST_MG_PAWN: [Int32] = [
        0, 0, 0, 0, 0, 0, 0, 0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0,
        5, -5, -10, 0, 0, -10, -5, 5,
        5, 10, 10, -20, -20, 10, 10, 5,
        0, 0, 0, 0, 0, 0, 0, 0
    ]
    static let PST_EG_PAWN: [Int32] = [
        0, 0, 0, 0, 0, 0, 0, 0,
        90, 90, 90, 90, 90, 90, 90, 90,
        55, 55, 55, 55, 55, 55, 55, 55,
        32, 32, 32, 32, 32, 32, 32, 32,
        18, 18, 18, 18, 18, 18, 18, 18,
        8, 8, 8, 8, 8, 8, 8, 8,
        2, 2, 2, 2, 2, 2, 2, 2,
        0, 0, 0, 0, 0, 0, 0, 0
    ]
    static let PST_KNIGHT: [Int32] = [
        -50, -40, -30, -30, -30, -30, -40, -50,
        -40, -20, 0, 0, 0, 0, -20, -40,
        -30, 0, 10, 15, 15, 10, 0, -30,
        -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30,
        -30, 5, 10, 15, 15, 10, 5, -30,
        -40, -20, 0, 5, 5, 0, -20, -40,
        -50, -40, -30, -30, -30, -30, -40, -50
    ]
    static let PST_BISHOP: [Int32] = [
        -20, -10, -10, -10, -10, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 10, 10, 5, 0, -10,
        -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10,
        -10, 10, 10, 10, 10, 10, 10, -10,
        -10, 5, 0, 0, 0, 0, 5, -10,
        -20, -10, -10, -10, -10, -10, -10, -20
    ]
    static let PST_ROOK: [Int32] = [
        0, 0, 0, 0, 0, 0, 0, 0,
        5, 10, 10, 10, 10, 10, 10, 5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        0, 0, 0, 5, 5, 0, 0, 0
    ]
    static let PST_QUEEN: [Int32] = [
        -20, -10, -10, -5, -5, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 5, 5, 5, 0, -10,
        -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5,
        -10, 5, 5, 5, 5, 5, 0, -10,
        -10, 0, 5, 0, 0, 0, 0, -10,
        -20, -10, -10, -5, -5, -10, -10, -20
    ]
    static let PST_MG_KING: [Int32] = [
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20,
        -10, -20, -20, -20, -20, -20, -20, -10,
        20, 20, 0, 0, 0, 0, 20, 20,
        20, 30, 10, 0, 0, 10, 30, 20
    ]
    static let PST_EG_KING: [Int32] = [
        -50, -40, -30, -20, -20, -30, -40, -50,
        -30, -20, -10, 0, 0, -10, -20, -30,
        -30, -10, 20, 30, 30, 20, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 20, 30, 30, 20, -10, -30,
        -30, -30, 0, 0, 0, 0, -30, -30,
        -50, -30, -30, -30, -30, -30, -30, -50
    ]
    static let PASSED_BONUS: [Int32] = [0, 120, 80, 50, 30, 15, 10, 0]

    /// PST_MG/PST_EG по индексу типа фигуры (1...6)
    func pstMG(_ t: Int32) -> [Int32] {
        switch t {
        case Self.PAWN: return Self.PST_MG_PAWN
        case Self.KNIGHT: return Self.PST_KNIGHT
        case Self.BISHOP: return Self.PST_BISHOP
        case Self.ROOK: return Self.PST_ROOK
        case Self.QUEEN: return Self.PST_QUEEN
        case Self.KING: return Self.PST_MG_KING
        default: return Self.PST_MG_PAWN
        }
    }
    func pstEG(_ t: Int32) -> [Int32] {
        switch t {
        case Self.PAWN: return Self.PST_EG_PAWN
        case Self.KNIGHT: return Self.PST_KNIGHT
        case Self.BISHOP: return Self.PST_BISHOP
        case Self.ROOK: return Self.PST_ROOK
        case Self.QUEEN: return Self.PST_QUEEN
        case Self.KING: return Self.PST_EG_KING
        default: return Self.PST_EG_PAWN
        }
    }

    // ---------- Zobrist ----------
    private var seed: UInt32 = 0x9e3779b9
    private func rand32() -> Int32 {
        seed ^= seed << 13
        seed ^= seed >> 17
        seed ^= seed << 5
        return Int32(bitPattern: seed)
    }
    private var ZP_LO = [Int32](repeating: 0, count: 16 * 128)
    private var ZP_HI = [Int32](repeating: 0, count: 16 * 128)
    private var ZC_LO = [Int32](repeating: 0, count: 16)
    private var ZC_HI = [Int32](repeating: 0, count: 16)
    private var ZE_LO = [Int32](repeating: 0, count: 8)
    private var ZE_HI = [Int32](repeating: 0, count: 8)
    private var ZS_LO: Int32 = 0
    private var ZS_HI: Int32 = 0

    // Права рокировки: 1 = белые O-O, 2 = белые O-O-O, 4 = чёрные O-O, 8 = чёрные O-O-O
    private var CASTLE_KEEP = [Int32](repeating: 15, count: 128)

    // ---------- Состояние ----------
    private var board = [Int8](repeating: 0, count: 128)
    private var side: Int32 = 0
    private var castle: Int32 = 0
    private var ep: Int32 = -1
    private var halfmove: Int32 = 0
    private var hashLo: Int32 = 0
    private var hashHi: Int32 = 0
    private var kingSq: [Int32] = [116, 4]
    private var count = [Int32](repeating: 0, count: 16)

    private let HIST_MAX = 2048
    private var hply: Int = 0
    private var uMove: [Int32]
    private var uCapt: [Int8]
    private var uCastle: [Int32]
    private var uEp: [Int32]
    private var uHalf: [Int32]
    private var uHashLo: [Int32]
    private var uHashHi: [Int32]
    private var posLo: [Int32]
    private var posHi: [Int32]

    // Таблица транспозиций
    private let TT_BITS = 19
    private var TT_SIZE: Int { 1 << TT_BITS }
    private var TT_MASK: Int32 { Int32(TT_SIZE - 1) }
    private var ttKey: [Int32]
    private var ttMove: [Int32]
    private var ttScore: [Int32]
    private var ttDepth: [Int8]
    private var ttFlag: [Int8] // 0 пусто, 1 точная, 2 нижняя граница, 3 верхняя
    private let TT_EXACT: Int8 = 1, TT_LOWER: Int8 = 2, TT_UPPER: Int8 = 3

    // Буферы ходов на каждый уровень поиска
    private var moveBuf: [[Int32]]
    private var scoreBuf: [[Int32]]
    private var killers: [Int32]
    private var historyH: [Int32]

    private var nodes: Int = 0
    private var stopped: Bool = false
    private var deadline: Double = 0
    private func now() -> Double { Date().timeIntervalSince1970 * 1000.0 }

    private static let PIECE_CHARS = " pnbrqk"

    // ---------- Инициализация ----------
    init() {
        uMove = [Int32](repeating: 0, count: HIST_MAX)
        uCapt = [Int8](repeating: 0, count: HIST_MAX)
        uCastle = [Int32](repeating: 0, count: HIST_MAX)
        uEp = [Int32](repeating: 0, count: HIST_MAX)
        uHalf = [Int32](repeating: 0, count: HIST_MAX)
        uHashLo = [Int32](repeating: 0, count: HIST_MAX)
        uHashHi = [Int32](repeating: 0, count: HIST_MAX)
        posLo = [Int32](repeating: 0, count: HIST_MAX)
        posHi = [Int32](repeating: 0, count: HIST_MAX)

        ttKey = [Int32](repeating: 0, count: 1 << TT_BITS)
        ttMove = [Int32](repeating: 0, count: 1 << TT_BITS)
        ttScore = [Int32](repeating: 0, count: 1 << TT_BITS)
        ttDepth = [Int8](repeating: 0, count: 1 << TT_BITS)
        ttFlag = [Int8](repeating: 0, count: 1 << TT_BITS)

        moveBuf = (0...Self.MAX_PLY).map { _ in [Int32](repeating: 0, count: 256) }
        scoreBuf = (0...Self.MAX_PLY).map { _ in [Int32](repeating: 0, count: 256) }
        killers = [Int32](repeating: 0, count: (Self.MAX_PLY + 1) * 2)
        historyH = [Int32](repeating: 0, count: 16 * 128)

        for i in 0..<(16 * 128) { ZP_LO[i] = rand32(); ZP_HI[i] = rand32() }
        for i in 0..<16 { ZC_LO[i] = rand32(); ZC_HI[i] = rand32() }
        for i in 0..<8 { ZE_LO[i] = rand32(); ZE_HI[i] = rand32() }
        ZS_LO = rand32(); ZS_HI = rand32()

        CASTLE_KEEP[112] = 15 & ~2 // a1
        CASTLE_KEEP[116] = 15 & ~3 // e1
        CASTLE_KEEP[119] = 15 & ~1 // h1
        CASTLE_KEEP[0] = 15 & ~8   // a8
        CASTLE_KEEP[4] = 15 & ~12  // e8
        CASTLE_KEEP[7] = 15 & ~4   // h8
    }

    // ---------- Утилиты ----------
    private func colorOf(_ p: Int8) -> Int32 { (p & 8) != 0 ? Self.BLACK : Self.WHITE }
    private func sqName(_ sq: Int32) -> String {
        let file = "abcdefgh"
        let fi = file.index(file.startIndex, offsetBy: Int(sq & 7))
        return "\(file[fi])\(8 - (sq >> 4))"
    }
    private func sqFromName(_ s: String) -> Int32 {
        let chars = Array(s)
        let file = Int32(chars[0].asciiValue! - 97)
        let rank = Int32(String(chars[1])) ?? 0
        return (8 - rank) * 16 + file
    }

    private func zPiece(_ p: Int8, _ sq: Int32) {
        let i = Int(p) * 128 + Int(sq)
        hashLo ^= ZP_LO[i]
        hashHi ^= ZP_HI[i]
    }

    private func computeHash() {
        hashLo = 0; hashHi = 0
        var sq: Int32 = 0
        while sq < 128 {
            if (sq & 0x88) != 0 { sq += 8; continue }
            let p = board[Int(sq)]
            if p != 0 { zPiece(p, sq) }
            sq += 1
        }
        hashLo ^= ZC_LO[Int(castle)]; hashHi ^= ZC_HI[Int(castle)]
        if ep >= 0 { hashLo ^= ZE_LO[Int(ep & 7)]; hashHi ^= ZE_HI[Int(ep & 7)] }
        if side == Self.BLACK { hashLo ^= ZS_LO; hashHi ^= ZS_HI }
    }

    func loadFen(_ fen: String) {
        for i in 0..<128 { board[i] = 0 }
        for i in 0..<16 { count[i] = 0 }
        let parts = fen.trimmingCharacters(in: .whitespaces).split(separator: " ").map(String.init)
        var row: Int32 = 0, col: Int32 = 0
        for ch in parts[0] {
            if ch == "/" { row += 1; col = 0; continue }
            if let d = ch.wholeNumberValue, ch >= "1" && ch <= "8" { col += Int32(d); continue }
            let lower = Character(ch.lowercased())
            let type = Self.PIECE_CHARS.firstIndex(of: lower).map { Self.PIECE_CHARS.distance(from: Self.PIECE_CHARS.startIndex, to: $0) } ?? 0
            let p = Int8(type) | (ch == lower ? Int8(8) : 0)
            let sq = row * 16 + col
            board[Int(sq)] = p
            count[Int(p)] += 1
            if type == Int(Self.KING) { kingSq[ch == lower ? 1 : 0] = sq }
            col += 1
        }
        side = (parts.count > 1 && parts[1] == "b") ? Self.BLACK : Self.WHITE
        castle = 0
        let c = parts.count > 2 ? parts[2] : "-"
        if c.contains("K") { castle |= 1 }
        if c.contains("Q") { castle |= 2 }
        if c.contains("k") { castle |= 4 }
        if c.contains("q") { castle |= 8 }
        if parts.count > 3, parts[3] != "-" { ep = sqFromName(parts[3]) } else { ep = -1 }
        halfmove = parts.count > 4 ? (Int32(parts[4]) ?? 0) : 0
        hply = 0
        computeHash()
        posLo[0] = hashLo; posHi[0] = hashHi
    }

    // ---------- Атаки ----------
    private func attacked(_ sq: Int32, by: Int32) -> Bool {
        let bit: Int8 = by == Self.BLACK ? 8 : 0
        var s: Int32
        if by == Self.WHITE {
            s = sq + 15; if (s & 0x88) == 0 && board[Int(s)] == Int8(Self.PAWN) { return true }
            s = sq + 17; if (s & 0x88) == 0 && board[Int(s)] == Int8(Self.PAWN) { return true }
        } else {
            s = sq - 15; if (s & 0x88) == 0 && board[Int(s)] == Int8(Self.PAWN) | 8 { return true }
            s = sq - 17; if (s & 0x88) == 0 && board[Int(s)] == Int8(Self.PAWN) | 8 { return true }
        }
        let kn = Int8(Self.KNIGHT) | bit
        for off in Self.KNIGHT_OFFS {
            s = sq + off
            if (s & 0x88) == 0 && board[Int(s)] == kn { return true }
        }
        let kg = Int8(Self.KING) | bit
        for off in Self.KING_OFFS {
            s = sq + off
            if (s & 0x88) == 0 && board[Int(s)] == kg { return true }
        }
        let bq = Int8(Self.BISHOP) | bit, qq = Int8(Self.QUEEN) | bit, rq = Int8(Self.ROOK) | bit
        for d in Self.BISHOP_DIRS {
            s = sq + d
            while (s & 0x88) == 0 {
                let p = board[Int(s)]
                if p != 0 { if p == bq || p == qq { return true }; break }
                s += d
            }
        }
        for d in Self.ROOK_DIRS {
            s = sq + d
            while (s & 0x88) == 0 {
                let p = board[Int(s)]
                if p != 0 { if p == rq || p == qq { return true }; break }
                s += d
            }
        }
        return false
    }

    private func inCheck() -> Bool { attacked(kingSq[Int(side)], by: side ^ 1) }

    // ---------- Генерация ходов ----------
    private func genMoves(_ list: inout [Int32], capturesOnly: Bool) -> Int {
        var n = 0
        let us = side, them = side ^ 1
        let usBit: Int8 = us == Self.BLACK ? 8 : 0
        let pawnDir: Int32 = us == Self.WHITE ? -16 : 16
        let startRow: Int32 = us == Self.WHITE ? 6 : 1
        let promoRow: Int32 = us == Self.WHITE ? 0 : 7

        var sq: Int32 = 0
        while sq < 128 {
            if (sq & 0x88) != 0 { sq += 8; continue }
            let p = board[Int(sq)]
            if p == 0 || (p & 8) != usBit { sq += 1; continue }
            let t = Int32(p & 7)
            let pieceBits = t << 23

            if t == Self.PAWN {
                let to = sq + pawnDir
                if board[Int(to)] == 0 {
                    if (to >> 4) == promoRow {
                        list[n] = sq | (to << 7) | (Self.QUEEN << 14) | pieceBits; n += 1
                        if !capturesOnly {
                            list[n] = sq | (to << 7) | (Self.ROOK << 14) | pieceBits; n += 1
                            list[n] = sq | (to << 7) | (Self.BISHOP << 14) | pieceBits; n += 1
                            list[n] = sq | (to << 7) | (Self.KNIGHT << 14) | pieceBits; n += 1
                        }
                    } else if !capturesOnly {
                        list[n] = sq | (to << 7) | pieceBits; n += 1
                        let to2 = to + pawnDir
                        if (sq >> 4) == startRow && board[Int(to2)] == 0 {
                            list[n] = sq | (to2 << 7) | Self.FLAG_DOUBLE | pieceBits; n += 1
                        }
                    }
                }
                var k: Int32 = -1
                while k <= 1 {
                    if k == 0 { k += 2; continue }
                    let tc = to + k
                    if (tc & 0x88) != 0 { k += 2; continue }
                    let q = board[Int(tc)]
                    if q != 0 && colorOf(q) == them {
                        let capBits = Int32(q & 7) << 17
                        if (tc >> 4) == promoRow {
                            list[n] = sq | (tc << 7) | (Self.QUEEN << 14) | capBits | pieceBits; n += 1
                            list[n] = sq | (tc << 7) | (Self.ROOK << 14) | capBits | pieceBits; n += 1
                            list[n] = sq | (tc << 7) | (Self.BISHOP << 14) | capBits | pieceBits; n += 1
                            list[n] = sq | (tc << 7) | (Self.KNIGHT << 14) | capBits | pieceBits; n += 1
                        } else {
                            list[n] = sq | (tc << 7) | capBits | pieceBits; n += 1
                        }
                    } else if tc == ep {
                        list[n] = sq | (tc << 7) | (Self.PAWN << 17) | Self.FLAG_EP | pieceBits; n += 1
                    }
                    k += 2
                }
                sq += 1
                continue
            }

            if t == Self.KNIGHT || t == Self.KING {
                let offs = t == Self.KNIGHT ? Self.KNIGHT_OFFS : Self.KING_OFFS
                for off in offs {
                    let to = sq + off
                    if (to & 0x88) != 0 { continue }
                    let q = board[Int(to)]
                    if q == 0 {
                        if !capturesOnly { list[n] = sq | (to << 7) | pieceBits; n += 1 }
                    } else if colorOf(q) == them {
                        list[n] = sq | (to << 7) | (Int32(q & 7) << 17) | pieceBits; n += 1
                    }
                }
                if t == Self.KING && !capturesOnly {
                    if us == Self.WHITE && sq == 116 {
                        if (castle & 1) != 0 && board[117] == 0 && board[118] == 0 && board[119] == Int8(Self.ROOK) &&
                            !attacked(116, by: Self.BLACK) && !attacked(117, by: Self.BLACK) {
                            list[n] = 116 | (118 << 7) | Self.FLAG_CASTLE | pieceBits; n += 1
                        }
                        if (castle & 2) != 0 && board[115] == 0 && board[114] == 0 && board[113] == 0 && board[112] == Int8(Self.ROOK) &&
                            !attacked(116, by: Self.BLACK) && !attacked(115, by: Self.BLACK) {
                            list[n] = 116 | (114 << 7) | Self.FLAG_CASTLE | pieceBits; n += 1
                        }
                    } else if us == Self.BLACK && sq == 4 {
                        if (castle & 4) != 0 && board[5] == 0 && board[6] == 0 && board[7] == (Int8(Self.ROOK) | 8) &&
                            !attacked(4, by: Self.WHITE) && !attacked(5, by: Self.WHITE) {
                            list[n] = 4 | (6 << 7) | Self.FLAG_CASTLE | pieceBits; n += 1
                        }
                        if (castle & 8) != 0 && board[3] == 0 && board[2] == 0 && board[1] == 0 && board[0] == (Int8(Self.ROOK) | 8) &&
                            !attacked(4, by: Self.WHITE) && !attacked(3, by: Self.WHITE) {
                            list[n] = 4 | (2 << 7) | Self.FLAG_CASTLE | pieceBits; n += 1
                        }
                    }
                }
                sq += 1
                continue
            }

            let dirs = t == Self.BISHOP ? Self.BISHOP_DIRS : t == Self.ROOK ? Self.ROOK_DIRS : Self.KING_OFFS
            for d in dirs {
                var to = sq + d
                while (to & 0x88) == 0 {
                    let q = board[Int(to)]
                    if q == 0 {
                        if !capturesOnly { list[n] = sq | (to << 7) | pieceBits; n += 1 }
                    } else {
                        if colorOf(q) == them { list[n] = sq | (to << 7) | (Int32(q & 7) << 17) | pieceBits; n += 1 }
                        break
                    }
                    to += d
                }
            }
            sq += 1
        }
        return n
    }

    // ---------- Сделать / отменить ход ----------
    private func makeMove(_ m: Int32) {
        let from = Self.mFrom(m), to = Self.mTo(m)
        let p = board[Int(from)]
        let captured = board[Int(to)]
        let u = hply
        uMove[u] = m; uCapt[u] = captured; uCastle[u] = castle; uEp[u] = ep; uHalf[u] = halfmove
        uHashLo[u] = hashLo; uHashHi[u] = hashHi

        if ep >= 0 { hashLo ^= ZE_LO[Int(ep & 7)]; hashHi ^= ZE_HI[Int(ep & 7)] }
        hashLo ^= ZC_LO[Int(castle)]; hashHi ^= ZC_HI[Int(castle)]

        zPiece(p, from)
        board[Int(from)] = 0
        if captured != 0 { zPiece(captured, to); count[Int(captured)] -= 1 }
        var placed = p
        let promo = Self.mPromo(m)
        if promo != 0 {
            placed = Int8(promo) | (p & 8)
            count[Int(p)] -= 1; count[Int(placed)] += 1
        }
        board[Int(to)] = placed
        zPiece(placed, to)

        if (m & Self.FLAG_EP) != 0 {
            let capSq = to + (side == Self.WHITE ? 16 : -16)
            let cp = board[Int(capSq)]
            zPiece(cp, capSq)
            board[Int(capSq)] = 0
            count[Int(cp)] -= 1
        } else if (m & Self.FLAG_CASTLE) != 0 {
            var rFrom: Int32, rTo: Int32
            if to > from { rFrom = from + 3; rTo = from + 1 } else { rFrom = from - 4; rTo = from - 1 }
            let r = board[Int(rFrom)]
            board[Int(rFrom)] = 0; board[Int(rTo)] = r
            zPiece(r, rFrom); zPiece(r, rTo)
        }
        if (p & 7) == Int8(Self.KING) { kingSq[Int(side)] = to }

        castle &= (CASTLE_KEEP[Int(from)] & CASTLE_KEEP[Int(to)])
        hashLo ^= ZC_LO[Int(castle)]; hashHi ^= ZC_HI[Int(castle)]

        ep = -1
        if (m & Self.FLAG_DOUBLE) != 0 {
            ep = (from + to) >> 1
            hashLo ^= ZE_LO[Int(ep & 7)]; hashHi ^= ZE_HI[Int(ep & 7)]
        }
        halfmove = ((p & 7) == Int8(Self.PAWN) || captured != 0) ? 0 : halfmove + 1
        side ^= 1
        hashLo ^= ZS_LO; hashHi ^= ZS_HI
        hply += 1
        posLo[hply] = hashLo; posHi[hply] = hashHi
    }

    private func unmakeMove() {
        hply -= 1
        let u = hply
        let m = uMove[u]
        side ^= 1
        let from = Self.mFrom(m), to = Self.mTo(m)
        var p = board[Int(to)]
        let promo = Self.mPromo(m)
        if promo != 0 {
            count[Int(p)] -= 1
            p = Int8(Self.PAWN) | (p & 8)
            count[Int(p)] += 1
        }
        board[Int(from)] = p
        let captured = uCapt[u]
        board[Int(to)] = captured
        if captured != 0 { count[Int(captured)] += 1 }
        if (m & Self.FLAG_EP) != 0 {
            let capSq = to + (side == Self.WHITE ? 16 : -16)
            let cp = Int8(Self.PAWN) | (side == Self.WHITE ? Int8(8) : 0)
            board[Int(capSq)] = cp
            count[Int(cp)] += 1
        } else if (m & Self.FLAG_CASTLE) != 0 {
            var rFrom: Int32, rTo: Int32
            if to > from { rFrom = from + 3; rTo = from + 1 } else { rFrom = from - 4; rTo = from - 1 }
            board[Int(rFrom)] = board[Int(rTo)]; board[Int(rTo)] = 0
        }
        if (p & 7) == Int8(Self.KING) { kingSq[Int(side)] = from }
        castle = uCastle[u]; ep = uEp[u]; halfmove = uHalf[u]
        hashLo = uHashLo[u]; hashHi = uHashHi[u]
    }

    private func makeNull() {
        let u = hply
        uMove[u] = 0; uCapt[u] = 0; uCastle[u] = castle; uEp[u] = ep; uHalf[u] = halfmove
        uHashLo[u] = hashLo; uHashHi[u] = hashHi
        if ep >= 0 { hashLo ^= ZE_LO[Int(ep & 7)]; hashHi ^= ZE_HI[Int(ep & 7)] }
        ep = -1
        side ^= 1
        hashLo ^= ZS_LO; hashHi ^= ZS_HI
        halfmove += 1
        hply += 1
        posLo[hply] = hashLo; posHi[hply] = hashHi
    }

    private func unmakeNull() {
        hply -= 1
        let u = hply
        side ^= 1
        castle = uCastle[u]; ep = uEp[u]; halfmove = uHalf[u]
        hashLo = uHashLo[u]; hashHi = uHashHi[u]
    }

    private func tryMove(_ m: Int32) -> Bool {
        makeMove(m)
        if attacked(kingSq[Int(side ^ 1)], by: side) { unmakeMove(); return false }
        return true
    }

    func legalMoves() -> [Int32] {
        var list = [Int32](repeating: 0, count: 256)
        let n = genMoves(&list, capturesOnly: false)
        var res: [Int32] = []
        for i in 0..<n {
            if tryMove(list[i]) { unmakeMove(); res.append(list[i]) }
        }
        return res
    }

    private func moveToUci(_ m: Int32) -> String {
        let promo = Self.mPromo(m)
        let pch = promo != 0 ? String(Self.PIECE_CHARS[Self.PIECE_CHARS.index(Self.PIECE_CHARS.startIndex, offsetBy: Int(promo))]) : ""
        return sqName(Self.mFrom(m)) + sqName(Self.mTo(m)) + pch
    }

    private func isRepetition() -> Bool {
        let stop = max(0, hply - Int(halfmove))
        var i = hply - 2
        while i >= stop {
            if posLo[i] == hashLo && posHi[i] == hashHi { return true }
            i -= 2
        }
        return false
    }

    // ---------- Оценка позиции ----------
    private var pawnFiles0 = [Int32](repeating: 0, count: 10)
    private var pawnFiles1 = [Int32](repeating: 0, count: 10)
    private var pawnMinRow0 = [Int32](repeating: 8, count: 10)
    private var pawnMinRow1 = [Int32](repeating: 8, count: 10)
    private var pawnMaxRow0 = [Int32](repeating: -1, count: 10)
    private var pawnMaxRow1 = [Int32](repeating: -1, count: 10)

    private func insufficientMaterial() -> Bool {
        if count[Int(Self.PAWN)] != 0 || count[Int(Self.PAWN) | 8] != 0 ||
            count[Int(Self.ROOK)] != 0 || count[Int(Self.ROOK) | 8] != 0 ||
            count[Int(Self.QUEEN)] != 0 || count[Int(Self.QUEEN) | 8] != 0 { return false }
        let wMinor = count[Int(Self.KNIGHT)] + count[Int(Self.BISHOP)]
        let bMinor = count[Int(Self.KNIGHT) | 8] + count[Int(Self.BISHOP) | 8]
        return wMinor <= 1 && bMinor <= 1
    }

    private func evaluate() -> Int32 {
        if insufficientMaterial() { return 0 }
        var mg: Int32 = 0, eg: Int32 = 0, phase: Int32 = 0
        var matW: Int32 = 0, matB: Int32 = 0
        for i in 0..<10 { pawnFiles0[i] = 0; pawnFiles1[i] = 0; pawnMinRow0[i] = 8; pawnMinRow1[i] = 8; pawnMaxRow0[i] = -1; pawnMaxRow1[i] = -1 }

        var sq: Int32 = 0
        while sq < 128 {
            if (sq & 0x88) != 0 { sq += 8; continue }
            let p = board[Int(sq)]
            if p == 0 { sq += 1; continue }
            let t = Int32(p & 7)
            let row = sq >> 4, col = sq & 7
            if (p & 8) != 0 {
                let idx = Int((7 - row) * 8 + col)
                mg -= Self.VALUE[Int(t)] + pstMG(t)[idx]
                eg -= Self.VALUE[Int(t)] + pstEG(t)[idx]
                matB += Self.VALUE[Int(t)]
                if t == Self.PAWN {
                    pawnFiles1[Int(col + 1)] += 1
                    if row > pawnMaxRow1[Int(col + 1)] { pawnMaxRow1[Int(col + 1)] = row }
                    if row < pawnMinRow1[Int(col + 1)] { pawnMinRow1[Int(col + 1)] = row }
                }
            } else {
                let idx = Int(row * 8 + col)
                mg += Self.VALUE[Int(t)] + pstMG(t)[idx]
                eg += Self.VALUE[Int(t)] + pstEG(t)[idx]
                matW += Self.VALUE[Int(t)]
                if t == Self.PAWN {
                    pawnFiles0[Int(col + 1)] += 1
                    if row < pawnMinRow0[Int(col + 1)] { pawnMinRow0[Int(col + 1)] = row }
                    if row > pawnMaxRow0[Int(col + 1)] { pawnMaxRow0[Int(col + 1)] = row }
                }
            }
            phase += Self.PHASE_W[Int(t)]
            sq += 1
        }

        var f: Int32 = 1
        while f <= 8 {
            let pf0f = pawnFiles0[Int(f)], pf1f = pawnFiles1[Int(f)]
            if pf0f > 1 { mg -= 12 * (pf0f - 1); eg -= 20 * (pf0f - 1) }
            if pf1f > 1 { mg += 12 * (pf1f - 1); eg += 20 * (pf1f - 1) }
            if pf0f != 0 && pawnFiles0[Int(f - 1)] == 0 && pawnFiles0[Int(f + 1)] == 0 { mg -= 10 * pf0f; eg -= 12 * pf0f }
            if pf1f != 0 && pawnFiles1[Int(f - 1)] == 0 && pawnFiles1[Int(f + 1)] == 0 { mg += 10 * pf1f; eg += 12 * pf1f }
            if pf0f != 0 {
                let r = pawnMinRow0[Int(f)]
                var passed = true
                var g = f - 1
                while g <= f + 1 && passed {
                    if pawnFiles1[Int(g)] != 0 && pawnMinRow1[Int(g)] < r { passed = false }
                    g += 1
                }
                if passed { mg += Self.PASSED_BONUS[Int(r)] >> 1; eg += Self.PASSED_BONUS[Int(r)] }
            }
            if pf1f != 0 {
                let r = pawnMaxRow1[Int(f)]
                var passed = true
                var g = f - 1
                while g <= f + 1 && passed {
                    if pawnFiles0[Int(g)] != 0 && pawnMaxRow0[Int(g)] > r { passed = false }
                    g += 1
                }
                if passed { mg -= Self.PASSED_BONUS[Int(7 - r)] >> 1; eg -= Self.PASSED_BONUS[Int(7 - r)] }
            }
            f += 1
        }

        sq = 0
        while sq < 128 {
            if (sq & 0x88) != 0 { sq += 8; continue }
            let p = board[Int(sq)]
            if (p & 7) != Int8(Self.ROOK) { sq += 1; continue }
            let f2 = (sq & 7) + 1
            if (p & 8) != 0 {
                if pawnFiles1[Int(f2)] == 0 { let b: Int32 = pawnFiles0[Int(f2)] != 0 ? 8 : 18; mg -= b; eg -= b >> 1 }
            } else if pawnFiles0[Int(f2)] == 0 { let b: Int32 = pawnFiles1[Int(f2)] != 0 ? 8 : 18; mg += b; eg += b >> 1 }
            sq += 1
        }
        if count[Int(Self.BISHOP)] >= 2 { mg += 30; eg += 45 }
        if count[Int(Self.BISHOP) | 8] >= 2 { mg -= 30; eg -= 45 }

        let clampedPhase = min(phase, 24)
        var score = Double(mg * clampedPhase + eg * (24 - clampedPhase)) / 24.0

        let diff = matW - matB
        if clampedPhase <= 10 && abs(diff) >= 300 {
            let strong: Int32 = diff > 0 ? Self.WHITE : Self.BLACK
            let weakK = kingSq[Int(strong ^ 1)], strongK = kingSq[Int(strong)]
            let wr = weakK >> 4, wc = weakK & 7
            let centerDist = max(3 - wr, wr - 4) + max(3 - wc, wc - 4)
            let kd = abs((strongK >> 4) - wr) + abs((strongK & 7) - wc)
            let bonus = Double(12 * centerDist + 6 * (14 - kd)) * Double(24 - clampedPhase) / 24.0
            score += strong == Self.WHITE ? bonus : -bonus
        }

        let result = Int32(score.rounded())
        return side == Self.WHITE ? result : -result
    }

    private func hasNonPawnMaterial(_ s: Int32) -> Bool {
        let b: Int32 = s == Self.BLACK ? 8 : 0
        return count[Int(Self.KNIGHT) | Int(b)] + count[Int(Self.BISHOP) | Int(b)] + count[Int(Self.ROOK) | Int(b)] + count[Int(Self.QUEEN) | Int(b)] > 0
    }

    // ---------- Поиск ----------
    private func checkTime() {
        if now() > deadline { stopped = true }
    }

    private func scoreMoves(_ list: [Int32], _ scores: inout [Int32], _ n: Int, _ ply: Int, _ ttm: Int32) {
        let k0 = killers[ply * 2], k1 = killers[ply * 2 + 1]
        for i in 0..<n {
            let m = list[i]
            if m == ttm { scores[i] = 3_000_000; continue }
            let cap = Self.mCapt(m), promo = Self.mPromo(m)
            if cap != 0 || promo != 0 {
                scores[i] = 2_000_000 + Self.VALUE[Int(cap)] * 10 - Self.mPiece(m) + (promo != 0 ? Self.VALUE[Int(promo)] * 10 : 0)
            } else if m == k0 {
                scores[i] = 1_500_000
            } else if m == k1 {
                scores[i] = 1_400_000
            } else {
                let p = board[Int(Self.mFrom(m))]
                scores[i] = historyH[Int(p) * 128 + Int(Self.mTo(m))]
            }
        }
    }

    private func pickNext(_ list: inout [Int32], _ scores: inout [Int32], _ i: Int, _ n: Int) -> Int32 {
        var best = i
        for j in (i + 1)..<n where scores[j] > scores[best] { best = j }
        if best != i {
            list.swapAt(i, best)
            scores.swapAt(i, best)
        }
        return list[i]
    }

    private func quiesce(_ alphaIn: Int32, _ beta: Int32, _ ply: Int) -> Int32 {
        nodes += 1
        if (nodes & 1023) == 0 { checkTime() }
        if stopped { return 0 }
        let check = inCheck()
        if ply >= Self.MAX_PLY { return evaluate() }

        var alpha = alphaIn
        var best: Int32 = -Self.INF
        if !check {
            let stand = evaluate()
            if stand >= beta { return stand }
            if stand > alpha { alpha = stand }
            best = stand
        }
        var list = moveBuf[ply]
        var scores = scoreBuf[ply]
        let n = genMoves(&list, capturesOnly: !check)
        scoreMoves(list, &scores, n, ply, 0)
        var legal = 0
        for i in 0..<n {
            let m = pickNext(&list, &scores, i, n)
            if !check && Self.mPromo(m) == 0 && best + Self.VALUE[Int(Self.mCapt(m))] + 200 < alpha { continue }
            if !tryMove(m) { continue }
            legal += 1
            let s = -quiesce(-beta, -alpha, ply + 1)
            unmakeMove()
            if stopped { return 0 }
            if s > best {
                best = s
                if s > alpha {
                    alpha = s
                    if s >= beta { return s }
                }
            }
        }
        if check && legal == 0 { return -Self.MATE + Int32(ply) }
        return best
    }

    private func ttStoreScore(_ s: Int32, _ ply: Int) -> Int32 {
        if s > Self.MATE_BOUND { return s + Int32(ply) }
        if s < -Self.MATE_BOUND { return s - Int32(ply) }
        return s
    }
    private func ttLoadScore(_ s: Int32, _ ply: Int) -> Int32 {
        if s > Self.MATE_BOUND { return s - Int32(ply) }
        if s < -Self.MATE_BOUND { return s + Int32(ply) }
        return s
    }

    private func search(_ depthIn: Int32, _ alphaIn: Int32, _ betaIn: Int32, _ ply: Int, _ allowNull: Bool) -> Int32 {
        nodes += 1
        if (nodes & 1023) == 0 { checkTime() }
        if stopped { return 0 }

        let check = inCheck()
        var depth = depthIn
        if check { depth += 1 }
        if depth <= 0 { return quiesce(alphaIn, betaIn, ply) }
        if ply >= Self.MAX_PLY { return evaluate() }

        if halfmove >= 100 || isRepetition() || insufficientMaterial() { return 0 }
        var alpha = alphaIn, beta = betaIn
        let ma = -Self.MATE + Int32(ply), mb = Self.MATE - Int32(ply) - 1
        if alpha < ma { alpha = ma }
        if beta > mb { beta = mb }
        if alpha >= beta { return alpha }

        let idx = Int(hashLo & TT_MASK)
        var ttm: Int32 = 0
        if ttKey[idx] == hashHi && ttFlag[idx] != 0 {
            ttm = ttMove[idx]
            if Int32(ttDepth[idx]) >= depth {
                let s = ttLoadScore(ttScore[idx], ply)
                let f = ttFlag[idx]
                if f == TT_EXACT { return s }
                if f == TT_LOWER && s >= beta { return s }
                if f == TT_UPPER && s <= alpha { return s }
            }
        }

        let pvNode = beta - alpha > 1
        if allowNull && !pvNode && !check && depth >= 3 && hasNonPawnMaterial(side) && evaluate() >= beta {
            makeNull()
            let s = -search(depth - 3, -beta, -beta + 1, ply + 1, false)
            unmakeNull()
            if stopped { return 0 }
            if s >= beta && s < Self.MATE_BOUND { return beta }
        }

        var list = moveBuf[ply]
        var scores = scoreBuf[ply]
        let n = genMoves(&list, capturesOnly: false)
        scoreMoves(list, &scores, n, ply, ttm)

        let origAlpha = alpha
        var best: Int32 = -Self.INF, bestMove: Int32 = 0, legal = 0
        for i in 0..<n {
            let m = pickNext(&list, &scores, i, n)
            if !tryMove(m) { continue }
            legal += 1
            let quiet = Self.mCapt(m) == 0 && Self.mPromo(m) == 0
            let givesCheck = attacked(kingSq[Int(side)], by: side ^ 1)
            var s: Int32
            if legal == 1 {
                s = -search(depth - 1, -beta, -alpha, ply + 1, true)
            } else {
                var r: Int32 = 0
                if depth >= 3 && legal > 3 && quiet && !check && !givesCheck {
                    r = legal > 8 ? 2 : 1
                }
                s = -search(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true)
                if s > alpha && (r > 0 || s < beta) {
                    s = -search(depth - 1, -beta, -alpha, ply + 1, true)
                }
            }
            unmakeMove()
            if stopped { return 0 }
            if s > best {
                best = s
                bestMove = m
                if s > alpha {
                    alpha = s
                    if s >= beta {
                        if quiet {
                            if killers[ply * 2] != m {
                                killers[ply * 2 + 1] = killers[ply * 2]
                                killers[ply * 2] = m
                            }
                            let hi = Int(board[Int(Self.mFrom(m))]) * 128 + Int(Self.mTo(m))
                            historyH[hi] += depth * depth
                            if historyH[hi] > 1_000_000 {
                                for k in 0..<historyH.count { historyH[k] >>= 1 }
                            }
                        }
                        break
                    }
                }
            }
        }
        if legal == 0 { return check ? -Self.MATE + Int32(ply) : 0 }

        ttKey[idx] = hashHi
        ttMove[idx] = bestMove
        ttScore[idx] = ttStoreScore(best, ply)
        ttDepth[idx] = Int8(depth)
        ttFlag[idx] = best >= beta ? TT_LOWER : (best > origAlpha ? TT_EXACT : TT_UPPER)
        return best
    }

    private struct RootMove {
        var move: Int32
        var score: Int32
        var depth: Int32
    }

    private func rootSearch(_ rootMoves: inout [RootMove], _ depth: Int32, _ fullWindow: Bool, _ margin: Int32) -> (bestMove: Int32, bestScore: Int32) {
        var alpha: Int32 = -Self.INF
        let beta: Int32 = Self.INF
        var bestScore: Int32 = -Self.INF
        var bestMove: Int32 = rootMoves[0].move
        for i in 0..<rootMoves.count {
            let mv = rootMoves[i].move
            makeMove(mv)
            var s: Int32
            if fullWindow {
                s = -search(depth - 1, -Self.INF, Self.INF, 1, true)
            } else if i == 0 {
                s = -search(depth - 1, -beta, -alpha, 1, true)
            } else {
                let bound = alpha - margin
                s = -search(depth - 1, -bound - 1, -bound, 1, true)
                if s > bound && !stopped { s = -search(depth - 1, -beta, -bound, 1, true) }
            }
            unmakeMove()
            if stopped { break }
            rootMoves[i].score = s
            rootMoves[i].depth = depth
            if s > bestScore { bestScore = s; bestMove = mv }
            if s > alpha { alpha = s }
        }
        return (bestMove, bestScore)
    }

    // ---------- Уровни сложности ----------
    struct Level {
        let maxDepth: Int32
        let timeMs: Double
        let noise: Int32
        let blunder: Double
        let fullWindow: Bool
    }

    static let LEVELS: [String: Level] = [
        "easy": Level(maxDepth: 1, timeMs: 400, noise: 160, blunder: 0.22, fullWindow: true),
        "medium": Level(maxDepth: 3, timeMs: 900, noise: 35, blunder: 0.04, fullWindow: true),
        "hard": Level(maxDepth: 64, timeMs: 1800, noise: 0, blunder: 0, fullWindow: false)
    ]

    struct ThinkResult {
        var from: String
        var to: String
        var promotion: String?
        var uci: String
        var score: Int32
        var depth: Int32
        var nodes: Int
        var timeMs: Int
    }

    /// `rng` — функция, возвращающая случайное число в [0,1); по умолчанию Double.random.
    func think(levelName: String, timeOverrideMs: Double? = nil, rng: (() -> Double)? = nil) -> ThinkResult? {
        let level = Self.LEVELS[levelName] ?? Self.LEVELS["medium"]!
        let random = rng ?? { Double.random(in: 0..<1) }
        let t0 = now()
        deadline = t0 + (timeOverrideMs ?? level.timeMs)
        stopped = false
        nodes = 0
        for i in 0..<killers.count { killers[i] = 0 }
        for i in 0..<historyH.count { historyH[i] = 0 }

        let legal = legalMoves()
        if legal.isEmpty { return nil }
        var rootMoves = legal.map { RootMove(move: $0, score: -Self.INF, depth: 0) }
        if legal.count == 1 {
            return finish(legal[0], 0, 0, t0)
        }

        let openingNoise: Int32 = (level.noise == 0 && hply < 8) ? 12 : 0
        let margin = level.fullWindow ? 0 : openingNoise

        var completedMove: Int32? = nil
        var completedScore: Int32 = -Self.INF
        var completedScores: [(move: Int32, score: Int32)] = []
        var depthDone: Int32 = 0

        var depth: Int32 = 1
        while depth <= level.maxDepth {
            rootMoves.sort { $0.score > $1.score }
            let res = rootSearch(&rootMoves, depth, level.fullWindow, margin)
            if stopped {
                if !level.fullWindow, completedMove != nil, rootMoves[0].depth == depth, res.bestScore > -Self.INF {
                    completedMove = res.bestMove
                    completedScore = res.bestScore
                }
                break
            }
            completedMove = res.bestMove
            completedScore = res.bestScore
            completedScores = rootMoves.map { ($0.move, $0.score) }
            depthDone = depth
            if abs(res.bestScore) > Self.MATE_BOUND { break }
            if now() - t0 > (timeOverrideMs ?? level.timeMs) * 0.55 { break }
            depth += 1
        }
        if completedMove == nil {
            completedMove = rootMoves[0].move
            completedScore = 0
            completedScores = rootMoves.map { ($0.move, 0) }
        }

        var chosen = completedMove!
        let scored = completedScores.filter { $0.score > -Self.INF }.sorted { $0.score > $1.score }

        let mateAvailable = !scored.isEmpty && scored[0].score > Self.MATE_BOUND
        if !mateAvailable, level.blunder > 0, random() < level.blunder {
            chosen = legal[Int(random() * Double(legal.count))]
        } else if !mateAvailable, scored.count > 1 {
            let noise = level.noise != 0 ? level.noise : openingNoise
            if noise != 0 {
                let top = scored[0].score
                let pool = scored.filter { $0.score > top - noise }
                let weights = pool.map { exp(Double($0.score - top) / Double(max(10, noise / 2))) }
                let sum = weights.reduce(0, +)
                var x = random() * sum
                for i in 0..<pool.count {
                    x -= weights[i]
                    if x <= 0 { chosen = pool[i].move; break }
                }
            }
        }
        return finish(chosen, completedScore, depthDone, t0)
    }

    private func finish(_ m: Int32, _ score: Int32, _ depth: Int32, _ t0: Double) -> ThinkResult {
        let promo = Self.mPromo(m)
        let pch: String? = promo != 0 ? String(Self.PIECE_CHARS[Self.PIECE_CHARS.index(Self.PIECE_CHARS.startIndex, offsetBy: Int(promo))]) : nil
        return ThinkResult(
            from: sqName(Self.mFrom(m)),
            to: sqName(Self.mTo(m)),
            promotion: pch,
            uci: moveToUci(m),
            score: side == Self.WHITE ? score : -score,
            depth: depth,
            nodes: nodes,
            timeMs: Int((now() - t0).rounded())
        )
    }

    // ---------- Публичный интерфейс ----------
    func setPosition(fen: String?, moves: [String]) {
        loadFen(fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
        for uci in moves {
            let legal = legalMoves()
            guard let m = legal.first(where: { moveToUci($0) == uci }) else {
                assertionFailure("Недопустимый ход в истории: \(uci)")
                return
            }
            makeMove(m)
        }
    }

    func search(fen: String?, moves: [String], level: String, timeOverrideMs: Double? = nil, rng: (() -> Double)? = nil) -> ThinkResult? {
        setPosition(fen: fen, moves: moves)
        return think(levelName: level, timeOverrideMs: timeOverrideMs, rng: rng)
    }

    func perft(fen: String, depth: Int32) -> Int {
        loadFen(fen)
        return perftInner(depth)
    }

    private func perftInner(_ depth: Int32) -> Int {
        if depth == 0 { return 1 }
        var list = [Int32](repeating: 0, count: 256)
        let n = genMoves(&list, capturesOnly: false)
        var total = 0
        for i in 0..<n {
            if !tryMove(list[i]) { continue }
            total += depth == 1 ? 1 : perftInner(depth - 1)
            unmakeMove()
        }
        return total
    }

    func legalMovesUci(fen: String?, moves: [String]) -> [String] {
        setPosition(fen: fen, moves: moves)
        return legalMoves().map { moveToUci($0) }
    }

    func evaluateFen(_ fen: String) -> Int32 {
        loadFen(fen)
        return evaluate()
    }

    /// Текущая доска как массив 64 опциональных фигур, построчно от a8 к h1 (как в JS board[row][col]).
    func currentBoard() -> [[Piece?]] {
        var result: [[Piece?]] = []
        for row in 0..<8 {
            var line: [Piece?] = []
            for col in 0..<8 {
                let sq = row * 16 + col
                line.append(Piece.from(raw: board[sq]))
            }
            result.append(line)
        }
        return result
    }

    func sideToMove() -> PieceColor { side == Self.WHITE ? .white : .black }

    // ---------- Интерактивная игра (используется ChessGameViewModel) ----------

    struct AppliedMove {
        var from: Square
        var to: Square
        var promotion: PieceKind?
        var capturedKind: PieceKind?
        var isCastle: Bool
        var isEnPassant: Bool
        var uci: String
        var movedKind: PieceKind
        var movedColor: PieceColor
    }

    /// Легальные ходы (как кортежи to+promotion) из данной клетки — для подсветки и выбора хода в UI.
    func legalDestinations(from square: Square) -> [(to: Square, promotion: PieceKind?)] {
        legalMoves()
            .filter { Self.mFrom($0) == Int32(square.index0x88) }
            .map { (Square(index0x88: Int(Self.mTo($0))), Self.mPromo($0) != 0 ? PieceKind(rawValue: Int8(Self.mPromo($0))) : nil) }
    }

    /// Применить ход по координатам (найдёт среди легальных ходов). Возвращает nil, если ход нелегален.
    @discardableResult
    func applyMove(from: Square, to: Square, promotion: PieceKind? = nil) -> AppliedMove? {
        let candidates = legalMoves().filter {
            Self.mFrom($0) == Int32(from.index0x88) && Self.mTo($0) == Int32(to.index0x88)
        }
        guard !candidates.isEmpty else { return nil }
        let m: Int32
        if candidates.count > 1 {
            // Несколько ходов (превращение) — выбираем по запрошенному типу, иначе ферзь.
            let wantPromo = Int32((promotion ?? .queen).rawValue)
            m = candidates.first { Self.mPromo($0) == wantPromo } ?? candidates[0]
        } else {
            m = candidates[0]
        }
        let movedPiece = board[Int(from.index0x88)]
        let capturedCode = Self.mCapt(m)
        let promoCode = Self.mPromo(m)
        makeMove(m)
        return AppliedMove(
            from: from,
            to: to,
            promotion: promoCode != 0 ? PieceKind(rawValue: Int8(promoCode)) : nil,
            capturedKind: capturedCode != 0 ? PieceKind(rawValue: Int8(capturedCode)) : nil,
            isCastle: (m & Self.FLAG_CASTLE) != 0,
            isEnPassant: (m & Self.FLAG_EP) != 0,
            uci: moveToUci(m),
            movedKind: PieceKind(rawValue: movedPiece & 7) ?? .pawn,
            movedColor: (movedPiece & 8) != 0 ? .black : .white
        )
    }

    /// Применить ход, заданный строкой UCI ("e2e4", "e7e8q"...). Используется для хода компьютера.
    @discardableResult
    func applyUci(_ uci: String) -> AppliedMove? {
        guard uci.count >= 4,
              let from = Square(name: String(uci.prefix(2))),
              let to = Square(name: String(uci.dropFirst(2).prefix(2))) else { return nil }
        var promo: PieceKind? = nil
        if uci.count >= 5 { promo = PieceKind.fromLetter(String(uci.suffix(1))) }
        return applyMove(from: from, to: to, promotion: promo)
    }

    /// Можно ли отменить ход (есть хотя бы один сделанный полуход).
    var canUndoHalfMove: Bool { hply > 0 }

    /// Откатить последний полуход.
    func undoHalfMove() {
        guard hply > 0 else { return }
        unmakeMove()
    }

    var turn: PieceColor { side == Self.WHITE ? .white : .black }

    func isInCheck() -> Bool { inCheck() }

    func isCheckmate() -> Bool { inCheck() && legalMoves().isEmpty }

    func isStalemate() -> Bool { !inCheck() && legalMoves().isEmpty }

    func isInsufficientMaterialPublic() -> Bool { insufficientMaterial() }

    func isFiftyMoveDraw() -> Bool { halfmove >= 100 }

    func isThreefoldRepetition() -> Bool { isRepetition() }

    func isGameOver() -> Bool {
        isCheckmate() || isStalemate() || isInsufficientMaterialPublic() || isFiftyMoveDraw() || isThreefoldRepetition()
    }

    func findKingSquare(_ color: PieceColor) -> Square {
        Square(index0x88: Int(kingSq[Int(color.rawValue)]))
    }

    /// Число сделанных полуходов от начальной позиции загруженного FEN.
    var halfMoveCount: Int { hply }
}
