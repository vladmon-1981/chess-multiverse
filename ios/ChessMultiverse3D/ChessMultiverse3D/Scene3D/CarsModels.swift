import SceneKit
import UIKit

/// Тема «Тачки»: процедурные мультяшные машинки — кузов + кабина со скруглёнными боксами,
/// глаза на лобовом стекле, рот на бампере, 4 колеса. Перенос силуэта (не текстур-наклеек)
/// из js/three/cars.js: каждая фигура — узнаваемый персонаж по README.
enum CarsModels {

    private struct Spec {
        var bodyColor: UIColor
        var length: CGFloat = 0.62
        var width: CGFloat = 0.42
        var bodyHeight: CGFloat = 0.16
        var clear: CGFloat = 0.075
        var cabHeight: CGFloat = 0.14
        var cabLength: CGFloat = 0.34
        var wheelRadius: CGFloat = 0.095
        var wheelWidth: CGFloat = 0.08
        var eyeColor: UIColor = .white
        var mouthColor: UIColor = UIColor(white: 0.08, alpha: 1)
        var hasHook: Bool = false      // Мэтр/Бууст — эвакуатор
        var hasTrailer: Bool = false   // Фрэнк — комбайн/трейлер
        var isTruck: Bool = false      // Мак — тягач, выше и без кабины-пузыря
        var isTractor: Bool = false    // Трактор — высокие колёса, без лобового стекла-глаз
        var spoiler: Bool = false
    }

    static func make(kind: PieceKind, color: PieceColor) -> SCNNode {
        let spec = spec(for: kind, color: color)
        return build(spec)
    }

    private static func spec(for kind: PieceKind, color: PieceColor) -> Spec {
        switch (color, kind) {
        case (.white, .king): // Молния Маккуин
            return Spec(bodyColor: UIColor(red: 0.83, green: 0.08, blue: 0.11, alpha: 1), length: 0.66, width: 0.42,
                        wheelRadius: 0.1, spoiler: true)
        case (.white, .queen): // Салли
            return Spec(bodyColor: UIColor(red: 0.31, green: 0.65, blue: 0.88, alpha: 1), length: 0.6, width: 0.4, cabHeight: 0.15)
        case (.white, .rook): // Мак (тягач)
            return Spec(bodyColor: UIColor(red: 0.78, green: 0.08, blue: 0.1, alpha: 1), length: 0.7, width: 0.46,
                        bodyHeight: 0.3, cabHeight: 0.0, hasTrailer: true, isTruck: true)
        case (.white, .bishop): // Док Хадсон
            return Spec(bodyColor: UIColor(red: 0.1, green: 0.22, blue: 0.45, alpha: 1), length: 0.64, width: 0.44, wheelRadius: 0.1)
        case (.white, .knight): // Мэтр (эвакуатор)
            return Spec(bodyColor: UIColor(red: 0.6, green: 0.56, blue: 0.5, alpha: 1), length: 0.58, width: 0.4, hasHook: true)
        case (.white, .pawn): // Луиджи
            return Spec(bodyColor: UIColor(red: 0.95, green: 0.78, blue: 0.1, alpha: 1), length: 0.42, width: 0.32,
                        bodyHeight: 0.14, cabHeight: 0.12, wheelRadius: 0.07)
        case (.black, .king): // Чик Хикс
            return Spec(bodyColor: UIColor(red: 0.22, green: 0.58, blue: 0.2, alpha: 1), length: 0.66, width: 0.42,
                        wheelRadius: 0.1, spoiler: true)
        case (.black, .queen): // Джексон Шторм
            return Spec(bodyColor: UIColor(red: 0.08, green: 0.1, blue: 0.14, alpha: 1), length: 0.68, width: 0.44,
                        wheelRadius: 0.1, eyeColor: UIColor(red: 0.16, green: 0.72, blue: 1.0, alpha: 1), spoiler: true)
        case (.black, .rook): // Фрэнк (комбайн)
            return Spec(bodyColor: UIColor(red: 0.72, green: 0.14, blue: 0.1, alpha: 1), length: 0.74, width: 0.5,
                        bodyHeight: 0.32, cabHeight: 0.0, hasTrailer: true, isTruck: true)
        case (.black, .bishop): // Профессор Зет
            return Spec(bodyColor: UIColor(red: 0.42, green: 0.48, blue: 0.34, alpha: 1), length: 0.46, width: 0.34,
                        bodyHeight: 0.18, wheelRadius: 0.075)
        case (.black, .knight): // Бууст
            return Spec(bodyColor: UIColor(red: 0.42, green: 0.18, blue: 0.58, alpha: 1), length: 0.62, width: 0.44,
                        wheelRadius: 0.1, spoiler: true)
        case (.black, .pawn): // Трактор
            return Spec(bodyColor: UIColor(red: 0.2, green: 0.5, blue: 0.22, alpha: 1), length: 0.44, width: 0.34,
                        bodyHeight: 0.16, cabHeight: 0.12, wheelRadius: 0.1, isTractor: true)
        case (_, .none):
            return Spec(bodyColor: .gray)
        }
    }

    private static func build(_ s: Spec) -> SCNNode {
        let root = SCNNode()

        let bodyMat = SCNMaterial()
        bodyMat.diffuse.contents = s.bodyColor
        bodyMat.metalness.contents = 0.1
        bodyMat.roughness.contents = 0.28
        bodyMat.specular.contents = UIColor.white

        // Кузов
        let body = SCNBox(width: s.width, height: s.bodyHeight, length: s.length, chamferRadius: s.bodyHeight * 0.35)
        body.materials = [bodyMat]
        let bodyNode = SCNNode(geometry: body)
        bodyNode.position = SCNVector3(0, Float(s.clear + s.bodyHeight / 2), 0)
        root.addChildNode(bodyNode)

        // Кабина / будка (не у тягача-комбайна)
        if s.cabHeight > 0 {
            let cab = SCNBox(width: s.width * 0.82, height: s.cabHeight, length: s.cabLength, chamferRadius: s.cabHeight * 0.4)
            cab.materials = [bodyMat]
            let cabNode = SCNNode(geometry: cab)
            cabNode.position = SCNVector3(0, Float(s.clear + s.bodyHeight + s.cabHeight / 2 - 0.015), Float(-s.length * 0.06))
            root.addChildNode(cabNode)

            // Лобовое стекло с глазами (две белые полусферы со зрачками)
            let glassZ = cabNode.position.z + Float(s.cabLength / 2 - 0.01)
            addEyes(to: root, y: cabNode.position.y, z: glassZ, width: s.width, eyeColor: s.eyeColor)
        } else {
            // Грузовик без кабины-пузыря: глаза прямо на передней решётке кузова
            addEyes(to: root, y: bodyNode.position.y + Float(s.bodyHeight) * 0.25, z: Float(s.length / 2 - 0.02), width: s.width, eyeColor: s.eyeColor)
        }

        // Рот на бампере
        addMouth(to: root, y: Float(s.clear * 0.9), z: Float(s.length / 2), width: s.width, color: s.mouthColor)

        // Колёса
        let wheelMat = SCNMaterial()
        wheelMat.diffuse.contents = UIColor(white: 0.08, alpha: 1)
        wheelMat.roughness.contents = 0.8
        let rimMat = SCNMaterial()
        rimMat.diffuse.contents = UIColor(white: 0.82, alpha: 1)
        rimMat.metalness.contents = 0.9
        rimMat.roughness.contents = 0.25

        let wheelZOffsets: [CGFloat] = [s.length * 0.32, -s.length * 0.32]
        for wz in wheelZOffsets {
            for side: CGFloat in [-1, 1] {
                let wheel = SCNCylinder(radius: s.wheelRadius, height: s.wheelWidth)
                wheel.materials = [wheelMat]
                let wn = SCNNode(geometry: wheel)
                wn.eulerAngles.z = Float.pi / 2
                wn.position = SCNVector3(Float(side * (s.width / 2 - s.wheelWidth * 0.2)), Float(s.wheelRadius), Float(wz))
                root.addChildNode(wn)

                let rim = SCNCylinder(radius: s.wheelRadius * 0.45, height: s.wheelWidth * 1.04)
                rim.materials = [rimMat]
                let rn = SCNNode(geometry: rim)
                rn.eulerAngles.z = Float.pi / 2
                rn.position = wn.position
                root.addChildNode(rn)
            }
        }

        if s.spoiler {
            let wing = SCNBox(width: s.width * 0.9, height: 0.02, length: 0.1, chamferRadius: 0.01)
            wing.materials = [bodyMat]
            let wn = SCNNode(geometry: wing)
            wn.position = SCNVector3(0, Float(s.clear + s.bodyHeight + 0.09), Float(-s.length / 2 + 0.07))
            root.addChildNode(wn)
            for side: CGFloat in [-1, 1] {
                let post = SCNBox(width: 0.015, height: 0.08, length: 0.04, chamferRadius: 0.005)
                post.materials = [bodyMat]
                let pn = SCNNode(geometry: post)
                pn.position = SCNVector3(Float(side * s.width * 0.32), Float(s.clear + s.bodyHeight + 0.05), Float(-s.length / 2 + 0.07))
                root.addChildNode(pn)
            }
        }

        if s.hasHook {
            // Эвакуатор: стрела-кран с крюком над кабиной, смотрит назад
            let armMat = SCNMaterial(); armMat.diffuse.contents = UIColor(white: 0.5, alpha: 1); armMat.metalness.contents = 0.7
            let arm = SCNCylinder(radius: 0.015, height: 0.26)
            arm.materials = [armMat]
            let an = SCNNode(geometry: arm)
            an.eulerAngles.x = Float.pi / 2.6
            an.position = SCNVector3(0, Float(s.clear + s.bodyHeight + 0.15), Float(-s.length * 0.3))
            root.addChildNode(an)
            let hook = SCNTorus(ringRadius: 0.025, pipeRadius: 0.006)
            hook.materials = [armMat]
            let hn = SCNNode(geometry: hook)
            hn.position = SCNVector3(0, Float(s.clear + s.bodyHeight + 0.02), Float(-s.length * 0.42))
            root.addChildNode(hn)
        }

        if s.hasTrailer {
            // Прицеп/комбайн: длинная платформа позади кузова
            let trailerMat = SCNMaterial()
            trailerMat.diffuse.contents = s.bodyColor.withAlphaComponent(1).withBrightness(0.85)
            let trailer = SCNBox(width: s.width * 0.95, height: s.bodyHeight * 0.9, length: s.length * 0.9, chamferRadius: 0.02)
            trailer.materials = [trailerMat]
            let tn = SCNNode(geometry: trailer)
            tn.position = SCNVector3(0, Float(s.clear + s.bodyHeight * 0.45), Float(-s.length * 0.78))
            root.addChildNode(tn)
            for side: CGFloat in [-1, 1] {
                let wheel = SCNCylinder(radius: s.wheelRadius * 0.85, height: s.wheelWidth)
                wheel.materials = [wheelMat]
                let wn = SCNNode(geometry: wheel)
                wn.eulerAngles.z = Float.pi / 2
                wn.position = SCNVector3(Float(side * (s.width / 2 - s.wheelWidth * 0.2)), Float(s.wheelRadius * 0.85), Float(-s.length * 1.05))
                root.addChildNode(wn)
            }
        }

        if s.isTractor {
            // Трактор-пешка: крупные задние колёса уже заданы радиусом, добавим выхлопную трубу
            let pipeMat = SCNMaterial(); pipeMat.diffuse.contents = UIColor(white: 0.2, alpha: 1)
            let pipe = SCNCylinder(radius: 0.015, height: 0.12)
            pipe.materials = [pipeMat]
            let pn = SCNNode(geometry: pipe)
            pn.position = SCNVector3(Float(s.width * 0.22), Float(s.clear + s.bodyHeight + 0.06), Float(s.length * 0.1))
            root.addChildNode(pn)
        }

        root.position.y = 0 // контейнер стоит прямо на подставке клетки
        return root
    }

    private static func addEyes(to root: SCNNode, y: Float, z: Float, width: CGFloat, eyeColor: UIColor) {
        let whiteMat = SCNMaterial(); whiteMat.diffuse.contents = UIColor.white
        let pupilMat = SCNMaterial(); pupilMat.diffuse.contents = eyeColor == .white ? UIColor(white: 0.08, alpha: 1) : eyeColor
        for side: CGFloat in [-1, 1] {
            let eyeW = SCNSphere(radius: Double(width) * 0.14)
            eyeW.materials = [whiteMat]
            let en = SCNNode(geometry: eyeW)
            en.scale = SCNVector3(1, 0.85, 0.4)
            en.position = SCNVector3(Float(side * width * 0.22), y, z)
            root.addChildNode(en)
            let pupil = SCNSphere(radius: Double(width) * 0.06)
            pupil.materials = [pupilMat]
            let pn = SCNNode(geometry: pupil)
            pn.position = SCNVector3(Float(side * width * 0.22), y, z + 0.015)
            root.addChildNode(pn)
        }
    }

    private static func addMouth(to root: SCNNode, y: Float, z: Float, width: CGFloat, color: UIColor) {
        let mat = SCNMaterial(); mat.diffuse.contents = color
        let mouth = SCNBox(width: width * 0.36, height: 0.02, length: 0.015, chamferRadius: 0.008)
        mouth.materials = [mat]
        let n = SCNNode(geometry: mouth)
        n.position = SCNVector3(0, y, z)
        root.addChildNode(n)
    }
}

extension UIColor {
    func withBrightness(_ factor: CGFloat) -> UIColor {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        if getHue(&h, saturation: &s, brightness: &b, alpha: &a) {
            return UIColor(hue: h, saturation: s, brightness: min(1, b * factor), alpha: a)
        }
        return self
    }
}
