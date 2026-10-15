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

    // Пределы камеры. Наклон: от 12° над доской (почти вровень) до 85° (почти сверху),
    // никогда под доску и не за зенит. Дистанция: ближе 10.5 доска вылезает за края
    // экрана, дальше 22 становится мелкой.
    static let minElevation: Float = 12 * .pi / 180
    static let maxElevation: Float = 85 * .pi / 180
    static let minDistance: Float = 10.5
    static let maxDistance: Float = 22

    /// Сигналы сцены для звука: контакт при взятии и остановка на льду (хоккей).
    var onImpact: (() -> Void)?
    var onSlideStop: (() -> Void)?

    /// Временные смещения камеры в кинорежиме (погоня/облёт); складываются с пользовательскими.
    private var cineAzimuth: Float = 0
    private var cineElevation: Float = 0
    private var cineDistance: Float = 0
    private var distance: Float = 13
    private var azimuth: Float = 0            // поворот вокруг Y, без ограничений
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

    /// Ориентация угла обзора: на узком (портретном) экране 45° задаём по горизонтали,
    /// чтобы вся ширина доски помещалась при любом повороте; на широком — по вертикали.
    func updateViewAspect(_ aspect: CGFloat) {
        guard let camera = cameraNode.camera, aspect > 0 else { return }
        let direction: SCNCameraProjectionDirection = aspect < 1 ? .horizontal : .vertical
        if camera.projectionDirection != direction { camera.projectionDirection = direction }
    }

    private func applyCameraTransform() {
        azimuth = azimuth.truncatingRemainder(dividingBy: 2 * .pi)
        elevation = min(Self.maxElevation, max(Self.minElevation, elevation))
        distance = min(Self.maxDistance, max(Self.minDistance, distance))
        let az = azimuth + cineAzimuth
        let el = min(Self.maxElevation, max(Self.minElevation, elevation + cineElevation))
        let dist = max(5, distance + cineDistance)
        let x = dist * sin(az) * cos(el)
        let y = dist * sin(el)
        let z = dist * cos(az) * cos(el)
        cameraNode.position = SCNVector3(x, y, z)
        cameraNode.look(at: SCNVector3(0, 0, 0))
    }

    /// Драг одним пальцем: горизонталь — азимут, вертикаль — наклон (дельты в радианах).
    func rotateCamera(deltaAzimuth: Float, deltaElevation: Float) {
        azimuth += deltaAzimuth
        elevation += deltaElevation
        applyCameraTransform()
    }

    /// Поворот вокруг доски на фиксированный угол — кнопки влево/вправо.
    func rotateBy(_ radians: Float) {
        azimuth += radians
        applyCameraTransform()
    }

    /// Наклон на фиксированный угол — кнопки выше/ниже.
    func tiltBy(_ radians: Float) {
        elevation += radians
        applyCameraTransform()
    }

    /// Зум пинчем и кнопками — множитель к дистанции, в пределах minDistance…maxDistance.
    func zoomBy(_ factor: Float) {
        distance *= factor
        applyCameraTransform()
    }

    /// Пресет камеры: сброс вращения и дистанции. Вызывается при смене ракурса в настройках,
    /// двойным тапом и кнопкой «сброс».
    func setCameraPreset(_ preset: CameraPreset) {
        azimuth = 0
        switch preset {
        case .normal: distance = 13; elevation = 0.9
        case .top: distance = 14; elevation = Self.maxElevation
        case .low: distance = 11; elevation = Self.minElevation + 0.05
        }
        applyCameraTransform()
    }

    // ---------- Фигуры ----------

    func setTheme(_ theme: ThemeKey) {
        currentTheme = theme
    }

    private var mateShownOn: Square?
    private var lastCheck: Square?

    /// Полная перестройка фигур по текущей доске модели.
    func setPosition(_ board: [[Piece?]]) {
        piecesNode.childNodes.forEach { $0.removeFromParentNode() }
        mateShownOn = nil
        for row in 0..<8 {
            for col in 0..<8 {
                guard let piece = board[row][col] else { continue }
                let holder = PieceHolder(kind: piece.kind, color: piece.color)
                holder.restYaw = facingYaw(piece: piece)
                holder.eulerAngles.y = holder.restYaw
                holder.tilt.addChildNode(PieceFactory.makeNode(piece: piece, theme: currentTheme))
                holder.position = boardPosition(row: row, col: col, y: 0.06)
                holder.name = "piece_\(row)_\(col)"
                piecesNode.addChildNode(holder)
            }
        }
    }

    /// Поворот фигуры «лицом к сопернику» (правило js/three: faceOpponent и yaw темы классика).
    /// Модели смотрят носом в +z; при ориентации белых белые стоят на +z, при чёрных — на −z,
    /// поэтому при перевороте доски поворот сдвигается на π.
    private func facingYaw(piece: Piece) -> Float {
        var yaw: Float = 0
        if currentTheme != .classic {
            yaw = piece.color == .white ? Float.pi : 0
        } else if piece.kind == .knight {
            yaw = piece.color == .white ? -0.5 : Float.pi - 0.5
        }
        if orientation == .black { yaw += Float.pi }
        return yaw
    }

    /// Анимированный ход: фигура летит дугой, поворачивается по курсу, наклоняется вперёд,
    /// приземляется с приплюском. Рокировка двигает и ладью. Взятие — эффекты темы в момент контакта
    /// (captureFx). Возвращает false, если фигуры нет на исходной клетке — тогда нужна перестройка.
    @discardableResult
    func animateMove(from: Square, to: Square, promoted: Bool, cinematic: Bool = false, captureFx: Bool = false,
                     duration: TimeInterval = 0.3, completion: @escaping () -> Void) -> Bool {
        _ = promoted
        _ = duration
        let fromName = "piece_\(from.row)_\(from.file)"
        guard let mover = piecesNode.childNode(withName: fromName, recursively: false) as? PieceHolder else {
            completion()
            return false
        }
        let toName = "piece_\(to.row)_\(to.file)"
        let total = MotionTiming.duration(from: from, to: to, cinematic: cinematic)
        let target = boardPosition(row: to.row, col: to.file, y: 0.06)

        // Жертва: на клетке назначения либо (взятие на проходе) рядом
        var victim: PieceHolder?
        if let node = piecesNode.childNode(withName: toName, recursively: false) as? PieceHolder, node !== mover {
            victim = node
        } else if mover.kind == .pawn, from.file != to.file,
                  let node = piecesNode.childNode(withName: "piece_\(from.row)_\(to.file)", recursively: false) as? PieceHolder,
                  node.kind == .pawn, node.color != mover.color {
            victim = node
        }
        victim?.name = nil

        // Ладья при рокировке
        var rook: PieceHolder?
        var rookToName = ""
        var rookTarget = SCNVector3Zero
        if mover.kind == .king, abs(to.file - from.file) == 2 {
            let rookFrom = to.file > from.file ? 7 : 0
            let rookTo = to.file > from.file ? 5 : 3
            if let node = piecesNode.childNode(withName: "piece_\(from.row)_\(rookFrom)", recursively: false) as? PieceHolder {
                node.name = nil
                rook = node
                rookToName = "piece_\(to.row)_\(rookTo)"
                rookTarget = boardPosition(row: to.row, col: rookTo, y: 0.06)
            }
        }

        let start = mover.position
        let dx = target.x - start.x, dz = target.z - start.z
        let dist = (dx * dx + dz * dz).squareRoot()
        let isKnight = mover.kind == .knight
        let slide = currentTheme == .hockey && !isKnight   // хоккей: фигуры скользят по льду
        let lift: Float = slide ? 0.02 : isKnight ? (cinematic ? 1.1 : 0.9) : 0.28 + dist * 0.02
        let lean: Float = isKnight ? 0.22 : 0.12

        let handled = FlagBox()
        let impact = {
            guard let victim, !handled.on else { return }
            handled.on = true
            self.onImpact?()
            self.impactEffects(victim: victim, at: target, dirX: dx, dirZ: dz, captureFx: captureFx)
        }
        let moveAction = hopAction(mover, from: start, to: target, total: total, lift: lift, lean: lean,
                                   impactAt: victim != nil ? Float(MotionTiming.impactFraction) : nil, onImpact: impact,
                                   slide: slide, slowMo: cinematic && victim != nil)
        if let rook {
            let rookStart = rook.position
            let rookDist = rookTarget.x - rookStart.x
            let rookLift: Float = 0.28 + abs(rookDist) * 0.02
            rook.runAction(hopAction(rook, from: rookStart, to: rookTarget, total: total, lift: rookLift, lean: 0.1,
                                     impactAt: nil, onImpact: nil)) { [weak rook] in
                guard let rook else { return }
                rook.position = rookTarget
                rook.eulerAngles.y = rook.restYaw
                rook.tilt.eulerAngles = SCNVector3Zero
                rook.tilt.scale = SCNVector3(1, 1, 1)
                rook.name = rookToName
            }
        }
        if cinematic { runCinematicCamera(following: mover, duration: total, dirX: dx, dirZ: dz) }
        mover.runAction(moveAction) { [weak mover] in
            if let victim, !handled.on {
                // Анимация прервана до контакта — жертву убираем без эффектов
                handled.on = true
                victim.removeFromParentNode()
            }
            guard let mover else { return }
            mover.position = target
            mover.eulerAngles.y = mover.restYaw
            mover.tilt.eulerAngles = SCNVector3Zero
            mover.tilt.scale = SCNVector3(1, 1, 1)
            mover.name = toName
            DispatchQueue.main.async { completion() }
        }
        return true
    }

    /// Действие одного прыжка фигуры: дуга, поворот по курсу, наклон и приплюск при посадке.
    private func hopAction(_ holder: PieceHolder, from start: SCNVector3, to end: SCNVector3, total: Double,
                           lift: Float, lean: Float, impactAt: Float?, onImpact: (() -> Void)?,
                           slide: Bool = false, slowMo: Bool = false) -> SCNAction {
        let dx = end.x - start.x, dz = end.z - start.z
        let heading = atan2(dx, dz)
        let startYaw = holder.eulerAngles.y
        let endYaw = holder.restYaw
        var fired = false
        var stopped = false
        // Замедление на ударе: с 75% пути полсекунды время течёт втрое медленнее.
        let slowStart = 0.75 * total, slowLen = 0.5, slowRate = 0.3
        let realTotal = total + (slowMo ? slowLen * (1 - slowRate) : 0)
        return SCNAction.customAction(duration: realTotal) { [weak holder, weak self] _, elapsed in
            guard let holder else { return }
            var t = Double(elapsed)
            if slowMo {
                if t > slowStart + slowLen { t = slowStart + slowLen * slowRate + (t - slowStart - slowLen) }
                else if t > slowStart { t = slowStart + (t - slowStart) * slowRate }
            }
            let raw = Float(min(1, t / total))
            if slide {
                // Скольжение: быстрый разгон, плавное торможение, откат корпуса назад на остановке
                let e = 1 - pow(1 - raw, 2.4)
                holder.position = SCNVector3(start.x + dx * e, 0.06, start.z + dz * e)
                holder.eulerAngles.y = raw < 0.15 ? ChessScene.lerpAngle(startYaw, heading, ChessScene.easeOut(raw / 0.15))
                                     : raw > 0.9 ? ChessScene.lerpAngle(heading, endYaw, ChessScene.easeInOut((raw - 0.9) / 0.1)) : heading
                let fwd = lean * sin(Float.pi * min(1, raw / 0.6)) * (raw < 0.6 ? 1 : 0)
                let back = raw > 0.75 ? -lean * 0.9 * sin(Float.pi * min(1, (raw - 0.75) / 0.25)) : 0
                holder.tilt.eulerAngles.x = fwd + back
                holder.tilt.scale = SCNVector3(1, 1, 1)
                if raw > 0.8, !stopped {
                    stopped = true
                    self?.spawnBurst(at: end, color: UIColor(red: 0.85, green: 0.95, blue: 1, alpha: 1), rate: 220)
                    self?.onSlideStop?()
                }
                if let impactAt, !fired, raw >= impactAt { fired = true; onImpact?() }
                return
            }
            let e = ChessScene.easeInOut(raw)
            holder.position = SCNVector3(start.x + dx * e, 0.06 + sin(Float.pi * e) * lift, start.z + dz * e)
            let yaw: Float
            if raw < 0.2 {
                yaw = ChessScene.lerpAngle(startYaw, heading, ChessScene.easeOut(raw / 0.2))
            } else if raw > 0.8 {
                yaw = ChessScene.lerpAngle(heading, endYaw, ChessScene.easeInOut((raw - 0.8) / 0.2))
            } else {
                yaw = heading
            }
            holder.eulerAngles.y = yaw
            holder.tilt.eulerAngles.x = lean * sin(Float.pi * e)
            if raw > 0.88 {
                let s = sin(Float.pi * (raw - 0.88) / 0.12)
                holder.tilt.scale = SCNVector3(1 + 0.08 * s, 1 - 0.14 * s, 1 + 0.08 * s)
            } else {
                holder.tilt.scale = SCNVector3(1, 1, 1)
            }
            if let impactAt, !fired, raw >= impactAt {
                fired = true
                onImpact?()
            }
        }
    }

    private static func easeInOut(_ x: Float) -> Float { x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2 }
    private static func easeOut(_ x: Float) -> Float { 1 - pow(1 - x, 3) }

    private static func lerpAngle(_ a: Float, _ b: Float, _ t: Float) -> Float {
        var d = (b - a).truncatingRemainder(dividingBy: 2 * Float.pi)
        if d > Float.pi { d -= 2 * Float.pi } else if d < -Float.pi { d += 2 * Float.pi }
        return a + d * t
    }

    /// Эффекты взятия в момент контакта — порт fxShatter / fxCrash / fxZap / fxCheck из js/three.
    private func impactEffects(victim: PieceHolder, at pos: SCNVector3, dirX: Float, dirZ: Float, captureFx: Bool) {
        victim.name = nil
        guard captureFx else {
            // Без спецэффектов жертва уменьшается и исчезает в облачке
            spawnBurst(at: pos, color: UIColor(white: 0.9, alpha: 1), rate: 300)
            victim.runAction(.sequence([
                .group([.scale(to: 0.01, duration: 0.2), .fadeOut(duration: 0.2)]),
                .removeFromParentNode()
            ]))
            return
        }
        switch currentTheme {
        case .classic:
            // Фигура раскалывается: осколки разлетаются, падают и гаснут
            victim.removeFromParentNode()
            spawnBurst(at: pos, color: UIColor(red: 1, green: 0.8, blue: 0.4, alpha: 1), rate: 700)
            let woodMat = SCNMaterial()
            woodMat.diffuse.contents = UIColor(red: 0.85, green: 0.78, blue: 0.62, alpha: 1)
            for _ in 0..<10 {
                let shard = SCNNode(geometry: SCNBox(width: 0.07, height: 0.05, length: 0.09, chamferRadius: 0.01))
                shard.geometry?.materials = [woodMat]
                let p0 = SCNVector3(pos.x, pos.y + 0.25, pos.z)
                shard.position = p0
                piecesNode.addChildNode(shard)
                let vx = dirX * Float.random(in: 0.4...1.2) + Float.random(in: -0.8...0.8)
                let vz = dirZ * Float.random(in: 0.4...1.2) + Float.random(in: -0.8...0.8)
                let vy = Float.random(in: 1.4...2.6)
                let fall = SCNAction.customAction(duration: 0.9) { node, time in
                    let s = Float(time)
                    node.position = SCNVector3(p0.x + vx * s, p0.y + vy * s - 2.6 * s * s, p0.z + vz * s)
                }
                shard.runAction(.sequence([fall, .fadeOut(duration: 0.15), .removeFromParentNode()]))
            }
        case .cars:
            // Таран: машинку подбрасывает, она кувыркается и взрывается облаком
            spawnBurst(at: pos, color: UIColor(red: 1, green: 0.55, blue: 0.1, alpha: 1), rate: 900)
            victim.runAction(.sequence([
                .group([
                    .moveBy(x: CGFloat(dirX * 0.7), y: 0.5, z: CGFloat(dirZ * 0.7), duration: 0.45),
                    .rotateBy(x: 0, y: CGFloat.pi * 4, z: 0, duration: 0.45)
                ]),
                .group([.fadeOut(duration: 0.35), .scale(to: 0.2, duration: 0.35)]),
                .removeFromParentNode()
            ]))
        case .hospital:
            // Разряд дефибриллятора: персонаж дрожит и лопается
            spawnBurst(at: pos, color: UIColor(red: 0.45, green: 0.95, blue: 0.85, alpha: 1), rate: 700)
            victim.runAction(.sequence([
                .customAction(duration: 0.3) { node, time in
                    let w = Float(1 + 0.1 * sin(Double(time) * 70))
                    node.scale = SCNVector3(w, w, w)
                },
                .scale(to: 1.4, duration: 0.12),
                .group([.fadeOut(duration: 0.15), .scale(to: 0.01, duration: 0.15)]),
                .removeFromParentNode()
            ]))
        case .hockey:
            // Хоккеиста впечатывают в борт: откидывается и уезжает по льду
            spawnBurst(at: pos, color: UIColor(white: 0.95, alpha: 1), rate: 600)
            victim.tilt.runAction(.rotateBy(x: -1.2, y: 0, z: 0, duration: 0.3))
            victim.runAction(.sequence([
                .group([.moveBy(x: CGFloat(dirX * 0.6), y: 0.25, z: CGFloat(dirZ * 0.6), duration: 0.35)]),
                .group([.fadeOut(duration: 0.25)]),
                .removeFromParentNode()
            ]))
        }
    }

    /// Мат: поверженный король падает, над доской салютуют частицы (порт showMate из js/three).
    /// Вызывается каждым обновлением сцены — повторно для той же клетки не срабатывает.
    func announceMate(at square: Square, winnerIsWhite: Bool) {
        guard mateShownOn != square else { return }
        mateShownOn = square
        guard let king = piecesNode.childNode(withName: "piece_\(square.row)_\(square.file)", recursively: false) as? PieceHolder else { return }
        king.tilt.runAction(SCNAction.customAction(duration: 0.9) { node, time in
            let k = Float(min(1, Double(time) / 0.9))
            node.eulerAngles.x = -1.35 * (1 - pow(1 - k, 3))
        })
        let colors: [UIColor] = winnerIsWhite
            ? [UIColor(red: 1, green: 0.97, blue: 0.88, alpha: 1), UIColor(red: 1, green: 0.84, blue: 0.31, alpha: 1)]
            : [UIColor(red: 0.7, green: 0.53, blue: 1, alpha: 1), UIColor(red: 1, green: 0.32, blue: 0.32, alpha: 1)]
        for i in 0..<4 {
            piecesNode.runAction(.sequence([
                .wait(duration: 0.26 * Double(i)),
                .run { [weak self] _ in
                    guard let self else { return }
                    let pos = SCNVector3(Float.random(in: -2.8...2.8), 1.2, Float.random(in: -2.8...2.8))
                    self.spawnBurst(at: pos, color: colors[i % colors.count], rate: 500)
                }
            ]))
        }
    }

    /// Киноплан хода: камера следует за фигурой, чуть облетает по дуге, опускается и приближается,
    /// затем плавно возвращается на пользовательский ракурс (порт кинокамеры из веба).
    private func runCinematicCamera(following mover: PieceHolder, duration: TimeInterval, dirX: Float, dirZ: Float) {
        let total = duration + 0.7
        let side: Float = dirX >= 0 ? 1 : -1
        let action = SCNAction.customAction(duration: total) { [weak self, weak mover] _, t in
            guard let self, let mover else { return }
            let k = Float(min(1, Double(t) / total))
            let env = sin(Float.pi * k)               // 0 → 1 → 0
            let smooth = env * env * (3 - 2 * env)
            self.cameraOrbit.position = SCNVector3(mover.position.x * 0.6 * smooth, 0, mover.position.z * 0.6 * smooth)
            self.cineAzimuth = 0.55 * side * (k - 0.5) * 2 * smooth
            self.cineElevation = -0.28 * smooth
            self.cineDistance = -3.2 * smooth
            self.applyCameraTransform()
        }
        cameraOrbit.removeAction(forKey: "cine")
        cameraOrbit.runAction(action, forKey: "cine") { [weak self] in
            guard let self else { return }
            self.cameraOrbit.position = SCNVector3Zero
            self.cineAzimuth = 0; self.cineElevation = 0; self.cineDistance = 0
            self.applyCameraTransform()
        }
    }

    /// Облачко частиц в точке: один короткий всплеск, узел удаляется сам (порт burst() из js/three).
    private func spawnBurst(at pos: SCNVector3, color: UIColor, rate: CGFloat) {
        let ps = SCNParticleSystem()
        ps.birthRate = rate
        ps.emissionDuration = 0.12
        ps.loops = false
        ps.particleLifeSpan = 0.7
        ps.particleVelocity = 2.5
        ps.particleVelocityVariation = 1.5
        ps.spreadingAngle = 180
        ps.emitterShape = SCNSphere(radius: 0.1)
        ps.particleSize = 0.06
        ps.particleColor = color
        ps.particleColorVariation = SCNVector4(0.1, 0.3, 0.1, 0)
        ps.blendMode = .additive
        ps.acceleration = SCNVector3(0, -4, 0)
        ps.isAffectedByGravity = false
        let node = SCNNode()
        node.position = pos
        node.addParticleSystem(ps)
        piecesNode.addChildNode(node)
        node.runAction(.sequence([.wait(duration: 1.3), .removeFromParentNode()]))
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
            let marker = addMarker(square: check, color: UIColor.systemRed.withAlphaComponent(0.6), height: 0.025)
            // Шах: подсветка короткими ударами, как checkRing в js/three
            if check != lastCheck {
                marker.runAction(SCNAction.repeat(.sequence([.scale(to: 1.3, duration: 0.2), .scale(to: 1, duration: 0.2)]), count: 3))
            }
        }
        lastCheck = check
    }

    @discardableResult
    private func addMarker(square: Square, color: UIColor, height: Float, isDot: Bool = false) -> SCNNode {
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
        return node
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

/// Узел фигуры: тип и цвет, базовый поворот (лицом к сопернику) и вложенный узел наклона и приплюска.
final class PieceHolder: SCNNode {
    let kind: PieceKind
    let color: PieceColor
    let tilt = SCNNode()
    var restYaw: Float = 0

    init(kind: PieceKind, color: PieceColor) {
        self.kind = kind
        self.color = color
        super.init()
        addChildNode(tilt)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) не используется")
    }
}

/// Общий тайминг хода для сцены и озвучки: звук удара совпадает с контактом фигур.
enum MotionTiming {
    /// Доля длительности хода, на которой фигура касается клетки противника.
    static let impactFraction = 0.8

    static func duration(from: Square, to: Square, cinematic: Bool) -> Double {
        let dr = Double(to.row - from.row), df = Double(to.file - from.file)
        let dist = (dr * dr + df * df).squareRoot()
        let base = min(0.75, 0.3 + dist * 0.07)
        return cinematic ? base * 1.35 : base
    }
}

/// Флаг, общий для замыканий анимации (обработано ли взятие).
final class FlagBox {
    var on = false
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
            // Морда коня: конус в сторону −x (как в js/three/classic.js), чтобы у фигуры было «перед»
            let snout = SCNNode(geometry: SCNCone(topRadius: 0.02, bottomRadius: 0.07, height: 0.14))
            snout.geometry?.materials = [mat]
            snout.eulerAngles.z = Float.pi / 2
            snout.position = SCNVector3(-0.16, 0.44, 0)
            node.addChildNode(snout)
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
