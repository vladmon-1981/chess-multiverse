import SwiftUI
import SceneKit

/// Обёртка SCNView для SwiftUI — аналог CM.Board3D из оригинала (js/three/board3d.js),
/// но без кинорежима и спецэффектов взятия (заглушки на следующую фазу).
struct ChessSceneView: UIViewRepresentable {
    @ObservedObject var viewModel: ChessGameViewModel

    func makeUIView(context: Context) -> SCNView {
        let scnView = SCNView()
        let scene = ChessScene()
        context.coordinator.scene = scene
        scnView.scene = scene.scnScene
        scnView.backgroundColor = UIColor(white: 0.08, alpha: 1)
        scnView.antialiasingMode = .multisampling4X
        scnView.allowsCameraControl = false
        scnView.rendersContinuously = false

        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        scnView.addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePinch(_:)))
        scnView.addGestureRecognizer(pinch)
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        scnView.addGestureRecognizer(tap)

        scene.setTheme(viewModel.theme)
        scene.setOrientation(viewModel.orientation)
        scene.setPosition(viewModel.board)
        context.coordinator.scnView = scnView
        return scnView
    }

    func updateUIView(_ scnView: SCNView, context: Context) {
        guard let scene = context.coordinator.scene else { return }
        let coordinator = context.coordinator
        var themeChanged = false
        if coordinator.lastTheme != viewModel.theme {
            scene.setTheme(viewModel.theme)
            coordinator.lastTheme = viewModel.theme
            themeChanged = true
        }
        var orientationChanged = false
        if coordinator.lastOrientation != viewModel.orientation {
            scene.setOrientation(viewModel.orientation)
            coordinator.lastOrientation = viewModel.orientation
            orientationChanged = true
        }

        // Полная перестройка нужна при смене темы/ориентации или когда нет свежего
        // одиночного хода, который можно анимировать (новая партия, отмена хода).
        let move = viewModel.lastMove
        let moveChanged = move?.from != coordinator.lastAnimatedMove?.from || move?.to != coordinator.lastAnimatedMove?.to
        if themeChanged || orientationChanged {
            scene.setPosition(viewModel.board)
            coordinator.lastAnimatedMove = move
        } else if let move, moveChanged {
            let animated = scene.animateMove(from: move.from, to: move.to, promoted: false,
                                         cinematic: viewModel.settings.cinematic,
                                         captureFx: viewModel.settings.captureFx) {}
            if !animated { scene.setPosition(viewModel.board) }
            coordinator.lastAnimatedMove = move
        } else if coordinator.firstUpdateDone == false {
            scene.setPosition(viewModel.board)
        } else {
            // Нет нового хода для анимации (undo, новая партия) — проверяем, не разошлась
            // ли фактическая доска с тем, что уже нарисовано, и перестраиваем целиком при расхождении.
            let signature = Self.boardSignature(viewModel.board)
            if signature != coordinator.lastBoardSignature {
                scene.setPosition(viewModel.board)
                coordinator.lastAnimatedMove = move
            }
        }
        coordinator.firstUpdateDone = true
        coordinator.lastBoardSignature = Self.boardSignature(viewModel.board)

        scene.setHighlights(selected: viewModel.selected,
                             targets: viewModel.legalTargets,
                             lastMove: viewModel.lastMove,
                             check: viewModel.checkSquare)
        scene.setCameraPreset(viewModel.settings.cameraPreset)
        context.coordinator.cameraAction = { [weak viewModel] in _ = viewModel }
    }

    func makeCoordinator() -> Coordinator { Coordinator(viewModel: viewModel) }

    /// Простая сигнатура доски (кто стоит где) — чтобы отличить «ход можно анимировать»
    /// от «доска поменялась иначе» (отмена хода, новая партия) и в этом случае
    /// корректно перестроить фигуры целиком, а не анимировать несуществующий ход.
    static func boardSignature(_ board: [[Piece?]]) -> String {
        var s = ""
        for row in board {
            for cell in row {
                if let p = cell {
                    s.append(p.color == .white ? "w" : "b")
                    s.append(String(describing: p.kind).first ?? "?")
                } else {
                    s.append(".")
                }
            }
        }
        return s
    }

    final class Coordinator: NSObject {
        var viewModel: ChessGameViewModel
        weak var scnView: SCNView?
        var scene: ChessScene?
        var lastOrientation: PieceColor = .white
        var lastTheme: ThemeKey = .classic
        var lastAnimatedMove: (from: Square, to: Square)?
        var lastBoardSignature: String = ""
        var firstUpdateDone: Bool = false
        var cameraAction: (() -> Void)?

        init(viewModel: ChessGameViewModel) {
            self.viewModel = viewModel
        }

        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard let scene else { return }
            let translation = gesture.translation(in: gesture.view)
            scene.rotateCamera(deltaAzimuth: Float(translation.x) * -0.01, deltaElevation: Float(translation.y) * 0.01)
            gesture.setTranslation(.zero, in: gesture.view)
        }

        @objc func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            guard let scene else { return }
            if gesture.state == .changed {
                scene.zoomBy(Float(1 / gesture.scale))
                gesture.scale = 1
            }
        }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let scnView, let scene else { return }
            let point = gesture.location(in: scnView)
            let results = scnView.hitTest(point, options: [:])
            guard let first = results.first, let square = scene.square(forHitResult: first) else { return }
            Task { @MainActor in
                if let selected = self.viewModel.selected, self.viewModel.legalTargets.contains(square) {
                    self.viewModel.attemptMove(from: selected, to: square)
                } else {
                    self.viewModel.select(square)
                }
            }
        }
    }
}

/// Кнопки управления камерой — аналог ⟲ ⟳ ＋ － ⌖ у доски в оригинале.
struct CameraControlsView: View {
    let scene: ChessScene?
    var body: some View {
        HStack(spacing: 14) {
            Button { scene?.rotateBy(-.pi / 4) } label: { Image(systemName: "arrow.counterclockwise") }
            Button { scene?.rotateBy(.pi / 4) } label: { Image(systemName: "arrow.clockwise") }
            Button { scene?.zoomBy(0.75) } label: { Image(systemName: "plus.magnifyingglass") }
            Button { scene?.zoomBy(1 / 0.75) } label: { Image(systemName: "minus.magnifyingglass") }
            Button { scene?.resetView() } label: { Image(systemName: "scope") }
        }
        .buttonStyle(.bordered)
    }
}
