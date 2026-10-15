import AVFoundation

/// Звук и озвучка партии: простые тоны синтезируются в реальном времени через
/// AVAudioEngine + AVAudioSourceNode (без аудиофайлов — как в оригинальном js/sounds.js,
/// где звук строился осцилляторами Web Audio API). Голосовые реплики — через
/// AVSpeechSynthesizer с голосом ru-RU.
final class SoundEngine: SoundAnnouncing {

    var soundEnabled: Bool = true
    var voiceEnabled: Bool = true

    private let engine = AVAudioEngine()
    private let speech = AVSpeechSynthesizer()
    private var sampleRate: Double = 44100

    init() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, options: [.mixWithOthers])
        try? session.setActive(true)
        sampleRate = engine.outputNode.inputFormat(forBus: 0).sampleRate
        if sampleRate <= 0 { sampleRate = 44100 }
        try? engine.start()
    }

    // ---------- Публичный интерфейс SoundAnnouncing ----------

    func playEffect(_ name: String) {
        guard soundEnabled else { return }
        switch name {
        case "move": playMove()
        case "hit": playCapture()
        case "check": playCheck()
        case "castle": playCastle()
        case "start": playStart()
        case "win": playWin()
        case "lose": playLose()
        case "draw": playDraw()
        case "mate": playCheck()
        case "select", "promote": playTone(frequency: 520, duration: 0.07, amplitude: 0.15)
        case "illegal": playTone(frequency: 160, duration: 0.12, amplitude: 0.2, waveform: .square)
        default: break
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

    // ---------- Эффекты ----------

    func playMove() { playTone(frequency: 420, duration: 0.09, amplitude: 0.18) }

    func playCapture() {
        playTone(frequency: 300, duration: 0.05, amplitude: 0.22, waveform: .square)
        playTone(frequency: 180, duration: 0.09, amplitude: 0.2, delay: 0.05)
    }

    func playCheck() {
        playTone(frequency: 660, duration: 0.1, amplitude: 0.22)
        playTone(frequency: 880, duration: 0.14, amplitude: 0.2, delay: 0.1)
    }

    func playCastle() {
        playTone(frequency: 350, duration: 0.08, amplitude: 0.18)
        playTone(frequency: 450, duration: 0.08, amplitude: 0.18, delay: 0.08)
    }

    func playStart() {
        playTone(frequency: 523, duration: 0.12, amplitude: 0.2)
        playTone(frequency: 659, duration: 0.12, amplitude: 0.2, delay: 0.12)
        playTone(frequency: 784, duration: 0.16, amplitude: 0.2, delay: 0.24)
    }

    func playWin() {
        let notes: [Double] = [523, 659, 784, 1047]
        for (i, f) in notes.enumerated() {
            playTone(frequency: f, duration: 0.18, amplitude: 0.22, delay: Double(i) * 0.15)
        }
    }

    func playLose() {
        let notes: [Double] = [440, 392, 349, 294]
        for (i, f) in notes.enumerated() {
            playTone(frequency: f, duration: 0.22, amplitude: 0.2, delay: Double(i) * 0.18)
        }
    }

    func playDraw() {
        playTone(frequency: 392, duration: 0.2, amplitude: 0.18)
        playTone(frequency: 392, duration: 0.2, amplitude: 0.18, delay: 0.25)
    }

    // ---------- Синтез тона через AVAudioSourceNode ----------

    private enum Waveform { case sine, square }

    private func playTone(frequency: Double, duration: Double, amplitude: Double, waveform: Waveform = .sine, delay: Double = 0) {
        guard soundEnabled else { return }
        if delay > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.scheduleTone(frequency: frequency, duration: duration, amplitude: amplitude, waveform: waveform)
            }
        } else {
            scheduleTone(frequency: frequency, duration: duration, amplitude: amplitude, waveform: waveform)
        }
    }

    private func scheduleTone(frequency: Double, duration: Double, amplitude: Double, waveform: Waveform) {
        let rate = sampleRate
        var phase: Double = 0
        let phaseIncrement = 2.0 * Double.pi * frequency / rate
        let totalFrames = Int(duration * rate)
        var framesRendered = 0

        let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)!
        let sourceNode = AVAudioSourceNode { _, _, frameCount, audioBufferList -> OSStatus in
            let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
            for frame in 0..<Int(frameCount) {
                let remaining = totalFrames - framesRendered
                var sampleValue: Double = 0
                if remaining > 0 {
                    let envelope = min(1.0, Double(remaining) / (rate * 0.02)) * min(1.0, Double(framesRendered) / (rate * 0.005) + 0.001)
                    let raw: Double
                    switch waveform {
                    case .sine: raw = sin(phase)
                    case .square: raw = sin(phase) >= 0 ? 1.0 : -1.0
                    }
                    sampleValue = raw * amplitude * min(1.0, envelope)
                    phase += phaseIncrement
                    if phase > 2.0 * Double.pi { phase -= 2.0 * Double.pi }
                }
                framesRendered += 1
                for buffer in ablPointer {
                    let buf = UnsafeMutableBufferPointer<Float>(buffer)
                    buf[frame] = Float(sampleValue)
                }
            }
            return noErr
        }

        engine.attach(sourceNode)
        engine.connect(sourceNode, to: engine.mainMixerNode, format: format)

        let lifetime = duration + 0.05
        DispatchQueue.main.asyncAfter(deadline: .now() + lifetime) { [weak self] in
            self?.engine.disconnectNodeOutput(sourceNode)
            self?.engine.detach(sourceNode)
        }
    }
}
