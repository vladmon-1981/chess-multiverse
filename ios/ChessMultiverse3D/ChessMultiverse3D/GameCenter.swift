import GameKit
import WebKit
import UIKit

/// Мост «веб-игра ↔ Game Center». Веб (js/online.js) шлёт команды через
/// window.webkit.messageHandlers.gc.postMessage({cmd, ...}), ответы приходят событиями
/// window.CMOnline._event({type, ...}).
///
/// Партия — GKMatch в реальном времени на двоих: ходы, сдача, время и реванш — JSON-сообщения,
/// правила и часы считает сама игра. Приглашения друзей и случайный соперник — штатное окно
/// GKMatchmakerViewController. Соперники подбираются только с тем же временем на ход (playerGroup).
///
/// Таблицы рекордов заводятся в App Store Connect (Game Center → Leaderboards) с ID ниже,
/// тип «Classic», отправка «Most Recent Score»: в них лежит текущий рейтинг и число побед.
final class GameCenterBridge: NSObject, WKScriptMessageHandler {
    static let ratingBoard = "chessgm.rating"
    static let winsBoard = "chessgm.wins"

    weak var webView: WKWebView?
    private var match: GKMatch?
    private var authStarted = false
    private var announced = false   // событие «соперник найден» — один раз на партию

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
        switch cmd {
        case "auth": authenticate()
        case "find": find(group: body["group"] as? Int ?? 0)
        case "cancel": if let vc = topController() as? GKMatchmakerViewController { vc.dismiss(animated: true) }
        case "send":
            if let s = body["data"] as? String, let data = s.data(using: .utf8), let match {
                do { try match.sendData(toAllPlayers: data, with: .reliable) }
                catch { emit(["type": "error", "text": error.localizedDescription]) }
            }
        case "leave": leave()
        case "leaderboard": showLeaderboard()
        case "report": report(rating: body["rating"] as? Int, wins: body["wins"] as? Int)
        default: break
        }
    }

    // MARK: - Вход

    private func authenticate() {
        let me = GKLocalPlayer.local
        if me.isAuthenticated { sendAuth(); return }
        if authStarted { return }
        authStarted = true
        me.authenticateHandler = { [weak self] vc, error in
            guard let self else { return }
            if let vc { self.topController()?.present(vc, animated: true); return }
            if me.isAuthenticated {
                me.register(self)
                self.sendAuth()
                self.loadMyScores()
            } else {
                self.emit(["type": "auth", "ok": false, "text": error?.localizedDescription ?? ""])
            }
        }
    }

    private func sendAuth() {
        emit(["type": "auth", "ok": true, "name": GKLocalPlayer.local.displayName])
    }

    // MARK: - Подбор соперника

    private func find(group: Int) {
        guard GKLocalPlayer.local.isAuthenticated else {
            emit(["type": "auth", "ok": false])
            return
        }
        leave()
        let req = GKMatchRequest()
        req.minPlayers = 2
        req.maxPlayers = 2
        req.playerGroup = group
        guard let vc = GKMatchmakerViewController(matchRequest: req) else {
            emit(["type": "error", "text": "Game Center недоступен"])
            return
        }
        present(vc)
    }

    private func present(_ vc: GKMatchmakerViewController) {
        vc.matchmakerDelegate = self
        topController()?.present(vc, animated: true)
    }

    private func start(_ m: GKMatch) {
        match = m
        announced = false
        m.delegate = self
        announceIfReady(m)
    }

    private func announceIfReady(_ m: GKMatch) {
        guard !announced, match === m, m.expectedPlayerCount == 0, let opp = m.players.first else { return }
        announced = true
        emit(["type": "match", "opponent": opp.displayName])
    }

    private func leave() {
        match?.delegate = nil
        match?.disconnect()
        match = nil
    }

    // MARK: - Доска почёта

    private func showLeaderboard() {
        let vc = GKGameCenterViewController(leaderboardID: Self.ratingBoard, playerScope: .global, timeScope: .allTime)
        vc.gameCenterDelegate = self
        topController()?.present(vc, animated: true)
    }

    private func report(rating: Int?, wins: Int?) {
        guard GKLocalPlayer.local.isAuthenticated else { return }
        if let rating {
            GKLeaderboard.submitScore(rating, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [Self.ratingBoard]) { _ in }
        }
        if let wins {
            GKLeaderboard.submitScore(wins, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [Self.winsBoard]) { _ in }
        }
    }

    /// Свои результаты из таблиц — чтобы на новом устройстве рейтинг не начинался с нуля.
    private func loadMyScores() {
        GKLeaderboard.loadLeaderboards(IDs: [Self.ratingBoard, Self.winsBoard]) { [weak self] boards, _ in
            guard let self, let boards, !boards.isEmpty else { return }
            var out: [String: Any] = ["type": "scores"]
            let group = DispatchGroup()
            for b in boards {
                group.enter()
                b.loadEntries(for: [GKLocalPlayer.local], timeScope: .allTime) { local, _, _ in
                    if let score = local?.score {
                        out[b.baseLeaderboardID == Self.ratingBoard ? "rating" : "wins"] = score
                    }
                    group.leave()
                }
            }
            group.notify(queue: .main) { if out.count > 1 { self.emit(out) } }
        }
    }

    // MARK: - Служебное

    private func emit(_ ev: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: ev),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.CMOnline && CMOnline._event(\(json))")
        }
    }

    private func topController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController ?? scene?.windows.first?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }
}

extension GameCenterBridge: GKMatchmakerViewControllerDelegate {
    func matchmakerViewControllerWasCancelled(_ vc: GKMatchmakerViewController) {
        vc.dismiss(animated: true)
        emit(["type": "cancelled"])
    }

    func matchmakerViewController(_ vc: GKMatchmakerViewController, didFailWithError error: Error) {
        vc.dismiss(animated: true)
        emit(["type": "error", "text": error.localizedDescription])
    }

    func matchmakerViewController(_ vc: GKMatchmakerViewController, didFind match: GKMatch) {
        vc.dismiss(animated: true)
        start(match)
    }
}

extension GameCenterBridge: GKMatchDelegate {
    func match(_ match: GKMatch, didReceive data: Data, fromRemotePlayer player: GKPlayer) {
        guard let s = String(data: data, encoding: .utf8) else { return }
        emit(["type": "data", "msg": s])
    }

    func match(_ match: GKMatch, player: GKPlayer, didChange state: GKPlayerConnectionState) {
        switch state {
        case .connected:
            announceIfReady(match)
        case .disconnected:
            if self.match === match { emit(["type": "left"]) }
        default: break
        }
    }

    func match(_ match: GKMatch, didFailWithError error: Error?) {
        if self.match === match { emit(["type": "left"]) }
    }
}

/// Приглашение от друга (из уведомления или Сообщений) открывает окно подбора с этим приглашением.
extension GameCenterBridge: GKLocalPlayerListener {
    func player(_ player: GKPlayer, didAccept invite: GKInvite) {
        guard let vc = GKMatchmakerViewController(invite: invite) else { return }
        present(vc)
    }
}

extension GameCenterBridge: GKGameCenterControllerDelegate {
    func gameCenterViewControllerDidFinish(_ vc: GKGameCenterViewController) {
        vc.dismiss(animated: true)
    }
}
