import SwiftUI

/// Корневой экран: переключает меню / настройку партии / игру по `vm.screen`.
struct TVRootView: View {
    @ObservedObject var vm: ChessGameViewModel
    @StateObject private var online = TVOnline()

    var body: some View {
        ZStack {
            Color(red: 0.07, green: 0.06, blue: 0.14).ignoresSafeArea()
            switch vm.screen {
            case .menu:
                if online.lobbyVisible { TVOnlineView(online: online) }
                else { TVMenuView(vm: vm, online: online) }
            case .pveSetup: TVPveSetupView(vm: vm)
            case .pvpSetup: TVPvpSetupView(vm: vm)
            case .game: TVGameView(vm: vm, online: online)
            }
        }
        .onAppear {
            online.attach(vm)
            #if DEBUG
            // Проверка без пульта: -autoOnline find|room
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-autoOnline"), i + 1 < args.count {
                online.lobbyVisible = true
                if args[i + 1] == "room" { online.createRoom() } else { online.quickFind() }
            }
            // Кадры для App Store: -autoGame classic|cars|hospital|hockey [-autoMoves "e2e4 e7e5 ..."]
            if let i = args.firstIndex(of: "-autoGame"), i + 1 < args.count {
                if let key = ThemeKey(rawValue: args[i + 1]) { vm.theme = key }
                vm.startGame(mode: .pvp)
                if let j = args.firstIndex(of: "-autoMoves"), j + 1 < args.count {
                    let moves = args[j + 1].split(separator: " ").map(String.init)
                    Task { @MainActor in
                        for m in moves where m.count >= 4 {
                            try? await Task.sleep(nanoseconds: 2_500_000_000)
                            if let f = Square(name: String(m.prefix(2))), let t = Square(name: String(m.dropFirst(2).prefix(2))) {
                                vm.attemptMove(from: f, to: t)
                            }
                        }
                    }
                }
            }
            #endif
        }
    }
}

/// Главное меню: вселенная и режим. Фокус двигается пультом, нажатие — выбор.
struct TVMenuView: View {
    @ObservedObject var vm: ChessGameViewModel
    @ObservedObject var online: TVOnline

    var body: some View {
        VStack(spacing: 48) {
            Text("♟ Шахматы: Мультивселенная")
                .font(.system(size: 64, weight: .bold))
            Text("Выбери вселенную")
                .font(.title3).foregroundStyle(.secondary)
            HStack(spacing: 32) {
                ForEach(ThemeKey.allCases) { key in
                    let spec = ThemeLibrary.spec(for: key)
                    Button { vm.chooseTheme(key) } label: {
                        VStack(spacing: 10) {
                            Text(spec.name).font(.headline)
                            Text(spec.tagline).font(.caption).foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                            if vm.theme == key { Text("✓").font(.title2).foregroundStyle(.green) }
                        }
                        .frame(width: 330, height: 190)
                    }
                }
            }
            HStack(spacing: 40) {
                Button("Против компьютера") { vm.screen = .pveSetup }
                Button("Вдвоём") { vm.screen = .pvpSetup }
                Button("По сети") { online.error = nil; online.lobbyVisible = true }
            }
            .font(.title2)
        }
        .padding(80)
    }
}

struct TVPveSetupView: View {
    @ObservedObject var vm: ChessGameViewModel

    var body: some View {
        VStack(spacing: 36) {
            Text("Игра с компьютером").font(.system(size: 52, weight: .bold))
            HStack(spacing: 24) {
                colorButton("Белые", .white)
                colorButton("Чёрные", .black)
                colorButton("Случайно", .random)
            }
            Text("Сложность").font(.title3).foregroundStyle(.secondary)
            HStack(spacing: 24) {
                ForEach(Difficulty.allCases) { d in
                    Button(d.title) { vm.startGame(mode: .pve, difficulty: d) }
                }
            }
            Button("Назад") { vm.screen = .menu }
        }
        .font(.title2)
        .padding(80)
    }

    private func colorButton(_ title: String, _ choice: ColorChoice) -> some View {
        Button((vm.colorChoice == choice ? "✓ " : "") + title) { vm.colorChoice = choice }
    }
}

/// Партия вдвоём на одном экране: игроки по очереди двигают курсор и нажимают на пульте.
struct TVPvpSetupView: View {
    @ObservedObject var vm: ChessGameViewModel

    var body: some View {
        VStack(spacing: 36) {
            Text("Вдвоём").font(.system(size: 52, weight: .bold))
            Text("Игроки ходят по очереди одним пультом").foregroundStyle(.secondary)
            HStack(spacing: 24) {
                Button("Начать партию") { vm.startGame(mode: .pvp) }
                Button("Назад") { vm.screen = .menu }
            }
        }
        .font(.title2)
        .padding(80)
    }
}
