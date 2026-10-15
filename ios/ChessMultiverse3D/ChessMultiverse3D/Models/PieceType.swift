import Foundation

/// Типы фигур — коды совпадают по смыслу с движком (PAWN=1 ... KING=6).
enum PieceKind: Int8, CaseIterable {
    case none = 0
    case pawn = 1
    case knight = 2
    case bishop = 3
    case rook = 4
    case queen = 5
    case king = 6

    var letter: String {
        switch self {
        case .none: return ""
        case .pawn: return "p"
        case .knight: return "n"
        case .bishop: return "b"
        case .rook: return "r"
        case .queen: return "q"
        case .king: return "k"
        }
    }

    static func fromLetter(_ s: String) -> PieceKind? {
        switch s.lowercased() {
        case "p": return .pawn
        case "n": return .knight
        case "b": return .bishop
        case "r": return .rook
        case "q": return .queen
        case "k": return .king
        default: return nil
        }
    }
}

enum PieceColor: Int8, CaseIterable {
    case white = 0
    case black = 1

    var other: PieceColor { self == .white ? .black : .white }
    var letter: String { self == .white ? "w" : "b" }
}

/// Фигура на доске: цвет + тип. Используется в представлении для SceneKit/SwiftUI слоя
/// (внутренний движок работает с «сырыми» Int8 кодами для скорости и точного соответствия оригиналу).
struct Piece: Equatable {
    var color: PieceColor
    var kind: PieceKind

    /// Код как в движке: kind | (color==black ? 8 : 0)
    var rawCode: Int8 {
        kind.rawValue | (color == .black ? 8 : 0)
    }

    static func from(raw: Int8) -> Piece? {
        guard raw != 0 else { return nil }
        let kindRaw = raw & 7
        guard let kind = PieceKind(rawValue: kindRaw), kind != .none else { return nil }
        let color: PieceColor = (raw & 8) != 0 ? .black : .white
        return Piece(color: color, kind: kind)
    }
}

/// Клетка на доске в алгебраической нотации, напр. "e4".
struct Square: Equatable, Hashable {
    /// Индекс в 0x88-представлении (0...127, значимы только клетки без бита 0x88).
    var index0x88: Int

    init(index0x88: Int) {
        self.index0x88 = index0x88
    }

    init?(name: String) {
        guard name.count == 2 else { return nil }
        let chars = Array(name.lowercased())
        guard let fileChar = chars.first, let rankChar = chars.last,
              let file = "abcdefgh".firstIndex(of: fileChar).map({ "abcdefgh".distance(from: "abcdefgh".startIndex, to: $0) }),
              let rank = rankChar.wholeNumberValue else { return nil }
        let row = 8 - rank
        guard row >= 0, row <= 7, file >= 0, file <= 7 else { return nil }
        self.index0x88 = row * 16 + file
    }

    var file: Int { index0x88 & 7 }
    var row: Int { index0x88 >> 4 }

    var name: String {
        let f = "abcdefgh"
        let fi = f.index(f.startIndex, offsetBy: file)
        return "\(f[fi])\(8 - row)"
    }

    var isValid: Bool { (index0x88 & 0x88) == 0 }
}
