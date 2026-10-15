import Foundation
import Combine

enum GameMode { case pve, pvp }
enum ColorChoice: String { case white, black, random }
enum Difficulty: String, CaseIterable, Identifiable {
    case easy, medium, hard
    var id: String { rawValue }
    var title: String {
        switch self {
        case .easy: return "Лёгкий"
        case .medium: return "Средний"
        case .hard: return "Тяжёлый"
        }
    }
    var engineKey: String { rawValue }
}

enum AppScreen { case menu, pveSetup, pvpSetup, game }

enum GameOverKind { case checkmate, stalemate, insufficientMaterial, threefold, fiftyMove, resign }

struct GameOverInfo {
    var kind: GameOverKind
    var winner: PieceColor?       // nil при ничьей
    var reasonText: String
}

/// Протокол озвучки/звука — заглушка на будущую фазу (AVFoundation / AVSpeechSynthesizer).
protocol SoundAnnouncing {
    func setTheme(_ key: ThemeKey)
    func playEffect(_ name: String)
    func say(_ text: String, rate: Double, pitch: Double)
    var soundEnabled: Bool { get set }
    var voiceEnabled: Bool { get set }
}

/// Заглушка озвучки: ничего не воспроизводит, только хранит состояние тумблеров.
final class NoopAnnouncer: SoundAnnouncing {
    var soundEnabled: Bool = true
    var voiceEnabled: Bool = true
    func setTheme(_ key: ThemeKey) { }
    func playEffect(_ name: String) { }
    func say(_ text: String, rate: Double, pitch: Double) { }
}

/// Настройки, аналогичные chess-app.js: кинорежим, спецэффекты взятия, звук, голос.
struct GameSettings {
    var cinematic: Bool = true
    var captureFx: Bool = true
    var sound: Bool = true
    var voice: Bool = true
    var autoFlip: Bool = false
    var cameraPreset: CameraPreset = .normal
}

enum CameraPreset: String, CaseIterable {
    case normal, top, low
    var label: String {
        switch self {
        case .normal: return "Обычный ракурс"
        case .top: return "Вид сверху"
        case .low: return "Кинематографичный ракурс"
        }
    }
}

/// Запись в истории партии для панели ходов.
struct MoveRecord: Identifiable {
    let id = UUID()
    let number: Int
    let whiteSAN: String?
    let blackSAN: String?
}

/// Статистика партии для экрана результата.
struct GameStats {
    var plyCount: Int
    var seconds: Int
    var difficulty: Difficulty?
}

/// Центральная модель состояния партии — аналог ChessApp (js/chess-app.js), но без DOM:
/// режимы pvp/pve, выбор цвета, выбор темы, отмена хода, конец партии, статистика, настройки.
@MainActor
final class ChessGameViewModel: ObservableObject {

    // ---------- Публичное состояние для SwiftUI ----------
    @Published var screen: AppScreen = .menu
    @Published var theme: ThemeKey = .classic {
        didSet { announcer.setTheme(theme) }
    }
    @Published var mode: GameMode = .pve
    @Published var difficulty: Difficulty = .medium
    @Published var colorChoice: ColorChoice = .white
    @Published var humanColor: PieceColor = .white
    @Published var orientation: PieceColor = .white
    @Published var playerName: String = "Игрок"
    @Published var whiteName: String = "Белые"
    @Published var blackName: String = "Чёрные"

    @Published var board: [[Piece?]] = []
    @Published var turn: PieceColor = .white
    @Published var selected: Square? = nil
    @Published var legalTargets: [Square] = []
    @Published var lastMove: (from: Square, to: Square)? = nil
    @Published var checkSquare: Square? = nil

    @Published var thinking: Bool = false
    @Published var busy: Bool = false
    @Published var statusText: String = ""
    @Published var moveHistory: [MoveRecord] = []
    @Published var gameOver: GameOverInfo? = nil
    @Published var gameStats: GameStats? = nil
    @Published var pendingPromotion: (from: Square, to: Square)? = nil

    @Published var settings = GameSettings()

    var announcer: SoundAnnouncing = SoundEngine()

    private var game = ChessEngine()
    private var aiEngine = ChessEngine()
    private var startedAt: Date = Date()
    private var aiTask: Task<Void, Never>? = nil
    private var impactTask: Task<Void, Never>? = nil
    private var sanHistory: [String] = []

    var spec: ThemeSpec { ThemeLibrary.spec(for: theme) }

    // ---------- Запуск партии ----------

    func startGame(mode: GameMode, difficulty: Difficulty? = nil) {
        self.mode = mode
        if let d = difficulty { self.difficulty = d }
        aiTask?.cancel()
        game = ChessEngine()
        game.setPosition(fen: nil, moves: [])
        sanHistory = []
        gameOver = nil
        gameStats = nil
        selected = nil
        legalTargets = []
        lastMove = nil
        checkSquare = nil
        busy = false
        thinking = false
        startedAt = Date()

        if mode == .pve {
            switch colorChoice {
            case .white: humanColor = .white
            case .black: humanColor = .black
            case .random: humanColor = Bool.random() ? .white : .black
            }
            orientation = humanColor
            if humanColor == .white {
                whiteName = playerName.isEmpty ? "Игрок" : playerName
                blackName = "Компьютер · \(difficultyTitleForNames())"
            } else {
                blackName = playerName.isEmpty ? "Игрок" : playerName
                whiteName = "Компьютер · \(difficultyTitleForNames())"
            }
        } else {
            humanColor = .white
            orientation = .white
        }

        screen = .game
        refreshBoard()
        updateStatus()
        announcer.playEffect("start")
        announcer.say(spec.voice.start, rate: spec.voice.rate, pitch: spec.voice.pitch)

        if isAITurn() { scheduleAIMove(after: 1.2) }
    }

    private func difficultyTitleForNames() -> String { difficulty.title }

    // ---------- Выбор темы ----------

    func chooseTheme(_ key: ThemeKey) {
        guard key != theme else { return }
        theme = key
        if mode == .pve, screen == .game {
            if humanColor == .white {
                blackName = "Компьютер · \(difficultyTitleForNames())"
            } else {
                whiteName = "Компьютер · \(difficultyTitleForNames())"
            }
        }
    }

    // ---------- Запрос состояния ----------

    func isHumanTurn() -> Bool { mode == .pvp || turn == humanColor }
    func isAITurn() -> Bool { mode == .pve && gameOver == nil && turn != humanColor }
    func canInteract() -> Bool { gameOver == nil && !thinking && !busy && pendingPromotion == nil && isHumanTurn() }

    func canUndo() -> Bool {
        guard pendingPromotion == nil, game.halfMoveCount > 0 else { return false }
        if mode == .pve, turn == humanColor, game.halfMoveCount < 2 { return false }
        return true
    }

    // ---------- Взаимодействие с доской ----------

    func select(_ square: Square) {
        guard canInteract() else { return }
        guard let piece = pieceAt(square), piece.color == turn else {
            if selected != nil { deselect() }
            return
        }
        selected = square
        legalTargets = game.legalDestinations(from: square).map { $0.to }
        announcer.playEffect("select")
    }

    func deselect() {
        selected = nil
        legalTargets = []
    }

    /// Попытка хода. Если требуется выбор фигуры при превращении — откладывает до вызова resolvePromotion.
    func attemptMove(from: Square, to: Square) {
        guard canInteract() else { return }
        let destinations = game.legalDestinations(from: from)
        guard destinations.contains(where: { $0.to == to }) else {
            announcer.playEffect("illegal")
            return
        }
        let needsPromotion = destinations.contains { $0.to == to && $0.promotion != nil }
        if needsPromotion {
            pendingPromotion = (from, to)
            return
        }
        commitMove(from: from, to: to, promotion: nil)
    }

    func resolvePromotion(_ kind: PieceKind?) {
        guard let pending = pendingPromotion else { return }
        pendingPromotion = nil
        guard let kind else { deselect(); return }
        commitMove(from: pending.from, to: pending.to, promotion: kind)
    }

    private func commitMove(from: Square, to: Square, promotion: PieceKind?) {
        guard let applied = game.applyMove(from: from, to: to, promotion: promotion) else {
            announcer.playEffect("illegal")
            return
        }
        selected = nil
        legalTargets = []
        lastMove = (from, to)
        recordSAN(applied)
        playMoveAudio(from: from, to: to, applied: applied)
        afterMove()
    }

    /// Звук хода: старт движения (ход, рокировка, превращение), кинорежим — «whoosh»,
    /// удар при взятии — в момент контакта фигур, как onStart/onImpact в js/chess-app.js.
    private func playMoveAudio(from: Square, to: Square, applied: ChessEngine.AppliedMove) {
        if applied.promotion != nil {
            announcer.playEffect("promote")
        } else if applied.isCastle {
            announcer.playEffect("castle")
        } else {
            announcer.playEffect("move")
        }
        if settings.cinematic { announcer.playEffect("whoosh") }
        if applied.capturedKind != nil || applied.isEnPassant {
            let total = MotionTiming.duration(from: from, to: to, cinematic: settings.cinematic)
            scheduleImpactAudio(after: total * 1.3)   // запасной таймер; обычно удар приходит сигналом сцены
        }
    }

    /// Сигнал из сцены: фигуры соприкоснулись — играем удар точно в этот момент.
    func sceneImpact() { scheduleImpactAudio(after: 0) }

    /// Удар «hit» в момент контакта; при captureFx — звук эффекта взятия темы (как в вебе).
    private func scheduleImpactAudio(after delay: Double) {
        impactTask?.cancel()
        let captureFx = settings.captureFx
        let currentTheme = theme
        impactTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(max(0, delay) * 1_000_000_000))
            guard !Task.isCancelled, let self else { return }
            self.announcer.playEffect("hit")
            guard captureFx else { return }
            self.announcer.playEffect("impact")
            let fx: String
            var follow: String? = nil
            switch currentTheme {
            case .classic: fx = "shatter"
            case .cars: fx = "boom"
            case .hospital: fx = "zap"; follow = "pop"
            case .hockey: fx = "boards"; follow = "poof"
            }
            self.announcer.playEffect(fx)
            if let follow {
                try? await Task.sleep(nanoseconds: 300_000_000)
                guard !Task.isCancelled else { return }
                self.announcer.playEffect(follow)
            }
        }
    }

    private func afterMove() {
        refreshBoard()
        turn = game.turn
        if settings.autoFlip, mode == .pvp { orientation = turn }
        if game.isGameOver() {
            finishGame()
            return
        }
        if game.isInCheck() {
            checkSquare = game.findKingSquare(turn)
            announcer.playEffect("check")
            announcer.say(spec.voice.check, rate: spec.voice.rate, pitch: spec.voice.pitch)
        } else {
            checkSquare = nil
        }
        updateStatus()
        if isAITurn() { scheduleAIMove(after: 0.3) }
    }

    // ---------- Компьютер ----------

    private func scheduleAIMove(after delay: Double) {
        thinking = true
        updateStatus()
        let movesSoFar = sanUciHistory
        let level = difficulty.engineKey
        aiTask?.cancel()
        aiTask = Task { [weak self] in
            guard let self else { return }
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if Task.isCancelled { return }
            let result = await Task.detached(priority: .userInitiated) { [aiEngine] in
                aiEngine.search(fen: nil, moves: movesSoFar, level: level)
            }.value
            if Task.isCancelled { return }
            await MainActor.run {
                self.thinking = false
                guard let result else { return }
                guard let applied = self.game.applyMove(
                    from: Square(name: result.from) ?? Square(index0x88: 0),
                    to: Square(name: result.to) ?? Square(index0x88: 0),
                    promotion: result.promotion.flatMap { PieceKind.fromLetter($0) }
                ) else { return }
                self.lastMove = (applied.from, applied.to)
                self.recordSAN(applied)
                self.playMoveAudio(from: applied.from, to: applied.to, applied: applied)
                self.afterMove()
            }
        }
    }

    private var sanUciHistory: [String] = []

    private func recordSAN(_ applied: ChessEngine.AppliedMove) {
        sanUciHistory.append(applied.uci)
        let moveNumber = (sanUciHistory.count + 1) / 2
        let text = simpleSAN(applied)
        if applied.movedColor == .white {
            moveHistory.append(MoveRecord(number: moveNumber, whiteSAN: text, blackSAN: nil))
        } else {
            if let last = moveHistory.last, last.blackSAN == nil, last.number == moveNumber {
                moveHistory[moveHistory.count - 1] = MoveRecord(number: moveNumber, whiteSAN: last.whiteSAN, blackSAN: text)
            } else {
                moveHistory.append(MoveRecord(number: moveNumber, whiteSAN: nil, blackSAN: text))
            }
        }
    }

    /// Упрощённая запись хода (не полная SAN-нотация с разрешением неоднозначностей —
    /// это можно доработать позже; формат: Кре2, Фd8=Ф, 0-0 и т.п.).
    private func simpleSAN(_ applied: ChessEngine.AppliedMove) -> String {
        if applied.isCastle {
            return applied.to.file > applied.from.file ? "0-0" : "0-0-0"
        }
        let letters: [PieceKind: String] = [.king: "Кр", .queen: "Ф", .rook: "Л", .bishop: "С", .knight: "К", .pawn: ""]
        var s = (letters[applied.movedKind] ?? "")
        if applied.capturedKind != nil || applied.isEnPassant { s += "x" }
        s += applied.to.name
        if let promo = applied.promotion {
            s += "=" + (letters[promo] ?? "Ф")
        }
        return s
    }

    // ---------- Отмена хода ----------

    func undo() {
        guard canUndo() else { return }
        aiTask?.cancel()
        thinking = false
        var n = 1
        if mode == .pve, turn == humanColor { n = 2 }
        for _ in 0..<n {
            game.undoHalfMove()
            if !sanUciHistory.isEmpty { sanUciHistory.removeLast() }
        }
        // Перестроить историю ходов панели заново из UCI, проще — отбросить последние записи.
        rebuildHistoryDisplay(afterUndoCount: n)
        gameOver = nil
        busy = false
        selected = nil
        legalTargets = []
        refreshBoard()
        turn = game.turn
        checkSquare = game.isInCheck() ? game.findKingSquare(turn) : nil
        updateStatus()
    }

    private func rebuildHistoryDisplay(afterUndoCount n: Int) {
        var remaining = n
        while remaining > 0, !moveHistory.isEmpty {
            let last = moveHistory[moveHistory.count - 1]
            if last.blackSAN != nil {
                moveHistory[moveHistory.count - 1] = MoveRecord(number: last.number, whiteSAN: last.whiteSAN, blackSAN: nil)
            } else {
                moveHistory.removeLast()
            }
            remaining -= 1
        }
    }

    // ---------- Разворот доски / камера ----------

    func flipBoard() { orientation = orientation.other }

    func cycleCamera() {
        let all = CameraPreset.allCases
        let idx = all.firstIndex(of: settings.cameraPreset) ?? 0
        settings.cameraPreset = all[(idx + 1) % all.count]
    }

    // ---------- Сдача и конец партии ----------

    func resign() {
        guard gameOver == nil else { return }
        aiTask?.cancel()
        let who = mode == .pve ? humanColor : turn
        finishGame(forced: GameOverInfo(kind: .resign, winner: who.other, reasonText: "Сдача"))
    }

    private func finishGame(forced: GameOverInfo? = nil) {
        let result: GameOverInfo
        if let forced {
            result = forced
        } else if game.isCheckmate() {
            result = GameOverInfo(kind: .checkmate, winner: turn.other, reasonText: "Мат")
        } else if game.isStalemate() {
            result = GameOverInfo(kind: .stalemate, winner: nil, reasonText: "Пат")
        } else if game.isInsufficientMaterialPublic() {
            result = GameOverInfo(kind: .insufficientMaterial, winner: nil, reasonText: "Недостаточно фигур для мата")
        } else if game.isThreefoldRepetition() {
            result = GameOverInfo(kind: .threefold, winner: nil, reasonText: "Троекратное повторение позиции")
        } else {
            result = GameOverInfo(kind: .fiftyMove, winner: nil, reasonText: "Правило 50 ходов")
        }
        gameOver = result
        thinking = false
        deselect()
        if result.kind == .checkmate, let winner = result.winner {
            checkSquare = game.findKingSquare(winner.other)
            announcer.playEffect("mate")
        }
        updateStatus()

        let plyCount = sanUciHistory.count
        let seconds = Int(Date().timeIntervalSince(startedAt))
        gameStats = GameStats(plyCount: plyCount, seconds: seconds, difficulty: mode == .pve ? difficulty : nil)

        let outcome: String
        if result.winner == nil { outcome = "draw" }
        else if mode == .pve { outcome = result.winner == humanColor ? "win" : "lose" }
        else { outcome = "win" }
        announcer.playEffect(outcome)
        let winnerName = result.winner.map { nameFor($0) } ?? ""
        let line: String
        if outcome == "draw" { line = spec.voice.draw }
        else if mode == .pvp { line = spec.voice.pvpWin(winnerName) }
        else if result.kind == .resign { line = outcome == "win" ? spec.voice.resignWin : spec.voice.resignLose }
        else { line = outcome == "win" ? spec.voice.win : spec.voice.lose }
        announcer.say(line, rate: spec.voice.rate, pitch: spec.voice.pitch)
    }

    func nameFor(_ color: PieceColor) -> String { color == .white ? whiteName : blackName }

    func newGame() { startGame(mode: mode, difficulty: difficulty) }

    func backToMenu() {
        aiTask?.cancel()
        screen = .menu
    }

    // ---------- Статус-бар ----------

    private func updateStatus() {
        if let over = gameOver {
            switch over.kind {
            case .resign: statusText = "\(nameFor(over.winner?.other ?? .white)) сдаётся"
            case .checkmate: statusText = "\(spec.texts.mateBanner) Победа: \(nameFor(over.winner ?? .white))"
            default: statusText = "\(spec.texts.drawTitle): \(over.reasonText.lowercased())"
            }
            return
        }
        if thinking {
            statusText = spec.texts.thinking + "…"
            return
        }
        if mode == .pve {
            statusText = turn == humanColor ? (game.isInCheck() ? spec.texts.check : spec.texts.yourMove) : spec.texts.thinking + "…"
        } else {
            let nm = nameFor(turn)
            statusText = game.isInCheck() ? "\(spec.texts.checkBanner) \(nm), спасай короля!" : "\(nm), твой ход"
        }
    }

    private func pieceAt(_ square: Square) -> Piece? {
        board[square.row][square.file]
    }

    private func refreshBoard() {
        board = game.currentBoard()
        turn = game.turn
    }
}
