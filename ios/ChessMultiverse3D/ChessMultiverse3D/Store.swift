import StoreKit
import WebKit

/// Покупка ChessGM Pro (StoreKit 2, разовая покупка без подписки).
/// Веб (js/pro.js) шлёт window.webkit.messageHandlers.store.postMessage({cmd}),
/// ответы приходят событиями window.CMPro._event({type, ...}):
///   pro {active}            — есть ли Pro (при запуске, после покупки/восстановления/возврата денег)
///   product {price}         — цена в валюте магазина пользователя («199,00 ₽»)
///   purchase {ok, text?}    — итог покупки (ok=false и пустой text — пользователь передумал)
final class StoreBridge: NSObject, WKScriptMessageHandler {
    static let proID = "com.chessmultiverse.app.pro"

    weak var webView: WKWebView?
    private var product: Product?
    private var updates: Task<Void, Never>?

    override init() {
        super.init()
        // Покупки, завершённые вне приложения (Ask to Buy, другое устройство), и возвраты денег
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish() }
                await self?.refresh()
            }
        }
    }

    deinit { updates?.cancel() }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
        switch cmd {
        case "init": Task { await refresh(); await loadProduct() }
        case "buy": Task { await buy() }
        case "restore": Task { await restore() }
        default: break
        }
    }

    private func loadProduct() async {
        do {
            product = try await Product.products(for: [Self.proID]).first
            if let product { emit(["type": "product", "price": product.displayPrice]) }
        } catch { /* нет сети — цену покажем позже */ }
    }

    /// Есть ли действующая покупка Pro (возврат денег её отзывает).
    private func refresh() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.productID == Self.proID, t.revocationDate == nil { active = true }
        }
        emit(["type": "pro", "active": active])
    }

    private func buy() async {
        if product == nil { await loadProduct() }
        guard let product else {
            emit(["type": "purchase", "ok": false, "text": "Магазин недоступен. Проверьте интернет."])
            return
        }
        do {
            switch try await product.purchase() {
            case .success(let result):
                if case .verified(let t) = result {
                    await t.finish()
                    await refresh()
                    emit(["type": "purchase", "ok": true])
                } else {
                    emit(["type": "purchase", "ok": false, "text": "Покупку не удалось проверить."])
                }
            case .pending:
                emit(["type": "purchase", "ok": false, "text": "Покупка ждёт подтверждения."])
            case .userCancelled:
                emit(["type": "purchase", "ok": false])
            @unknown default:
                emit(["type": "purchase", "ok": false])
            }
        } catch {
            emit(["type": "purchase", "ok": false, "text": error.localizedDescription])
        }
    }

    private func restore() async {
        try? await AppStore.sync()
        await refresh()
        emit(["type": "restored"])
    }

    private func emit(_ ev: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: ev),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.CMPro && CMPro._event(\(json))")
        }
    }
}
