import SceneKit
import UIKit

/// Базовая SceneKit-сцена: доска 8x8, процедурные фигуры Стаунтона (тема classic),
/// орбитальная камера, подсветка выбора и легальных ходов.
///
/// Фигуры тем cars/hospital/hockey строятся своими моделями (CarsModels/HospitalModels/HockeyModels).
final class ChessScene {

    let scnScene = SCNScene()
    private let boardNode = SCNNode()
    private let piecesNode = SCNNode()
    private let highlightNode = SCNNode()
    private let cameraNode = SCNNode()
    private let cameraOrbit = SCNNode()

    private var currentTheme: ThemeKey = .classic
    private(set) var orientation: PieceColor = .white

    // Геометрия клетки: доска занимает 8x8 условных единиц, центр в (0,0,0).
    let tileSize: CGFloat = 1.0

    init() {
        buildBoard()
        buildLighting()
        buildCamera()
        scnScene.rootNode.addChildNode(boardNode)
        scnScene.rootNode.addChildNode(piecesNode)
        scnScene.rootNode.addChildNode(highlightNode)
    }

    // ---------- Доска ----------

    private func buildBoard() {
        let light = UIColor(red: 0.90, green: 0.82, blue: 0.68, alpha: 1)
        let dark = UIColor(red: 0.42, green: 0.27, blue: 0.17, alpha: 1)
        for row in 0..<8 {
            for col in 0..<8 {
                let box = SCNBox(width: tileSize, height: 0.12, length: tileSize, chamferRadius: 0)
                let mat = SCNMaterial()
                mat.diffuse.contents = (row + col) % 2 == 0 ? light : dark
                mat.specular.contents = UIColor.white
                box.materials = [mat]
                let node = SCNNode(geometry: box)
                node.position = boardPosition(row: row, col: col, y: -0.06)
                node.name = "tile_\(row)_\(col)"
                boardNode.addChildNode(node)
            }
        }
        // Основание доски
        let base = SCNBox(width: 8.6, height: 0.3, length: 8.6, chamferRadius: 0.05)
        let baseMat = SCNMaterial()
        baseMat.diffuse.contents = UIColor(red: 0.2, green: 0.12, blue: 0.08, alpha: 1)
        base.materials = [baseMat]
        let baseNode = SCNNode(geometry: base)
        baseNode.position = SCNVector3(0, -0.28, 0)
        boardNode.addChildNode(baseNode)
    }

    /// Позиция центра клетки (row 0 = ряд 8, col 0 = файл a), с учётом текущей ориентации доски.
    func boardPosition(row: Int, col: Int, y: Float) -> SCNVector3 {
        var r = row, c = col
        if orientation == .black { r = 7 - row; c = 7 - col }
        let x = Float(c) - 3.5
        let z = Float(r) - 3.5
        return SCNVector3(x, y, z)
    }

    func setOrientation(_ color: PieceColor) {
        orientation = color
        // Фигуры и клетки переставляются при следующем setPosition/обновлении подсветки.
    }

    // ---------- Освещение ----------

    private func buildLighting() {
        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 350
        ambient.light?.color = UIColor(white: 1.0, alpha: 1)
        scnScene.rootNode.addChildNode(ambient)

        let directional = SCNNode()
        directional.light = SCNLight()
        directional.light?.type = .directional
        directional.light?.intensity = 900
        directional.light?.castsShadow = true
        directional.light?.shadowRadius = 4
        directional.light?.shadowColor = UIColor(white: 0, alpha: 0.5)
        directional.position = SCNVector3(5, 10, 5)
        directional.look(at: SCNVector3(0, 0, 0))
        scnScene.rootNode.addChildNode(directional)

        let fill = SCNNode()
        fill.light = SCNLight()
        fill.light?.type = .omni
        fill.light?.intensity = 300
        fill.position = SCNVector3(-6, 6, -6)
        scnScene.rootNode.addChildNode(fill)
    }

    // ---------- Камера (орбитальная, аналог управления из оригинала) ----------

    private var distance: Float = 11
    private var azimuth: Float = 0            // поворот вокруг Y (аналог ⟲⟳ 45°)
    private var elevation: Float = 0.9         // угол наклона камеры

    private func buildCamera() {
        let camera = SCNCamera()
        camera.fieldOfView = 45
        camera.zFar = 100
        cameraNode.camera = camera
        cameraOrbit.addChildNode(cameraNode)
        scnScene.rootNode.addChildNode(cameraOrbit)
        applyCameraTransform()
    }

    private func applyCameraTransform() {
        let x = distance * sin(azimuth) * cos(elevation)
        let y = distance * sin(elevation)
        let z = distance * cos(azimuth) * cos(elevation)
        cameraNode.position = SCNVector3(x, y, z)
        cameraNode.look(at: SCNVector3(0, 0, 0))
    }

    /// Поворот камеры драгом пальца (дельта в радианах).
    func rotateCamera(deltaAzimuth: Float, deltaElevation: Float) {
        azimuth += deltaAzimuth
        elevation = max(0.15, min(1.45, elevation + deltaElevation))
        applyCameraTransform()
    }

    /// Поворот на фиксированный угол — кнопки ⟲ ⟳.
    func rotateBy(_ radians: Float) {
        azimuth += radians
        applyCameraTransform()
    }

    /// Зум колесом/пинчем — множитель к дистанции.
    func zoomBy(_ factor: Float) {
        distance = max(5, min(22, distance * factor))
        applyCameraTransform()
    }

    func resetView() {
        distance = 11; azimuth = 0; elevation = 0.9
        applyCameraTransform()
    }

    func setCameraPreset(_ preset: CameraPreset) {
        switch preset {
        case .normal: distance = 11; elevation = 0.9
        case .top: distance = 13; elevation = 1.45
        case .low: distance = 8; elevation = 0.25
        }
        applyCameraTransform()
    }

    // ---------- Фигуры ----------

    func setTheme(_ theme: ThemeKey) {
        currentTheme = theme
    }

    /// Полная перестройка фигур по текущей доске модели.
    func setPosition(_ board: [[Piece?]]) {
        piecesNode.childNodes.forEach { $0.removeFromParentNode() }
        for row in 0..<8 {
            for col in 0..<8 {
                guard let piece = board[row][col] else { continue }
                let node = PieceFactory.makeNode(piece: piece, theme: currentTheme)
                node.position = boardPosition(row: row, col: col, y: 0.06)
                node.name = "piece_\(row)_\(col)"
                piecesNode.addChildNode(node)
            }
        }
    }

    /// Анимированный ход одной фигуры: находит ноду "piece_row_col" на исходной клетке,
    /// удаляет ноду взятой фигуры (если есть) на целевой клетке и анимирует перемещение
    /// SCNAction.move вместо мгновенной телепортации/полной перестройки всех фигур.
    /// Возвращает false, если подходящую ноду не нашли — тогда вызывающая сторона должна
    /// упасть обратно на setPosition (полная перестройка).
    @discardableResult
    func animateMove(from: Square, to: Square, promoted: Bool, cinematic: Bool = false, captureFx: Bool = false,
                     duration: TimeInterval = 0.3, completion: @escaping () -> Void) -> Bool {
        let fromName = "piece_\(from.row)_\(from.file)"
        guard let movingNode = piecesNode.childNode(withName: fromName, recursively: false) else {
            completion()
            return false
        }
        let targetPosition = boardPosition(row: to.row, col: to.file, y: 0.06)
        // Взятая фигура: сразу убираем, либо (спецэффекты) разлетаемся искрами.
        let toName = "piece_\(to.row)_\(to.file)"
        if let capturedNode = piecesNode.childNode(withName: toName, recursively: false), capturedNode !== movingNode {
            if captureFx {
                capturedNode.name = nil
                let delay = cinematic ? 0.5 : duration * 0.7
                capturedNode.runAction(.sequence([
                    .wait(duration: delay),
                    .group([.scale(to: 0.01, duration: 0.2), .fadeOut(duration: 0.2)]),
                    .removeFromParentNode()
                ]))
                let burst = Self.makeBurst()
                burst.position = targetPosition
                piecesNode.addChildNode(burst)
                burst.runAction(.sequence([.wait(duration: delay), .run { n in
                    n.particleSystems?.first?.birthRate = 900
                }, .wait(duration: 1.2), .removeFromParentNode()]))
            } else {
                capturedNode.removeFromParentNode()
            }
        }
        let total = cinematic ? max(duration, 0.7) : duration
        let move = SCNAction.move(to: targetPosition, duration: total)
        move.timingMode = .easeInEaseOut
        var action = move
        if cinematic || captureFx {
            // Фигура «перелетает» дугой.
            let hop = SCNAction.customAction(duration: total) { [from = movingNode.position] node, t in
                let k = Float(t / CGFloat(total))
                node.position.x = from.x + (targetPosition.x - from.x) * k
                node.position.z = from.z + (targetPosition.z - from.z) * k
                node.position.y = 0.06 + sinf(k * .pi) * (cinematic ? 0.9 : 0.4)
            }
            hop.timingMode = .easeInEaseOut
            action = hop
        }
        if cinematic { runCinematicCamera(on: targetPosition, duration: total) }
        movingNode.runAction(action) { [weak movingNode] in
            movingNode?.position = targetPosition
            movingNode?.name = toName
            DispatchQueue.main.async { completion() }
        }
        _ = promoted
        return true
    }

    /// Лёгкий наезд камеры на клетку хода и возврат.
    private func runCinematicCamera(on target: SCNVector3, duration: TimeInterval) {
        guard let camera = cameraNode.camera else { return }
        let base = camera.fieldOfView
        let zoom = SCNAction.customAction(duration: duration + 0.5) { _, t in
            let k = Double(t) / (duration + 0.5)
            camera.fieldOfView = base - CGFloat(sin(k * .pi)) * base * 0.22
        }
        cameraNode.runAction(zoom) { camera.fieldOfView = base }
    }

    private static func makeBurst() -> SCNNode {
        let ps = SCNParticleSystem()
        ps.birthRate = 0
        ps.emissionDuration = 0.15
        ps.loops = false
        ps.particleLifeSpan = 0.7
        ps.particleVelocity = 2.5
        ps.particleVelocityVariation = 1.5
        ps.spreadingAngle = 180
        ps.emitterShape = SCNSphere(radius: 0.1)
        ps.particleSize = 0.06
        ps.particleColor = UIColor(red: 1, green: 0.75, blue: 0.2, alpha: 1)
        ps.particleColorVariation = SCNVector4(0.1, 0.3, 0.1, 0)
        ps.blendMode = .additive
        ps.acceleration = SCNVector3(0, -4, 0)
        ps.isAffectedByGravity = false
        let node = SCNNode()
        node.addParticleSystem(ps)
        return node
    }

    // ---------- Подсветка ----------

    func setHighlights(selected: Square?, targets: [Square], lastMove: (from: Square, to: Square)?, check: Square?) {
        highlightNode.childNodes.forEach { $0.removeFromParentNode() }
        if let selected {
            addMarker(square: selected, color: UIColor.systemYellow.withAlphaComponent(0.55), height: 0.02)
        }
        for t in targets {
            addMarker(square: t, color: UIColor.systemGreen.withAlphaComponent(0.55), height: 0.02, isDot: true)
        }
        if let lastMove {
            addMarker(square: lastMove.from, color: UIColor.systemBlue.withAlphaComponent(0.35), height: 0.015)
            addMarker(square: lastMove.to, color: UIColor.systemBlue.withAlphaComponent(0.35), height: 0.015)
        }
        if let check {
            addMarker(square: check, color: UIColor.systemRed.withAlphaComponent(0.6), height: 0.025)
        }
    }

    private func addMarker(square: Square, color: UIColor, height: Float, isDot: Bool = false) {
        let geometry: SCNGeometry
        if isDot {
            geometry = SCNSphere(radius: 0.18)
        } else {
            geometry = SCNBox(width: tileSize * 0.92, height: 0.02, length: tileSize * 0.92, chamferRadius: 0.05)
        }
        let mat = SCNMaterial()
        mat.diffuse.contents = color
        mat.transparency = 0.85
        geometry.materials = [mat]
        let node = SCNNode(geometry: geometry)
        node.position = boardPosition(row: square.row, col: square.file, y: height)
        highlightNode.addChildNode(node)
    }

    /// Перевод точки на экране (в системе SCNView) в клетку доски — для жестов выбора/хода.
    func square(forHitResult result: SCNHitTestResult) -> Square? {
        // Ищем по имени узла клетки/фигуры "tile_r_c" или "piece_r_c".
        var node: SCNNode? = result.node
        while let n = node {
            if let name = n.name, name.hasPrefix("tile_") || name.hasPrefix("piece_") {
                let parts = name.split(separator: "_")
                guard parts.count == 3, let r = Int(parts[1]), let c = Int(parts[2]) else { return nil }
                var row = r, col = c
                if orientation == .black { row = 7 - r; col = 7 - c }
                return Square(index0x88: row * 16 + col)
            }
            node = n.parent
        }
        return nil
    }
}

/// Процедурные фигуры Стаунтона: пешка/ладья/конь/слон/ферзь/король из SCNCylinder/SCNSphere/SCNCone.
/// Для тем cars/hospital/hockey — заглушка: те же силуэты, перекрашенные в акцентный цвет темы.
enum PieceFactory {
    static func makeNode(piece: Piece, theme: ThemeKey) -> SCNNode {
        if theme == .cars {
            return CarsModels.make(kind: piece.kind, color: piece.color)
        }
        if theme == .hockey {
            return HockeyModels.make(kind: piece.kind, color: piece.color)
        }
        if theme == .hospital {
            return HospitalModels.make(kind: piece.kind, color: piece.color)
        }
        let node = SCNNode()
        let spec = ThemeLibrary.spec(for: theme)
        let baseColor: UIColor = piece.color == .white ? UIColor(white: 0.96, alpha: 1) : UIColor(white: 0.12, alpha: 1)
        let accent = UIColor(hex: spec.accentColorHex) ?? baseColor
        let color = theme == .classic ? baseColor : blend(baseColor, accent, ratio: 0.55)

        let mat = SCNMaterial()
        mat.diffuse.contents = color
        mat.metalness.contents = theme == .classic ? 0.05 : 0.3
        mat.roughness.contents = 0.35
        mat.specular.contents = UIColor.white

        func addPart(_ geometry: SCNGeometry, y: Float) {
            geometry.materials = [mat]
            let n = SCNNode(geometry: geometry)
            n.position = SCNVector3(0, y, 0)
            node.addChildNode(n)
        }

        switch piece.kind {
        case .pawn:
            addPart(SCNSphere(radius: 0.14), y: 0.34)
            addPart(SCNCone(topRadius: 0.1, bottomRadius: 0.2, height: 0.22), y: 0.17)
            addPart(SCNCylinder(radius: 0.22, height: 0.06), y: 0.03)
        case .rook:
            addPart(SCNCylinder(radius: 0.2, height: 0.42), y: 0.24)
            addPart(SCNCylinder(radius: 0.24, height: 0.08), y: 0.49)
            addPart(SCNCylinder(radius: 0.26, height: 0.06), y: 0.03)
        case .knight:
            addPart(SCNCylinder(radius: 0.18, height: 0.3), y: 0.18)
            let head = SCNCone(topRadius: 0.04, bottomRadius: 0.16, height: 0.32)
            addPart(head, y: 0.46)
            addPart(SCNCylinder(radius: 0.24, height: 0.06), y: 0.03)
        case .bishop:
            addPart(SCNCylinder(radius: 0.17, height: 0.38), y: 0.22)
            addPart(SCNCone(topRadius: 0.02, bottomRadius: 0.13, height: 0.3), y: 0.56)
            addPart(SCNSphere(radius: 0.05), y: 0.74)
            addPart(SCNCylinder(radius: 0.24, height: 0.06), y: 0.03)
        case .queen:
            addPart(SCNCylinder(radius: 0.19, height: 0.5), y: 0.28)
            addPart(SCNSphere(radius: 0.17), y: 0.6)
            addPart(SCNCone(topRadius: 0.03, bottomRadius: 0.1, height: 0.18), y: 0.78)
            addPart(SCNCylinder(radius: 0.26, height: 0.06), y: 0.03)
        case .king:
            addPart(SCNCylinder(radius: 0.2, height: 0.56), y: 0.3)
            addPart(SCNSphere(radius: 0.16), y: 0.63)
            addPart(SCNBox(width: 0.06, height: 0.22, length: 0.06, chamferRadius: 0.01), y: 0.83)
            addPart(SCNBox(width: 0.18, height: 0.06, length: 0.06, chamferRadius: 0.01), y: 0.83)
            addPart(SCNCylinder(radius: 0.26, height: 0.06), y: 0.03)
        case .none:
            break
        }
        return node
    }

    private static func blend(_ a: UIColor, _ b: UIColor, ratio: CGFloat) -> UIColor {
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        return UIColor(red: ar * (1 - ratio) + br * ratio,
                        green: ag * (1 - ratio) + bg * ratio,
                        blue: ab * (1 - ratio) + bb * ratio,
                        alpha: 1)
    }
}

extension UIColor {
    convenience init?(hex: String) {
        var s = hex
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        let r = CGFloat((v >> 16) & 0xFF) / 255
        let g = CGFloat((v >> 8) & 0xFF) / 255
        let b = CGFloat(v & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
