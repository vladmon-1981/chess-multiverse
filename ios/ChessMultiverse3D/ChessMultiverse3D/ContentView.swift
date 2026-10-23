import SwiftUI
import WebKit
import AVFoundation

/// Приложение показывает веб-версию игры (index.html, css, js из корня репозитория),
/// которую шаг сборки «Copy Web Version» кладёт в бандл в папку Web. Фигуры, интерфейс,
/// эффекты, звуки и компьютер-соперник — те же, что в браузере, без интернета.
struct ContentView: View {
    var body: some View {
        // Сверху и по бокам WebView не заходит под вырез/Dynamic Island: внутри WKWebView
        // CSS env(safe-area-inset-*) под SwiftUI приходит нулевым, и шапка игры уезжала под часы.
        WebGameView()
            .ignoresSafeArea(edges: .bottom)
            .background(Color(red: 0x12 / 255, green: 0x0f / 255, blue: 0x24 / 255).ignoresSafeArea())
            .persistentSystemOverlays(.hidden)
    }
}

struct WebGameView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        // Звук игры слышен и при беззвучном режиме, но не глушит чужую музыку
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        // Без масштабирования страницы пинчем и двойным тапом: жесты принадлежат 3D-камере
        let noZoom = WKUserScript(source: """
            (function () {
              var m = document.querySelector('meta[name=viewport]');
              if (m) m.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
              var s = document.createElement('style');
              s.textContent = 'html, body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; overscroll-behavior: none; } #fullscreenBtn { display: none !important; }';
              document.head.appendChild(s);
            })();
            """, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        config.userContentController.addUserScript(noZoom)
        // Web Audio в WKWebView по умолчанию идёт как «ambient» и глохнет при беззвучном режиме
        // (переключатель на боку). Audio Session API (iOS 17+) переводит его в «playback».
        let audioSession = WKUserScript(source: """
            try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        config.userContentController.addUserScript(audioSession)
        #if DEBUG
        if CommandLine.arguments.contains("-webLog") { WebLog.install(in: config) }
        #endif
        #if DEBUG
        // Сценарий для снимков App Store (AppStore/shoot.sh): JS из переменной CM_SCRIPT выполняется
        // через 1,5 с после загрузки страницы. В Release этого кода нет.
        if let js = ProcessInfo.processInfo.environment["CM_SCRIPT"], !js.isEmpty {
            config.userContentController.addUserScript(WKUserScript(
                source: "setTimeout(function () { \(js) }, 1500);",
                injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        #endif
        let tts = NativeSpeech()
        config.userContentController.add(tts, name: "tts")

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0x12 / 255, green: 0x0f / 255, blue: 0x24 / 255, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never   // отступы под вырез считает CSS (env(safe-area-inset-*))
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        tts.webView = web

        if let dir = Bundle.main.url(forResource: "Web", withExtension: nil) {
            web.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}
}


#if DEBUG
/// Отладка (запуск с аргументом -webLog): раз в 3 с пишет в системный лог состояние Web Audio —
/// так звук проверяется в симуляторе без ушей: `log stream --predicate 'eventMessage CONTAINS "[web]"'`.
final class WebLog: NSObject, WKScriptMessageHandler {
    static func install(in config: WKWebViewConfiguration) {
        config.userContentController.add(WebLog(), name: "log")
        config.userContentController.addUserScript(WKUserScript(source: """
            (function () {
              var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
              var list = [];
              var W = function (o) { var c = new AC(o); list.push(c); return c; };
              W.prototype = AC.prototype;
              window.AudioContext = W; window.webkitAudioContext = W;
              setInterval(function () {
                window.webkit.messageHandlers.log.postMessage('audio ' + list.map(function (c) { return c.state + '@' + c.currentTime.toFixed(1); }).join(',') +
                  ' session=' + (navigator.audioSession ? navigator.audioSession.type : 'none'));
              }, 3000);
            })();
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        NSLog("[web] %@", String(describing: message.body))
    }
}

#endif

/// Голос диктора через системный синтезатор: игра шлёт {cmd: 'say', text, rate, pitch, gender}.
/// В отличие от speechSynthesis внутри WebView, AVSpeechSynthesizer видит скачанные голоса
/// («Юрий», улучшенная «Милена») и знает их пол — так у хоккея звучит мужской комментатор.
final class NativeSpeech: NSObject, WKScriptMessageHandler, AVSpeechSynthesizerDelegate {
    weak var webView: WKWebView?
    private let synth = AVSpeechSynthesizer()

    override init() {
        super.init()
        synth.delegate = self
        #if DEBUG
        if CommandLine.arguments.contains("-webLog") {
            NSLog("[web] male=%@ female=%@", Self.voice(gender: "male", lang: "ru")?.name ?? "-", Self.voice(gender: "female", lang: "ru")?.name ?? "-")
        }
        #endif
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
        if cmd == "cancel" { synth.stopSpeaking(at: .immediate); return }
        guard cmd == "say", let text = body["text"] as? String, !text.isEmpty else { return }
        synth.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: text)
        let lang = (body["lang"] as? String) == "en" ? "en" : "ru"
        u.voice = Self.voice(gender: body["gender"] as? String, lang: lang)
        // rate из веба: 1 — обычная речь; у AVSpeech обычная речь — 0.5
        let rate = (body["rate"] as? Double) ?? 1
        u.rate = Float(min(max(Double(AVSpeechUtteranceDefaultSpeechRate) * rate, Double(AVSpeechUtteranceMinimumSpeechRate)), Double(AVSpeechUtteranceMaximumSpeechRate)))
        u.pitchMultiplier = Float(min(max((body["pitch"] as? Double) ?? 1, 0.5), 2))
        synth.speak(u)
    }

    /// Лучший по качеству голос языка интерфейса ("ru" или "en") нужного пола; без пола — лучший из языка.
    static func voice(gender: String?, lang: String = "ru") -> AVSpeechSynthesisVoice? {
        let ru = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix(lang) }
            .sorted { $0.quality.rawValue > $1.quality.rawValue }
        #if DEBUG
        if CommandLine.arguments.contains("-webLog") {
            NSLog("[web] voices %@", ru.map { "\($0.name)/\($0.gender.rawValue)/q\($0.quality.rawValue)" }.joined(separator: ", "))
        }
        #endif
        guard let gender, !gender.isEmpty else { return ru.first }
        let male = gender == "male"
        let byGender = ru.first { $0.gender == (male ? .male : .female) }
        let byName = ru.first {
            let n = $0.name.lowercased()
            if lang == "en" {
                return male ? (n.contains("daniel") || n.contains("aaron") || n.contains("arthur") || n.contains("alex"))
                            : (n.contains("samantha") || n.contains("ava") || n.contains("allison") || n.contains("nicky"))
            }
            return male ? (n.contains("yuri") || n.contains("юри") || n.contains("юрий"))
                        : (n.contains("milena") || n.contains("милена") || n.contains("katya") || n.contains("катя"))
        }
        return byGender ?? byName ?? ru.first
    }

    private func notify(_ kind: String) {
        DispatchQueue.main.async { [weak self] in self?.webView?.evaluateJavaScript("window.__ttsEvent && __ttsEvent('\(kind)')") }
    }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didStart u: AVSpeechUtterance) { notify("start") }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { notify("end") }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { notify("end") }
}
