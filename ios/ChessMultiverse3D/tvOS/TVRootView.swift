import SwiftUI
import SceneKit

/// Корневой экран: переключает меню / настройку партии / игру по `vm.screen`.
struct TVRootView: View {
    @ObservedObject var vm: ChessGameViewModel
    @StateObject private var online = TVOnline()

    var body: some View {
        ZStack {
            switch vm.screen {
            case .menu:
                TVMenuBackground()
                if online.lobbyVisible { TVOnlineView(online: online, vm: vm) }
                else { TVMenuView(vm: vm, online: online) }
            case .pveSetup:
                TVMenuBackground()
                TVPveSetupView(vm: vm)
            case .pvpSetup:
                TVMenuBackground()
                TVPvpSetupView(vm: vm)
            case .game: TVGameView(vm: vm, online: online)
            }
        }
        .onAppear {
            online.attach(vm)
            if let engine = vm.announcer as? SoundEngine, let narrator = TVNarrator(sound: engine) {
                vm.narrate = { [narrator] event, theme in narrator.narrate(event, theme: theme) }
            }
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

/// Рисунок на карточке вселенной: ферзи обоих цветов (SceneKit-снимок, как фигуры на карточках веба).
enum TVCardArt {
    private static var cache: [ThemeKey: UIImage] = [:]

    @MainActor static func image(for key: ThemeKey) -> UIImage? {
        if let c = cache[key] { return c }
        guard let device = MTLCreateSystemDefaultDevice() else { return nil }
        let scene = SCNScene()
        let pieces: [(Piece, Float)] = [(Piece(color: .white, kind: .queen), -0.8), (Piece(color: .black, kind: .queen), 0.8)]
        for (piece, x) in pieces {
            let node = PieceFactory.makeNode(piece: piece, theme: key)
            let holder = SCNNode()
            holder.addChildNode(node)
            holder.position = SCNVector3(x, 0, 0)
            holder.eulerAngles.y = key == .classic ? 0 : (piece.color == .white ? 0.5 : -0.5)
            scene.rootNode.addChildNode(holder)
        }
        let amb = SCNNode(); amb.light = SCNLight(); amb.light?.type = .ambient; amb.light?.intensity = 650
        scene.rootNode.addChildNode(amb)
        let sun = SCNNode(); sun.light = SCNLight(); sun.light?.type = .directional; sun.light?.intensity = 1300
        sun.eulerAngles = SCNVector3(-0.8, 0.5, 0)
        scene.rootNode.addChildNode(sun)
        let cam = SCNNode(); cam.camera = SCNCamera(); cam.camera?.fieldOfView = 32
        cam.position = SCNVector3(0, 1.3, 4.3)
        cam.look(at: SCNVector3(0, 0.75, 0))
        scene.rootNode.addChildNode(cam)
        let r = SCNRenderer(device: device, options: nil)
        r.scene = scene
        r.pointOfView = cam
        r.autoenablesDefaultLighting = false
        let img = r.snapshot(atTime: 0, with: CGSize(width: 720, height: 420), antialiasingMode: .multisampling4X)
        cache[key] = img
        return img
    }
}

private func cardTint(_ key: ThemeKey) -> [Color] {
    switch key {
    case .classic: return [Color(hex: 0x6B4326), Color(hex: 0x2A170A)]
    case .cars: return [Color(hex: 0xC2412F), Color(hex: 0x4A1850)]
    case .hospital: return [Color(hex: 0x1C7C74), Color(hex: 0x06303A)]
    case .hockey: return [Color(hex: 0x2563A8), Color(hex: 0x071A38)]
    }
}

struct TVUniverseCard: View {
    let key: ThemeKey
    let selected: Bool
    let image: UIImage?
    let action: () -> Void

    var body: some View {
        Button(action: action) { TVUniverseCardBody(key: key, selected: selected, image: image) }
            .buttonStyle(TVCardButtonStyle(accent: TVStyle.palette(key).accent))
    }
}

private struct TVUniverseCardBody: View {
    let key: ThemeKey
    let selected: Bool
    let image: UIImage?
    var body: some View {
        let spec = ThemeLibrary.spec(for: key)
        let pal = TVStyle.palette(key)
        VStack(spacing: 8) {
            ZStack {
                if let image { Image(uiImage: image).resizable().scaledToFit() }
                else { Color.clear }
            }
            .frame(height: 210)
            Text(spec.name).font(.system(size: 40, weight: .heavy)).foregroundStyle(pal.name)
            Text(spec.tagline).font(.system(size: 22)).foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center).lineLimit(2).padding(.horizontal, 12)
            Text(selected ? "✓ Выбрано" : " ").font(.system(size: 24, weight: .bold)).foregroundStyle(pal.accent)
        }
        .padding(.vertical, 18)
        .frame(width: 400, height: 420)
        .background(RoundedRectangle(cornerRadius: 28).fill(LinearGradient(colors: cardTint(key), startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(selected ? pal.accent : Color.white.opacity(0.15), lineWidth: selected ? 5 : 1.5))
    }
}

struct TVCardButtonStyle: ButtonStyle {
    let accent: Color
    func makeBody(configuration: Configuration) -> some View { TVCardFocus(label: configuration.label, accent: accent) }
}

private struct TVCardFocus<L: View>: View {
    let label: L
    let accent: Color
    @Environment(\.isFocused) private var focused
    var body: some View {
        label
            .scaleEffect(focused ? 1.08 : 1)
            .shadow(color: accent.opacity(focused ? 0.8 : 0), radius: 26)
            .overlay(RoundedRectangle(cornerRadius: 28).stroke(Color.white.opacity(focused ? 0.95 : 0), lineWidth: 6))
            .animation(.easeOut(duration: 0.15), value: focused)
    }
}

/// Главное меню: вселенная и режим, как в вебе.
struct TVMenuView: View {
    @ObservedObject var vm: ChessGameViewModel
    @ObservedObject var online: TVOnline
    @State private var art: [ThemeKey: UIImage] = [:]

    var body: some View {
        let pal = TVStyle.palette(nil)
        VStack(spacing: 22) {
            VStack(spacing: 2) {
                Text("Шахматы").font(.system(size: 120, weight: .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xFDBA74), Color(hex: 0xF472B6), Color(hex: 0xA78BFA)], startPoint: .leading, endPoint: .trailing))
                Text("МУЛЬТИВСЕЛЕННАЯ").font(.system(size: 34, weight: .bold)).tracking(8)
                    .foregroundStyle(Color(hex: 0xC4B5FD))
                Text("Трёхмерные фигуры, четыре вселенные, живой звук").font(.system(size: 26)).foregroundStyle(.white.opacity(0.6))
            }
            Text("Выбери вселенную").font(.system(size: 36, weight: .bold)).padding(.top, 6)
            HStack(spacing: 30) {
                ForEach(ThemeKey.allCases) { key in
                    TVUniverseCard(key: key, selected: vm.theme == key, image: art[key]) { vm.chooseTheme(key) }
                }
            }
            HStack(spacing: 28) {
                Button("🖥 Играть с компьютером") { vm.screen = .pveSetup }
                Button("👥 Играть вдвоём") { vm.screen = .pvpSetup }
                Button("🌐 По сети") { online.error = nil; online.lobbyVisible = true }
            }
            .buttonStyle(TVChipStyle(palette: pal))
            .font(.system(size: 32, weight: .bold))
            .padding(.top, 6)
        }
        .padding(.horizontal, 60)
        .task {
            for key in ThemeKey.allCases where art[key] == nil {
                art[key] = TVCardArt.image(for: key)
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
    }
}

struct TVPveSetupView: View {
    @ObservedObject var vm: ChessGameViewModel

    var body: some View {
        let pal = TVStyle.palette(vm.theme)
        VStack(spacing: 34) {
            Text("Игра с компьютером").font(.system(size: 64, weight: .heavy))
            Text("Твой цвет").font(.system(size: 28)).foregroundStyle(.white.opacity(0.65))
            HStack(spacing: 24) {
                colorButton("⚪ \(vm.spec.sideName[.white] ?? "Белые")", .white, pal)
                colorButton("🎲 Случайно", .random, pal)
                colorButton("⚫ \(vm.spec.sideName[.black] ?? "Чёрные")", .black, pal)
            }
            Text("Сложность — нажми, чтобы начать").font(.system(size: 28)).foregroundStyle(.white.opacity(0.65)).padding(.top, 10)
            HStack(spacing: 30) {
                ForEach(Difficulty.allCases) { d in
                    Button { vm.startGame(mode: .pve, difficulty: d) } label: {
                        VStack(spacing: 10) {
                            Text(d == .easy ? "🌱" : d == .medium ? "🔥" : "🧠").font(.system(size: 64))
                            Text(d.title).font(.system(size: 40, weight: .heavy))
                            Text(d == .easy ? "Для новичков: думает на ход вперёд и иногда зевает фигуры"
                                 : d == .medium ? "Считает на три хода и не отдаёт фигуры даром"
                                 : "Глубокий расчёт вариантов — серьёзный соперник")
                                .font(.system(size: 22)).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.75))
                        }
                        .frame(width: 440, height: 300).padding(.horizontal, 12)
                        .background(RoundedRectangle(cornerRadius: 28).fill(pal.panel))
                        .overlay(RoundedRectangle(cornerRadius: 28).stroke(Color.white.opacity(0.18), lineWidth: 1.5))
                    }
                    .buttonStyle(TVCardButtonStyle(accent: pal.accent))
                }
            }
            Button("← Назад") { vm.screen = .menu }
                .buttonStyle(TVChipStyle(palette: pal)).font(.system(size: 30, weight: .bold))
        }
        .padding(60)
        .onExitCommand { vm.screen = .menu }
    }

    private func colorButton(_ title: String, _ choice: ColorChoice, _ pal: TVStyle.Palette) -> some View {
        Button(title) { vm.colorChoice = choice }
            .buttonStyle(TVChipStyle(palette: pal, active: vm.colorChoice == choice))
            .font(.system(size: 32, weight: .bold))
    }
}

/// Партия вдвоём на одном экране: игроки по очереди двигают курсор и нажимают на пульте.
struct TVPvpSetupView: View {
    @ObservedObject var vm: ChessGameViewModel

    var body: some View {
        let pal = TVStyle.palette(vm.theme)
        VStack(spacing: 40) {
            Text("Играть вдвоём").font(.system(size: 64, weight: .heavy))
            Text("Игроки ходят по очереди одним пультом").font(.system(size: 30)).foregroundStyle(.white.opacity(0.7))
            HStack(spacing: 28) {
                Button("▶ Начать партию") { vm.startGame(mode: .pvp) }
                Button("← Назад") { vm.screen = .menu }
            }
            .buttonStyle(TVChipStyle(palette: pal)).font(.system(size: 34, weight: .bold))
        }
        .padding(60)
        .onExitCommand { vm.screen = .menu }
    }
}
