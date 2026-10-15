import SceneKit
import UIKit

/// Тема «Animal Hospital»: большеголовые звери в «чиби»-стиле — непропорционально крупная
/// сфера-голова на маленьком капсула-теле, разные уши/мордочки по персонажу. Белые — персонал
/// ночной больницы, чёрные — аномалии (чёрные/пустые глаза без зрачков).
enum HospitalModels {

    private enum Species { case muntjac, rabbit, duck, caracal, rat, slug }

    private struct Spec {
        var furColor: UIColor
        var accentColor: UIColor
        var species: Species
        var isAnomaly: Bool
        var earsUp: Bool = true   // торчком vs вислоухие
        var hasMirror: Bool = false   // Харлоу — налобное зеркало
        var hasBeret: Bool = false    // Барни — берет
        var hasCap: Bool = false      // Дакман — полицейская кепка
        var hasNurseHat: Bool = false // медсестра
    }

    static func make(kind: PieceKind, color: PieceColor) -> SCNNode {
        let spec = spec(for: kind, color: color)
        return build(spec)
    }

    private static func spec(for kind: PieceKind, color: PieceColor) -> Spec {
        let anomaly = color == .black
        switch kind {
        case .king: // Доктор Харлоу (мунтжак) / Барни (кролик)
            if !anomaly {
                return Spec(furColor: UIColor(red: 0.62, green: 0.45, blue: 0.3, alpha: 1),
                            accentColor: UIColor(white: 0.9, alpha: 1), species: .muntjac, isAnomaly: false,
                            earsUp: true, hasMirror: true)
            } else {
                return Spec(furColor: UIColor(white: 0.85, alpha: 1),
                            accentColor: UIColor(red: 0.15, green: 0.15, blue: 0.18, alpha: 1), species: .rabbit,
                            isAnomaly: true, earsUp: true, hasBeret: true)
            }
        case .queen: // Медсестра / аномалия-медсестра
            return Spec(furColor: anomaly ? UIColor(white: 0.25, alpha: 1) : UIColor(red: 0.95, green: 0.82, blue: 0.7, alpha: 1),
                        accentColor: UIColor.white, species: .rabbit, isAnomaly: anomaly,
                        earsUp: true, hasNurseHat: true)
        case .rook: // Офицер Дакман / аномалия-Дакман
            return Spec(furColor: anomaly ? UIColor(white: 0.2, alpha: 1) : UIColor(red: 0.95, green: 0.8, blue: 0.15, alpha: 1),
                        accentColor: UIColor(red: 0.1, green: 0.2, blue: 0.5, alpha: 1), species: .duck, isAnomaly: anomaly,
                        hasCap: true)
        case .bishop: // Рон из бухгалтерии (вислоухий кролик) / аномалия-Рон
            return Spec(furColor: anomaly ? UIColor(white: 0.22, alpha: 1) : UIColor(red: 0.82, green: 0.78, blue: 0.7, alpha: 1),
                        accentColor: UIColor(red: 0.4, green: 0.3, blue: 0.2, alpha: 1), species: .rabbit, isAnomaly: anomaly,
                        earsUp: false)
        case .knight: // Лиз (каракал-журналистка) / аномалия-Лиз
            return Spec(furColor: anomaly ? UIColor(white: 0.18, alpha: 1) : UIColor(red: 0.78, green: 0.56, blue: 0.3, alpha: 1),
                        accentColor: UIColor(white: 0.1, alpha: 1), species: .caracal, isAnomaly: anomaly,
                        earsUp: true)
        case .pawn: // Рэттью (крыс) / слизень-аномалия
            if !anomaly {
                return Spec(furColor: UIColor(white: 0.55, alpha: 1), accentColor: UIColor(red: 0.85, green: 0.6, blue: 0.6, alpha: 1),
                            species: .rat, isAnomaly: false, earsUp: true)
            } else {
                return Spec(furColor: UIColor(red: 0.15, green: 0.35, blue: 0.12, alpha: 1), accentColor: UIColor(red: 0.08, green: 0.2, blue: 0.06, alpha: 1),
                            species: .slug, isAnomaly: true, earsUp: false)
            }
        case .none:
            return Spec(furColor: .gray, accentColor: .darkGray, species: .rabbit, isAnomaly: false)
        }
    }

    private static func build(_ s: Spec) -> SCNNode {
        let root = SCNNode()

        let furMat = SCNMaterial(); furMat.diffuse.contents = s.furColor; furMat.roughness.contents = 0.75
        let accentMat = SCNMaterial(); accentMat.diffuse.contents = s.accentColor; accentMat.roughness.contents = 0.5

        let bodyHeight: CGFloat = 0.14
        let bodyRadius: CGFloat = 0.075
        let headRadius: CGFloat = s.species == .slug ? 0.1 : 0.14

        if s.species == .slug {
            // Слизень-аномалия: без ног, вытянутое тело-капля на земле
            let blob = SCNCapsule(capRadius: 0.09, height: 0.12)
            blob.materials = [furMat]
            let bn = SCNNode(geometry: blob)
            bn.eulerAngles.x = Float.pi / 2
            bn.position = SCNVector3(0, 0.09, 0)
            root.addChildNode(bn)
            addEyes(to: root, y: 0.12, z: 0.08, radius: 0.1, anomaly: true)
            root.position.y = 0
            return root
        }

        // Тело — маленькая капсула
        let body = SCNCapsule(capRadius: bodyRadius, height: bodyHeight)
        body.materials = [furMat]
        let bodyNode = SCNNode(geometry: body)
        bodyNode.position = SCNVector3(0, Float(bodyRadius + bodyHeight / 2), 0)
        root.addChildNode(bodyNode)

        // Ноги-лапки
        for side: CGFloat in [-1, 1] {
            let leg = SCNCylinder(radius: bodyRadius * 0.35, height: 0.05)
            leg.materials = [furMat]
            let ln = SCNNode(geometry: leg)
            ln.position = SCNVector3(Float(side * bodyRadius * 0.6), 0.025, 0)
            root.addChildNode(ln)
        }

        // Большая голова — чиби
        let headY = bodyNode.position.y + Float(bodyRadius + bodyHeight / 2) + Float(headRadius) * 0.75
        let head = SCNSphere(radius: headRadius)
        head.materials = [furMat]
        let headNode = SCNNode(geometry: head)
        headNode.position = SCNVector3(0, headY, 0)
        root.addChildNode(headNode)

        // Мордочка
        switch s.species {
        case .duck:
            let billMat = SCNMaterial(); billMat.diffuse.contents = UIColor(red: 0.95, green: 0.6, blue: 0.1, alpha: 1)
            let bill = SCNBox(width: headRadius * 0.7, height: headRadius * 0.2, length: headRadius * 0.55, chamferRadius: headRadius * 0.08)
            bill.materials = [billMat]
            let bn = SCNNode(geometry: bill)
            bn.position = SCNVector3(0, headY - Float(headRadius) * 0.15, Float(headRadius) * 0.9)
            root.addChildNode(bn)
        case .rat:
            let snoutMat = SCNMaterial(); snoutMat.diffuse.contents = UIColor(red: 0.8, green: 0.6, blue: 0.58, alpha: 1)
            let snout = SCNSphere(radius: headRadius * 0.28)
            snout.materials = [snoutMat]
            let sn = SCNNode(geometry: snout)
            sn.position = SCNVector3(0, headY - Float(headRadius) * 0.15, Float(headRadius) * 0.95)
            root.addChildNode(sn)
        case .muntjac, .caracal:
            let snout = SCNCone(topRadius: headRadius * 0.08, bottomRadius: headRadius * 0.32, height: headRadius * 0.5)
            snout.materials = [furMat]
            let sn = SCNNode(geometry: snout)
            sn.eulerAngles.x = Float.pi / 2
            sn.position = SCNVector3(0, headY - Float(headRadius) * 0.1, Float(headRadius) * 0.9)
            root.addChildNode(sn)
        case .rabbit:
            let nose = SCNSphere(radius: headRadius * 0.14)
            let noseMat = SCNMaterial(); noseMat.diffuse.contents = UIColor(red: 0.85, green: 0.5, blue: 0.55, alpha: 1)
            nose.materials = [noseMat]
            let nn = SCNNode(geometry: nose)
            nn.position = SCNVector3(0, headY - Float(headRadius) * 0.1, Float(headRadius) * 0.95)
            root.addChildNode(nn)
        case .slug:
            break
        }

        // Уши
        switch s.species {
        case .duck:
            break // у утки клюв, без ушей
        default:
            for side: CGFloat in [-1, 1] {
                if s.earsUp {
                    let ear = SCNCapsule(capRadius: headRadius * 0.14, height: headRadius * 0.9)
                    ear.materials = [furMat]
                    let en = SCNNode(geometry: ear)
                    en.eulerAngles.z = Float(side) * 0.2
                    en.position = SCNVector3(Float(side * headRadius * 0.55), headY + Float(headRadius) * 0.85, -Float(headRadius) * 0.1)
                    root.addChildNode(en)
                } else {
                    // Вислоухие — капсулы свисают вдоль головы
                    let ear = SCNCapsule(capRadius: headRadius * 0.16, height: headRadius * 1.1)
                    ear.materials = [furMat]
                    let en = SCNNode(geometry: ear)
                    en.eulerAngles.z = Float(side) * 1.3
                    en.position = SCNVector3(Float(side * headRadius * 0.85), headY, 0)
                    root.addChildNode(en)
                }
            }
        }

        // Глаза
        addEyes(to: root, y: headY, z: Float(headRadius) * 0.88, radius: headRadius, anomaly: s.isAnomaly)

        // Аксессуары
        if s.hasMirror {
            let band = SCNTorus(ringRadius: headRadius * 0.85, pipeRadius: headRadius * 0.05)
            band.materials = [accentMat]
            let bn = SCNNode(geometry: band)
            bn.eulerAngles.x = Float.pi / 2
            bn.position = SCNVector3(0, headY + Float(headRadius) * 0.3, 0)
            root.addChildNode(bn)
            let mirrorMat = SCNMaterial(); mirrorMat.diffuse.contents = UIColor(white: 0.9, alpha: 1); mirrorMat.metalness.contents = 1
            let mirror = SCNCylinder(radius: headRadius * 0.18, height: 0.008)
            mirror.materials = [mirrorMat]
            let mn = SCNNode(geometry: mirror)
            mn.eulerAngles.x = Float.pi / 2
            mn.position = SCNVector3(0, headY + Float(headRadius) * 0.3, Float(headRadius) * 0.85)
            root.addChildNode(mn)
        }
        if s.hasBeret {
            let beret = SCNCylinder(radius: headRadius * 0.75, height: headRadius * 0.22)
            beret.materials = [accentMat]
            let bn = SCNNode(geometry: beret)
            bn.position = SCNVector3(0, headY + Float(headRadius) * 0.85, 0)
            root.addChildNode(bn)
        }
        if s.hasCap {
            let cap = SCNCylinder(radius: headRadius * 0.8, height: headRadius * 0.3)
            cap.materials = [accentMat]
            let cn = SCNNode(geometry: cap)
            cn.position = SCNVector3(0, headY + Float(headRadius) * 0.85, 0)
            root.addChildNode(cn)
            let brim = SCNBox(width: headRadius * 1.2, height: 0.01, length: headRadius * 0.5, chamferRadius: 0.01)
            brim.materials = [accentMat]
            let brn = SCNNode(geometry: brim)
            brn.position = SCNVector3(0, headY + Float(headRadius) * 0.72, Float(headRadius) * 0.6)
            root.addChildNode(brn)
        }
        if s.hasNurseHat {
            let hat = SCNBox(width: headRadius * 0.7, height: headRadius * 0.3, length: headRadius * 0.5, chamferRadius: headRadius * 0.08)
            let hatMat = SCNMaterial(); hatMat.diffuse.contents = UIColor.white
            hat.materials = [hatMat]
            let hn = SCNNode(geometry: hat)
            hn.position = SCNVector3(0, headY + Float(headRadius) * 0.95, 0)
            root.addChildNode(hn)
            let crossMat = SCNMaterial(); crossMat.diffuse.contents = UIColor(red: 0.85, green: 0.1, blue: 0.1, alpha: 1)
            let cross = SCNBox(width: headRadius * 0.18, height: headRadius * 0.3, length: 0.004, chamferRadius: 0.002)
            cross.materials = [crossMat]
            let cn = SCNNode(geometry: cross)
            cn.position = SCNVector3(0, headY + Float(headRadius) * 0.95, Float(headRadius) * 0.26)
            root.addChildNode(cn)
        }

        // Для каракала/лисьего профиля журналистки — чуть заметные кисточки на ушах уже даны формой капсул

        root.position.y = 0
        return root
    }

    private static func addEyes(to root: SCNNode, y: Float, z: Float, radius: CGFloat, anomaly: Bool) {
        let whiteMat = SCNMaterial(); whiteMat.diffuse.contents = anomaly ? UIColor(white: 0.05, alpha: 1) : UIColor.white
        let pupilMat = SCNMaterial(); pupilMat.diffuse.contents = UIColor(white: 0.04, alpha: 1)
        for side: Float in [-1, 1] {
            let eye = SCNSphere(radius: Double(radius) * 0.22)
            eye.materials = [whiteMat]
            let en = SCNNode(geometry: eye)
            en.position = SCNVector3(side * Float(radius) * 0.45, y, z)
            root.addChildNode(en)
            if !anomaly {
                let pupil = SCNSphere(radius: Double(radius) * 0.1)
                pupil.materials = [pupilMat]
                let pn = SCNNode(geometry: pupil)
                pn.position = SCNVector3(side * Float(radius) * 0.45, y, z + Float(radius) * 0.15)
                root.addChildNode(pn)
            }
        }
    }
}
