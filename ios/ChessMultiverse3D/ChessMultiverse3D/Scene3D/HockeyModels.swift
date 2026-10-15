import SceneKit
import UIKit
import simd

/// Тема «Хоккей»: стилизованные мультяшные хоккеисты на коньках. «Металлург» (белые: синяя форма
/// с белыми и красными полосами) против «Авангарда» (чёрные: графитово-красная форма).
/// Роли: король — вратарь, ферзь — капитан («C», кубок), ладья — защитник (клюшка поперёк),
/// слон — снайпер (замах для щелчка), конь — зверь-талисман (лисёнок / ястреб) на коньках,
/// пешка — юниор с шайбой. Все фигуры смотрят в +z и стоят на y = 0.
enum HockeyModels {

    // MARK: - Конфигурация

    fileprivate enum Club { case metallurg, avangard }
    fileprivate enum Role { case goalie, captain, defender, sniper, mascot, junior }
    fileprivate enum Head { case human, fox, hawk }

    fileprivate struct Style {
        var club: Club
        var jersey: UIColor
        var stripeA: UIColor     // основная полоса (рукава, подол)
        var stripeB: UIColor     // вторая полоса
        var pants: UIColor
        var sock: UIColor
        var helmet: UIColor
        var glove: UIColor
        var number: String
    }

    fileprivate struct Config {
        var role: Role
        var style: Style
        var u: Float             // полная высота фигуры
        var head: Head = .human
        var headScale: Float = 1
        var fur: UIColor = .white
    }

    static func make(kind: PieceKind, color: PieceColor) -> SCNNode {
        let cfg = config(for: kind, color: color)
        return Builder(cfg).build()
    }

    private static func config(for kind: PieceKind, color: PieceColor) -> Config {
        let white = UIColor(red: 0.96, green: 0.96, blue: 0.97, alpha: 1)
        let blue = UIColor(red: 0.07, green: 0.30, blue: 0.78, alpha: 1)
        let navy = UIColor(red: 0.04, green: 0.13, blue: 0.40, alpha: 1)
        let red = UIColor(red: 0.85, green: 0.10, blue: 0.14, alpha: 1)
        let graphite = UIColor(red: 0.13, green: 0.13, blue: 0.15, alpha: 1)

        func met(_ num: String, helmet: UIColor = white) -> Style {
            Style(club: .metallurg, jersey: blue, stripeA: white, stripeB: red, pants: navy,
                  sock: blue, helmet: helmet, glove: navy, number: num)
        }
        func av(_ num: String, helmet: UIColor = graphite) -> Style {
            Style(club: .avangard, jersey: graphite, stripeA: red, stripeB: white, pants: UIColor(white: 0.07, alpha: 1),
                  sock: red, helmet: helmet, glove: UIColor(white: 0.06, alpha: 1), number: num)
        }

        switch (color, kind) {
        case (.white, .king):   return Config(role: .goalie, style: met("31"), u: 0.92)
        case (.white, .queen):  return Config(role: .captain, style: met("10"), u: 0.86)
        case (.white, .rook):   return Config(role: .defender, style: met("2"), u: 0.80)
        case (.white, .bishop): return Config(role: .sniper, style: met("71"), u: 0.82)
        case (.white, .knight):
            return Config(role: .mascot, style: met("0", helmet: white), u: 0.74, head: .fox,
                          fur: UIColor(red: 0.95, green: 0.50, blue: 0.13, alpha: 1))
        case (.white, .pawn):   return Config(role: .junior, style: met("13"), u: 0.62, headScale: 1.18)

        case (.black, .king):   return Config(role: .goalie, style: av("30"), u: 0.92)
        case (.black, .queen):  return Config(role: .captain, style: av("87"), u: 0.86)
        case (.black, .rook):   return Config(role: .defender, style: av("44"), u: 0.80)
        case (.black, .bishop): return Config(role: .sniper, style: av("91"), u: 0.82)
        case (.black, .knight):
            return Config(role: .mascot, style: av("0"), u: 0.74, head: .hawk,
                          fur: UIColor(red: 0.42, green: 0.30, blue: 0.22, alpha: 1))
        case (.black, .pawn):   return Config(role: .junior, style: av("17"), u: 0.62, headScale: 1.18)
        case (_, .none):
            return Config(role: .junior, style: met("0"), u: 0.6)
        }
    }

    // MARK: - Материалы и геометрические помощники

    fileprivate static func pbr(_ c: UIColor, rough: CGFloat, metal: CGFloat = 0) -> SCNMaterial {
        let s = SCNMaterial()
        s.lightingModel = .physicallyBased
        s.diffuse.contents = c
        s.roughness.contents = rough
        s.metalness.contents = metal
        return s
    }

    /// Тело вращения по профилю (r, y). Нормали гладкие, порядок обхода — наружу.
    fileprivate static func lathe(_ profile: [(Float, Float)], segments: Int = 28) -> SCNGeometry {
        var verts: [SCNVector3] = []
        var norms: [SCNVector3] = []
        var pn: [(Float, Float)] = []
        for i in 0..<profile.count {
            let a = profile[max(i - 1, 0)], b = profile[min(i + 1, profile.count - 1)]
            let dr = b.0 - a.0, dy = b.1 - a.1
            let l = max(sqrtf(dr * dr + dy * dy), 1e-6)
            pn.append((dy / l, -dr / l))
        }
        for s in 0...segments {
            let th = Float(s) / Float(segments) * 2 * .pi
            let c = cosf(th), sn = sinf(th)
            for (i, p) in profile.enumerated() {
                verts.append(SCNVector3(p.0 * c, p.1, p.0 * sn))
                norms.append(SCNVector3(pn[i].0 * c, pn[i].1, pn[i].0 * sn))
            }
        }
        var idx: [Int32] = []
        let n = profile.count
        for s in 0..<segments {
            for k in 0..<(n - 1) {
                let br = Int32(s * n + k), bl = Int32((s + 1) * n + k)
                let tr = Int32(s * n + k + 1), tl = Int32((s + 1) * n + k + 1)
                idx += [bl, br, tr, bl, tr, tl]
            }
        }
        let g = SCNGeometry(sources: [SCNGeometrySource(vertices: verts), SCNGeometrySource(normals: norms)],
                            elements: [SCNGeometryElement(indices: idx, primitiveType: .triangles)])
        return g
    }

    fileprivate static func dome(radius R: Float, segments: Int = 28) -> [(Float, Float)] {
        var pts: [(Float, Float)] = [(R * 1.02, -0.02 * R), (R * 1.03, 0.0)]
        for i in 0...10 {
            let a = Float(i) / 10 * (.pi / 2)
            pts.append((R * cosf(a), R * sinf(a)))
        }
        return pts
    }

    // MARK: - Текстуры нашивок

    private static var decalCache: [String: UIImage] = [:]

    fileprivate static func decal(club: Club, number: String, emblem: Bool, text: UIColor) -> UIImage {
        let key = "\(club)-\(number)-\(emblem)"
        if let i = decalCache[key] { return i }
        let size = CGSize(width: 256, height: 320)
        let img = UIGraphicsImageRenderer(size: size).image { ctx in
            let g = ctx.cgContext
            if emblem {
                let rect = CGRect(x: 36, y: 8, width: 184, height: 184)
                switch club {
                case .metallurg:
                    UIColor.white.setFill(); g.fillEllipse(in: rect)
                    UIColor(red: 0.04, green: 0.13, blue: 0.40, alpha: 1).setFill(); g.fillEllipse(in: rect.insetBy(dx: 12, dy: 12))
                    UIColor(red: 0.85, green: 0.10, blue: 0.14, alpha: 1).setFill()
                    g.fillEllipse(in: rect.insetBy(dx: 26, dy: 26))
                    drawText("М", in: rect, size: 118, color: .white, stroke: nil)
                case .avangard:
                    UIColor.white.setFill(); g.fillEllipse(in: rect)
                    UIColor(red: 0.85, green: 0.10, blue: 0.14, alpha: 1).setFill(); g.fillEllipse(in: rect.insetBy(dx: 12, dy: 12))
                    UIColor(white: 0.08, alpha: 1).setFill(); g.fillEllipse(in: rect.insetBy(dx: 36, dy: 36))
                    drawText("А", in: rect, size: 104, color: .white, stroke: nil)
                }
            }
            if !number.isEmpty && number != "0" {
                let r = emblem ? CGRect(x: 0, y: 196, width: 256, height: 124) : CGRect(x: 0, y: 40, width: 256, height: 240)
                drawText(number, in: r, size: emblem ? 112 : 210, color: text,
                         stroke: UIColor(white: 0.05, alpha: 1))
            }
        }
        decalCache[key] = img
        return img
    }

    private static func drawText(_ s: String, in rect: CGRect, size: CGFloat, color: UIColor, stroke: UIColor?) {
        var attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: size, weight: .black),
            .foregroundColor: color
        ]
        if let st = stroke { attrs[.strokeColor] = st; attrs[.strokeWidth] = -7 }
        let str = NSAttributedString(string: s, attributes: attrs)
        let sz = str.size()
        str.draw(at: CGPoint(x: rect.midX - sz.width / 2, y: rect.midY - sz.height / 2))
    }

    // MARK: - Сборщик фигуры

    fileprivate final class Builder {
        typealias V = SIMD3<Float>
        let cfg: Config
        let st: Style
        let u: Float
        let root = SCNNode()

        let jerseyM: SCNMaterial, stripeAM: SCNMaterial, stripeBM: SCNMaterial, pantsM: SCNMaterial
        let sockM: SCNMaterial, helmetM: SCNMaterial, gloveM: SCNMaterial, skinM: SCNMaterial
        let bootM = HockeyModels.pbr(UIColor(white: 0.07, alpha: 1), rough: 0.35)
        let chromeM = HockeyModels.pbr(UIColor(white: 0.9, alpha: 1), rough: 0.14, metal: 1)
        let woodM = HockeyModels.pbr(UIColor(red: 0.80, green: 0.62, blue: 0.36, alpha: 1), rough: 0.55)
        let bladeM = HockeyModels.pbr(UIColor(white: 0.10, alpha: 1), rough: 0.5)
        let tapeM = HockeyModels.pbr(UIColor(white: 0.95, alpha: 1), rough: 0.9)
        let darkM = HockeyModels.pbr(UIColor(white: 0.05, alpha: 1), rough: 0.5)
        let whiteM = HockeyModels.pbr(UIColor.white, rough: 0.3)
        let goldM = HockeyModels.pbr(UIColor(red: 0.95, green: 0.76, blue: 0.20, alpha: 1), rough: 0.22, metal: 1)

        init(_ c: Config) {
            cfg = c; st = c.style; u = c.u
            jerseyM = HockeyModels.pbr(st.jersey, rough: 0.85)
            stripeAM = HockeyModels.pbr(st.stripeA, rough: 0.8)
            stripeBM = HockeyModels.pbr(st.stripeB, rough: 0.8)
            pantsM = HockeyModels.pbr(st.pants, rough: 0.88)
            sockM = HockeyModels.pbr(st.sock, rough: 0.9)
            helmetM = HockeyModels.pbr(st.helmet, rough: 0.25, metal: 0.1)
            gloveM = HockeyModels.pbr(st.glove, rough: 0.8)
            let skinColor: UIColor = c.head == .human
                ? UIColor(red: 0.96, green: 0.78, blue: 0.64, alpha: 1) : c.fur
            skinM = HockeyModels.pbr(skinColor, rough: c.head == .human ? 0.6 : 0.9)
        }

        // --- примитивы (координаты v в долях u, у «абс»-вариантов — уже умноженные) ---
        func p(_ x: Float, _ y: Float, _ z: Float) -> V { V(x * u, y * u, z * u) }
        func s(_ v: Float) -> CGFloat { CGFloat(v * u) }

        @discardableResult
        func add(_ g: SCNGeometry, _ m: SCNMaterial, _ pos: V, parent: SCNNode? = nil) -> SCNNode {
            g.materials = [m]
            let n = SCNNode(geometry: g)
            n.simdPosition = pos
            (parent ?? root).addChildNode(n)
            return n
        }

        @discardableResult
        func ball(_ c: V, _ r: Float, _ sc: V = V(1, 1, 1), _ m: SCNMaterial, seg: Int = 24) -> SCNNode {
            let g = SCNSphere(radius: s(r)); g.segmentCount = seg
            let n = add(g, m, c)
            n.simdScale = sc
            return n
        }

        @discardableResult
        func seg(_ a: V, _ b: V, r: Float, _ m: SCNMaterial, capsule: Bool = true) -> SCNNode {
            let d = b - a
            let len = simd_length(d)
            let g: SCNGeometry
            if capsule {
                let c = SCNCapsule(capRadius: s(r), height: CGFloat(len) + s(r) * 2)
                c.radialSegmentCount = 14
                g = c
            } else {
                let c = SCNCylinder(radius: s(r), height: CGFloat(len)); c.radialSegmentCount = 14
                g = c
            }
            let n = add(g, m, (a + b) / 2)
            if len > 1e-5 { n.simdOrientation = simd_quatf(from: V(0, 1, 0), to: d / len) }
            return n
        }

        @discardableResult
        func band(_ a: V, _ b: V, t: Float, r: Float, h: Float, _ m: SCNMaterial) -> SCNNode {
            let d = b - a
            let len = simd_length(d)
            let c = SCNCylinder(radius: s(r), height: s(h)); c.radialSegmentCount = 16
            let n = add(c, m, a + d * t)
            if len > 1e-5 { n.simdOrientation = simd_quatf(from: V(0, 1, 0), to: d / len) }
            return n
        }

        @discardableResult
        func ring(y: Float, radius: Float, pipe: Float, sx: Float, sz: Float, _ m: SCNMaterial) -> SCNNode {
            let t = SCNTorus(ringRadius: s(radius), pipeRadius: s(pipe))
            t.ringSegmentCount = 32; t.pipeSegmentCount = 8
            let n = add(t, m, p(0, y, 0))
            n.simdScale = V(sx, 1, sz)
            return n
        }

        func box(_ w: Float, _ h: Float, _ l: Float, chamfer: Float, _ m: SCNMaterial, _ c: V) -> SCNNode {
            let b = SCNBox(width: s(w), height: s(h), length: s(l), chamferRadius: s(chamfer))
            b.chamferSegmentCount = 2
            return add(b, m, c)
        }

        // MARK: Сборка

        func build() -> SCNNode {
            switch cfg.role {
            case .goalie: buildGoalie()
            case .captain: buildSkater(stance: 0.095, torso: (1.15, 0.82, 1), pose: .captain)
            case .defender: buildSkater(stance: 0.125, torso: (1.28, 0.9, 1.04), pose: .defender)
            case .sniper: buildSkater(stance: 0.105, torso: (1.1, 0.8, 1), pose: .sniper)
            case .mascot: buildSkater(stance: 0.1, torso: (1.1, 0.85, 1), pose: .mascot)
            case .junior: buildSkater(stance: 0.095, torso: (1.1, 0.82, 1), pose: .junior)
            }
            return root
        }

        enum Pose { case captain, defender, sniper, mascot, junior }

        // Коньки: ботинок + держатель + хромированное лезвие
        func skates(stance: Float, out: Float = 0.03) {
            for side: Float in [-1, 1] {
                let x = side * stance
                let boot = box(0.092, 0.085, 0.25, chamfer: 0.03, bootM, p(x, 0.105, 0.035))
                boot.simdEulerAngles = V(0, side * out, 0)
                let cuff = SCNCylinder(radius: s(0.052), height: s(0.06)); cuff.radialSegmentCount = 16
                let cn = add(cuff, bootM, p(x, 0.16, -0.005))
                cn.simdScale = V(1, 1, 0.95)
                let toe = ball(p(x, 0.105, 0.14), 0.05, V(0.95, 0.8, 1), bootM)
                _ = toe
                box(0.016, 0.035, 0.20, chamfer: 0.005, chromeM, p(x, 0.054, 0.035))
                box(0.012, 0.03, 0.30, chamfer: 0.012, chromeM, p(x, 0.016, 0.04))
            }
        }

        // Ноги в форме: носки с полосами, штаны
        func legs(stance: Float, knee: Float = 0.015) {
            for side: Float in [-1, 1] {
                let x = side * stance
                let ankle = p(x, 0.17, -0.005)
                let kn = p(x * 1.04, 0.30, knee)
                let hip = p(x * 0.9, 0.43, 0)
                seg(ankle, kn, r: 0.05, sockM)
                band(ankle, kn, t: 0.35, r: 0.054, h: 0.022, stripeAM)
                band(ankle, kn, t: 0.58, r: 0.054, h: 0.022, stripeBM)
                band(ankle, kn, t: 0.81, r: 0.054, h: 0.022, stripeAM)
                seg(kn, hip, r: 0.075, pantsM)
            }
        }

        // Профиль свитера (r, y в долях u)
        func jerseyR(_ y: Float) -> Float {
            let pts: [(Float, Float)] = [(0.395, 0.152), (0.40, 0.162), (0.46, 0.157), (0.52, 0.150),
                                         (0.58, 0.165), (0.64, 0.172), (0.67, 0.160), (0.695, 0.116),
                                         (0.715, 0.078), (0.728, 0.064)]
            if y <= pts[0].0 { return pts[0].1 }
            for i in 1..<pts.count where y <= pts[i].0 {
                let a = pts[i - 1], b = pts[i]
                return a.1 + (b.1 - a.1) * (y - a.0) / (b.0 - a.0)
            }
            return pts.last!.1
        }

        // Туловище: свитер + полосы + нашивки; возвращает полуширину плеч
        @discardableResult
        func torso(sx: Float, sz: Float, bulk: Float, emblem: Bool = true) -> Float {
            ball(p(0, 0.425, 0), 0.155, V(1.1 * bulk, 0.62, 0.84 * bulk), pantsM)
            var prof: [(Float, Float)] = [(0.395, 0.152), (0.40, 0.162), (0.46, 0.157), (0.52, 0.150),
                                          (0.58, 0.165), (0.64, 0.172), (0.67, 0.160), (0.695, 0.116),
                                          (0.715, 0.078), (0.728, 0.064), (0.0, 0.73)]
            prof = prof.map { ($0.0 * u * bulk, $0.1 * u) }
            // профиль задан в (y, r) → перекладываем в (r, y)
            let pr: [(Float, Float)] = [(0.152, 0.395), (0.162, 0.40), (0.157, 0.46), (0.150, 0.52), (0.165, 0.58),
                                        (0.172, 0.64), (0.160, 0.67), (0.116, 0.695), (0.078, 0.715), (0.064, 0.728), (0.0, 0.735)]
                .map { ($0.0 * u * bulk, $0.1 * u) }
            _ = prof
            let g = HockeyModels.lathe(pr)
            let tn = add(g, jerseyM, V(0, 0, 0))
            tn.simdScale = V(sx, 1, sz)
            // полосы на подоле и груди
            func stripeRing(_ y: Float, _ pipe: Float, _ m: SCNMaterial) {
                ring(y: y, radius: jerseyR(y) * bulk + pipe * 0.15, pipe: pipe, sx: sx, sz: sz, m)
            }
            stripeRing(0.415, 0.011, stripeAM)
            stripeRing(0.44, 0.009, stripeBM)
            stripeRing(0.462, 0.011, stripeAM)
            // шея, воротник
            seg(p(0, 0.72, 0), p(0, 0.78, 0), r: 0.045, skinM, capsule: false)
            ring(y: 0.727, radius: 0.066 * bulk, pipe: 0.012, sx: sx * 0.95, sz: sz * 0.95, stripeAM)
            // плечевые накладки
            let shX = 0.178 * sx * bulk
            for side: Float in [-1, 1] {
                ball(p(side * shX, 0.655, 0), 0.062 * bulk, V(1, 0.9, 1), jerseyM)
            }
            // нашивки: перед и спина
            let zf = jerseyR(0.56) * bulk * sz + 0.004 * u
            let w = 0.19 * u * bulk, h = 0.24 * u * bulk
            let front = SCNPlane(width: CGFloat(w), height: CGFloat(h))
            let fm = SCNMaterial(); fm.lightingModel = .physicallyBased
            fm.diffuse.contents = HockeyModels.decal(club: st.club, number: st.number, emblem: emblem, text: .white)
            fm.roughness.contents = 0.85; fm.metalness.contents = 0.0
            front.materials = [fm]
            let fn = SCNNode(geometry: front)
            fn.simdPosition = p(0, 0.555, 0); fn.simdPosition.z = zf
            fn.simdEulerAngles = V(-0.04, 0, 0)
            root.addChildNode(fn)
            let back = SCNPlane(width: CGFloat(w * 1.25), height: CGFloat(h * 1.0))
            let bm = SCNMaterial(); bm.lightingModel = .physicallyBased
            bm.diffuse.contents = HockeyModels.decal(club: st.club, number: st.number, emblem: false, text: .white)
            bm.roughness.contents = 0.85
            back.materials = [bm]
            let bn = SCNNode(geometry: back)
            bn.simdPosition = p(0, 0.56, 0); bn.simdPosition.z = -zf
            bn.eulerAngles.y = .pi
            root.addChildNode(bn)
            return shX / u
        }

        // Рука: плечо → локоть → кисть. Рукав-свитер с полосами, краги.
        func arm(shoulder: V, hand: V, side: Float, glove: Bool = true) {
            let d = hand - shoulder
            var dist = simd_length(d)
            let reach = 0.19 * u
            let L = max(reach, dist * 0.52)
            dist = min(dist, 2 * L * 0.995)
            let mid = shoulder + d / simd_length(d) * (dist / 2)
            let hh = sqrtf(max(L * L - (dist / 2) * (dist / 2), 0))
            var bend = V(side * 0.8, -0.55, -0.35)
            let dn = d / simd_length(d)
            bend = bend - dn * simd_dot(bend, dn)
            bend = simd_normalize(bend)
            let elbow = mid + bend * hh
            seg(shoulder, elbow, r: 0.046, jerseyM)
            band(shoulder, elbow, t: 0.55, r: 0.05, h: 0.026, stripeAM)
            band(shoulder, elbow, t: 0.8, r: 0.05, h: 0.016, stripeBM)
            seg(elbow, hand, r: 0.04, jerseyM)
            if glove {
                band(elbow, hand, t: 0.82, r: 0.048, h: 0.026, stripeAM)
                let g = ball(hand, 0.052, V(1, 0.9, 1.1), gloveM)
                _ = g
            }
        }

        // Клюшка: от верха butt до пятки heel; крюк лежит вдоль bladeDir. Возвращает кончик крюка.
        @discardableResult
        func stick(butt: V, heel: V, bladeDir: V = V(0, 0, 1), length: Float = 0.19, goalie: Bool = false) -> V {
            let bd = simd_normalize(bladeDir)
            let H: Float = goalie ? 0.11 : 0.072
            let shape = UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: CGFloat(length * u), height: CGFloat(H * u)),
                                     byRoundingCorners: [.topRight, .bottomRight], cornerRadii: CGSize(width: CGFloat(H * u * 0.5), height: CGFloat(H * u * 0.5)))
            shape.flatness = 0.002
            let g = SCNShape(path: shape, extrusionDepth: s(0.018))
            g.chamferRadius = CGFloat(0.003 * u)
            let n = add(g, bladeM, heel)
            let q = simd_quatf(from: V(1, 0, 0), to: bd)
            n.simdOrientation = q
            // лента на крюке
            let tape = SCNBox(width: s(length * 0.62), height: s(H * 0.96), length: s(0.03), chamferRadius: s(0.004))
            tape.materials = [tapeM]
            let tn = SCNNode(geometry: tape)
            tn.simdPosition = V(length * u * 0.55, H * u * 0.5, 0)
            n.addChildNode(tn)
            let top = heel + q.act(V(0, H * u * 0.7, 0)) + bd * 0.0
            seg(butt, top, r: goalie ? 0.016 : 0.013, woodM, capsule: false)
            // лента на рукояти и намотка
            band(butt, top, t: 0.04, r: 0.017, h: 0.04, tapeM)
            band(butt, top, t: 0.14, r: 0.0155, h: 0.02, tapeM)
            band(butt, top, t: 0.9, r: 0.0155, h: 0.02, stripeBM)
            return heel + bd * (length * u)
        }

        func puck(_ c: V) {
            let g = SCNCylinder(radius: s(0.036), height: s(0.02)); g.radialSegmentCount = 20
            add(g, darkM, c)
        }

        // MARK: Голова

        func head(hc: V, tilt: Float = 0, cage: Bool = false) {
            let hs = cfg.headScale
            let r: Float = 0.125 * hs
            switch cfg.head {
            case .human: humanHead(hc: hc, r: r, cage: cage)
            case .fox: foxHead(hc: hc, r: r)
            case .hawk: hawkHead(hc: hc, r: r)
            }
        }

        func eyes(hc: V, r: Float, spread: Float, dy: Float, size: Float, iris: UIColor = UIColor(white: 0.08, alpha: 1)) {
            let irisM = HockeyModels.pbr(iris, rough: 0.2)
            for side: Float in [-1, 1] {
                let x = side * spread * r, y = dy * r
                let z = sqrtf(max(r * r - x * x - y * y, 0.0001) )
                let c = hc + p(0, 0, 0) + V(x, y, z * 0.985 / 1) * 1
                _ = c
                let center = V(hc.x + x * u, hc.y + y * u, hc.z + z * u * 0.97)
                ball(center, size * r, V(0.85, 1.15, 0.5), whiteM, seg: 16)
                ball(center + V(side * -0.003, 0, 0.0035) * u + V(0, 0, 0.0) , size * r * 0.62, V(0.9, 1.0, 0.5), irisM, seg: 14)
                ball(center + V(0.004 * u, 0.008 * u, 0.007 * u), size * r * 0.2, V(1, 1, 0.5), whiteM, seg: 8)
            }
        }

        func humanHead(hc: V, r: Float, cage: Bool) {
            ball(hc, r, V(1, 1.04, 1), skinM, seg: 28)
            // лицо
            eyes(hc: hc, r: r, spread: 0.38, dy: 0.02, size: 0.2)
            let browM = HockeyModels.pbr(UIColor(red: 0.3, green: 0.18, blue: 0.1, alpha: 1), rough: 0.8)
            for side: Float in [-1, 1] {
                let b = box(0.05, 0.012, 0.012, chamfer: 0.004, browM, hc + V(side * 0.4 * r * u, 0.3 * r * u, 0.9 * r * u))
                b.simdEulerAngles = V(0, 0, side * -0.12)
            }
            ball(hc + V(0, -0.1 * r * u, 0.99 * r * u), 0.12 * r, V(1, 0.9, 0.9), HockeyModels.pbr(UIColor(red: 0.93, green: 0.65, blue: 0.54, alpha: 1), rough: 0.6), seg: 12)
            let mouth = box(0.045, 0.011, 0.01, chamfer: 0.004, HockeyModels.pbr(UIColor(red: 0.6, green: 0.2, blue: 0.2, alpha: 1), rough: 0.6),
                            hc + V(0, -0.45 * r * u, 0.88 * r * u))
            mouth.simdEulerAngles = V(0.15, 0, 0)
            for side: Float in [-1, 1] {
                ball(hc + V(side * 0.55 * r * u, -0.25 * r * u, 0.78 * r * u), 0.17 * r, V(1, 0.8, 0.4),
                     HockeyModels.pbr(UIColor(red: 0.98, green: 0.62, blue: 0.58, alpha: 1), rough: 0.7), seg: 10)
            }
            // шлем: купол, чуть откинутый назад, + наушники
            let hg = HockeyModels.lathe(HockeyModels.dome(radius: r * 1.1 * u / u))
            let helmet = add(hg, helmetM, hc + V(0, 0.08 * r * u, -0.02 * r * u))
            helmet.simdScale = V(u, u, u)
            helmet.simdEulerAngles = V(-0.3, 0, 0)
            helmet.geometry?.firstMaterial?.isDoubleSided = true
            for side: Float in [-1, 1] {
                box(0.035, 0.1 * r / 0.125 * 0.9, 0.075, chamfer: 0.012, helmetM, hc + V(side * 1.02 * r * u, -0.02 * r * u, -0.05 * r * u))
            }
            // полоска на шлеме
            let stripe = box(0.026, 0.01, 0.2, chamfer: 0.004, stripeBM, hc + V(0, 1.1 * r * u * 0.96, -0.02 * r * u))
            stripe.simdEulerAngles = V(0.0, 0, 0)
            _ = stripe
            if cage {
                let cageM = HockeyModels.pbr(UIColor(white: 0.85, alpha: 1), rough: 0.25, metal: 1)
                let R = r * 1.1
                for yy: Float in [-0.5, -0.15, 0.2] {
                    let t = SCNTorus(ringRadius: s(R), pipeRadius: s(0.0045)); t.pipeSegmentCount = 6; t.ringSegmentCount = 30
                    let n = add(t, cageM, hc + V(0, yy * r * u, 0.0))
                    n.simdScale = V(1, 1, 1.0)
                }
                for i in -3...3 {
                    let a = Float(i) * 0.26
                    let x = sinf(a) * R * u, z = cosf(a) * R * u
                    let bar = SCNCylinder(radius: s(0.0045), height: s(r * 0.95)); bar.radialSegmentCount = 6
                    add(bar, cageM, hc + V(x, -0.15 * r * u, z))
                }
            } else {
                // прозрачный козырёк
                let visor = SCNBox(width: s(r * 2.0), height: s(r * 0.78), length: s(0.012), chamferRadius: s(0.005))
                let vm = SCNMaterial(); vm.lightingModel = .physicallyBased
                vm.diffuse.contents = UIColor(red: 0.7, green: 0.85, blue: 1, alpha: 0.28)
                vm.transparency = 0.5; vm.roughness.contents = 0.05; vm.metalness.contents = 0.0
                vm.writesToDepthBuffer = false
                visor.materials = [vm]
                let vn = SCNNode(geometry: visor)
                vn.simdPosition = hc + V(0, 0.0, 1.08 * r * u)
                vn.simdEulerAngles = V(0.1, 0, 0)
                vn.renderingOrder = 5
                root.addChildNode(vn)
            }
        }

        func foxHead(hc: V, r: Float) {
            let fur = skinM
            let white = HockeyModels.pbr(UIColor(white: 0.97, alpha: 1), rough: 0.9)
            ball(hc, r * 1.12, V(1.12, 0.98, 1.0), fur, seg: 28)
            for side: Float in [-1, 1] {
                ball(hc + V(side * 0.7 * r * u, -0.28 * r * u, 0.62 * r * u), r * 0.62, V(1, 0.8, 0.8), white, seg: 16)
            }
            // морда
            let snout = SCNCone(topRadius: s(0.006), bottomRadius: s(r * 0.46), height: s(r * 1.05))
            snout.radialSegmentCount = 18
            let sn = add(snout, white, hc + V(0, -0.2 * r * u, 1.25 * r * u))
            sn.simdEulerAngles = V(.pi / 2, 0, 0)
            sn.simdScale = V(1, 1, 0.8)
            ball(hc + V(0, -0.12 * r * u, 1.85 * r * u), r * 0.17, V(1.1, 0.85, 1), darkM, seg: 12)
            // уши
            let inner = HockeyModels.pbr(UIColor(red: 0.25, green: 0.12, blue: 0.1, alpha: 1), rough: 0.9)
            for side: Float in [-1, 1] {
                let ear = SCNCone(topRadius: s(0.004), bottomRadius: s(r * 0.55), height: s(r * 1.5)); ear.radialSegmentCount = 16
                let en = add(ear, fur, hc + V(side * 0.72 * r * u, 1.1 * r * u, -0.12 * r * u))
                en.simdEulerAngles = V(-0.12, 0, side * -0.28)
                en.simdScale = V(1, 1, 0.55)
                let ei = SCNCone(topRadius: s(0.003), bottomRadius: s(r * 0.32), height: s(r * 1.05)); ei.radialSegmentCount = 12
                let eni = add(ei, inner, hc + V(side * 0.72 * r * u, 1.0 * r * u, -0.02 * r * u))
                eni.simdEulerAngles = V(-0.12, 0, side * -0.28)
                eni.simdScale = V(1, 1, 0.5)
            }
            eyes(hc: hc, r: r * 1.1, spread: 0.46, dy: 0.18, size: 0.2, iris: UIColor(white: 0.05, alpha: 1))
        }

        func hawkHead(hc: V, r: Float) {
            let fur = skinM
            let beakM = HockeyModels.pbr(UIColor(red: 0.98, green: 0.78, blue: 0.14, alpha: 1), rough: 0.35)
            let lightM = HockeyModels.pbr(UIColor(red: 0.93, green: 0.88, blue: 0.80, alpha: 1), rough: 0.9)
            ball(hc, r * 1.12, V(1.08, 1.0, 1.0), fur, seg: 28)
            ball(hc + V(0, -0.35 * r * u, 0.5 * r * u), r * 0.8, V(1, 0.75, 0.8), lightM, seg: 16)
            // клюв
            let beak = SCNCone(topRadius: s(0.004), bottomRadius: s(r * 0.42), height: s(r * 1.1)); beak.radialSegmentCount = 16
            let bn = add(beak, beakM, hc + V(0, -0.08 * r * u, 1.25 * r * u))
            bn.simdEulerAngles = V(.pi / 2 + 0.25, 0, 0)
            bn.simdScale = V(0.9, 1, 1.0)
            let hook = SCNCone(topRadius: s(0.003), bottomRadius: s(r * 0.22), height: s(r * 0.5)); hook.radialSegmentCount = 12
            let hn = add(hook, beakM, hc + V(0, -0.38 * r * u, 1.78 * r * u))
            hn.simdEulerAngles = V(.pi, 0, 0)
            // хохолок
            for i in -1...1 {
                let c = SCNCone(topRadius: s(0.002), bottomRadius: s(r * 0.22), height: s(r * 0.8)); c.radialSegmentCount = 10
                let cn = add(c, fur, hc + V(Float(i) * 0.3 * r * u, 1.0 * r * u, -0.45 * r * u))
                cn.simdEulerAngles = V(-0.7, 0, Float(i) * -0.3)
            }
            // глаза с суровыми бровями
            let yellow = UIColor(red: 1, green: 0.85, blue: 0.1, alpha: 1)
            eyes(hc: hc, r: r * 1.1, spread: 0.5, dy: 0.2, size: 0.24, iris: yellow)
            for side: Float in [-1, 1] {
                let b = box(0.085, 0.02, 0.03, chamfer: 0.006, darkM, hc + V(side * 0.5 * r * 1.1 * u, 0.55 * r * u, 0.88 * r * u))
                b.simdEulerAngles = V(0.1, 0, side * 0.45)
            }
            // маленький шлем-повязка в цвет формы
            let band = ring(y: 0, radius: 0, pipe: 0, sx: 1, sz: 1, jerseyM)
            band.removeFromParentNode()
            let hb = SCNTorus(ringRadius: s(r * 1.1), pipeRadius: s(0.016)); hb.ringSegmentCount = 30
            let hbn = add(hb, stripeAM, hc + V(0, 0.55 * r * u, -0.02 * r * u))
            hbn.simdScale = V(1.05, 1, 1)
        }

        // MARK: Скейтер

        func buildSkater(stance: Float, torso t: (Float, Float, Float), pose: Pose) {
            skates(stance: stance)
            legs(stance: stance)
            let shX = torso(sx: t.0, sz: t.1, bulk: t.2, emblem: true)
            let headZ: Float = cfg.role == .mascot ? 0.03 : 0.0
            let hc = p(0, 0.835 + (cfg.role == .junior ? -0.02 : 0), headZ)

            let shL = p(-shX, 0.655, 0), shR = p(shX, 0.655, 0)

            switch pose {
            case .junior:
                let butt = p(0.13, 0.56, 0.12), heel = p(0.2, 0.0, 0.36)
                let tip = stick(butt: butt, heel: heel, bladeDir: V(0, 0, 1), length: 0.2)
                puck(tip - V(0.0, -0.01 * u, 0.045 * u) + V(0, 0, 0))
                arm(shoulder: shR, hand: butt + (heel - butt) * 0.25 - V(0, 0, 0), side: 1)
                arm(shoulder: shL, hand: p(0.03, 0.56, 0.17), side: -1)

            case .defender:
                let butt = p(-0.2, 0.74, 0.22), heel = p(0.27, 0.02, 0.2)
                _ = stick(butt: butt, heel: heel, bladeDir: V(0.35, 0, 1), length: 0.2)
                arm(shoulder: shL, hand: butt + (heel - butt) * 0.15, side: -1)
                arm(shoulder: shR, hand: butt + (heel - butt) * 0.4, side: 1)

            case .sniper:
                let butt = p(-0.09, 0.50, 0.24), heel = p(0.2, 0.96, -0.3)
                let tip = stick(butt: butt, heel: heel, bladeDir: V(0.1, -0.55, 0.6), length: 0.2)
                _ = tip
                puck(p(0.1, 0.012, 0.3))
                arm(shoulder: shL, hand: butt + (heel - butt) * 0.12, side: -1)
                arm(shoulder: shR, hand: butt + (heel - butt) * 0.4, side: 1)

            case .captain:
                let butt = p(-0.2, 0.56, 0.1), heel = p(-0.25, 0.0, 0.26)
                _ = stick(butt: butt, heel: heel, bladeDir: V(0, 0, 1), length: 0.2)
                arm(shoulder: shL, hand: butt + (heel - butt) * 0.1, side: -1)
                // правая рука поднимает кубок
                let handUp = p(shX + 0.03, 0.93, 0.05)
                arm(shoulder: shR, hand: handUp, side: 1)
                cup(at: handUp + p(0, 0.05, 0))
                // нашивка «C» на левой стороне груди
                captainPatch(shX: shX)

            case .mascot:
                let butt = p(0.14, 0.58, 0.12), heel = p(0.24, 0.0, 0.3)
                _ = stick(butt: butt, heel: heel, bladeDir: V(0, 0, 1), length: 0.2)
                arm(shoulder: shR, hand: butt + (heel - butt) * 0.22, side: 1)
                arm(shoulder: shL, hand: p(0.02, 0.58, 0.2), side: -1)
                mascotTail(hc: hc)
            }
            head(hc: hc)
        }

        func cup(at c: V) {
            let prof: [(Float, Float)] = [(0.0, 0.0), (0.05, 0.0), (0.055, 0.012), (0.02, 0.025), (0.016, 0.07),
                                          (0.05, 0.085), (0.075, 0.13), (0.085, 0.19), (0.07, 0.205), (0.0, 0.205)]
            let g = HockeyModels.lathe(prof.map { ($0.0 * u, $0.1 * u) }, segments: 22)
            let n = add(g, goldM, c)
            _ = n
            for side: Float in [-1, 1] {
                let t = SCNTorus(ringRadius: s(0.035), pipeRadius: s(0.008)); t.pipeSegmentCount = 6; t.ringSegmentCount = 16
                let tn = add(t, goldM, c + V(side * 0.09 * u, 0.15 * u, 0))
                tn.simdEulerAngles = V(0, .pi / 2, 0)
            }
        }

        func captainPatch(shX: Float) {
            let g = SCNCylinder(radius: s(0.036), height: s(0.012)); g.radialSegmentCount = 20
            let m = HockeyModels.pbr(UIColor(red: 0.95, green: 0.76, blue: 0.2, alpha: 1), rough: 0.5)
            let z = jerseyR(0.62) * 0.82 * 1.15 * u + 0.002 * u
            let pn = add(g, m, p(0.09, 0.62, 0))
            pn.simdPosition.z = z
            pn.simdEulerAngles = V(.pi / 2, 0, 0)
            let pl = SCNPlane(width: s(0.06), height: s(0.06))
            let pm = SCNMaterial(); pm.lightingModel = .physicallyBased
            let img = UIGraphicsImageRenderer(size: CGSize(width: 128, height: 128)).image { _ in
                HockeyModels.drawText("C", in: CGRect(x: 0, y: 0, width: 128, height: 128), size: 112,
                                      color: UIColor(white: 0.05, alpha: 1), stroke: nil)
            }
            pm.diffuse.contents = img
            pl.materials = [pm]
            let pln = SCNNode(geometry: pl)
            pln.simdPosition = p(0.09, 0.62, 0); pln.simdPosition.z = z + 0.008 * u
            root.addChildNode(pln)
        }

        func mascotTail(hc: V) {
            if cfg.head == .fox {
                let tailM = skinM
                let white = HockeyModels.pbr(UIColor(white: 0.97, alpha: 1), rough: 0.9)
                let a = p(0, 0.42, -0.15), b = p(0, 0.62, -0.36)
                seg(a, b, r: 0.075, tailM)
                ball(b + p(0, 0.05, -0.02), 0.085, V(1, 1.15, 1), white)
            } else {
                // веер хвостовых перьев
                let fm = skinM
                for i in -2...2 {
                    let a = Float(i) * 0.22
                    let f = box(0.05, 0.015, 0.24, chamfer: 0.006, fm, p(sinf(a) * 0.1, 0.46, -0.2 - cosf(a) * 0.04))
                    f.simdEulerAngles = V(-0.35, -a, 0)
                }
                let tip = HockeyModels.pbr(UIColor(red: 0.85, green: 0.1, blue: 0.14, alpha: 1), rough: 0.7)
                ball(p(0, 0.46, -0.18), 0.045, V(1.5, 0.6, 1), tip, seg: 10)
                // крылья-накладки на спине
                for side: Float in [-1, 1] {
                    let w = box(0.04, 0.22, 0.14, chamfer: 0.012, fm, p(side * 0.17, 0.57, -0.1))
                    w.simdEulerAngles = V(0.2, 0, side * -0.25)
                }
            }
        }

        // MARK: Вратарь

        func buildGoalie() {
            let stance: Float = 0.125
            // коньки видны под щитками
            skates(stance: stance, out: 0.0)
            // ноги: штаны + огромные щитки
            for side: Float in [-1, 1] {
                let x = side * stance
                seg(p(x * 0.9, 0.43, 0), p(x * 1.0, 0.30, 0.01), r: 0.085, pantsM)
                let pad = box(0.135, 0.37, 0.115, chamfer: 0.045, whiteM, p(x * 1.06, 0.255, 0.035))
                pad.simdScale = V(1, 1, 1)
                let padInner = box(0.04, 0.3, 0.02, chamfer: 0.01, stripeAM, p(x * 1.06 + side * 0.02, 0.27, 0.095))
                padInner.simdScale = V(1, 1, 1)
                // горизонтальные полосы щитка
                for yy: Float in [0.15, 0.22, 0.29] {
                    box(0.14, 0.018, 0.12, chamfer: 0.006, stripeAM, p(x * 1.06, yy, 0.035))
                }
                // наколенник
                let kn = SCNCylinder(radius: s(0.05), height: s(0.15)); kn.radialSegmentCount = 18
                let kn2 = add(kn, stripeAM, p(x * 1.06, 0.405, 0.045))
                kn2.simdEulerAngles = V(0, 0, .pi / 2)
                ball(p(x * 1.06, 0.405, 0.1), 0.045, V(1.2, 1, 0.5), stripeBM)
            }
            let shX = torso(sx: 1.32, sz: 1.0, bulk: 1.08, emblem: true)
            let hc = p(0, 0.835, 0.0)
            head(hc: hc, cage: true)
            // правая рука: блин-блокер и клюшка
            let shR = p(shX, 0.655, 0), shL = p(-shX, 0.655, 0)
            let butt = p(0.2, 0.60, 0.2), heel = p(0.2, 0.0, 0.38)
            _ = stick(butt: butt, heel: heel, bladeDir: V(0, 0, 1), length: 0.22, goalie: true)
            // широкая лопасть вратарской клюшки
            let paddle = box(0.05, 0.28, 0.018, chamfer: 0.006, woodM, p(0.2, 0.14, 0.355))
            _ = paddle
            let handR = p(0.27, 0.5, 0.2)
            arm(shoulder: shR, hand: handR, side: 1, glove: false)
            let blocker = box(0.12, 0.17, 0.05, chamfer: 0.02, whiteM, handR + p(0.0, 0.0, 0.04))
            blocker.simdEulerAngles = V(0.2, 0, 0)
            box(0.1, 0.04, 0.055, chamfer: 0.01, stripeAM, handR + p(0.0, 0.03, 0.05)).simdEulerAngles = V(0.2, 0, 0)
            // левая рука: ловушка
            let handL = p(-0.3, 0.5, 0.22)
            arm(shoulder: shL, hand: handL, side: -1, glove: false)
            let trap = ball(handL + p(0, 0.0, 0.05), 0.095, V(1.05, 1.15, 0.45), stripeAM)
            _ = trap
            let pocket = ball(handL + p(0, 0, 0.075), 0.06, V(1, 1.1, 0.4), stripeBM)
            _ = pocket
            // шайба
            puck(p(0.17, 0.012, 0.57))
        }
    }
}
