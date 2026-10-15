import SwiftUI

/// Игровой экран: доска, история ходов, статус-бар, кнопки — аналог gameScreen.
struct GameView: View {
    @ObservedObject var vm: ChessGameViewModel
    @State private var showSettings = false
    @State private var showConfirmNewGame = false
    @State private var camera = CameraController()

    var body: some View {
        VStack(spacing: 0) {
            topBar
            statusBar
            ZStack {
                ChessSceneView(viewModel: vm, camera: camera)
                if vm.thinking {
                    VStack {
                        Spacer()
                        Text(vm.spec.texts.thinking + "…")
                            .padding(8)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                            .padding(.bottom, 8)
                    }
                }
            }
            .frame(maxHeight: .infinity)
            cameraBar
            moveHistoryBar
            controlBar
        }
        .sheet(isPresented: $showSettings) { SettingsSheet(vm: vm) }
        .sheet(item: Binding(get: { vm.pendingPromotion.map { PromotionRequest(from: $0.from, to: $0.to) } },
                              set: { _ in })) { req in
            PromotionSheet(vm: vm, color: vm.turn)
        }
        .sheet(item: Binding(get: { vm.gameOver.map { ResultRequest(info: $0) } }, set: { _ in })) { req in
            ResultView(vm: vm, info: req.info)
        }
        .alert("Начать новую партию? Текущая будет потеряна.", isPresented: $showConfirmNewGame) {
            Button("Начать заново", role: .destructive) { vm.newGame() }
            Button("Отмена", role: .cancel) {}
        }
    }

    private var topBar: some View {
        HStack {
            Button { vm.backToMenu() } label: { Image(systemName: "house.fill") }
            Spacer()
            Text(vm.spec.name).font(.headline)
            Spacer()
            Button { showSettings = true } label: { Image(systemName: "gearshape.fill") }
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private var statusBar: some View {
        VStack(spacing: 2) {
            Text(vm.statusText).font(.subheadline.bold())
            HStack {
                Text(vm.nameFor(.white)).font(.caption).opacity(vm.turn == .white ? 1 : 0.5)
                Text("vs").font(.caption2).foregroundStyle(.secondary)
                Text(vm.nameFor(.black)).font(.caption).opacity(vm.turn == .black ? 1 : 0.5)
            }
        }
        .padding(.vertical, 6)
    }

    private var moveHistoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(vm.moveHistory) { rec in
                    HStack(spacing: 4) {
                        Text("\(rec.number).").foregroundStyle(.secondary)
                        Text(rec.whiteSAN ?? "")
                        if let b = rec.blackSAN { Text(b) }
                    }
                    .font(.caption)
                }
            }
            .padding(.horizontal)
        }
        .frame(height: 28)
    }

    /// Панель управления камерой под доской (не перекрывает саму доску).
    /// Подписи под иконками — чтобы было понятно без догадок; на iPad тот же ряд.
    private var cameraBar: some View {
        HStack(spacing: 4) {
            cameraButton("arrow.counterclockwise", "Влево") { camera.rotate(-.pi / 4) }
            cameraButton("arrow.clockwise", "Вправо") { camera.rotate(.pi / 4) }
            cameraButton("arrow.up", "Выше") { camera.tilt(.pi / 36) }
            cameraButton("arrow.down", "Ниже") { camera.tilt(-.pi / 36) }
            cameraButton("plus.magnifyingglass", "Ближе") { camera.zoom(0.8) }
            cameraButton("minus.magnifyingglass", "Дальше") { camera.zoom(1.25) }
            cameraButton("scope", "Сброс") { camera.reset(to: vm.settings.cameraPreset) }
            cameraButton("arrow.triangle.2.circlepath", "Сторона") { vm.flipBoard() }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }

    private func cameraButton(_ systemName: String, _ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: systemName)
                    .font(.system(size: 17, weight: .semibold))
                Text(title)
                    .font(.system(size: 10))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.bordered)
        .accessibilityLabel(title)
    }

    private var controlBar: some View {
        HStack(spacing: 18) {
            iconButton("arrow.uturn.backward", disabled: !vm.canUndo()) { vm.undo() }
            iconButton("video.fill") { vm.cycleCamera() }
            iconButton("plus.square") { showConfirmNewGame = true }
            iconButton("flag.fill", disabled: vm.gameOver != nil) { vm.resign() }
        }
        .padding(.vertical, 10)
    }

    private func iconButton(_ systemName: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.title3)
                .frame(width: 40, height: 40)
        }
        .buttonStyle(.bordered)
        .disabled(disabled)
    }
}

struct PromotionRequest: Identifiable { let from: Square; let to: Square; var id: String { from.name + to.name } }
struct ResultRequest: Identifiable { let info: GameOverInfo; var id: String { "\(info.kind)\(info.winner?.rawValue ?? -1)" } }

/// Модалка выбора фигуры при превращении пешки.
struct PromotionSheet: View {
    @ObservedObject var vm: ChessGameViewModel
    let color: PieceColor

    var body: some View {
        VStack(spacing: 16) {
            Text("Выберите фигуру").font(.headline)
            HStack(spacing: 16) {
                ForEach([PieceKind.queen, .rook, .bishop, .knight], id: \.self) { kind in
                    Button {
                        vm.resolvePromotion(kind)
                    } label: {
                        VStack {
                            Text(vm.spec.pieceNames.name(for: color, kind: kind))
                                .font(.caption)
                            Image(systemName: symbol(for: kind)).font(.largeTitle)
                        }
                        .frame(width: 70, height: 70)
                    }
                    .buttonStyle(.bordered)
                }
            }
            Button("Отмена") { vm.resolvePromotion(nil) }
        }
        .padding()
    }

    private func symbol(for kind: PieceKind) -> String {
        switch kind {
        case .queen: return "crown.fill"
        case .rook: return "building.columns.fill"
        case .bishop: return "triangle.fill"
        case .knight: return "horse"
        default: return "circle.fill"
        }
    }
}
