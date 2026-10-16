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

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0x12 / 255, green: 0x0f / 255, blue: 0x24 / 255, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never   // отступы под вырез считает CSS (env(safe-area-inset-*))
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsLinkPreview = false
        if #available(iOS 16.4, *) { web.isInspectable = true }

        if let dir = Bundle.main.url(forResource: "Web", withExtension: nil) {
            web.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}
}

