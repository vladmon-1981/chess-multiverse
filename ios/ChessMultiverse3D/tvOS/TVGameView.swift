import SwiftUI

/// Игровой экран Apple TV. Управление Siri Remote:
///  • свайп по тачпаду — двигает курсор по доске;
///  • нажатие на тачпад — выбрать фигуру / сделать ход;
///  • Play/Pause или Menu — открыть меню партии.
struct TVGameView: View {
    @ObservedObject var vm: ChessGameViewModel
    @State private var camera = CameraController()
    @State private var cursor = Square(index0x88: 6 * 16 + 4)   // e2
    @State private var showMenu = false
    @FocusState private var boardFocused: Bool

    private var overlayShown: Bool { showMenu || vm.gameOver != nil || vm.pendingPromotion != nil }

    var body: some View {
        ZStack {
            ChessSceneView(viewModel: vm, camera: camera, cursor: boardFocused || !overlayShown ? cursor : nil)
                .ignoresSafeArea()

            VStack {
                HStack {
                    Text(vm.statusText)
                        .font(.title3.weight(.semibold))
                        .padding(.horizontal, 24).padding(.vertical, 12)
                        .background(.ultraThinMaterial, in: Capsule())
                    Spacer()
                    Text("Курсор: \(cursor.name)").font(.callout).foregroundStyle(.secondary)
                }
                .padding(.horizontal, 60).padding(.top, 40)
                Spacer()
                Text("Свайп — курсор · нажатие — выбрать/ходить · Play/Pause — меню")
                    .font(.footnote).foregroundStyle(.secondary).padding(.bottom, 30)
            }

            // Фокусируемая поверхность: принимает свайпы и нажатие пульта
            Button(action: pressSquare) { Color.clear }
                .buttonStyle(TVBoardButtonStyle())
                .focused($boardFocused)
                .disabled(overlayShown)
                .onMoveCommand(perform: move)
                .onPlayPauseCommand { showMenu = true }
                .onExitCommand { showMenu = true }

            if vm.pendingPromotion != nil { promotionOverlay }
            else if let over = vm.gameOver { resultOverlay(over) }
            else if showMenu { pauseOverlay }
        }
        .onAppear { boardFocused = true }
        .onChange(of: overlayShown) { shown in if !shown { boardFocused = true } }
    }

    // MARK: Управление

    private func move(_ d: MoveCommandDirection) {
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
        cursor = Square(index0x88: min(7, max(0, row)) * 16 + min(7, max(0, file)))
    }

    private func pressSquare() {
        guard vm.canInteract() else { return }
        if let selected = vm.selected, vm.legalTargets.contains(cursor) {
            vm.attemptMove(from: selected, to: cursor)
        } else {
            vm.select(cursor)
        }
    }

    // MARK: Оверлеи

    private var pauseOverlay: some View {
        TVOverlay(title: "Партия") {
            Button("Продолжить") { showMenu = false }
            Button("Новая партия") { showMenu = false; vm.newGame() }
            if vm.canUndo() { Button("Отменить ход") { showMenu = false; vm.undo() } }
            Button("Развернуть доску") { showMenu = false; vm.flipBoard() }
            Button("Сдаться") { showMenu = false; vm.resign() }
            Button("В меню") { showMenu = false; vm.backToMenu() }
        }
        .onExitCommand { showMenu = false }
    }

    private func resultOverlay(_ info: GameOverInfo) -> some View {
        TVOverlay(title: vm.statusText) {
            Button("Ещё партию") { vm.newGame() }
            Button("В меню") { vm.backToMenu() }
        }
    }

    private var promotionOverlay: some View {
        TVOverlay(title: "Во что превратить пешку?") {
            Button("Ферзь") { vm.resolvePromotion(.queen) }
            Button("Ладья") { vm.resolvePromotion(.rook) }
            Button("Слон") { vm.resolvePromotion(.bishop) }
            Button("Конь") { vm.resolvePromotion(.knight) }
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
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            Color.black.opacity(0.65).ignoresSafeArea()
            VStack(spacing: 28) {
                Text(title).font(.system(size: 44, weight: .bold)).multilineTextAlignment(.center)
                content
            }
            .font(.title2)
            .padding(60)
            .frame(maxWidth: 900)
        }
    }
}
