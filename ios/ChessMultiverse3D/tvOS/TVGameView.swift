import SwiftUI

/// Игровой экран Apple TV по образцу веб-игры: карточки игроков, статус, панель кнопок, срубленные фигуры.
///
/// Siri Remote:
///  • свайп по тачпаду — курсор по доске (в режиме «Камера» — вращение и наклон);
///  • нажатие — выбрать фигуру / сделать ход (в режиме «Камера» — сбросить ракурс);
///  • свайп вниз с нижней линии доски — на панель кнопок, вверх — обратно на доску;
///  • Play/Pause — переключить режим «Ход» ↔ «Камера»;  Menu — меню партии.
struct TVGameView: View {
    @ObservedObject var vm: ChessGameViewModel
    @ObservedObject var online: TVOnline
    @State private var camera = CameraController()
    @State private var cursor = Square(index0x88: 6 * 16 + 4)   // e2
    @State private var showMenu = false
    @State private var camMode = false
    @FocusState private var focus: Field?

    enum Field: Hashable { case board, bar(Int), overlay(Int) }

    private var palette: TVStyle.Palette { TVStyle.palette(vm.theme) }
    private var overlayShown: Bool { showMenu || vm.gameOver != nil || vm.pendingPromotion != nil }
    private var isOnline: Bool { vm.mode == .online }

    var body: some View {
        ZStack {
            Image(uiImage: TVStyle.backdrop(vm.theme)).resizable().ignoresSafeArea()
            // Доска помещается между шапкой и панелью кнопок
            ChessSceneView(viewModel: vm, camera: camera, cursor: overlayShown ? nil : cursor, transparentBackground: true)
                .padding(.top, 120).padding(.bottom, 180)

            hud

            // Поверхность доски: принимает свайпы и нажатие пульта, пока нет окна поверх
            Button(action: pressSquare) { Color.clear }
                .buttonStyle(TVBoardButtonStyle())
                .focused($focus, equals: .board)
                .disabled(overlayShown)
                .onMoveCommand { if !overlayShown { move($0) } }
                .onPlayPauseCommand { if !overlayShown { camMode.toggle() } }

            if vm.pendingPromotion != nil { promotionOverlay }
            else if let over = vm.gameOver { resultOverlay(over) }
            else if showMenu { pauseOverlay }
        }
        .onExitCommand {
            // Menu на пульте: открыть меню партии / закрыть его; поверх итога и выбора фигуры — ничего (не выходить из игры)
            if showMenu { showMenu = false } else if vm.gameOver == nil && vm.pendingPromotion == nil { showMenu = true }
        }
        .onAppear { focus = .board }
        .onChange(of: overlayShown) { shown in
            // Окно поверх доски забирает фокус себе; иначе свайпы продолжали бы двигать курсор
            DispatchQueue.main.async { focus = shown ? .overlay(0) : .board }
        }
    }

    // MARK: HUD

    private var hud: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                playerCard(color: vm.orientation.other, align: .leading)
                Spacer()
                VStack(spacing: 8) {
                    Text(vm.statusText)
                        .font(.system(size: 30, weight: .bold))
                        .padding(.horizontal, 30).padding(.vertical, 12)
                        .background(Capsule().fill(palette.panel))
                        .overlay(Capsule().stroke(Color.white.opacity(0.15), lineWidth: 1.5))
                    if let c = vm.clockSeconds {
                        Text("\(c / 60):\(String(format: "%02d", c % 60))")
                            .font(.system(size: 40, weight: .heavy).monospacedDigit())
                            .foregroundStyle(c <= 10 ? Color.red : .white)
                    }
                }
                Spacer()
                playerCard(color: vm.orientation, align: .trailing)
            }
            .padding(.horizontal, 70).padding(.top, 40)

            Spacer()

            capturedStrip
                .padding(.bottom, 14)

            bar
                .padding(.bottom, 36)
        }
    }

    private func playerCard(color: PieceColor, align: HorizontalAlignment) -> some View {
        let turn = vm.turn == color && vm.gameOver == nil
        return VStack(alignment: align, spacing: 4) {
            Text(vm.nameFor(color)).font(.system(size: 30, weight: .bold)).lineLimit(1)
            if let side = vm.spec.sideName[color], side != vm.nameFor(color) {
                Text(side).font(.system(size: 22)).foregroundStyle(.white.opacity(0.65))
            }
        }
        .padding(.horizontal, 24).padding(.vertical, 14)
        .frame(minWidth: 300, alignment: align == .leading ? .leading : .trailing)
        .background(RoundedRectangle(cornerRadius: 20).fill(palette.panel))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(turn ? palette.accent : Color.white.opacity(0.15), lineWidth: turn ? 4 : 1.5))
        .shadow(color: turn ? palette.accent.opacity(0.6) : .clear, radius: 14)
    }

    // MARK: Срубленные фигуры

    private var capturedStrip: some View {
        let (byWhite, byBlack) = captured()
        return HStack(spacing: 24) {
            Text("Срубленные:").font(.system(size: 22)).foregroundStyle(.white.opacity(0.6))
            if byWhite.isEmpty && byBlack.isEmpty {
                Text("пока нет").font(.system(size: 22)).foregroundStyle(.white.opacity(0.45))
            } else {
                Text(byWhite).font(.system(size: 34))   // фигуры чёрных, которых срубили белые
                Text(byBlack).font(.system(size: 34))
            }
        }
        .padding(.horizontal, 28).padding(.vertical, 8)
        .background(Capsule().fill(palette.panel))
    }

    /// Строки глифов: чёрные фигуры, снятые с доски; белые, снятые с доски.
    private func captured() -> (String, String) {
        let initial: [PieceKind: Int] = [.queen: 1, .rook: 2, .bishop: 2, .knight: 2, .pawn: 8]
        var present: [String: Int] = [:]
        for row in vm.board { for p in row { if let p { present["\(p.color.letter)\(p.kind.rawValue)", default: 0] += 1 } } }
        let glyphW: [PieceKind: String] = [.queen: "♕", .rook: "♖", .bishop: "♗", .knight: "♘", .pawn: "♙"]
        let glyphB: [PieceKind: String] = [.queen: "♛", .rook: "♜", .bishop: "♝", .knight: "♞", .pawn: "♟\u{FE0E}"]
        func line(_ color: PieceColor, _ glyphs: [PieceKind: String]) -> String {
            [PieceKind.queen, .rook, .bishop, .knight, .pawn].map { k in
                let lost = max(0, (initial[k] ?? 0) - (present["\(color.letter)\(k.rawValue)"] ?? 0))
                return String(repeating: glyphs[k] ?? "", count: lost)
            }.joined()
        }
        return (line(.black, glyphB), line(.white, glyphW))
    }

    // MARK: Панель кнопок

    private struct BarItem { let title: String; let active: Bool; let action: () -> Void }

    private var barItems: [BarItem] {
        var items: [BarItem] = []
        items.append(BarItem(title: "⌂ Меню", active: false, action: { showMenu = true }))
        items.append(BarItem(title: "🎥 Ракурс", active: false, action: { vm.cycleCamera() }))
        items.append(BarItem(title: camMode ? "⟲ Камера: вкл" : "⟲ Камера", active: camMode, action: { camMode.toggle() }))
        items.append(BarItem(title: vm.settings.cinematic ? "🎬 Кино: вкл" : "🎬 Кино: выкл", active: vm.settings.cinematic,
                             action: { vm.settings.cinematic.toggle() }))
        items.append(BarItem(title: "⇅ Развернуть", active: false, action: { vm.flipBoard() }))
        if vm.canUndo() && !isOnline { items.append(BarItem(title: "↶ Отменить", active: false, action: { vm.undo() })) }
        if !isOnline { items.append(BarItem(title: "↻ Заново", active: false, action: { vm.newGame() })) }
        items.append(BarItem(title: "⚑ Сдаться", active: false, action: { vm.resign() }))
        return items
    }

    private var bar: some View {
        let items = barItems
        return VStack(spacing: 10) {
            if camMode {
                Text("Камера: свайп — вращение и наклон, нажатие — сброс ракурса, Play/Pause — вернуться к ходам")
                    .font(.system(size: 22)).foregroundStyle(palette.accent)
            }
            HStack(spacing: 18) {
                ForEach(0..<items.count, id: \.self) { i in
                    Button(items[i].title) { items[i].action() }
                        .buttonStyle(TVChipStyle(palette: palette, active: items[i].active))
                        .focused($focus, equals: .bar(i))
                        .disabled(overlayShown)
                }
            }
            .font(.system(size: 26, weight: .semibold))
            .focusSection()
            .onMoveCommand { if $0 == .up { focus = .board } }
        }
    }

    // MARK: Управление

    private func move(_ d: MoveCommandDirection) {
        if camMode {
            switch d {
            case .left: camera.rotate(-0.2)
            case .right: camera.rotate(0.2)
            case .up: camera.tilt(0.1)
            case .down: camera.tilt(-0.1)
            @unknown default: break
            }
            return
        }
        // «Вверх» на экране — к дальней стороне доски; при развороте (чёрные снизу) оси меняются местами
        let flip = vm.orientation == .black
        var row = cursor.row, file = cursor.file
        switch d {
        case .up: row += flip ? 1 : -1
        case .down: row += flip ? -1 : 1
        case .left: file += flip ? 1 : -1
        case .right: file += flip ? -1 : 1
        @unknown default: break
        }
        // Вниз с ближней линии доски — на панель кнопок
        if d == .down, row < 0 || row > 7 { focus = .bar(0); return }
        cursor = Square(index0x88: min(7, max(0, row)) * 16 + min(7, max(0, file)))
    }

    private func pressSquare() {
        if camMode { camera.reset(to: vm.settings.cameraPreset); return }
        guard vm.canInteract() else { return }
        if let selected = vm.selected, vm.legalTargets.contains(cursor) {
            vm.attemptMove(from: selected, to: cursor)
        } else {
            vm.select(cursor)
        }
    }

    private func toMenu() {
        if vm.mode == .online { online.leave() }
        vm.backToMenu()
    }

    // MARK: Окна поверх доски

    private var pauseOverlay: some View {
        TVOverlay(title: "Партия", palette: palette) {
            Button("Продолжить") { showMenu = false }
                .focused($focus, equals: .overlay(0))
            if !isOnline { Button("Новая партия") { showMenu = false; vm.newGame() }.focused($focus, equals: .overlay(1)) }
            Button("Ракурс камеры") { vm.cycleCamera() }.focused($focus, equals: .overlay(2))
            Button(vm.settings.cinematic ? "Кинорежим: вкл" : "Кинорежим: выкл") { vm.settings.cinematic.toggle() }
                .focused($focus, equals: .overlay(3))
            Button("Развернуть доску") { showMenu = false; vm.flipBoard() }.focused($focus, equals: .overlay(4))
            Button("Сдаться") { showMenu = false; vm.resign() }.focused($focus, equals: .overlay(5))
            Button("В главное меню") { showMenu = false; toMenu() }.focused($focus, equals: .overlay(6))
        }
    }

    private func resultOverlay(_ info: GameOverInfo) -> some View {
        TVOverlay(title: vm.statusText, palette: palette) {
            if isOnline {
                if online.canRematch { Button("Реванш") { online.requestRematch() }.focused($focus, equals: .overlay(0)) }
                if let h = online.rematchHint { Text(h).font(.callout).foregroundStyle(.secondary) }
            } else {
                Button("Ещё партию") { vm.newGame() }.focused($focus, equals: .overlay(0))
            }
            Button("В меню") { toMenu() }.focused($focus, equals: .overlay(1))
        }
    }

    private var promotionOverlay: some View {
        TVOverlay(title: "Во что превратить пешку?", palette: palette) {
            Button("Ферзь") { vm.resolvePromotion(.queen) }.focused($focus, equals: .overlay(0))
            Button("Ладья") { vm.resolvePromotion(.rook) }.focused($focus, equals: .overlay(1))
            Button("Слон") { vm.resolvePromotion(.bishop) }.focused($focus, equals: .overlay(2))
            Button("Конь") { vm.resolvePromotion(.knight) }.focused($focus, equals: .overlay(3))
        }
    }
}

/// Поверхность доски не должна рисовать стандартную рамку фокуса tvOS поверх сцены.
struct TVBoardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.contentShape(Rectangle())
    }
}

struct TVOverlay<Content: View>: View {
    let title: String
    var palette: TVStyle.Palette = TVStyle.palette(nil)
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
            VStack(spacing: 24) {
                Text(title).font(.system(size: 44, weight: .heavy)).multilineTextAlignment(.center)
                content.buttonStyle(TVChipStyle(palette: palette))
            }
            .font(.system(size: 32, weight: .semibold))
            .padding(50)
            .frame(maxWidth: 900)
            .background(RoundedRectangle(cornerRadius: 30).fill(palette.panel))
            .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.white.opacity(0.18), lineWidth: 2))
            .focusSection()
        }
    }
}
