import AVFoundation

/// Звук и озвучка партии. Порт js/sounds.js: все эффекты синтезируются без аудиофайлов.
/// Каждый звук — рецепт (SoundRecipes), который оффлайн рендерится в стерео-буфер
/// (осцилляторы, огибающие, фильтры, шум, ревербератор) и проигрывается через пул
/// AVAudioPlayerNode. У каждой вселенной свой набор (как в вебе), общие звуки — из COMMON.
/// Голосовые реплики — через AVSpeechSynthesizer (ru-RU), во время речи звук приглушается.
final class SoundEngine: NSObject, SoundAnnouncing, AVSpeechSynthesizerDelegate {

    var soundEnabled: Bool = true
    var voiceEnabled: Bool = true

    private let engine = AVAudioEngine()
    private let speech = AVSpeechSynthesizer()
    private let format = AVAudioFormat(standardFormatWithSampleRate: SoundBuilder.sampleRate, channels: 2)!
    private let players: [AVAudioPlayerNode] = (0..<8).map { _ in AVAudioPlayerNode() }
    private var nextPlayer = 0
    private var theme: ThemeKey = .classic
    private var cache: [String: AVAudioPCMBuffer] = [:]
    private let renderQueue = DispatchQueue(label: "chess.sound.render", qos: .userInitiated)

    override init() {
        super.init()
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, options: [.mixWithOthers])
        try? session.setActive(true)
        for player in players {
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: format)
        }
        speech.delegate = self
        startEngine()
    }

    private func startEngine() {
        if engine.isRunning { return }
        engine.prepare()
        do {
            try engine.start()
            players.forEach { $0.play() }
        } catch {
            // Без звука игра продолжается
        }
    }

    // ---------- Публичный интерфейс SoundAnnouncing ----------

    func setTheme(_ key: ThemeKey) {
        theme = key
    }

    func playEffect(_ rawName: String) {
        guard soundEnabled else { return }
        let name = rawName == "mate" ? "check" : rawName   // мат озвучивается как шах, как в вебе
        let key = "\(theme.rawValue).\(name)"
        if let buffer = cache[key] {
            schedule(buffer)
            return
        }
        guard let recipe = SoundRecipes.recipe(theme: theme, name: name) else { return }
        renderQueue.async { [weak self] in
            let buffer = SoundBuilder.render(recipe)
            DispatchQueue.main.async {
                guard let self, let buffer else { return }
                self.cache[key] = buffer
                if self.soundEnabled { self.schedule(buffer) }
            }
        }
    }

    func say(_ text: String, rate: Double, pitch: Double) {
        guard voiceEnabled, !text.isEmpty else { return }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "ru-RU")
        utterance.rate = Float(max(0.3, min(0.6, rate)))
        utterance.pitchMultiplier = Float(max(0.5, min(2.0, pitch)))
        speech.speak(utterance)
    }

    // ---------- Воспроизведение ----------

    private func schedule(_ buffer: AVAudioPCMBuffer) {
        startEngine()
        guard engine.isRunning else { return }
        let node = players[nextPlayer]
        nextPlayer = (nextPlayer + 1) % players.count
        node.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)
        if !node.isPlaying { node.play() }
    }

    // Диктор говорит — общий звук тише, как duck() в js/sounds.js
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        engine.mainMixerNode.outputVolume = 0.5
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        engine.mainMixerNode.outputVolume = 1.0
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        engine.mainMixerNode.outputVolume = 1.0
    }
}

// MARK: - Рецепты звуков (порт SFX/COMMON из js/sounds.js)

typealias SoundRecipe = (SoundBuilder, Double) -> Void

/// Случайный множитель 1 ± k/2, как rnd() в вебе.
func rnd(_ k: Double) -> Double { 1 + (Double.random(in: 0..<1) - 0.5) * k }

/// Частота ноты по имени: "C4", "F#3", "A2".
func hz(_ name: String) -> Double {
    let semitones: [Character: Int] = ["C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11]
    let chars = Array(name)
    guard let base = semitones[chars[0]] else { return 440 }
    var i = 1
    var accidental = 0
    if i < chars.count, chars[i] == "#" { accidental = 1; i += 1 } else if i < chars.count, chars[i] == "b" { accidental = -1; i += 1 }
    let octave = Int(String(chars[i...])) ?? 4
    let midi = base + accidental + (octave + 1) * 12
    return 440 * pow(2, Double(midi - 69) / 12)
}

enum SoundRecipes {

    static func recipe(theme: ThemeKey, name: String) -> SoundRecipe? {
        let table: [String: SoundRecipe]
        switch theme {
        case .classic: table = classic
        case .cars: table = cars
        case .hospital: table = hospital
        case .hockey: table = hockey
        }
        return table[name] ?? common[name]
    }

    static let common: [String: SoundRecipe] = [
        "uiClick": { S, t in
            S.tone(t, .sine, f: 880, f2: 620, dur: 0.05, g: 0.08, send: 0.05)
            S.noise(t, dur: 0.008, g: 0.05, filters: [.hp(3000)], send: 0)
        },
        "uiHover": { S, t in S.tone(t, .sine, f: 1500, dur: 0.02, g: 0.018, send: 0) },
        "type": { S, t in S.noise(t, dur: 0.006, g: 0.04 * rnd(0.6), filters: [.hp(2800 * rnd(0.3))], send: 0) },
        "portal": { S, t in
            S.noise(t, dur: 0.7, g: 0.18, a: 0.25, filters: [.bp(300, to: 3000, q: 1.5)], send: 0.4)
            for (i, f) in [523.25, 659.25, 783.99, 1046.5].enumerated() {
                S.tone(t + 0.08 * Double(i), .sine, f: f, dur: 0.6, g: 0.05, send: 0.5)
            }
        },
        // Кинокамера подлетает к ходу
        "whoosh": { S, t in
            S.noise(t, dur: 0.5, g: 0.26, a: 0.24, filters: [.bp(320, to: 2600, q: 2.4)], send: 0.3)
            S.noise(t + 0.05, dur: 0.45, g: 0.13, a: 0.2, filters: [.bp(600, to: 4200, q: 3)], send: 0.3, pan: 0.3)
        },
        // Мощный удар при взятии со спецэффектами
        "impact": { S, t in
            S.kick(t, g: 0.55)
            S.tone(t, .sine, f: 78, f2: 30, dur: 0.7, g: 0.32, a: 0.002, send: 0.18)
            S.noise(t, dur: 0.6, g: 0.24, filters: [.lp(2600, to: 160, q: 0.7)], send: 0.4)
        }
    ]

    static let classic: [String: SoundRecipe] = [
        "select": { S, t in S.wood(t, pitch: 1.6, g: 0.25) },
        "move": { S, t in S.wood(t, pitch: rnd(0.08)) },
        "hit": { S, t in
            S.wood(t, pitch: rnd(0.06) * 0.92, g: 1.1)
            S.wood(t + 0.085, pitch: rnd(0.06) * 0.8, g: 0.9)
            S.noise(t + 0.02, dur: 0.12, g: 0.06, filters: [.bp(1500, q: 0.7)], send: 0.05)
        },
        // Фигура раскалывается: россыпь деревянных щелчков и хруст
        "shatter": { S, t in
            for i in 0..<8 {
                S.wood(t + 0.02 + Double(i) * 0.035 * rnd(0.6), pitch: 1.3 * rnd(0.5), g: 0.35 * (1 - Double(i) / 10))
            }
            S.noise(t, dur: 0.35, g: 0.12, filters: [.hp(2200)], send: 0.3)
        },
        "castle": { S, t in S.wood(t, pitch: 1.02); S.wood(t + 0.17, pitch: 0.9) },
        "check": { S, t in S.bell(t, 1318.5, dur: 1.8, g: 0.2); S.bell(t + 0.14, 1760, dur: 1.4, g: 0.1) },
        "promote": { S, t in
            for (i, n) in ["C5", "E5", "G5", "C6", "E6", "G6", "C7"].enumerated() {
                S.pluck(t + Double(i) * 0.055, hz(n), dur: 1.1, g: 0.12)
            }
            S.bell(t + 0.42, 2093, dur: 1.6, g: 0.1)
        },
        "illegal": { S, t in
            S.tone(t, .triangle, f: 196, f2: 150, dur: 0.12, g: 0.22)
            S.tone(t + 0.13, .triangle, f: 175, f2: 130, dur: 0.14, g: 0.2)
        },
        "start": { S, t in
            for (i, n) in ["C4", "E4", "G4", "C5"].enumerated() { S.piano(t + Double(i) * 0.11, hz(n), dur: 1.6, g: 0.13) }
            S.chord(t + 0.5, ["C3", "G3", "E4"]) { tt, f, _ in S.piano(tt, f, dur: 2.2, g: 0.08) }
        },
        "win": { S, t in
            S.cymbal(t, dur: 1.2, g: 0.05)
            for i in 0..<8 { S.timpani(t + Double(i) * 0.05, f: 98, g: 0.12 + Double(i) * 0.015) }
            let mel: [(String, Double)] = [("G4", 0.14), ("C5", 0.14), ("E5", 0.14), ("G5", 0.42), ("E5", 0.16), ("G5", 1.3)]
            var tt = t + 0.45
            for (n, d) in mel { S.brass(tt, hz(n), d, g: 0.07, bright: 3200); tt += d }
            let hit = t + 0.45 + 0.14 * 3
            S.timpani(hit, f: 131, g: 0.35)
            S.chord(hit, ["C4", "E4", "G4"]) { x, f, _ in S.brass(x, f, 1.9, g: 0.045, send: 0.3) }
            let big = tt - 1.3
            S.timpani(big, f: 98, g: 0.45)
            S.cymbal(big, dur: 2.2, g: 0.14)
            S.chord(big, ["C3", "C4", "E4", "G4", "C5"]) { x, f, _ in S.brass(x, f, 1.5, g: 0.045, send: 0.35) }
            S.bell(big + 0.1, 2093, dur: 2, g: 0.08)
            S.bell(big + 0.25, 2637, dur: 2, g: 0.06)
        },
        "lose": { S, t in
            S.tone(t, .saw, f: hz("A2"), dur: 3.2, g: 0.05, a: 0.4, d: 0.8, hold: 2.2, vib: 6, send: 0.4,
                   filter: .lp(420, q: 0.7))
            var tt = t + 0.2
            for (n, d) in [("E4", 0.6), ("D4", 0.6), ("C4", 0.6), ("B3", 1.6)] {
                S.piano(tt, hz(n), dur: d + 0.8, g: 0.13, send: 0.35)
                tt += d
            }
            S.chord(t + 0.2, ["A2", "E3", "C4"]) { x, f, _ in S.piano(x, f, dur: 2.2, g: 0.06, send: 0.35) }
            S.chord(t + 2.0, ["E2", "B2", "G#3"]) { x, f, _ in S.piano(x, f, dur: 2.4, g: 0.06, send: 0.4) }
        },
        "draw": { S, t in
            S.chord(t, ["C4", "F4", "G4", "C5"]) { x, f, _ in S.piano(x, f, dur: 1.2, g: 0.08) }
            S.chord(t + 0.8, ["C4", "E4", "G4", "C5"]) { x, f, _ in S.piano(x, f, dur: 2, g: 0.08) }
        }
    ]

    static let cars: [String: SoundRecipe] = [
        "select": { S, t in S.engine(t, f0: 55, f1: 95, f2: 60, dur: 0.22, g: 0.08) },
        "move": { S, t in
            S.engine(t, f0: 50 * rnd(0.1), f1: 150 * rnd(0.1), f2: 85, dur: 0.55, g: 0.13)
            S.noise(t + 0.05, dur: 0.3, g: 0.025, filters: [.bp(1800, q: 1.5)], send: 0.05)
        },
        // Таран: скрежет и звон металла
        "hit": { S, t in
            S.noise(t, dur: 0.45, g: 0.32, filters: [.lp(3500, to: 500, q: 0.8)], send: 0.2)
            S.tone(t, .sine, f: 110, f2: 42, dur: 0.3, g: 0.4, send: 0.05)
            for f in [430.0, 1130, 2390, 3710] {
                S.tone(t + 0.01, .sine, f: f * rnd(0.05), dur: 0.35, g: 0.06, send: 0.2)
            }
        },
        // Машинка взрывается: глухой удар, рокот и треск обломков
        "boom": { S, t in
            S.kick(t, g: 0.5)
            S.noise(t, dur: 1.2, g: 0.36, a: 0.004, filters: [.lp(2200, to: 110, q: 0.6)], send: 0.45)
            S.tone(t, .sine, f: 60, f2: 26, dur: 0.95, g: 0.38, send: 0.12)
            for i in 0..<6 {
                S.noise(t + 0.12 + Double(i) * 0.07 * rnd(0.6), dur: 0.04, g: 0.07,
                        filters: [.hp(2600 * rnd(0.4))], send: 0.25, pan: Double.random(in: -0.4...0.4))
            }
        },
        "castle": { S, t in
            for i in 0..<9 { S.noise(t + Double(i) * 0.034, dur: 0.018, g: 0.16, filters: [.bp(3800, q: 2)], send: 0.05) }
            S.engine(t + 0.34, f0: 60, f1: 130, f2: 90, dur: 0.4, g: 0.1)
        },
        "check": { S, t in S.horn(t, dur: 0.13, g: 0.12); S.horn(t + 0.2, dur: 0.22, g: 0.12) },
        "promote": { S, t in
            S.noise(t, dur: 0.6, g: 0.25, a: 0.25, filters: [.bp(400, to: 5000, q: 2)], send: 0.25)
            S.tone(t, .saw, f: 200, f2: 1300, dur: 0.6, g: 0.08, send: 0.2, filter: .lp(2500))
            S.bell(t + 0.55, 1760, dur: 1.2, g: 0.12)
        },
        "illegal": { S, t in S.screech(t, dur: 0.3, g: 0.2) },
        "start": { S, t in
            for i in 0..<3 {
                S.tone(t + Double(i) * 0.55, .square, f: 440, dur: 0.18, g: 0.07, a: 0.005, d: 0.04, hold: 0.14,
                       send: 0.15, filter: .lp(2000))
            }
            S.tone(t + 1.65, .square, f: 880, dur: 0.55, g: 0.08, a: 0.005, d: 0.08, hold: 0.5, send: 0.2, filter: .lp(2600))
            S.engine(t + 1.7, f0: 55, f1: 210, f2: 150, dur: 1.1, g: 0.14, peak: 0.6)
            S.screech(t + 1.72, dur: 0.4, g: 0.05)
        },
        "win": { S, t in
            S.crowd(t, dur: 3.4, g: 0.12)
            S.horn(t + 0.05, dur: 0.12, g: 0.1)
            S.horn(t + 0.24, dur: 0.2, g: 0.1)
            let beat = 0.24, st = t + 0.5
            for i in 0..<12 {
                if i % 2 == 0 { S.kick(st + Double(i) * beat, g: 0.35) } else { S.snare(st + Double(i) * beat, g: 0.16) }
            }
            let riff: [(String, Double)] = [("C5", 1), ("C5", 1), ("G4", 1), ("C5", 2), ("E5", 2), ("G5", 5)]
            var tt = st
            for (n, k) in riff { S.brass(tt, hz(n), k * beat * 0.95, g: 0.065, bright: 3600); tt += k * beat }
            S.chord(st + 7 * beat, ["C4", "E4", "G4"]) { x, f, _ in S.brass(x, f, 5 * beat, g: 0.04) }
            S.cymbal(st + 7 * beat, dur: 2, g: 0.12)
            S.engine(t + 2.9, f0: 70, f1: 220, f2: 180, dur: 0.9, g: 0.1, peak: 0.5)
        },
        "lose": { S, t in
            // Мотор чихает и глохнет
            var tt = t
            let gaps = [0.1, 0.12, 0.15, 0.2, 0.27, 0.36]
            for (i, gap) in gaps.enumerated() {
                S.engine(tt, f0: 70 - Double(i) * 6, f1: 95 - Double(i) * 8, f2: 50 - Double(i) * 5, dur: 0.12, g: 0.12, peak: 0.3)
                tt += gap
            }
            S.noise(tt, dur: 0.25, g: 0.12, filters: [.lp(500)], send: 0.1)
            // «Грустный тромбон»
            var x = tt + 0.45
            let notes: [(String, Double)] = [("G3", 0.42), ("F#3", 0.42), ("F3", 0.42), ("E3", 1.4)]
            for (i, (n, d)) in notes.enumerated() {
                S.tone(x, .saw, f: hz(n), dur: d, g: 0.12, a: 0.04, d: d * 0.25, hold: d * 0.75, vib: i == 3 ? 35 : 8,
                       vibRate: i == 3 ? 5 : 4, send: 0.25, filter: .lp(900, to: 450, q: 3))
                x += d
            }
        },
        "draw": { S, t in
            S.horn(t, dur: 0.14, g: 0.08)
            S.chord(t + 0.3, ["C4", "F4", "A4"]) { x, f, _ in S.brass(x, f, 0.9, g: 0.04) }
            S.chord(t + 1.2, ["C4", "E4", "G4"]) { x, f, _ in S.brass(x, f, 1.2, g: 0.04) }
        }
    ]

    static let hospital: [String: SoundRecipe] = [
        "select": { S, t in S.tone(t, .sine, f: 1250, dur: 0.05, g: 0.06, send: 0.1) },
        "move": { S, t in
            S.tone(t, .sine, f: 640 * rnd(0.1), f2: 430, dur: 0.1, g: 0.3, send: 0.1)
            S.tone(t + 0.16, .sine, f: 700 * rnd(0.1), f2: 470, dur: 0.09, g: 0.21, send: 0.1)
        },
        "hit": { S, t in
            S.tone(t, .sine, f: 900, f2: 180, dur: 0.16, g: 0.36, send: 0.08)
            S.noise(t + 0.08, dur: 0.4, g: 0.32, filters: [.bp(1800, to: 280, q: 1.3)], send: 0.25)
            S.bell(t + 0.12, 1568, dur: 0.6, g: 0.06)
        },
        // Разряд дефибриллятора
        "zap": { S, t in
            S.tone(t, .saw, f: 95, dur: 0.42, g: 0.15, a: 0.005, d: 0.12, hold: 0.3, vib: 80, vibRate: 55,
                   send: 0.15, filter: .bp(1600, q: 1.2))
            for i in 0..<7 {
                S.noise(t + Double(i) * 0.055 * rnd(0.5), dur: 0.025, g: 0.17, filters: [.hp(3000 * rnd(0.4))], send: 0.12)
            }
            S.tone(t + 0.02, .square, f: 2400, f2: 1800, dur: 0.3, g: 0.025, send: 0.2)
        },
        // Персонаж лопается
        "pop": { S, t in
            S.tone(t, .sine, f: 520, f2: 1400, dur: 0.09, g: 0.25, a: 0.003, send: 0.1)
            S.noise(t, dur: 0.25, g: 0.18, filters: [.bp(1200, to: 300, q: 1.1)], send: 0.25)
        },
        "castle": { S, t in S.noise(t, dur: 0.36, g: 0.42, a: 0.12, filters: [.bp(500, to: 2600, q: 1.8)], send: 0.2) },
        "check": { S, t in for i in 0..<3 { S.monitorBeep(t + Double(i) * 0.2, g: 0.14) } },
        "promote": { S, t in
            for (i, n) in ["C6", "E6", "G6", "C7", "E7"].enumerated() {
                S.bell(t + Double(i) * 0.06, hz(n), dur: 0.9, g: 0.06, send: 0.5)
            }
            S.noise(t, dur: 0.5, g: 0.05, a: 0.1, filters: [.hp(6000)], send: 0.4)
        },
        "illegal": { S, t in
            for i in 0..<2 {
                S.tone(t + Double(i) * 0.15, .square, f: 140, dur: 0.11, g: 0.08, a: 0.005, d: 0.03, hold: 0.08,
                       send: 0.05, filter: .lp(900))
            }
        },
        // Сигнал больничного интеркома «динь-дон-дон»
        "start": { S, t in
            for (n, d) in [("E5", 0.0), ("C5", 0.45), ("G4", 0.9)] { S.bell(t + d, hz(n), dur: 1.6, g: 0.14, send: 0.4) }
        },
        "win": { S, t in
            for (n, d) in [("E5", 0.0), ("C5", 0.32)] { S.bell(t + d, hz(n), dur: 1.2, g: 0.1, send: 0.4) }
            let st = t + 0.75
            let tune: [String?] = ["C5", "E5", "G5", "C6", nil, "G5", "C6", "E6"]
            for (i, n) in tune.enumerated() {
                if let n { S.marimba(st + Double(i) * 0.13, hz(n), g: 0.32) }
            }
            S.chord(st + 1.05, ["C5", "E5", "G5"]) { x, f, _ in S.marimba(x, f, g: 0.12) }
            for i in 0..<8 { S.clap(st + 1.2 + Double(i) * 0.22 + Double.random(in: 0...0.03), g: 0.17) }
            S.crowd(st + 1.1, dur: 2.2, g: 0.07)
            for (i, n) in ["C7", "E7", "G7"].enumerated() {
                S.bell(st + 1.1 + Double(i) * 0.07, hz(n), dur: 1, g: 0.04, send: 0.5)
            }
        },
        "lose": { S, t in
            // Пульс замедляется — и линия на мониторе становится ровной
            for d in [0.0, 0.55, 1.2] { S.monitorBeep(t + d, g: 0.13) }
            S.tone(t + 2.0, .sine, f: 1000, dur: 2.4, g: 0.1, a: 0.01, d: 0.4, hold: 2.0, send: 0.15)
            S.tone(t + 0.3, .saw, f: 55, dur: 4, g: 0.05, a: 1.2, d: 1.0, hold: 1.8, send: 0.4, filter: .lp(300))
            S.tone(t + 0.3, .saw, f: 58.3, dur: 4, g: 0.05, a: 1.2, d: 1.0, hold: 1.8, send: 0.4, filter: .lp(300))
            // Сбой-«аномалия»
            for i in 0..<10 {
                S.tone(t + 1.4 + Double(i) * 0.045, .square, f: 180 + Double.random(in: 0...900), dur: 0.04, g: 0.035,
                       send: 0.1, filter: .lp(2500))
            }
            S.noise(t + 1.4, dur: 0.5, g: 0.06, filters: [.bp(1200, q: 3)], send: 0.3)
        },
        "draw": { S, t in
            for (n, d) in [("G5", 0.0), ("E5", 0.4)] { S.bell(t + d, hz(n), dur: 1.4, g: 0.1, send: 0.4) }
            S.chord(t + 0.8, ["C5", "E5", "G5"]) { x, f, _ in S.marimba(x, f, g: 0.12) }
        }
    ]

    static let hockey: [String: SoundRecipe] = [
        "select": { S, t in S.stickTap(t, g: 0.16) },
        // Толчки коньками при ходе
        "move": { S, t in
            S.skate(t + 0.1, g: 0.17)
            S.skate(t + 0.27, g: 0.18)
            S.skate(t + 0.42, g: 0.08, len: 0.35)
        },
        "stop": { S, t in S.skateStop(t, g: 0.21) },
        // Силовой приём: глухой удар щитков и стук клюшек
        "hit": { S, t in
            S.kick(t, g: 0.5)
            S.noise(t, dur: 0.25, g: 0.3, filters: [.lp(1500, to: 300, q: 0.9)], send: 0.2)
            S.tone(t, .sine, f: 95, f2: 50, dur: 0.3, g: 0.3, send: 0.1)
            S.stickTap(t + 0.05, g: 0.12)
        },
        "impact": { S, t in
            S.kick(t, g: 0.4)
            S.crowd(t + 0.05, dur: 1.4, g: 0.1)
        },
        "boards": { S, t in S.boards(t, g: 0.32) },
        "poof": { S, t in S.whistle(t, dur: 0.22, g: 0.08) },
        "castle": { S, t in
            S.skate(t, g: 0.16)
            S.skate(t + 0.18, g: 0.16)
            S.stickTap(t + 0.4, g: 0.2)
            S.stickTap(t + 0.55, g: 0.2)
        },
        "check": { S, t in S.whistle(t, dur: 0.14, g: 0.11); S.whistle(t + 0.22, dur: 0.32, g: 0.11) },
        // Орган «В атаку!» и трибуны
        "promote": { S, t in
            var tt = t
            for (n, d) in [("G4", 0.12), ("C5", 0.12), ("E5", 0.12), ("G5", 0.24), ("E5", 0.12), ("G5", 0.5)] {
                S.organ(tt, hz(n), dur: d * 0.9, g: 0.06)
                tt += d
            }
            S.crowd(t + 0.9, dur: 1.4, g: 0.08)
        },
        "illegal": { S, t in
            S.whistle(t, dur: 0.09, g: 0.08, f: 2700)
            S.whistle(t + 0.15, dur: 0.09, g: 0.08, f: 2700)
        },
        "start": { S, t in
            S.whistle(t, dur: 0.6, g: 0.12)
            S.stickTap(t + 0.9, g: 0.2)
            S.stickTap(t + 0.98, g: 0.18)
            S.slap(t + 1.1, g: 0.16)
            S.crowd(t + 0.85, dur: 2.4, g: 0.1)
            S.skate(t + 1.2, g: 0.08)
            S.skate(t + 1.38, g: 0.08)
        },
        // Гол! Сирена, рёв трибун и праздничный орган
        "win": { S, t in
            S.goalHorn(t, dur: 2.4, g: 0.09)
            S.crowd(t + 0.05, dur: 4.2, g: 0.16)
            let st = t + 1.9
            var tt = st
            for (n, d) in [("C5", 0.15), ("E5", 0.15), ("G5", 0.15), ("C6", 0.45), ("A5", 0.15), ("C6", 0.9)] {
                S.organ(tt, hz(n), dur: d * 0.92, g: 0.055)
                tt += d
            }
            S.chord(st + 1.05, ["C4", "E4", "G4"]) { x, f, _ in S.organ(x, f, dur: 1.2, g: 0.03) }
            for i in 0..<6 { S.clap(st + 0.1 + Double(i) * 0.3, g: 0.12) }
        },
        // Шайба в наших воротах: далёкая сирена, вздох трибун и грустный орган
        "lose": { S, t in
            S.goalHorn(t, dur: 1.2, g: 0.035)
            S.groan(t + 0.2, dur: 1.8, g: 0.14)
            var tt = t + 1.2
            for (n, d) in [("G4", 0.45), ("F#4", 0.45), ("F4", 0.45), ("E4", 1.3)] {
                S.organ(tt, hz(n), dur: d * 0.95, g: 0.05, send: 0.4)
                tt += d
            }
            S.chord(t + 2.55, ["C3", "G3", "E4"]) { x, f, _ in S.organ(x, f, dur: 1.4, g: 0.02, send: 0.4) }
        },
        // Финальная сирена и вежливые аплодисменты
        "draw": { S, t in
            S.buzzer(t, dur: 1.3, g: 0.06)
            for i in 0..<8 { S.clap(t + 1.4 + Double(i) * 0.16 + Double.random(in: 0...0.05), g: 0.08) }
            S.chord(t + 1.5, ["C4", "F4", "A4"]) { x, f, _ in S.organ(x, f, dur: 0.8, g: 0.025) }
            S.chord(t + 2.3, ["C4", "E4", "G4"]) { x, f, _ in S.organ(x, f, dur: 1.2, g: 0.025) }
        }
    ]
}

// MARK: - Фильтры и огибающие

enum FilterType { case lowpass, highpass, bandpass }

/// Фильтр звука: тип, частота (и конечная частота для плавного перехода), добротность, время перехода.
struct SoundFilter {
    var type: FilterType
    var f: Double
    var f2: Double?
    var q: Double
    var time: Double?

    static func lp(_ f: Double, to f2: Double? = nil, q: Double = 1, time: Double? = nil) -> SoundFilter {
        SoundFilter(type: .lowpass, f: f, f2: f2, q: q, time: time)
    }
    static func hp(_ f: Double, to f2: Double? = nil, q: Double = 1, time: Double? = nil) -> SoundFilter {
        SoundFilter(type: .highpass, f: f, f2: f2, q: q, time: time)
    }
    static func bp(_ f: Double, to f2: Double? = nil, q: Double = 1, time: Double? = nil) -> SoundFilter {
        SoundFilter(type: .bandpass, f: f, f2: f2, q: q, time: time)
    }
}

enum Wave { case sine, square, saw, triangle }

/// Огибающая как SoundManager.env: линейная атака, удержание, экспоненциальный спад к нулю.
private func envelope(_ tau: Double, peak: Double, a: Double, hold: Double, d: Double) -> Double {
    if tau < 0 { return 0 }
    let p = max(peak, 0.0001)
    if tau < a { return p * max(tau, 0) / max(a, 1e-6) }
    if tau < a + hold { return p }
    let x = tau - a - hold
    if x < d { return p * pow(0.0001 / p, x / max(d, 1e-6)) }
    return 0
}

private func waveSample(_ wave: Wave, _ phase: Double) -> Double {
    switch wave {
    case .sine: return sin(phase)
    case .square: return sin(phase) >= 0 ? 1 : -1
    case .saw: return phase / Double.pi - 1
    case .triangle:
        let x = phase / (2 * Double.pi)
        return 4 * abs(x - floor(x + 0.5)) - 1
    }
}

// MARK: - Оффлайн-рендер

/// Собирает звук: источники смешиваются в стерео с панорамой, часть уходит в общую шину
/// ревербератора. Времена — в секундах от начала буфера.
final class SoundBuilder {

    static let sampleRate: Double = 44100
    private let sr = SoundBuilder.sampleRate
    private var dryL: [Float] = []
    private var dryR: [Float] = []
    private var sendBus: [Float] = []

    /// Рендер рецепта в PCM-буфер; nil, если звук пустой.
    static func render(_ recipe: SoundRecipe) -> AVAudioPCMBuffer? {
        let builder = SoundBuilder()
        recipe(builder, 0.02)
        return builder.finish()
    }

    private func ensure(_ n: Int) {
        guard dryL.count < n else { return }
        let grow = n - dryL.count + 1024
        dryL.append(contentsOf: repeatElement(0, count: grow))
        dryR.append(contentsOf: repeatElement(0, count: grow))
        sendBus.append(contentsOf: repeatElement(0, count: grow))
    }

    private func mix(_ src: [Float], at t: Double, pan: Double, send: Double) {
        let start = max(0, Int(t * sr))
        ensure(start + src.count)
        let angle = (min(1, max(-1, pan)) + 1) * Double.pi / 4
        let gl = Float(cos(angle) * 1.4142)
        let gr = Float(sin(angle) * 1.4142)
        let s = Float(send)
        for i in 0..<src.count {
            let x = src[i]
            dryL[start + i] += x * gl
            dryR[start + i] += x * gr
            if s > 0 { sendBus[start + i] += x * s }
        }
    }

    private func applyFilter(_ buf: inout [Float], _ type: FilterType, q: Double, freqAt: (Double) -> Double) {
        let nyq = sr * 0.45
        var x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0
        var b0 = 0.0, b1 = 0.0, b2 = 0.0, a1 = 0.0, a2 = 0.0
        for i in 0..<buf.count {
            if i % 32 == 0 {
                let fc = min(max(10, freqAt(Double(i) / sr)), nyq)
                let w0 = 2 * Double.pi * fc / sr
                let cosw = cos(w0), sinw = sin(w0)
                let alpha = sinw / (2 * max(q, 0.05))
                var nb0 = 0.0, nb1 = 0.0, nb2 = 0.0
                switch type {
                case .lowpass: nb0 = (1 - cosw) / 2; nb1 = 1 - cosw; nb2 = (1 - cosw) / 2
                case .highpass: nb0 = (1 + cosw) / 2; nb1 = -(1 + cosw); nb2 = (1 + cosw) / 2
                case .bandpass: nb0 = alpha; nb1 = 0; nb2 = -alpha
                }
                let a0 = 1 + alpha
                b0 = nb0 / a0; b1 = nb1 / a0; b2 = nb2 / a0
                a1 = -2 * cosw / a0; a2 = (1 - alpha) / a0
            }
            let x = Double(buf[i])
            let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2 = x1; x1 = x; y2 = y1; y1 = y
            buf[i] = Float(y)
        }
    }

    private func applyFilter(_ buf: inout [Float], _ fl: SoundFilter, dur: Double) {
        let time = max(fl.time ?? dur, 1e-4)
        let f0 = max(fl.f, 10)
        let f1 = max(fl.f2 ?? fl.f, 10)
        applyFilter(&buf, fl.type, q: fl.q) { tau in f0 * pow(f1 / f0, min(1, tau / time)) }
    }

    /// Тон: осциллятор с глиссандо f → f2, вибрато, фильтр, перегрузка (drive), огибающая.
    func tone(_ t: Double, _ wave: Wave = .sine, f: Double, f2: Double? = nil, glide: Double? = nil, dur: Double,
              g: Double = 0.2, a: Double = 0.005, d: Double? = nil, hold: Double = 0, detune: Double = 0,
              vib: Double = 0, vibRate: Double = 5.5, send: Double = 0.12, pan: Double = 0,
              filter: SoundFilter? = nil, drive: Bool = false) {
        let nyq = sr * 0.45
        guard f <= nyq else { return }
        let decay = d ?? dur
        let n = Int((a + hold + decay + 0.05) * sr)
        let glideT = max(glide ?? dur, 1e-4)
        let f2c = f2.map { min($0, nyq) }
        let vibT = max(min(0.35, dur * 0.5), 1e-4)
        var buf = [Float](repeating: 0, count: n)
        var phase = 0.0
        for i in 0..<n {
            let tau = Double(i) / sr
            var fr = f
            if let f2c { fr = f * pow(f2c / f, min(1, tau / glideT)) }
            var cents = detune
            if vib > 0 { cents += vib * min(1, tau / vibT) * sin(2 * Double.pi * vibRate * tau) }
            fr *= pow(2, cents / 1200)
            buf[i] = Float(waveSample(wave, phase))
            phase += 2 * Double.pi * fr / sr
            if phase >= 2 * Double.pi { phase -= 2 * Double.pi }
        }
        if let filter { applyFilter(&buf, filter, dur: dur) }
        if drive { for i in 0..<n { buf[i] = Float(tanh(3.2 * Double(buf[i]))) } }
        for i in 0..<n {
            buf[i] *= Float(envelope(Double(i) / sr, peak: g, a: a, hold: hold, d: decay))
        }
        mix(buf, at: t, pan: pan, send: send)
    }

    /// Шумовой источник с фильтрами и огибающей.
    func noise(_ t: Double, dur: Double, g: Double = 0.2, a: Double = 0.002, d: Double? = nil, hold: Double = 0,
               filters: [SoundFilter] = [], send: Double = 0.08, pan: Double = 0) {
        let decay = d ?? dur
        let n = Int((a + hold + decay + 0.05) * sr)
        var buf = (0..<n).map { _ in Float(Double.random(in: -1...1)) }
        for fl in filters { applyFilter(&buf, fl, dur: dur) }
        for i in 0..<n {
            buf[i] *= Float(envelope(Double(i) / sr, peak: g, a: a, hold: hold, d: decay))
        }
        mix(buf, at: t, pan: pan, send: send)
    }

    // ---------- Инструменты (порт класса Synth) ----------

    func wood(_ t: Double, pitch: Double = 1, g: Double = 1) {
        noise(t, dur: 0.014, g: 0.45 * g, filters: [.bp(2600 * pitch, q: 1.6)], send: 0.05)
        tone(t, .sine, f: 760 * pitch, f2: 540 * pitch, dur: 0.08, g: 0.3 * g, a: 0.001, send: 0.06)
        tone(t, .triangle, f: 230 * pitch, f2: 150 * pitch, dur: 0.12, g: 0.28 * g, a: 0.002, send: 0.04)
    }

    func bell(_ t: Double, _ f: Double, dur: Double = 1.4, g: Double = 0.2, send: Double = 0.35, pan: Double = 0) {
        let partials: [(Double, Double)] = [(1, 1), (2.01, 0.45), (2.76, 0.32), (5.4, 0.16), (8.93, 0.07)]
        for (r, k) in partials {
            tone(t, .sine, f: f * r, dur: dur / (1 + r * 0.25), g: g * k, a: 0.002, send: send, pan: pan)
        }
    }

    func piano(_ t: Double, _ f: Double, dur: Double = 1.2, g: Double = 0.18, send: Double = 0.2) {
        tone(t, .triangle, f: f, dur: dur, g: g, a: 0.004, send: send)
        tone(t, .sine, f: f * 2, dur: dur * 0.6, g: g * 0.35, a: 0.004, send: send)
        tone(t, .sine, f: f * 3, dur: dur * 0.35, g: g * 0.12, a: 0.004, send: send)
    }

    func pluck(_ t: Double, _ f: Double, dur: Double = 0.9, g: Double = 0.16, send: Double = 0.3) {
        tone(t, .triangle, f: f, dur: dur, g: g, a: 0.002, send: send, filter: .lp(f * 8, to: f * 2, q: 0.5, time: dur * 0.6))
        tone(t, .sine, f: f * 2, dur: dur * 0.4, g: g * 0.25, a: 0.002, send: send)
    }

    func marimba(_ t: Double, _ f: Double, g: Double = 0.22, send: Double = 0.18) {
        tone(t, .sine, f: f, dur: 0.45, g: g, a: 0.002, send: send)
        tone(t, .sine, f: f * 4, dur: 0.12, g: g * 0.3, a: 0.001, send: send)
        noise(t, dur: 0.01, g: g * 0.25, filters: [.bp(f * 3, q: 2)], send: 0)
    }

    func brass(_ t: Double, _ f: Double, _ dur: Double, g: Double = 0.12, a: Double = 0.05, release: Double = 0.18,
               send: Double = 0.22, pan: Double = 0, bright: Double = 2600) {
        for det in [-7.0, 7.0] {
            tone(t, .saw, f: f, dur: dur, g: g, a: a, d: release, hold: max(0, dur - 0.12), detune: det,
                 vib: dur > 0.5 ? 9 : 0, send: send, pan: pan, filter: .lp(500, to: bright, q: 1.2, time: 0.08))
        }
    }

    func timpani(_ t: Double, f: Double = 98, g: Double = 0.4) {
        tone(t, .sine, f: f * 1.1, f2: f, glide: 0.08, dur: 1.1, g: g, a: 0.003, send: 0.25)
        noise(t, dur: 0.2, g: g * 0.35, filters: [.lp(700)], send: 0.2)
    }

    func kick(_ t: Double, g: Double = 0.45) {
        tone(t, .sine, f: 140, f2: 45, glide: 0.12, dur: 0.28, g: g, a: 0.002, send: 0.02)
    }

    func snare(_ t: Double, g: Double = 0.25) {
        noise(t, dur: 0.16, g: g, filters: [.bp(1900, q: 0.8)], send: 0.15)
        tone(t, .triangle, f: 190, f2: 140, dur: 0.08, g: g * 0.6, send: 0.05)
    }

    func cymbal(_ t: Double, dur: Double = 1.6, g: Double = 0.12) {
        noise(t, dur: dur, g: g, a: 0.004, filters: [.hp(5200)], send: 0.3)
    }

    func clap(_ t: Double, g: Double = 0.2) {
        for i in 0..<3 {
            noise(t + Double(i) * 0.009, dur: 0.05, g: g * (1 - Double(i) * 0.2), filters: [.bp(1400, q: 1.1)], send: 0.2)
        }
    }

    /// Мотор: пила и меандр с частотой, ведущей f0 → f1 → f2, фильтр-свип и перегрузка.
    func engine(_ t: Double, f0: Double = 60, f1: Double = 140, f2: Double = 90, dur: Double = 0.5,
                g: Double = 0.16, peak: Double = 0.45, pan: Double = 0) {
        let n = Int((dur + 0.1) * sr)
        let p = max(dur * peak, 1e-4)
        func freq(_ tau: Double) -> Double {
            if tau < p { return f0 + (f1 - f0) * tau / p }
            return f1 + (f2 - f1) * min(1, (tau - p) / max(dur - p, 1e-4))
        }
        func cutoff(_ tau: Double) -> Double {
            if tau < p { return f0 * 7 + (f1 * 9 - f0 * 7) * tau / p }
            return f1 * 9 + (f2 * 6 - f1 * 9) * min(1, (tau - p) / max(dur - p, 1e-4))
        }
        var mixBuf = [Float](repeating: 0, count: n)
        let parts: [(Wave, Double, Double)] = [(.saw, 1, 0.6), (.square, 0.5, 0.45), (.saw, 2.01, 0.2)]
        for (wave, mult, gain) in parts {
            var phase = 0.0
            for i in 0..<n {
                let tau = Double(i) / sr
                mixBuf[i] += Float(waveSample(wave, phase) * gain)
                phase += 2 * Double.pi * freq(tau) * mult / sr
                if phase >= 2 * Double.pi { phase -= 2 * Double.pi }
            }
        }
        for i in 0..<n { mixBuf[i] = Float(tanh(3.2 * Double(mixBuf[i]))) }
        applyFilter(&mixBuf, .lowpass, q: 2) { cutoff($0) }
        for i in 0..<n {
            mixBuf[i] *= Float(envelope(Double(i) / sr, peak: g, a: 0.03, hold: dur * 0.55, d: dur * 0.4))
        }
        mix(mixBuf, at: t, pan: pan, send: 0.06)
    }

    func horn(_ t: Double, dur: Double = 0.16, g: Double = 0.14) {
        for f in [415.0, 523.0] {
            tone(t, .square, f: f, dur: dur, g: g, a: 0.008, d: 0.04, hold: dur * 0.8, send: 0.1, filter: .lp(1800, q: 1))
        }
    }

    func screech(_ t: Double, dur: Double = 0.35, g: Double = 0.12) {
        noise(t, dur: dur, g: g, d: dur * 0.4, hold: dur * 0.6, filters: [.bp(3100, to: 2600, q: 10)], send: 0.1)
        tone(t, .sine, f: 2500, f2: 2200, dur: dur, g: g * 0.35, d: dur * 0.4, hold: dur * 0.6, vib: 60, vibRate: 22, send: 0.1)
    }

    /// Гул трибун: три полосы шума с плавающей громкостью и редкие «ура».
    func crowd(_ t: Double, dur: Double = 2.6, g: Double = 0.14) {
        for (f, q) in [(650.0, 1.2), (1200.0, 1.4), (2300.0, 1.6)] {
            let n = Int((dur + 0.2) * sr)
            var buf = (0..<n).map { _ in Float(Double.random(in: -1...1)) }
            applyFilter(&buf, .bandpass, q: q) { _ in f }
            let steps = 40
            let levels = (0..<steps).map { _ in 0.55 + Double.random(in: 0...0.45) }
            let hold = max(0, dur - 1.25)
            for i in 0..<n {
                let tau = Double(i) / sr
                let pos = min(Double(steps - 1), tau / dur * Double(steps - 1))
                let i0 = Int(pos)
                let i1 = min(steps - 1, i0 + 1)
                let frac = pos - Double(i0)
                let am = levels[i0] * (1 - frac) + levels[i1] * frac
                buf[i] *= Float(am * envelope(tau, peak: g, a: 0.35, hold: hold, d: 0.9))
            }
            mix(buf, at: t, pan: 0, send: 0.3)
        }
        for _ in 0..<3 {
            let w = t + 0.2 + Double.random(in: 0...max(0, dur - 0.8))
            tone(w, .sine, f: 1900 + Double.random(in: 0...500), f2: 2900 + Double.random(in: 0...600), glide: 0.25,
                 dur: 0.4, g: g * 0.35, a: 0.03, send: 0.3)
        }
    }

    func monitorBeep(_ t: Double, g: Double = 0.16, dur: Double = 0.1) {
        tone(t, .sine, f: 1000, dur: dur, g: g, a: 0.004, d: 0.03, hold: dur * 0.7, send: 0.12)
    }

    /// Свисток судьи: высокий тон с трелью и шумом дыхания.
    func whistle(_ t: Double, dur: Double = 0.35, g: Double = 0.12, f: Double = 2950) {
        tone(t, .sine, f: f, dur: dur, g: g, a: 0.01, d: 0.04, hold: dur * 0.85, vib: 90, vibRate: 34, send: 0.25)
        tone(t, .sine, f: f * 2.01, dur: dur, g: g * 0.12, a: 0.01, d: 0.04, hold: dur * 0.85, vib: 90, vibRate: 34, send: 0.25)
        noise(t, dur: dur, g: g * 0.3, a: 0.01, d: 0.05, hold: dur * 0.8, filters: [.bp(f * 1.05, q: 4)], send: 0.2)
    }

    /// Стадионный орган: гармоники с лёгким вибрато.
    func organ(_ t: Double, _ f: Double, dur: Double = 0.3, g: Double = 0.08, send: Double = 0.3) {
        let partials: [(Double, Double)] = [(1, 1), (2, 0.7), (3, 0.45), (4, 0.3), (6, 0.18), (8, 0.1)]
        for (r, k) in partials {
            tone(t, .sine, f: f * r, dur: dur, g: g * k, a: 0.008, d: 0.08, hold: max(0, dur - 0.06), vib: 7, vibRate: 6.4, send: send)
        }
    }

    /// Сирена гола.
    func goalHorn(_ t: Double, dur: Double = 2.2, g: Double = 0.1) {
        for f in [138.6, 174.6, 207.7] {
            tone(t, .saw, f: f, dur: dur, g: g, a: 0.06, d: 0.3, hold: dur - 0.35, send: 0.35,
                 filter: .lp(900, to: 1500, q: 1.4, time: 0.3), drive: true)
        }
        tone(t, .sine, f: 69.3, dur: dur, g: g * 1.2, a: 0.06, d: 0.3, hold: dur - 0.35, send: 0.2)
    }

    func skate(_ t: Double, g: Double = 0.1, len: Double = 0.18) {
        noise(t, dur: len, g: g, a: 0.01, d: len * 0.6, hold: len * 0.4,
              filters: [.hp(2600), .bp(5200, to: 3800, q: 1.2)], send: 0.08)
    }

    func skateStop(_ t: Double, g: Double = 0.16) {
        noise(t, dur: 0.32, g: g, a: 0.02, d: 0.24, hold: 0.1, filters: [.bp(7000, to: 2800, q: 1.4, time: 0.3)], send: 0.12)
        noise(t + 0.03, dur: 0.35, g: g * 0.5, a: 0.03, d: 0.35, filters: [.hp(6000)], send: 0.15)
    }

    func stickTap(_ t: Double, g: Double = 0.2) {
        noise(t, dur: 0.02, g: g * 1.2, filters: [.bp(2200, q: 1.3)], send: 0.1)
        tone(t, .triangle, f: 520, f2: 330, dur: 0.07, g: g * 0.8, a: 0.001, send: 0.08)
    }

    func slap(_ t: Double, g: Double = 0.3) {
        noise(t, dur: 0.05, g: g, filters: [.hp(1400)], send: 0.2)
        tone(t, .square, f: 1100, f2: 300, dur: 0.06, g: g * 0.35, a: 0.001, send: 0.1, filter: .lp(3000))
        kick(t, g: g * 0.5)
    }

    /// Удар о борт: глухой бум и дребезг оргстекла.
    func boards(_ t: Double, g: Double = 0.3) {
        kick(t, g: g * 1.3)
        noise(t, dur: 0.5, g: g * 0.8, filters: [.lp(1800, to: 200, q: 0.8)], send: 0.3)
        tone(t + 0.01, .triangle, f: 190, dur: 0.6, g: g * 0.35, vib: 45, vibRate: 13, send: 0.25)
        for i in 0..<7 {
            let when = t + 0.02 + Double(i) * 0.045 * rnd(1)
            noise(when, dur: 0.05, g: g * 0.35 * (1 - Double(i) / 9),
                  filters: [.bp(2600 * rnd(0.3), q: 3)], send: 0.25)
        }
    }

    func buzzer(_ t: Double, dur: Double = 1.4, g: Double = 0.07) {
        for f in [220.0, 223.0] {
            tone(t, .square, f: f, dur: dur, g: g, a: 0.01, d: 0.08, hold: dur - 0.1, send: 0.3, filter: .lp(2400))
        }
    }

    /// Разочарованный гул трибун «о-о-ох».
    func groan(_ t: Double, dur: Double = 1.6, g: Double = 0.12) {
        for (f, f2) in [(520.0, 360.0), (950, 640), (2300, 1700)] {
            noise(t, dur: dur, g: f > 2000 ? g * 0.3 : g, a: 0.25, d: dur * 0.5, hold: dur * 0.3,
                  filters: [.bp(f, to: f2, q: 3.5, time: dur)], send: 0.35)
        }
    }

    func chord(_ t: Double, _ notes: [String], _ fn: (Double, Double, Int) -> Void) {
        for (i, n) in notes.enumerated() { fn(t, hz(n), i) }
    }

    // ---------- Финализация: ревербератор и сведение в PCM ----------

    /// Упрощённый ревербератор (четыре гребенчатых фильтра и два всепропускающих) вместо свёртки.
    private func reverb(_ input: [Float]) -> [Float] {
        let n = input.count
        var out = [Float](repeating: 0, count: n)
        for delay in [1116, 1188, 1277, 1356] {
            let len = Int(Double(delay) * sr / 44100)
            var line = [Float](repeating: 0, count: len)
            var idx = 0
            var store: Float = 0
            for i in 0..<n {
                let y = line[idx]
                store = y * 0.8 + store * 0.2
                line[idx] = input[i] + store * 0.84
                out[i] += y * 0.25
                idx += 1
                if idx == len { idx = 0 }
            }
        }
        for delay in [556, 441] {
            let len = Int(Double(delay) * sr / 44100)
            var line = [Float](repeating: 0, count: len)
            var idx = 0
            for i in 0..<n {
                let x = out[i]
                let bufOut = line[idx]
                out[i] = -x + bufOut
                line[idx] = x + bufOut * 0.5
                idx += 1
                if idx == len { idx = 0 }
            }
        }
        return out
    }

    private func finish() -> AVAudioPCMBuffer? {
        let n = dryL.count
        guard n > 0,
              let format = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 2),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(n)),
              let channels = buffer.floatChannelData else { return nil }
        let wet = reverb(sendBus)
        for i in 0..<n {
            let l = Float(tanh(Double(dryL[i] + wet[i] * 0.6) * 1.2)) * 0.9
            let r = Float(tanh(Double(dryR[i] + wet[i] * 0.6) * 1.2)) * 0.9
            channels[0][i] = l
            channels[1][i] = r
        }
        buffer.frameLength = AVAudioFrameCount(n)
        return buffer
    }
}
