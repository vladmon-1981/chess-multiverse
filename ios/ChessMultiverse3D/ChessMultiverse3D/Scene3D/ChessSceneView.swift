import SwiftUI
import SceneKit

/// Обёртка SCNView для SwiftUI — аналог CM.Board3D из оригинала (js/three/board3d.js),
/// но без кинорежима и спецэффектов взятия (заглушки на следующую фазу).
struct ChessSceneView: UIViewRepresentable {
    @ObservedObject var viewModel: ChessGameViewModel
    /// Мост к кнопкам камеры в GameView.
    let camera: CameraController

    func makeUIView(context: Context) -> SCNView {
        let scnView = SCNView()
        let scene = ChessScene()
        context.coordinator.scene = scene
        scnView.scene = scene.scnScene
        scnView.backgroundColor = UIColor(white: 0.08, alpha: 1)
        scnView.antialiasingMode = .multisampling4X
        scnView.allowsCameraControl = false
        scnView.rendersContinuously = false

        // Один палец — вращение/наклон; два — пинч-зум (pan не реагирует на два пальца).
        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        pan.minimumNumberOfTouches = 1
        pan.maximumNumberOfTouches = 1
        scnView.addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePinch(_:)))
        scnView.addGestureRecognizer(pinch)
        // Двойной тап — сброс камеры на пресет. Одиночный тап ждёт, пока станет ясно,
        // что это не второй тап, поэтому выбор клетки срабатывает с небольшой задержкой.
        let doubleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleDoubleTap(_:)))
        doubleTap.numberOfTapsRequired = 2
        scnView.addGestureRecognizer(doubleTap)
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.require(toFail: doubleTap)
        scnView.addGestureRecognizer(tap)

        scene.setTheme(viewModel.theme)
        scene.setOrientation(viewModel.orientation)
        scene.setPosition(viewModel.board)
        scene.setCameraPreset(viewModel.settings.cameraPreset)
        context.coordinator.lastPreset = viewModel.settings.cameraPreset
        context.coordinator.scnView = scnView
        camera.scene = scene
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
                                         captureFx: viewModel.settings.captureFx) { [weak viewModel, weak scene] in
                // Превращение пешки: после анимации перестраиваем фигуры, чтобы пешка стала новой фигурой.
                guard let viewModel, let scene, move.to.row == 0 || move.to.row == 7 else { return }
                scene.setPosition(viewModel.board)
            }
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
        // Мат: король падает и салютует (announceMate сам не повторяется для той же клетки)
        if viewModel.gameOver?.kind == .checkmate, let king = viewModel.checkSquare {
            scene.announceMate(at: king, winnerIsWhite: viewModel.gameOver?.winner == .white)
        }
        // Пресет применяем только при смене, иначе каждый апдейт SwiftUI сбрасывал бы зум и наклон.
        let preset = viewModel.settings.cameraPreset
        if coordinator.lastPreset != preset {
            scene.setCameraPreset(preset)
            coordinator.lastPreset = preset
        }
        if scnView.bounds.height > 0 {
            scene.updateViewAspect(scnView.bounds.width / scnView.bounds.height)
        }
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
        var lastPreset: CameraPreset = .normal

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

        @objc func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            guard let scene else { return }
            Task { @MainActor in
                scene.setCameraPreset(self.viewModel.settings.cameraPreset)
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

/// Мост между кнопками SwiftUI (GameView) и сценой SceneKit.
/// Сцена появляется в makeUIView и регистрируется здесь; до этого команды ничего не делают.
final class CameraController {
    var scene: ChessScene?

    func rotate(_ radians: Float) { scene?.rotateBy(radians) }
    func tilt(_ radians: Float) { scene?.tiltBy(radians) }
    func zoom(_ factor: Float) { scene?.zoomBy(factor) }
    func reset(to preset: CameraPreset) { scene?.setCameraPreset(preset) }
}
