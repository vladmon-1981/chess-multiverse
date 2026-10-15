import SceneKit
import UIKit

/// Тема «Хоккей»: процедурные хоккеисты на коньках. «Металлург» (белые, бело-сине-красная
/// форма) против «Авангарда» (чёрные, чёрно-красная форма). Силуэт: капсула-туловище в форме,
/// сфера-шлем, плоские прямоугольники-коньки под ногами, у некоторых — клюшка-цилиндр.
/// Конь — зверь-талисман (лисёнок/ястреб), а не человек.
enum HockeyModels {

    private struct Spec {
        var jerseyColor: UIColor
        var trimColor: UIColor
        var helmetColor: UIColor
        var skinColor: UIColor = UIColor(red: 0.93, green: 0.76, blue: 0.62, alpha: 1)
        var height: CGFloat = 0.42
        var bodyRadius: CGFloat = 0.1
        var hasStick: Bool = false
        var sticked_wound_up: Bool = false // слон — замах для щелчка
        var isGoalie: Bool = false         // король — вратарь крупнее, щитки+ловушка
        var isCaptain: Bool = false        // ферзь — капитан с кубком
        var isMascot: Bool = false         // конь — зверь-талисман
        var mascotIsFox: Bool = true       // лисёнок (белые) vs ястреб (чёрные)
        var isJunior: Bool = false         // пешка — юниор поменьше
    }

    static func make(kind: PieceKind, color: PieceColor) -> SCNNode {
        let spec = spec(for: kind, color: color)
        return build(spec)
    }

    private static func spec(for kind: PieceKind, color: PieceColor) -> Spec {
        let white = UIColor(white: 0.95, alpha: 1)
        let metBlue = UIColor(red: 0.08, green: 0.22, blue: 0.55, alpha: 1)
        let metRed = UIColor(red: 0.78, green: 0.1, blue: 0.12, alpha: 1)
        let avBlack = UIColor(red: 0.08, green: 0.08, blue: 0.09, alpha: 1)
        let avRed = UIColor(red: 0.74, green: 0.08, blue: 0.1, alpha: 1)

        switch (color, kind) {
        case (.white, .king): // Вратарь «Металлурга»
            return Spec(jerseyColor: white, trimColor: metBlue, helmetColor: metRed,
                        height: 0.5, bodyRadius: 0.15, isGoalie: true)
        case (.white, .queen): // Капитан с «К» и кубком
            return Spec(jerseyColor: white, trimColor: metRed, helmetColor: metBlue,
                        height: 0.44, bodyRadius: 0.105, isCaptain: true)
        case (.white, .rook): // Защитник с клюшкой поперёк
            return Spec(jerseyColor: white, trimColor: metBlue, helmetColor: metBlue,
                        height: 0.44, bodyRadius: 0.11, hasStick: true)
        case (.white, .bishop): // Снайпер — замах для щелчка
            return Spec(jerseyColor: white, trimColor: metRed, helmetColor: metBlue,
                        height: 0.42, bodyRadius: 0.1, hasStick: true, sticked_wound_up: true)
        case (.white, .knight): // Лисёнок Тимоша
            return Spec(jerseyColor: UIColor(red: 0.92, green: 0.48, blue: 0.14, alpha: 1), trimColor: white,
                        helmetColor: metBlue, height: 0.36, bodyRadius: 0.1, isMascot: true, mascotIsFox: true)
        case (.white, .pawn): // Юниор
            return Spec(jerseyColor: white, trimColor: metBlue, helmetColor: metRed,
                        height: 0.32, bodyRadius: 0.08, isJunior: true)

        case (.black, .king): // Вратарь «Авангарда»
            return Spec(jerseyColor: avBlack, trimColor: avRed, helmetColor: avBlack,
                        height: 0.5, bodyRadius: 0.15, isGoalie: true)
        case (.black, .queen): // Капитан с кубком
            return Spec(jerseyColor: avBlack, trimColor: avRed, helmetColor: avBlack,
                        height: 0.44, bodyRadius: 0.105, isCaptain: true)
        case (.black, .rook): // Защитник
            return Spec(jerseyColor: avBlack, trimColor: avRed, helmetColor: avBlack,
                        height: 0.44, bodyRadius: 0.11, hasStick: true)
        case (.black, .bishop): // Снайпер — замах
            return Spec(jerseyColor: avBlack, trimColor: avRed, helmetColor: avBlack,
                        height: 0.42, bodyRadius: 0.1, hasStick: true, sticked_wound_up: true)
        case (.black, .knight): // Ястреб
            return Spec(jerseyColor: UIColor(red: 0.3, green: 0.3, blue: 0.34, alpha: 1), trimColor: avRed,
                        helmetColor: avBlack, height: 0.36, bodyRadius: 0.1, isMascot: true, mascotIsFox: false)
        case (.black, .pawn): // Юниор
            return Spec(jerseyColor: avBlack, trimColor: avRed, helmetColor: avBlack,
                        height: 0.32, bodyRadius: 0.08, isJunior: true)
        case (_, .none):
            return Spec(jerseyColor: .gray, trimColor: .darkGray, helmetColor: .gray)
        }
    }

    private static func build(_ s: Spec) -> SCNNode {
        let root = SCNNode()

        let jerseyMat = SCNMaterial()
        jerseyMat.diffuse.contents = s.jerseyColor
        jerseyMat.roughness.contents = 0.6
        let trimMat = SCNMaterial()
        trimMat.diffuse.contents = s.trimColor
        trimMat.roughness.contents = 0.5
        let helmetMat = SCNMaterial()
        helmetMat.diffuse.contents = s.helmetColor
        helmetMat.metalness.contents = 0.3
        helmetMat.roughness.contents = 0.35
        let skinMat = SCNMaterial()
        skinMat.diffuse.contents = s.skinColor
        let skateMat = SCNMaterial()
        skateMat.diffuse.contents = UIColor(white: 0.82, alpha: 1)
        skateMat.metalness.contents = 0.8
        skateMat.roughness.contents = 0.2

        let skateY: CGFloat = 0.012

        if s.isMascot {
            buildMascot(root: root, s: s, bodyMat: jerseyMat, trimMat: trimMat, skateMat: skateMat, skateY: skateY)
            root.position.y = 0
            return root
        }

        // Коньки — плоские прямоугольники под ногами
        for side: CGFloat in [-1, 1] {
            let skate = SCNBox(width: s.bodyRadius * 0.9, height: skateY, length: s.bodyRadius * 1.5, chamferRadius: skateY * 0.4)
            skate.materials = [skateMat]
            let sn = SCNNode(geometry: skate)
            sn.position = SCNVector3(Float(side * s.bodyRadius * 0.55), Float(skateY / 2), Float(s.bodyRadius * 0.15))
            root.addChildNode(sn)
            let blade = SCNBox(width: 0.012, height: 0.02, length: s.bodyRadius * 1.6, chamferRadius: 0.004)
            blade.materials = [skateMat]
            let bn = SCNNode(geometry: blade)
            bn.position = SCNVector3(Float(side * s.bodyRadius * 0.55), Float(-0.01), Float(s.bodyRadius * 0.15))
            root.addChildNode(bn)
        }

        // Туловище — капсула в форме команды
        let legHeight = s.height * 0.3
        let torsoHeight = s.height * (s.isGoalie ? 0.55 : 0.5)
        let torso = SCNCapsule(capRadius: s.bodyRadius, height: torsoHeight)
        torso.materials = [jerseyMat]
        let torsoNode = SCNNode(geometry: torso)
        torsoNode.position = SCNVector3(0, Float(skateY + legHeight + torsoHeight / 2), 0)
        root.addChildNode(torsoNode)

        // Ноги (простые цилиндры в цвет формы)
        for side: CGFloat in [-1, 1] {
            let leg = SCNCylinder(radius: s.bodyRadius * 0.4, height: legHeight)
            leg.materials = [jerseyMat]
            let ln = SCNNode(geometry: leg)
            ln.position = SCNVector3(Float(side * s.bodyRadius * 0.5), Float(skateY + legHeight / 2), Float(s.bodyRadius * 0.15))
            root.addChildNode(ln)
        }

        // Полоса-отличие (trim) поперёк груди
        let stripe = SCNCylinder(radius: s.bodyRadius * 1.02, height: torsoHeight * 0.18)
        stripe.materials = [trimMat]
        let stripeNode = SCNNode(geometry: stripe)
        stripeNode.position = SCNVector3(0, torsoNode.position.y, 0)
        root.addChildNode(stripeNode)

        // Голова + шлем
        let headRadius = s.bodyRadius * 0.85
        let headY = torsoNode.position.y + Float(torsoHeight / 2 + headRadius * 0.7)
        let head = SCNSphere(radius: headRadius)
        head.materials = [skinMat]
        let headNode = SCNNode(geometry: head)
        headNode.position = SCNVector3(0, headY, 0)
        root.addChildNode(headNode)

        let helmet = SCNSphere(radius: headRadius * 1.05)
        helmet.materials = [helmetMat]
        let helmetNode = SCNNode(geometry: helmet)
        helmetNode.scale = SCNVector3(1, 0.78, 1)
        helmetNode.position = SCNVector3(0, headY + Float(headRadius) * 0.25, 0)
        root.addChildNode(helmetNode)

        if s.isGoalie {
            // Маска вратаря: решётка (цилиндрические прутья) + ловушка
            let cageMat = SCNMaterial(); cageMat.diffuse.contents = UIColor(white: 0.7, alpha: 1); cageMat.metalness.contents = 0.8
            for i in -2...2 {
                let bar = SCNCylinder(radius: 0.004, height: headRadius * 1.3)
                bar.materials = [cageMat]
                let bn = SCNNode(geometry: bar)
                bn.eulerAngles.x = Float.pi / 2
                bn.position = SCNVector3(Float(CGFloat(i) * headRadius * 0.3), headY, Float(headRadius * 0.85))
                root.addChildNode(bn)
            }
            // Ловушка (перчатка-ловушка) — сфера у руки
            let trapper = SCNSphere(radius: s.bodyRadius * 0.5)
            trapper.materials = [trimMat]
            let tn = SCNNode(geometry: trapper)
            tn.position = SCNVector3(Float(s.bodyRadius * 1.1), Float(torsoNode.position.y), Float(s.bodyRadius * 0.3))
            root.addChildNode(tn)
            // Блин (round pad)
            let blocker = SCNBox(width: s.bodyRadius * 0.6, height: s.bodyRadius * 0.8, length: 0.03, chamferRadius: 0.02)
            blocker.materials = [trimMat]
            let blN = SCNNode(geometry: blocker)
            blN.position = SCNVector3(Float(-s.bodyRadius * 1.1), Float(torsoNode.position.y), Float(s.bodyRadius * 0.3))
            root.addChildNode(blN)
            // Щитки по бокам ног
            for side: CGFloat in [-1, 1] {
                let pad = SCNBox(width: s.bodyRadius * 0.55, height: legHeight * 0.95, length: s.bodyRadius * 0.4, chamferRadius: 0.015)
                pad.materials = [trimMat]
                let pn = SCNNode(geometry: pad)
                pn.position = SCNVector3(Float(side * s.bodyRadius * 0.55), Float(skateY + legHeight / 2), Float(s.bodyRadius * 0.3))
                root.addChildNode(pn)
            }
        } else {
            // Глаза
            addEyes(to: root, y: headY, z: Float(headRadius) * 0.9, radius: headRadius)
        }

        if s.isCaptain {
            // «К» на груди — маленький цилиндрический значок (упрощённо — диск)
            let badge = SCNCylinder(radius: s.bodyRadius * 0.22, height: 0.006)
            badge.materials = [trimMat]
            let bn = SCNNode(geometry: badge)
            bn.eulerAngles.x = Float.pi / 2
            bn.position = SCNVector3(0, torsoNode.position.y, Float(s.bodyRadius * 0.95))
            root.addChildNode(bn)
            // Кубок поднят над головой
            let cupMat = SCNMaterial(); cupMat.diffuse.contents = UIColor(red: 0.85, green: 0.72, blue: 0.2, alpha: 1); cupMat.metalness.contents = 0.9
            let cupBowl = SCNSphere(radius: s.bodyRadius * 0.4)
            cupBowl.materials = [cupMat]
            let cupNode = SCNNode(geometry: cupBowl)
            cupNode.scale = SCNVector3(1, 0.7, 1)
            cupNode.position = SCNVector3(0, headY + Float(headRadius) * 1.6, 0)
            root.addChildNode(cupNode)
            let cupStem = SCNCylinder(radius: s.bodyRadius * 0.12, height: headRadius * 0.6)
            cupStem.materials = [cupMat]
            let stemNode = SCNNode(geometry: cupStem)
            stemNode.position = SCNVector3(0, headY + Float(headRadius) * 1.0, 0)
            root.addChildNode(stemNode)
        }

        if s.hasStick {
            let stickMat = SCNMaterial(); stickMat.diffuse.contents = UIColor(red: 0.3, green: 0.18, blue: 0.08, alpha: 1)
            let stick = SCNCylinder(radius: 0.01, height: s.height * 0.9)
            stick.materials = [stickMat]
            let sn = SCNNode(geometry: stick)
            if s.sticked_wound_up {
                // Слон — замах для щелчка: клюшка отведена в сторону и вверх по диагонали
                sn.eulerAngles.z = Float.pi / 2.6
                sn.eulerAngles.x = Float.pi / 10
                sn.position = SCNVector3(Float(s.bodyRadius * 1.0), Float(torsoNode.position.y) + 0.02, Float(s.bodyRadius * 0.4))
            } else {
                // Ладья — клюшка поперёк тела
                sn.eulerAngles.z = Float.pi / 2
                sn.position = SCNVector3(0, Float(skateY) + 0.03, Float(s.bodyRadius * 1.1))
            }
            root.addChildNode(sn)
            let blade = SCNBox(width: 0.025, height: 0.08, length: 0.012, chamferRadius: 0.005)
            blade.materials = [stickMat]
            let blN = SCNNode(geometry: blade)
            blN.position = SCNVector3(sn.position.x + (s.sticked_wound_up ? 0.12 : 0.26), 0.02, sn.position.z)
            root.addChildNode(blN)
        }

        root.position.y = 0
        return root
    }

    private static func addEyes(to root: SCNNode, y: Float, z: Float, radius: CGFloat) {
        let whiteMat = SCNMaterial(); whiteMat.diffuse.contents = UIColor.white
        let pupilMat = SCNMaterial(); pupilMat.diffuse.contents = UIColor(white: 0.08, alpha: 1)
        for side: Float in [-1, 1] {
            let eye = SCNSphere(radius: Double(radius) * 0.18)
            eye.materials = [whiteMat]
            let en = SCNNode(geometry: eye)
            en.position = SCNVector3(side * Float(radius) * 0.4, y, z)
            root.addChildNode(en)
            let pupil = SCNSphere(radius: Double(radius) * 0.08)
            pupil.materials = [pupilMat]
            let pn = SCNNode(geometry: pupil)
            pn.position = SCNVector3(side * Float(radius) * 0.4, y, z + Float(radius) * 0.12)
            root.addChildNode(pn)
        }
    }

    /// Конь — зверь-талисман (лисёнок Тимоша / ястреб), а не человек-хоккеист.
    private static func buildMascot(root: SCNNode, s: Spec, bodyMat: SCNMaterial, trimMat: SCNMaterial, skateMat: SCNMaterial, skateY: CGFloat) {
        // Коньки
        for side: CGFloat in [-1, 1] {
            let skate = SCNBox(width: s.bodyRadius * 0.7, height: skateY, length: s.bodyRadius * 1.1, chamferRadius: skateY * 0.4)
            skate.materials = [skateMat]
            let sn = SCNNode(geometry: skate)
            sn.position = SCNVector3(Float(side * s.bodyRadius * 0.4), Float(skateY / 2), 0)
            root.addChildNode(sn)
        }

        let legHeight = s.height * 0.18
        let bodyHeight = s.height * 0.4
        // Пушистое округлое тело (сфера, приплюснутая вытянутая)
        let body = SCNSphere(radius: s.bodyRadius)
        body.materials = [bodyMat]
        let bodyNode = SCNNode(geometry: body)
        bodyNode.scale = SCNVector3(1.1, 1.0, 1.3)
        bodyNode.position = SCNVector3(0, Float(skateY + legHeight + bodyHeight * 0.4), 0)
        root.addChildNode(bodyNode)

        for side: CGFloat in [-1, 1] {
            let leg = SCNCylinder(radius: s.bodyRadius * 0.28, height: legHeight)
            leg.materials = [bodyMat]
            let ln = SCNNode(geometry: leg)
            ln.position = SCNVector3(Float(side * s.bodyRadius * 0.4), Float(skateY + legHeight / 2), 0)
            root.addChildNode(ln)
        }

        // Большая голова звериная
        let headRadius = s.bodyRadius * 0.95
        let head = SCNSphere(radius: headRadius)
        head.materials = [bodyMat]
        let headNode = SCNNode(geometry: head)
        headNode.position = SCNVector3(0, bodyNode.position.y + Float(s.bodyRadius) * 0.95, Float(s.bodyRadius * 0.4))
        root.addChildNode(headNode)

        // Мордочка — конус
        let snoutMat = SCNMaterial(); snoutMat.diffuse.contents = s.mascotIsFox ? UIColor.white : UIColor(white: 0.85, alpha: 1)
        let snout = SCNCone(topRadius: 0.004, bottomRadius: headRadius * 0.4, height: headRadius * 0.7)
        snout.materials = [snoutMat]
        let snoutNode = SCNNode(geometry: snout)
        snoutNode.eulerAngles.x = Float.pi / 2
        snoutNode.position = SCNVector3(headNode.position.x, headNode.position.y - Float(headRadius) * 0.1,
                                         headNode.position.z + Float(headRadius) * 0.85)
        root.addChildNode(snoutNode)

        // Уши: лисьи треугольные (конусы вверх) или ястребиные острые перьевые (тонкие конусы)
        let earMat = SCNMaterial(); earMat.diffuse.contents = s.mascotIsFox ? s.trimColor : bodyMat.diffuse.contents as? UIColor
        for side: CGFloat in [-1, 1] {
            let ear = SCNCone(topRadius: 0.002, bottomRadius: headRadius * 0.32, height: headRadius * 0.7)
            ear.materials = [earMat ?? trimMat]
            let en = SCNNode(geometry: ear)
            en.position = SCNVector3(Float(side * headRadius * 0.55), headNode.position.y + Float(headRadius) * 0.75, headNode.position.z - Float(headRadius) * 0.1)
            en.eulerAngles.z = Float(side) * 0.25
            root.addChildNode(en)
        }

        // Глаза
        addEyes(to: root, y: headNode.position.y, z: headNode.position.z + Float(headRadius) * 0.8, radius: headRadius * 0.6)

        // Хвост (пушистый, у лисёнка заметнее)
        let tail = SCNSphere(radius: s.bodyRadius * (s.mascotIsFox ? 0.55 : 0.4))
        tail.materials = [bodyMat]
        let tailNode = SCNNode(geometry: tail)
        tailNode.scale = SCNVector3(0.8, 0.8, 1.5)
        tailNode.position = SCNVector3(0, bodyNode.position.y, Float(-s.bodyRadius * 1.1))
        root.addChildNode(tailNode)
    }
}
