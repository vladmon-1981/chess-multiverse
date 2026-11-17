import Foundation
import SwiftUI

/// Сетевая игра на Apple TV: клиент ретранслятора (server/relay.py, wss://cdn-se.birdhot.ru/chessgm-ws)
/// и рукопожатие `hello` — тот же протокол, что в js/online.js + js/chess-app.js, поэтому
/// телевизор играет с iPhone/iPad. Цвет решает жребий: у кого nonce больше — белые.
@MainActor
final class TVOnline: ObservableObject {
    enum Phase: Equatable {
        case idle                 // лобби: выбор способа
        case connecting
        case searching            // быстрый подбор
        case room(String)         // ждём друга по коду
        case joining              // вошли по коду, ждём ответ
        case playing
    }

    static let url = URL(string: "wss://cdn-se.birdhot.ru/chessgm-ws")!

    @Published var phase: Phase = .idle
    @Published var error: String?
    @Published var lobbyVisible = false
    @Published var rematchHint: String?
    @Published var moveTime = 60
    @Published var codeInput = ""

    private weak var vm: ChessGameViewModel?
    private var task: URLSessionWebSocketTask?
    private var session = URLSession(configuration: .default)
    private var pingTask: Task<Void, Never>?
    private var generation = 0          // отсекает события закрытого соединения
    private var pending: [String: Any]? // первое сообщение после открытия (find/room/join)

    // Партия
    private var myName: String { Self.deviceName }
    private var nonce = 0
    private var hello: [String: Any]?
    private var oppName = "Соперник"
    private var color: PieceColor = .white
    private var round = 0
    private var tc = 60
    private var gone = false
    private var rematchMe = false
    private var rematchThem = false
    private var earlyHello: [String: Any]?

    static var deviceName: String {
        let n = UIDevice.current.name.trimmingCharacters(in: .whitespaces)
        return String((n.isEmpty ? "Apple TV" : n).prefix(24))
    }

    private static var cid: String {
        let key = "chess-cid"
        if let v = UserDefaults.standard.string(forKey: key), !v.isEmpty { return v }
        let v = UUID().uuidString
        UserDefaults.standard.set(v, forKey: key)
        return v
    }

    func attach(_ vm: ChessGameViewModel) {
        self.vm = vm
        vm.netSend = { [weak self] msg in self?.send(["t": "data", "msg": msg]) }
    }

    // MARK: Действия лобби

    func quickFind() {
        connect(first: ["t": "find", "group": moveTime, "name": myName, "id": Self.cid], phase: .searching)
    }

    func createRoom() {
        connect(first: ["t": "room", "name": myName, "id": Self.cid], phase: .connecting)
    }

    func joinRoom() {
        let code = codeInput.uppercased().filter { !$0.isWhitespace }
        guard code.count == 4 else { error = "Код — 4 символа"; return }
        connect(first: ["t": "join", "code": code, "name": myName, "id": Self.cid], phase: .joining)
    }

    /// Отмена поиска или выход из лобби/партии.
    func cancel() {
        send(["t": "cancel"])
        close()
        phase = .idle
    }

    /// Выход из партии (в меню).
    func leave() {
        send(["t": "leave"])
        close()
        phase = .idle
        gone = true
    }

    func requestRematch() {
        guard phase == .playing, !gone else { return }
        rematchMe = true
        send(["t": "data", "msg": ["t": "rematch", "r": round]])
        if rematchThem { startRematch() } else { rematchHint = "Ждём ответа соперника…" }
    }

    var canRematch: Bool { phase == .playing && !gone }

    // MARK: Соединение

    private func connect(first: [String: Any], phase newPhase: Phase) {
        close()
        error = nil
        phase = newPhase == .searching || newPhase == .joining ? .connecting : newPhase
        let wanted = newPhase
        generation += 1
        let gen = generation
        let t = session.webSocketTask(with: Self.url)
        task = t
        t.resume()
        pending = first
        // таймаут открытия: если за 9 с ничего не пришло — ошибка
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 9_000_000_000)
            guard let self, self.generation == gen, self.phase == .connecting else { return }
            self.fail("Нет связи с сервером игры")
        }
        // первое сообщение шлём сразу (URLSession ставит в очередь до открытия)
        send(first)
        if wanted == .searching { phase = .searching }
        else if wanted == .joining { phase = .joining }
        receiveLoop(t, gen)
        startPing(gen)
    }

    private func close() {
        generation += 1
        pingTask?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func startPing(_ gen: Int) {
        pingTask?.cancel()
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 25_000_000_000)
                guard let self, self.generation == gen else { return }
                self.task?.sendPing { _ in }
            }
        }
    }

    private func fail(_ text: String) {
        close()
        phase = .idle
        error = text
        if let vm, vm.screen == .game, vm.mode == .online, vm.gameOver == nil {
            gone = true
            vm.endOnline(winner: vm.humanColor, kind: .left, text: "Связь потеряна")
        }
    }

    private func send(_ obj: [String: Any]) {
        guard let task, let data = try? JSONSerialization.data(withJSONObject: obj),
              let s = String(data: data, encoding: .utf8) else { return }
        task.send(.string(s)) { _ in }
    }

    private func receiveLoop(_ t: URLSessionWebSocketTask, _ gen: Int) {
        t.receive { [weak self] result in
            Task { @MainActor in
                guard let self, self.generation == gen else { return }
                switch result {
                case .failure:
                    if self.phase != .idle { self.fail("Соединение прервано") }
                case .success(let msg):
                    if case .string(let s) = msg,
                       let d = s.data(using: .utf8),
                       let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                        self.onServer(obj)
                    }
                    self.receiveLoop(t, gen)
                }
            }
        }
    }

    // MARK: События сервера

    private func onServer(_ m: [String: Any]) {
        switch m["t"] as? String {
        case "room":
            if let code = m["code"] as? String { phase = .room(code) }
        case "match":
            onMatch(opponent: m["opponent"] as? String)
        case "data":
            if let msg = m["msg"] as? [String: Any] { onData(msg) }
        case "left":
            onLeft()
        case "cancelled":
            phase = .idle
        case "error":
            let text = (m["text"] as? String) ?? ""
            fail(text == "no room" ? "Такой комнаты нет" : (text.isEmpty ? "Ошибка сервера" : text))
        default: break
        }
    }

    private func onMatch(opponent: String?) {
        oppName = String((opponent ?? "Соперник").prefix(24))
        nonce = Int.random(in: 0..<(1 << 31))
        hello = nil
        round = 0
        gone = false
        rematchMe = false
        rematchThem = false
        rematchHint = nil
        phase = .playing
        sendHello()
        if let early = earlyHello { earlyHello = nil; onData(early) }
    }

    private func sendHello() {
        send(["t": "data", "msg": ["t": "hello", "v": 1, "nonce": nonce, "tc": moveTime,
                                   "name": myName, "rating": 1200]])
    }

    private func onData(_ m: [String: Any]) {
        guard phase == .playing else {
            if m["t"] as? String == "hello" { earlyHello = m }
            return
        }
        guard let vm else { return }
        switch m["t"] as? String {
        case "hello":
            if hello != nil {
                if m["re"] != nil { sendHello() }
                return
            }
            guard let theirNonce = (m["nonce"] as? NSNumber)?.intValue else { return }
            if theirNonce == nonce {   // ничья в жребии — перебросить
                nonce = Int.random(in: 0..<(1 << 31))
                sendHello()
                return
            }
            hello = m
            if let n = m["name"] as? String, !n.isEmpty { oppName = String(n.prefix(24)) }
            color = nonce > theirNonce ? .white : .black
            // лимит времени берётся у белых
            let theirTc = (m["tc"] as? NSNumber)?.intValue ?? 60
            tc = color == .white ? moveTime : ([30, 60, 120, 300].contains(theirTc) ? theirTc : 60)
            lobbyVisible = false
            vm.startOnlineGame(myColor: color, myName: myName, oppName: oppName, moveTime: tc, round: round)
        default:
            guard vm.mode == .online else { return }
            if let r = (m["r"] as? NSNumber)?.intValue, r != round { return }
            switch m["t"] as? String {
            case "move":
                vm.receiveMove(from: m["from"] as? String ?? "", to: m["to"] as? String ?? "",
                               promotion: m["promotion"] as? String,
                               ply: (m["ply"] as? NSNumber)?.intValue ?? -1)
            case "resign":
                vm.endOnline(winner: vm.humanColor, kind: .resign, text: "Сдача")
            case "timeout":
                vm.endOnline(winner: vm.humanColor, kind: .timeout, text: "У соперника вышло время")
            case "flag":
                vm.endOnline(winner: vm.humanColor.other, kind: .timeout, text: "Время вышло")
            case "rematch":
                rematchThem = true
                if rematchMe { startRematch() } else { rematchHint = "\(oppName) предлагает реванш" }
            default: break
            }
        }
    }

    private func onLeft() {
        guard phase == .playing, let vm else { return }
        gone = true
        if vm.screen == .game, vm.gameOver == nil {
            vm.endOnline(winner: vm.humanColor, kind: .left, text: "Соперник вышел")
        } else {
            rematchHint = "\(oppName) вышел из игры"
        }
    }

    private func startRematch() {
        guard let vm else { return }
        round += 1
        color = color.other
        rematchMe = false
        rematchThem = false
        rematchHint = nil
        vm.startOnlineGame(myColor: color, myName: myName, oppName: oppName, moveTime: tc, round: round)
    }
}

// MARK: - Экран лобби

struct TVOnlineView: View {
    @ObservedObject var online: TVOnline

    var body: some View {
        VStack(spacing: 36) {
            Text("По сети").font(.system(size: 52, weight: .bold))
            if let e = online.error {
                Text(e).font(.title3).foregroundStyle(.red)
            }
            content
        }
        .font(.title2)
        .padding(80)
    }

    @ViewBuilder private var content: some View {
        switch online.phase {
        case .idle:
            Text("Время на ход").font(.title3).foregroundStyle(.secondary)
            HStack(spacing: 24) {
                ForEach([30, 60, 120, 300], id: \.self) { s in
                    Button((online.moveTime == s ? "✓ " : "") + (s < 60 ? "\(s) с" : "\(s / 60) мин")) { online.moveTime = s }
                }
            }
            HStack(spacing: 24) {
                Button("Быстрая игра") { online.quickFind() }
                Button("Создать комнату") { online.createRoom() }
            }
            HStack(spacing: 24) {
                TextField("Код друга", text: $online.codeInput)
                    .frame(width: 360)
                    .textInputAutocapitalization(.characters)
                Button("Войти по коду") { online.joinRoom() }
            }
            Button("Назад") { online.lobbyVisible = false }
        case .connecting:
            ProgressView("Подключаемся…")
            Button("Отмена") { online.cancel() }
        case .searching:
            ProgressView("Ищем соперника (\(online.moveTime < 60 ? "\(online.moveTime) с" : "\(online.moveTime / 60) мин") на ход)…")
            Button("Отмена") { online.cancel() }
        case .room(let code):
            Text("Код комнаты").font(.title3).foregroundStyle(.secondary)
            Text(code).font(.system(size: 120, weight: .heavy, design: .monospaced))
            Text("Назови код другу — пусть войдёт с телефона или другого Apple TV").foregroundStyle(.secondary)
            Button("Отмена") { online.cancel() }
        case .joining:
            ProgressView("Входим в комнату…")
            Button("Отмена") { online.cancel() }
        case .playing:
            ProgressView("Соперник найден, начинаем…")
        }
    }
}
