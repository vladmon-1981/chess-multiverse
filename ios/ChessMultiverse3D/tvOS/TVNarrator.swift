import Foundation

/// Диктор вселенных Apple TV: реплики и комментарии к ходам из js/themes.js (tools/gen_tv_themes.js → Resources/themes.json),
/// записанным голосом (Piper) там, где есть запись, иначе системным синтезатором. Логика — как speak/commentMove в js/chess-app.js.
final class TVNarrator {
    private struct ThemeData: Decodable {
        struct Voice: Decodable {
            struct Comments: Decodable {
                let moveChance: Double?
                let move, capture, bigCapture, check, castle, promote: [String]?
            }
            let rate: Double
            let pitch: Double
            let start, check, win, lose, pvpWin, draw, resignWin, resignLose: [String]
            let comments: Comments?

            init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: Keys.self)
                rate = try c.decode(Double.self, forKey: .rate)
                pitch = try c.decode(Double.self, forKey: .pitch)
                func list(_ k: Keys) throws -> [String] {
                    if let a = try? c.decode([String].self, forKey: k) { return a }
                    return [try c.decode(String.self, forKey: k)]
                }
                start = try list(.start); check = try list(.check); win = try list(.win); lose = try list(.lose)
                pvpWin = try list(.pvpWin); draw = try list(.draw); resignWin = try list(.resignWin); resignLose = try list(.resignLose)
                comments = try? c.decode(Comments.self, forKey: .comments)
            }
            enum Keys: String, CodingKey { case rate, pitch, start, check, win, lose, pvpWin, draw, resignWin, resignLose, comments }
        }
        let sides: [String: String]
        let pieceNames: [String: [String: String]]
        let voice: Voice
    }

    private let themes: [String: ThemeData]
    private let sound: SoundEngine

    init?(sound: SoundEngine) {
        guard let url = Bundle.main.url(forResource: "themes", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let dict = try? JSONDecoder().decode([String: ThemeData].self, from: data) else { return nil }
        themes = dict
        self.sound = sound
    }

    private static let letters: [PieceKind: String] = [.king: "k", .queen: "q", .rook: "r", .bishop: "b", .knight: "n", .pawn: "p"]

    /// Озвучивает событие; true — фраза найдена и произнесена.
    func narrate(_ event: NarrationEvent, theme: ThemeKey) -> Bool {
        guard let T = themes[theme.rawValue] else { return false }
        let V = T.voice
        switch event {
        case .start: return speak(V.start, V, delay: 0.35)
        case .check: return speak(V.check, V, delay: 0.25)
        case .win: return speak(V.win, V)
        case .lose: return speak(V.lose, V)
        case .draw: return speak(V.draw, V)
        case .resignWin: return speak(V.resignWin, V)
        case .resignLose: return speak(V.resignLose, V)
        case .pvpWin(let name):
            // Записанный диктор объявляет победу фразой win (в pvpWin имя игрока)
            if V.win.contains(where: { sound.hasClip($0) }) { return speak(V.win, V) }
            return speak(V.pvpWin, V, args: ["0": name])
        case .move(let m, let isCheck): return comment(T, m, isCheck: isCheck)
        }
    }

    /// Комментарий к ходу: шах, превращение и крупное взятие — всегда, обычные ходы — через раз.
    private func comment(_ T: ThemeData, _ m: ChessEngine.AppliedMove, isCheck: Bool) -> Bool {
        guard let C = T.voice.comments else { return false }
        let mine = m.movedColor == .white ? "w" : "b", opp = m.movedColor == .white ? "b" : "w"
        let captured = m.capturedKind != nil || m.isEnPassant
        var pool: [String]?
        if isCheck { pool = C.check }
        else if m.promotion != nil { pool = C.promote }
        else if let k = m.capturedKind, k == .rook || k == .queen { pool = C.bigCapture }
        else if captured { pool = Double.random(in: 0..<1) < 0.75 ? C.capture : nil }
        else if m.isCastle { pool = C.castle }
        else if Double.random(in: 0..<1) < (C.moveChance ?? 0.3) { pool = C.move }
        guard let pool, !pool.isEmpty else { return false }
        let victimKind = m.capturedKind ?? (m.isEnPassant ? .pawn : nil)
        let ctx: [String: String] = [
            "side": T.sides[mine] ?? "", "opp": T.sides[opp] ?? "",
            "actor": T.pieceNames[mine]?[Self.letters[m.movedKind] ?? "p"] ?? "",
            "victim": victimKind.flatMap { T.pieceNames[opp]?[Self.letters[$0] ?? "p"] } ?? ""
        ]
        return speak(pool, T.voice, delay: isCheck ? 0.25 : 0.45, args: ctx)
    }

    private func speak(_ lines: [String], _ V: ThemeData.Voice, delay: Double = 0, args: [String: String] = [:]) -> Bool {
        var list = lines.map { fill($0, args) }.filter { !$0.isEmpty }
        // Записанным голосом — только фразы, для которых есть запись
        let recorded = list.filter { sound.hasClip($0) }
        if !recorded.isEmpty { list = recorded }
        guard let line = list.randomElement() else { return false }
        let go = { [sound] in sound.say(line, rate: V.rate, pitch: V.pitch) }
        if delay > 0 { DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: go) } else { go() }
        return true
    }

    private func fill(_ template: String, _ args: [String: String]) -> String {
        var s = template
        for (k, v) in args { s = s.replacingOccurrences(of: "{\(k)}", with: v) }
        return s
    }
}
