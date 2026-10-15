import SceneKit
import UIKit

/// Тема «Тачки»: процедурные мультяшные персонажи.
/// Кузов — выдавленный (SCNShape) гладкий боковой силуэт с арками колёс, отдельная кабина,
/// колёса с шиной/диском/болтами, глаза на лобовом стекле, рот на бампере, наклейки (CoreGraphics → SCNPlane).
/// Машинка смотрит в +z, стоит на y=0.
enum CarsModels {

    // MARK: - API

    private static var protoCache: [Int: SCNNode] = [:]

    static func make(kind: PieceKind, color: PieceColor) -> SCNNode {
        let key = Int(kind.rawValue) * 2 + (color == .white ? 0 : 1)
        if let p = protoCache[key] { return p.clone() }
        let def: Def?
        switch (color, kind) {
        case (.white, .king):   def = lightning()     // Молния Маккуин
        case (.white, .queen):  def = sally()         // Салли
        case (.white, .rook):   def = mack()          // Мак
        case (.white, .bishop): def = doc()           // Док Хадсон
        case (.white, .knight): def = mater()         // Мэтр
        case (.white, .pawn):   def = luigi()         // Луиджи
        case (.black, .king):   def = chick()         // Чик Хикс
        case (.black, .queen):  def = storm()         // Джексон Шторм
        case (.black, .rook):   def = frank()         // Фрэнк
        case (.black, .bishop): def = professorZ()    // Профессор Зет
        case (.black, .knight): def = boost()         // Бууст
        case (.black, .pawn):   def = tractor()       // Трактор
        case (_, .none):        def = nil
        }
        guard let d = def else { return SCNNode() }
        // Склеиваем в один узел (по одному элементу на материал): ~5000 узлов на доске были бы тяжелы для мобильного GPU.
        let proto = hoisted(buildCar(d)).flattenedClone()
        protoCache[key] = proto
        return proto.clone()
    }

    /// flattenedClone теряет вложенные узлы-контейнеры, поэтому сначала переносим все геометрии в плоский список с мировыми трансформами.
    private static func hoisted(_ root: SCNNode) -> SCNNode {
        let out = SCNNode()
        root.enumerateHierarchy { n, _ in
            if let g = n.geometry {
                let c = SCNNode(geometry: g)
                c.pivot = n.pivot
                c.transform = n.worldTransform
                out.addChildNode(c)
            }
        }
        return out
    }

    // MARK: - Типы

    private struct KP { var p: CGPoint; var sharp: Bool }
    private static func P(_ z: CGFloat, _ y: CGFloat) -> KP { KP(p: CGPoint(x: z, y: y), sharp: false) }
    private static func S(_ z: CGFloat, _ y: CGFloat) -> KP { KP(p: CGPoint(x: z, y: y), sharp: true) }

    private struct Wheel {
        var z: CGFloat
        var r: CGFloat
        var w: CGFloat
        var arch = true
        var track: CGFloat? = nil      // полная колея (по внешним граням); nil — ширина кузова
        var whitewall = false
        var hub: UIColor = UIColor(red: 0.85, green: 0.85, blue: 0.88, alpha: 1)
    }

    private enum Mouth { case buck, grin, smile, teeth, none }

    private struct Def {
        var color: UIColor
        var L: CGFloat
        var W: CGFloat                  // ширина кузова
        var belly: CGFloat = 0.045
        var top: [KP]
        var cabin: [KP]
        var cabW: CGFloat
        var wheels: [Wheel]
        var eyeR: CGFloat? = nil
        var eyeSpread: CGFloat? = nil
        var iris: UIColor = UIColor(red: 0.2, green: 0.5, blue: 0.9, alpha: 1)
        var brow: CGFloat = 0
        var mouth: Mouth = .smile
        var mouthY: CGFloat = 0.13
        var mouthW: CGFloat = 0.16
        var lampY: CGFloat = 0.17
        var lampX: CGFloat = 0.14
        var lampR: CGFloat = 0.03
        var bubble = false
        var chamfer: CGFloat = 0.02
        var bumper = true
        var rearBumper = true
        var winScaleZ: CGFloat = 0.86
        var winScaleY: CGFloat = 0.72
        var extras: ((SCNNode, Def) -> Void)? = nil
        var zFront: CGFloat { top.map { $0.p.x }.max()! }
        var zRear: CGFloat { top.map { $0.p.x }.min()! }
    }

    // MARK: - Материалы

    private static func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> UIColor {
        UIColor(red: r, green: g, blue: b, alpha: a)
    }

    private static func paint(_ c: UIColor, metal: CGFloat = 0.3, rough: CGFloat = 0.2) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = c
        m.metalness.contents = metal
        m.roughness.contents = rough
        m.clearCoat.contents = 0.8
        m.clearCoatRoughness.contents = 0.08
        return m
    }

    private static let chromeMat: SCNMaterial = {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = rgb(0.9, 0.92, 0.95)
        m.metalness.contents = 0.6
        m.roughness.contents = 0.16
        m.emission.contents = rgb(0.2, 0.21, 0.23)
        return m
    }()
    private static let rubberMat: SCNMaterial = {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = rgb(0.07, 0.07, 0.08)
        m.metalness.contents = 0
        m.roughness.contents = 0.85
        return m
    }()
    private static let blackMat: SCNMaterial = {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = rgb(0.06, 0.06, 0.07)
        m.metalness.contents = 0.2
        m.roughness.contents = 0.5
        return m
    }()
    private static let glassMat: SCNMaterial = {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = rgb(0.13, 0.22, 0.33)
        m.metalness.contents = 0.5
        m.roughness.contents = 0.08
        m.emission.contents = rgb(0.03, 0.06, 0.1)
        return m
    }()
    private static let bubbleMat: SCNMaterial = {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = rgb(0.55, 0.75, 0.9, 0.35)
        m.metalness.contents = 0.3
        m.roughness.contents = 0.05
        m.transparency = 0.45
        m.writesToDepthBuffer = false
        return m
    }()
    private static let whiteMat: SCNMaterial = {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = rgb(0.98, 0.98, 0.98)
        m.metalness.contents = 0
        m.roughness.contents = 0.25
        m.emission.contents = rgb(0.22, 0.22, 0.22)
        return m
    }()
    private static func lampMat(_ c: UIColor = rgb(1, 0.96, 0.75)) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .constant
        m.diffuse.contents = c
        m.emission.contents = c
        return m
    }
    private static let sharedLamp: SCNMaterial = lampMat()
    private static func flat(_ c: UIColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = c
        m.metalness.contents = 0
        m.roughness.contents = 0.6
        return m
    }

    // MARK: - Геометрические помощники

    private static func vec(_ x: CGFloat, _ y: CGFloat, _ z: CGFloat) -> SCNVector3 {
        SCNVector3(Float(x), Float(y), Float(z))
    }

    /// Эрмитов сплайн через ключевые точки; «острые» точки держат хорду.
    private static func hermite(_ pts: [KP], steps: Int = 7) -> [CGPoint] {
        let n = pts.count
        guard n > 1 else { return pts.map { $0.p } }
        func sub(_ a: CGPoint, _ b: CGPoint) -> CGPoint { CGPoint(x: a.x - b.x, y: a.y - b.y) }
        func tanIn(_ i: Int) -> CGPoint {
            if pts[i].sharp || i == n - 1 { return sub(pts[i].p, pts[i - 1].p) }
            let d = sub(pts[i + 1].p, pts[i - 1].p)
            let a = hypot(pts[i].p.x - pts[i - 1].p.x, pts[i].p.y - pts[i - 1].p.y)
            let b = hypot(pts[i + 1].p.x - pts[i].p.x, pts[i + 1].p.y - pts[i].p.y)
            let k = a / max(a + b, 0.0001)
            return CGPoint(x: d.x * k, y: d.y * k)
        }
        func tanOut(_ i: Int) -> CGPoint {
            if pts[i].sharp || i == 0 { return sub(pts[i + 1].p, pts[i].p) }
            let d = sub(pts[i + 1].p, pts[i - 1].p)
            let a = hypot(pts[i].p.x - pts[i - 1].p.x, pts[i].p.y - pts[i - 1].p.y)
            let b = hypot(pts[i + 1].p.x - pts[i].p.x, pts[i + 1].p.y - pts[i].p.y)
            let k = b / max(a + b, 0.0001)
            return CGPoint(x: d.x * k, y: d.y * k)
        }
        var out: [CGPoint] = [pts[0].p]
        for i in 0..<(n - 1) {
            let p0 = pts[i].p, p1 = pts[i + 1].p
            let m0 = tanOut(i), m1 = tanIn(i + 1)
            for s in 1...steps {
                let t = CGFloat(s) / CGFloat(steps)
                let t2 = t * t, t3 = t2 * t
                let h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t
                let h01 = -2 * t3 + 3 * t2, h11 = t3 - t2
                out.append(CGPoint(x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
                                   y: h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y))
            }
        }
        return out
    }

    private static func bodyPath(_ d: Def) -> UIBezierPath {
        let path = UIBezierPath()
        let pts = hermite(d.top)
        path.move(to: pts[0])
        for p in pts.dropFirst() { path.addLine(to: p) }
        for w in d.wheels.filter({ $0.arch }).sorted(by: { $0.z > $1.z }) {
            let ra = w.r + 0.014
            let dy = d.belly - w.r
            let dx = sqrt(max(0.0001, ra * ra - dy * dy))
            path.addLine(to: CGPoint(x: w.z + dx, y: d.belly))
            let a1 = atan2(dy, dx), a2 = CGFloat.pi - a1
            let n = 16
            for i in 1...n {
                let a = a1 + (a2 - a1) * CGFloat(i) / CGFloat(n)
                path.addLine(to: CGPoint(x: w.z + ra * cos(a), y: w.r + ra * sin(a)))
            }
        }
        path.close()
        return path
    }

    private static func cabinPath(_ pts: [KP], baseY: CGFloat) -> UIBezierPath {
        let path = UIBezierPath()
        let h = hermite(pts)
        path.move(to: h[0])
        for p in h.dropFirst() { path.addLine(to: p) }
        path.addLine(to: CGPoint(x: h.last!.x, y: baseY))
        path.addLine(to: CGPoint(x: h[0].x, y: baseY))
        path.close()
        return path
    }

    /// Выдавливание силуэта: форма в XY (x — длина), результат повёрнут так, что длина идёт по +Z.
    private static func extrude(_ path: UIBezierPath, depth: CGFloat, chamfer: CGFloat, _ mat: SCNMaterial) -> SCNNode {
        let shape = SCNShape(path: path, extrusionDepth: depth)
        shape.chamferRadius = chamfer
        shape.materials = [mat, mat, mat, mat]
        let n = SCNNode(geometry: shape)
        let bb = shape.boundingBox
        let cz = (bb.min.z + bb.max.z) / 2
        n.pivot = SCNMatrix4MakeTranslation(0, 0, cz)
        n.eulerAngles.y = -.pi / 2
        return n
    }

    private static func rbox(_ w: CGFloat, _ h: CGFloat, _ l: CGFloat, _ c: CGFloat, _ mat: SCNMaterial) -> SCNNode {
        let b = SCNBox(width: w, height: h, length: l, chamferRadius: c)
        b.chamferSegmentCount = 3
        b.materials = [mat]
        return SCNNode(geometry: b)
    }

    private static func cyl(_ r: CGFloat, _ h: CGFloat, _ mat: SCNMaterial, axis: Axis = .y, seg: Int = 20) -> SCNNode {
        let c = SCNCylinder(radius: r, height: h)
        c.radialSegmentCount = seg
        c.materials = [mat]
        let n = SCNNode(geometry: c)
        switch axis {
        case .x: n.eulerAngles.z = .pi / 2
        case .z: n.eulerAngles.x = .pi / 2
        case .y: break
        }
        return n
    }
    private enum Axis { case x, y, z }

    private static func sphere(_ r: CGFloat, _ mat: SCNMaterial, scale: SCNVector3 = SCNVector3(1, 1, 1)) -> SCNNode {
        let s = SCNSphere(radius: r)
        s.segmentCount = 20
        s.materials = [mat]
        let n = SCNNode(geometry: s)
        n.scale = scale
        return n
    }

    private static func shapeNode(_ path: UIBezierPath, depth: CGFloat, _ mat: SCNMaterial, chamfer: CGFloat = 0) -> SCNNode {
        path.flatness = 0.0005
        let s = SCNShape(path: path, extrusionDepth: depth)
        s.chamferRadius = chamfer
        s.materials = [mat, mat, mat, mat]
        return SCNNode(geometry: s)
    }

    private static func poly(_ pts: [CGPoint]) -> UIBezierPath {
        let p = UIBezierPath()
        p.move(to: pts[0])
        for q in pts.dropFirst() { p.addLine(to: q) }
        p.close()
        return p
    }

    // MARK: - Наклейки

    private static var decalCache: [String: UIImage] = [:]

    private static func image(_ key: String, _ w: Int, _ h: Int, _ draw: @escaping (CGContext, CGSize) -> Void) -> UIImage {
        if let i = decalCache[key] { return i }
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1; fmt.opaque = false
        let r = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: fmt)
        let i = r.image { c in draw(c.cgContext, CGSize(width: w, height: h)) }
        decalCache[key] = i
        return i
    }

    private static func decalPlane(_ img: UIImage, w: CGFloat, h: CGFloat) -> SCNNode {
        let p = SCNPlane(width: w, height: h)
        let m = SCNMaterial()
        m.lightingModel = .constant
        m.diffuse.contents = img
        m.isDoubleSided = false
        m.transparencyMode = .aOne
        p.materials = [m]
        let n = SCNNode(geometry: p)
        n.renderingOrder = 10
        return n
    }

    /// Наклейка на оба борта. make(frontLeft): при взгляде на борт перед машины слева (правый борт, +x) или справа (левый, −x).
    private static func sideDecal(_ root: SCNNode, x: CGFloat, y: CGFloat, z: CGFloat, w: CGFloat, h: CGFloat,
                                  _ make: (Bool) -> UIImage) {
        let r = decalPlane(make(true), w: w, h: h)
        r.position = vec(x, y, z); r.eulerAngles.y = .pi / 2
        root.addChildNode(r)
        let l = decalPlane(make(false), w: w, h: h)
        l.position = vec(-x, y, z); l.eulerAngles.y = -.pi / 2
        root.addChildNode(l)
    }

    private static func flipped(_ ctx: CGContext, _ size: CGSize, _ frontLeft: Bool, _ body: () -> Void) {
        ctx.saveGState()
        if !frontLeft { ctx.translateBy(x: size.width, y: 0); ctx.scaleBy(x: -1, y: 1) }
        body()
        ctx.restoreGState()
    }

    private static func drawText(_ s: String, in rect: CGRect, size: CGFloat, fill: UIColor, stroke: UIColor? = nil, italic: Bool = true) {
        let para = NSMutableParagraphStyle(); para.alignment = .center
        var font = UIFont.systemFont(ofSize: size, weight: .black)
        if italic, let d = font.fontDescriptor.withSymbolicTraits(.traitItalic) { font = UIFont(descriptor: d, size: size) }
        var attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: fill, .paragraphStyle: para]
        if let st = stroke { attrs[.strokeColor] = st; attrs[.strokeWidth] = -size * 0.035 }
        let h = font.lineHeight
        (s as NSString).draw(in: CGRect(x: rect.minX, y: rect.midY - h / 2, width: rect.width, height: h), withAttributes: attrs)
    }

    /// Вертикальная молния A..G, повёрнутая вдоль борта, остриём вперёд.
    private static func boltPath(_ size: CGSize, inset: CGFloat = 0) -> UIBezierPath {
        let pts: [(CGFloat, CGFloat)] = [(0.55, 0), (0.12, 0.56), (0.45, 0.56), (0.28, 1.0), (0.88, 0.4), (0.55, 0.4), (0.82, 0)]
        let mapped = pts.map { CGPoint(x: (1 - $0.1) * size.width * (inset > 0 ? inset : 1), y: $0.0 * size.height) }
        return poly(mapped)
    }

    // MARK: - Лицо

    private static func eyePair(r: CGFloat, spread: CGFloat, iris: UIColor, brow: CGFloat, browMat: SCNMaterial, monocle: Bool = false) -> SCNNode {
        let g = SCNNode()
        let irisMat = flat(iris); irisMat.emission.contents = iris.withAlphaComponent(1); irisMat.emission.intensity = 0.25
        let pupilMat = flat(rgb(0.02, 0.02, 0.03)); pupilMat.roughness.contents = 0.2
        let hlMat = lampMat(.white)
        for s: CGFloat in [-1, 1] {
            let eye = SCNNode()
            eye.position = vec(s * spread, 0, 0)
            let white = sphere(r, whiteMat, scale: SCNVector3(1, 1.08, 0.46))
            eye.addChildNode(white)
            let ir = sphere(r * 0.58, irisMat, scale: SCNVector3(1, 1, 0.3))
            ir.position = vec(-s * r * 0.1, -r * 0.04, r * 0.33)
            eye.addChildNode(ir)
            let pu = sphere(r * 0.3, pupilMat, scale: SCNVector3(1, 1, 0.34))
            pu.position = vec(-s * r * 0.1, -r * 0.04, r * 0.4)
            eye.addChildNode(pu)
            let hl = sphere(r * 0.13, hlMat, scale: SCNVector3(1, 1, 0.5))
            hl.position = vec(-s * r * 0.1 + r * 0.2, r * 0.18, r * 0.45)
            eye.addChildNode(hl)
            let hl2 = sphere(r * 0.06, hlMat, scale: SCNVector3(1, 1, 0.5))
            hl2.position = vec(-s * r * 0.1 - r * 0.18, -r * 0.2, r * 0.43)
            eye.addChildNode(hl2)
            if brow != 0 {
                let lid = rbox(r * 1.8, r * 0.55, r * 0.95, r * 0.2, browMat)
                lid.position = vec(0, r * 0.78, r * 0.12)
                lid.eulerAngles.z = Float(s * brow)
                eye.addChildNode(lid)
            }
            g.addChildNode(eye)
        }
        if monocle {
            let t = SCNTorus(ringRadius: r * 1.08, pipeRadius: r * 0.09)
            t.materials = [paint(rgb(0.9, 0.7, 0.2), metal: 0.5, rough: 0.2)]
            let tn = SCNNode(geometry: t)
            tn.eulerAngles.x = .pi / 2
            tn.position = vec(spread, 0, r * 0.2)
            g.addChildNode(tn)
        }
        return g
    }

    private static func mouthNode(_ style: Mouth, w: CGFloat) -> SCNNode {
        let root = SCNNode()
        guard style != .none else { return root }
        let h: CGFloat
        switch style {
        case .grin, .teeth: h = w * 0.34
        case .buck: h = w * 0.3
        default: h = w * 0.2
        }
        let path = UIBezierPath()
        path.move(to: CGPoint(x: -w / 2, y: 0.004))
        path.addQuadCurve(to: CGPoint(x: w / 2, y: 0.004), controlPoint: CGPoint(x: 0, y: -0.004))
        path.addQuadCurve(to: CGPoint(x: -w / 2, y: 0.004), controlPoint: CGPoint(x: 0, y: -h * 2.1))
        path.close()
        let m = shapeNode(path, depth: 0.006, flat(rgb(0.18, 0.02, 0.03)))
        root.addChildNode(m)
        // тёмная окантовка-губа
        let lipMat = flat(rgb(0.08, 0.02, 0.02))
        let lip = UIBezierPath()
        lip.move(to: CGPoint(x: -w / 2 - 0.004, y: 0.008))
        lip.addQuadCurve(to: CGPoint(x: w / 2 + 0.004, y: 0.008), controlPoint: CGPoint(x: 0, y: -0.01))
        lip.addLine(to: CGPoint(x: w / 2, y: 0.002))
        lip.addQuadCurve(to: CGPoint(x: -w / 2, y: 0.002), controlPoint: CGPoint(x: 0, y: -0.012))
        lip.close()
        let ln = shapeNode(lip, depth: 0.008, lipMat); ln.position.z = 0.001
        root.addChildNode(ln)
        switch style {
        case .buck:
            for s: CGFloat in [-1, 1] {
                let t = rbox(w * 0.15, h * 0.85, 0.008, 0.003, whiteMat)
                t.position = vec(s * w * 0.085, -h * 0.4, 0.004)
                root.addChildNode(t)
            }
        case .grin, .teeth:
            let n = style == .grin ? 6 : 4
            let tw = w * 0.78 / CGFloat(n)
            for i in 0..<n {
                let t = rbox(tw * 0.9, h * 0.5, 0.008, 0.003, whiteMat)
                let x = (CGFloat(i) - CGFloat(n - 1) / 2) * tw
                t.position = vec(x, -h * 0.28 - abs(x) * 0.12, 0.004)
                root.addChildNode(t)
            }
        default: break
        }
        return root
    }

    // MARK: - Колесо

    private static func makeWheel(_ w: Wheel) -> SCNNode {
        let n = SCNNode()
        let tire = cyl(w.r, w.w, rubberMat, axis: .x, seg: 28)
        n.addChildNode(tire)
        let faceX = w.w / 2
        if w.whitewall {
            let t = SCNTube(innerRadius: w.r * 0.6, outerRadius: w.r * 0.86, height: w.w * 1.01)
            t.radialSegmentCount = 28
            t.materials = [whiteMat]
            let tn = SCNNode(geometry: t); tn.eulerAngles.z = .pi / 2
            n.addChildNode(tn)
        }
        let rim = cyl(w.r * 0.62, w.w * 1.03, chromeMat, axis: .x, seg: 28)
        n.addChildNode(rim)
        let lip = SCNTorus(ringRadius: w.r * 0.62, pipeRadius: w.r * 0.05)
        lip.materials = [chromeMat]
        let lipN = SCNNode(geometry: lip); lipN.eulerAngles.z = .pi / 2
        lipN.position = vec(faceX * 1.02, 0, 0)
        n.addChildNode(lipN)
        let hub = cyl(w.r * 0.3, w.w * 0.18, paint(w.hub, metal: 0.4, rough: 0.25), axis: .x)
        hub.position = vec(faceX * 1.06, 0, 0)
        n.addChildNode(hub)
        // спицы
        let spokeMat = paint(rgb(0.55, 0.57, 0.6), metal: 0.5, rough: 0.3)
        for i in 0..<5 {
            let sp = rbox(w.w * 0.12, w.r * 0.5, w.r * 0.13, 0.004, spokeMat)
            let a = CGFloat(i) * 2 * .pi / 5
            let holder = SCNNode()
            holder.position = vec(faceX * 1.03, 0, 0)
            holder.eulerAngles.x = Float(a)
            sp.position = vec(0, w.r * 0.36, 0)
            holder.addChildNode(sp)
            n.addChildNode(holder)
        }
        return n
    }

    // MARK: - Сборка

    private static func buildCar(_ d: Def) -> SCNNode {
        let root = SCNNode()
        let body = paint(d.color)
        let path = bodyPath(d)
        root.addChildNode(extrude(path, depth: d.W, chamfer: d.chamfer, body))

        // кабина
        if !d.cabin.isEmpty {
            let baseY = d.cabin.map { $0.p.y }.min()! - 0.03
            let cabMat = d.bubble ? bubbleMat : body
            let cab = extrude(cabinPath(d.cabin, baseY: baseY), depth: d.cabW, chamfer: d.chamfer * 0.9, cabMat)
            root.addChildNode(cab)

            let F = d.cabin.last!.p, T = d.cabin[d.cabin.count - 2].p
            // боковые окна
            if !d.bubble {
                let zc = (d.cabin.first!.p.x + F.x) / 2
                let by = d.cabin.map { $0.p.y }.min()!
                let wpts = d.cabin.dropLast().map { k -> KP in
                    KP(p: CGPoint(x: zc + (k.p.x - zc) * d.winScaleZ, y: by + 0.012 + (k.p.y - by) * d.winScaleY), sharp: k.sharp)
                }
                // закрыть окно по низу
                let wp = UIBezierPath()
                let hh = hermite(Array(wpts))
                wp.move(to: hh[0])
                for p in hh.dropFirst() { wp.addLine(to: p) }
                wp.close()
                sideGlass(root, wp, x: d.cabW / 2 + 0.0015)
            }
            // лобовое стекло + глаза
            let dz = T.x - F.x, dy = T.y - F.y
            let len = hypot(dz, dy)
            let ws = SCNNode()
            let nz = dy / len, ny = -dz / len
            ws.position = vec(0, (F.y + T.y) / 2 + ny * 0.003, (F.x + T.x) / 2 + nz * 0.003)
            ws.eulerAngles.x = Float(atan2(-dz, dy))
            if !d.bubble {
                let g = rbox(d.cabW * 0.95, len * 0.95, 0.012, 0.004, glassMat)
                ws.addChildNode(g)
            }
            let eyes = eyePair(r: d.eyeR ?? d.cabW * 0.25, spread: d.eyeSpread ?? d.cabW * 0.255, iris: d.iris, brow: d.brow, browMat: body, monocle: d.bubble)
            eyes.position = vec(0, len * 0.04, d.bubble ? 0.0 : 0.012)
            eyes.eulerAngles.x = d.bubble ? 0 : Float(-0.3 * atan2(-dz, dy))
            ws.addChildNode(eyes)
            root.addChildNode(ws)
            // зеркала
            if !d.bubble {
                for s: CGFloat in [-1, 1] {
                    let m = sphere(0.022, body, scale: SCNVector3(0.8, 1, 1.2))
                    m.position = vec(s * (d.cabW / 2 + 0.03), baseY + 0.05, F.x - 0.03)
                    root.addChildNode(m)
                }
            }
        }

        // колёса
        var cache: [String: SCNNode] = [:]
        for w in d.wheels {
            let key = "\(w.r)-\(w.w)-\(w.whitewall)"
            let proto = cache[key] ?? makeWheel(w)
            cache[key] = proto
            let track = w.track ?? (d.W + 0.012)
            let x = track / 2 - w.w / 2
            let a = proto.clone(); a.position = vec(x, w.r, w.z)
            let b = proto.clone(); b.position = vec(-x, w.r, w.z); b.eulerAngles.y = .pi
            root.addChildNode(a); root.addChildNode(b)
        }
        // оси
        for w in d.wheels {
            let track = w.track ?? (d.W + 0.012)
            let ax = cyl(0.02, track * 0.9, blackMat, axis: .x, seg: 8)
            ax.position = vec(0, w.r, w.z)
            root.addChildNode(ax)
        }

        // морда
        let zf = d.zFront, zr = d.zRear
        let mouth = mouthNode(d.mouth, w: d.mouthW)
        mouth.position = vec(0, d.mouthY, zf + 0.004)
        root.addChildNode(mouth)

        let lamp = sharedLamp
        for s: CGFloat in [-1, 1] {
            let ring = sphere(d.lampR * 1.4, chromeMat, scale: SCNVector3(1, 1, 0.35))
            ring.position = vec(s * d.lampX, d.lampY, zf - 0.004)
            root.addChildNode(ring)
            let l = sphere(d.lampR, lamp, scale: SCNVector3(1, 1, 0.5))
            l.position = vec(s * d.lampX, d.lampY, zf + 0.002)
            root.addChildNode(l)
        }
        let tail = lampMat(rgb(1, 0.1, 0.08))
        for s: CGFloat in [-1, 1] {
            let t = rbox(0.07, 0.03, 0.012, 0.005, tail)
            t.position = vec(s * (d.W / 2 - 0.07), d.belly + 0.1, zr - 0.002)
            root.addChildNode(t)
        }
        if d.bumper {
            let b = rbox(d.W * 0.86, 0.03, 0.04, 0.013, chromeMat)
            b.position = vec(0, d.belly + 0.015, zf - 0.004)
            root.addChildNode(b)
        }
        if d.rearBumper {
            let b = rbox(d.W * 0.86, 0.03, 0.04, 0.013, chromeMat)
            b.position = vec(0, d.belly + 0.015, zr + 0.004)
            root.addChildNode(b)
        }
        d.extras?(root, d)
        return root
    }

    private static func sideGlass(_ root: SCNNode, _ path: UIBezierPath, x: CGFloat) {
        for s: CGFloat in [-1, 1] {
            let n = shapeNode(path, depth: 0.004, glassMat)
            // pivot по центру выдавливания
            let bb = (n.geometry as! SCNShape).boundingBox
            n.pivot = SCNMatrix4MakeTranslation(0, 0, (bb.min.z + bb.max.z) / 2)
            n.eulerAngles.y = -.pi / 2
            n.position.x = Float(s * x)
            root.addChildNode(n)
        }
    }

    private static func spoiler(_ root: SCNNode, _ d: Def, y: CGFloat, z: CGFloat, w: CGFloat, mat: SCNMaterial) {
        let wing = rbox(w, 0.018, 0.1, 0.008, mat)
        wing.position = vec(0, y, z)
        wing.eulerAngles.x = -0.12
        root.addChildNode(wing)
        for s: CGFloat in [-1, 1] {
            let post = rbox(0.016, y - 0.2, 0.04, 0.005, mat)
            post.position = vec(s * w * 0.3, 0.2 + (y - 0.2) / 2, z)
            root.addChildNode(post)
            let plate = rbox(0.012, 0.055, 0.11, 0.004, mat)
            plate.position = vec(s * (w / 2), y + 0.012, z)
            root.addChildNode(plate)
        }
    }

    private static func exhausts(_ root: SCNNode, _ d: Def, x: CGFloat = 0.07, y: CGFloat = 0.07, r: CGFloat = 0.016) {
        for s: CGFloat in [-1, 1] {
            let e = cyl(r, 0.05, chromeMat, axis: .z)
            e.position = vec(s * x, y, d.zRear - 0.015)
            root.addChildNode(e)
            let hole = cyl(r * 0.6, 0.052, blackMat, axis: .z)
            hole.position = vec(s * x, y, d.zRear - 0.017)
            root.addChildNode(hole)
        }
    }

    // MARK: - Персонажи (легковые)

    private static func lightning() -> Def {
        let b: CGFloat = 0.045
        var d = Def(
            color: rgb(0.85, 0.06, 0.1), L: 0.68, W: 0.40, belly: b,
            top: [S(-0.335, b), P(-0.345, 0.11), P(-0.335, 0.2), P(-0.29, 0.262), P(-0.2, 0.28), P(-0.05, 0.285),
                  P(0.06, 0.285), P(0.17, 0.275), P(0.27, 0.255), P(0.33, 0.22), P(0.35, 0.165), P(0.35, 0.1), S(0.34, b)],
            cabin: [S(-0.25, 0.27), P(-0.215, 0.345), P(-0.15, 0.405), P(-0.06, 0.43), S(0.0, 0.415), S(0.115, 0.275)],
            cabW: 0.31,
            wheels: [Wheel(z: 0.215, r: 0.092, w: 0.07, hub: rgb(0.95, 0.8, 0.1)), Wheel(z: -0.215, r: 0.092, w: 0.07, hub: rgb(0.95, 0.8, 0.1))],
            iris: rgb(0.25, 0.55, 0.95), mouth: .buck, mouthY: 0.115, mouthW: 0.2, lampY: 0.185, lampX: 0.145)
        d.extras = { root, d in
            let yellow = rgb(1, 0.82, 0.1)
            sideDecal(root, x: 0.2 + 0.002, y: 0.17, z: -0.02, w: 0.36, h: 0.12) { fl in
                image("mq-side-\(fl)", 600, 200) { ctx, sz in
                    flipped(ctx, sz, fl) {
                        let p = boltPath(sz, inset: 0.55)
                        rgb(1, 1, 1).setStroke(); yellow.setFill()
                        p.lineWidth = 14; p.lineJoinStyle = .round
                        p.fill(); p.stroke()
                        yellow.setFill(); p.fill()
                    }
                    let c = CGRect(x: sz.width * 0.5, y: 0, width: sz.width * 0.4, height: sz.height)
                    drawText("95", in: c, size: sz.height * 0.78, fill: .white, stroke: rgb(0.15, 0.03, 0.03))
                }
            }
            // полоса на капоте
            let stripe = decalPlane(image("mq-hood", 200, 400) { ctx, sz in
                yellow.setFill()
                poly([CGPoint(x: sz.width * 0.5, y: 0), CGPoint(x: sz.width * 0.75, y: sz.height * 0.3),
                      CGPoint(x: sz.width * 0.6, y: sz.height * 0.3), CGPoint(x: sz.width * 0.8, y: sz.height),
                      CGPoint(x: sz.width * 0.25, y: sz.height * 0.5), CGPoint(x: sz.width * 0.45, y: sz.height * 0.5)]).fill()
            }, w: 0.1, h: 0.2)
            stripe.position = vec(0, 0.2865, 0.22); stripe.eulerAngles.x = -.pi / 2
            _ = stripe // оставлено для будущей настройки
            spoiler(root, d, y: 0.37, z: -0.31, w: 0.36, mat: paint(rgb(0.85, 0.06, 0.1)))
            exhausts(root, d)
        }
        return d
    }

    private static func sally() -> Def {
        let b: CGFloat = 0.045
        var d = Def(
            color: rgb(0.38, 0.68, 0.93), L: 0.64, W: 0.40, belly: b,
            top: [S(-0.32, b), P(-0.33, 0.12), P(-0.32, 0.22), P(-0.28, 0.265), P(-0.2, 0.278), P(0.0, 0.282),
                  P(0.12, 0.272), P(0.22, 0.256), P(0.29, 0.226), P(0.325, 0.17), P(0.325, 0.1), S(0.315, b)],
            cabin: [S(-0.3, 0.26), P(-0.27, 0.315), P(-0.18, 0.395), P(-0.08, 0.43), S(0.005, 0.42), S(0.105, 0.275)],
            cabW: 0.31,
            wheels: [Wheel(z: 0.2, r: 0.09, w: 0.07), Wheel(z: -0.2, r: 0.09, w: 0.07)],
            iris: rgb(0.2, 0.7, 0.85), mouth: .smile, mouthY: 0.115, mouthW: 0.19, lampY: 0.18, lampX: 0.14)
        d.extras = { root, d in
            let wing = rbox(0.28, 0.014, 0.07, 0.006, paint(d.color))
            wing.position = vec(0, 0.3, -0.31)
            wing.eulerAngles.x = -0.35
            root.addChildNode(wing)
            sideDecal(root, x: 0.2 + 0.002, y: 0.2, z: -0.1, w: 0.2, h: 0.1) { fl in
                image("sally-stripe-\(fl)", 400, 200) { ctx, sz in
                    flipped(ctx, sz, fl) {
                        rgb(0.15, 0.25, 0.55).setStroke()
                        let p = UIBezierPath()
                        p.move(to: CGPoint(x: sz.width * 0.1, y: sz.height * 0.8))
                        p.addCurve(to: CGPoint(x: sz.width * 0.9, y: sz.height * 0.25),
                                   controlPoint1: CGPoint(x: sz.width * 0.4, y: sz.height * 0.9), controlPoint2: CGPoint(x: sz.width * 0.6, y: sz.height * 0.05))
                        p.lineWidth = 8; p.lineCapStyle = .round; p.stroke()
                    }
                }
            }
            exhausts(root, d)
        }
        return d
    }

    private static func doc() -> Def {
        let b: CGFloat = 0.045
        var d = Def(
            color: rgb(0.11, 0.24, 0.5), L: 0.66, W: 0.44, belly: b,
            top: [S(-0.33, b), P(-0.34, 0.12), P(-0.33, 0.22), P(-0.29, 0.275), P(-0.2, 0.29), P(-0.05, 0.295),
                  P(0.07, 0.295), P(0.17, 0.29), P(0.26, 0.275), P(0.31, 0.24), P(0.335, 0.18), P(0.335, 0.1), S(0.325, b)],
            cabin: [S(-0.27, 0.285), P(-0.24, 0.35), P(-0.16, 0.43), P(-0.06, 0.465), S(0.015, 0.45), S(0.125, 0.29)],
            cabW: 0.35,
            wheels: [Wheel(z: 0.21, r: 0.092, w: 0.07, whitewall: true), Wheel(z: -0.21, r: 0.092, w: 0.07, whitewall: true)],
            iris: rgb(0.2, 0.55, 0.95), brow: 0.2, mouth: .smile, mouthY: 0.12, mouthW: 0.2, lampY: 0.2, lampX: 0.16, lampR: 0.034)
        d.extras = { root, d in
            // хромированная полоса вдоль борта и решётка
            for s: CGFloat in [-1, 1] {
                let strip = rbox(0.008, 0.012, 0.5, 0.004, chromeMat)
                strip.position = vec(s * (d.W / 2 + 0.002), 0.2, -0.02)
                root.addChildNode(strip)
            }
            sideDecal(root, x: 0.22 + 0.002, y: 0.2 + 0.03, z: -0.07, w: 0.12, h: 0.1) { fl in
                image("doc51", 200, 160) { ctx, sz in
                    drawText("51", in: CGRect(x: 0, y: 0, width: sz.width, height: sz.height), size: sz.height * 0.85, fill: .white, stroke: rgb(0.05, 0.1, 0.25))
                }
            }
            let grille = rbox(0.17, 0.045, 0.012, 0.005, chromeMat)
            grille.position = vec(0, 0.21, d.zFront - 0.0)
            root.addChildNode(grille)
            exhausts(root, d, x: 0.09)
        }
        return d
    }

    private static func luigi() -> Def {
        let b: CGFloat = 0.035
        var d = Def(
            color: rgb(0.98, 0.82, 0.12), L: 0.46, W: 0.34, belly: b,
            top: [S(-0.225, b), P(-0.235, 0.09), P(-0.225, 0.17), P(-0.19, 0.21), P(-0.1, 0.225), P(0.02, 0.228),
                  P(0.1, 0.222), P(0.17, 0.2), P(0.215, 0.16), P(0.225, 0.1), S(0.215, b)],
            cabin: [S(-0.19, 0.22), P(-0.17, 0.28), P(-0.1, 0.345), P(-0.02, 0.365), S(0.025, 0.355), S(0.09, 0.225)],
            cabW: 0.27,
            wheels: [Wheel(z: 0.14, r: 0.066, w: 0.055, hub: rgb(0.8, 0.1, 0.1)), Wheel(z: -0.14, r: 0.066, w: 0.055, hub: rgb(0.8, 0.1, 0.1))],
            iris: rgb(0.4, 0.25, 0.1), mouth: .smile, mouthY: 0.085, mouthW: 0.14, lampY: 0.13, lampX: 0.105, lampR: 0.025)
        d.extras = { root, d in
            let flag = decalPlane(image("flag", 300, 200) { ctx, sz in
                rgb(0.1, 0.6, 0.25).setFill(); ctx.fill(CGRect(x: 0, y: 0, width: sz.width / 3, height: sz.height))
                UIColor.white.setFill(); ctx.fill(CGRect(x: sz.width / 3, y: 0, width: sz.width / 3, height: sz.height))
                rgb(0.85, 0.1, 0.12).setFill(); ctx.fill(CGRect(x: sz.width * 2 / 3, y: 0, width: sz.width / 3, height: sz.height))
            }, w: 0.1, h: 0.06)
            flag.position = vec(0, 0.2285, 0.13)
            flag.eulerAngles.x = -.pi / 2
            root.addChildNode(flag)
            exhausts(root, d, x: 0.05, y: 0.05, r: 0.012)
        }
        return d
    }

    private static func chick() -> Def {
        let b: CGFloat = 0.045
        var d = Def(
            color: rgb(0.2, 0.6, 0.2), L: 0.68, W: 0.42, belly: b,
            top: [S(-0.335, b), P(-0.345, 0.11), P(-0.335, 0.2), P(-0.29, 0.262), P(-0.2, 0.275), P(-0.05, 0.278),
                  P(0.07, 0.278), P(0.18, 0.268), P(0.28, 0.25), P(0.335, 0.215), P(0.35, 0.16), P(0.35, 0.1), S(0.34, b)],
            cabin: [S(-0.25, 0.265), P(-0.22, 0.34), P(-0.15, 0.4), P(-0.06, 0.42), S(0.0, 0.405), S(0.12, 0.27)],
            cabW: 0.33,
            wheels: [Wheel(z: 0.215, r: 0.092, w: 0.075, hub: rgb(0.95, 0.85, 0.2)), Wheel(z: -0.215, r: 0.092, w: 0.075, hub: rgb(0.95, 0.85, 0.2))],
            iris: rgb(0.1, 0.1, 0.12), brow: 0.35, mouth: .grin, mouthY: 0.12, mouthW: 0.24, lampY: 0.19, lampX: 0.155)
        d.extras = { root, d in
            // усы-решётка
            let mus = UIBezierPath()
            mus.move(to: CGPoint(x: 0, y: 0.012))
            mus.addQuadCurve(to: CGPoint(x: 0.12, y: -0.004), controlPoint: CGPoint(x: 0.06, y: 0.03))
            mus.addQuadCurve(to: CGPoint(x: 0.11, y: -0.002), controlPoint: CGPoint(x: 0.12, y: -0.016))
            mus.addQuadCurve(to: CGPoint(x: 0, y: 0.0), controlPoint: CGPoint(x: 0.055, y: 0.012))
            mus.close()
            for s: CGFloat in [-1, 1] {
                let m = shapeNode(mus, depth: 0.012, blackMat)
                m.position = vec(0, 0.165, d.zFront + 0.004)
                m.scale = SCNVector3(Float(s), 1, 1)
                root.addChildNode(m)
            }
            sideDecal(root, x: 0.21 + 0.002, y: 0.17, z: -0.02, w: 0.3, h: 0.1) { fl in
                image("chick-side-\(fl)", 600, 200) { ctx, sz in
                    flipped(ctx, sz, fl) {
                        rgb(1, 0.85, 0.1).setFill()
                        poly([CGPoint(x: 0, y: sz.height * 0.6), CGPoint(x: sz.width * 0.55, y: sz.height * 0.15),
                              CGPoint(x: sz.width * 0.9, y: sz.height * 0.15), CGPoint(x: sz.width * 0.35, y: sz.height * 0.85)]).fill()
                    }
                    drawText("86", in: CGRect(x: sz.width * 0.55, y: 0, width: sz.width * 0.4, height: sz.height), size: sz.height * 0.78, fill: .white, stroke: rgb(0.03, 0.2, 0.05))
                }
            }
            spoiler(root, d, y: 0.37, z: -0.31, w: 0.38, mat: paint(rgb(0.15, 0.5, 0.15)))
            exhausts(root, d)
        }
        return d
    }

    private static func storm() -> Def {
        let b: CGFloat = 0.04
        var d = Def(
            color: rgb(0.1, 0.12, 0.17), L: 0.7, W: 0.41, belly: b,
            top: [S(-0.35, b), P(-0.355, 0.1), P(-0.34, 0.19), P(-0.29, 0.235), P(-0.2, 0.25), P(-0.05, 0.26),
                  P(0.08, 0.26), P(0.2, 0.245), P(0.3, 0.215), P(0.35, 0.17), P(0.36, 0.11), S(0.35, b)],
            cabin: [S(-0.27, 0.25), P(-0.2, 0.31), P(-0.1, 0.365), P(-0.02, 0.385), S(0.03, 0.372), S(0.16, 0.255)],
            cabW: 0.31,
            wheels: [Wheel(z: 0.225, r: 0.088, w: 0.075, hub: rgb(0.2, 0.8, 1)), Wheel(z: -0.225, r: 0.088, w: 0.075, hub: rgb(0.2, 0.8, 1))],
            iris: rgb(0.1, 0.8, 1.0), brow: 0.4, mouth: .teeth, mouthY: 0.11, mouthW: 0.2, lampY: 0.17, lampX: 0.15, lampR: 0.026)
        d.extras = { root, d in
            let cyan = rgb(0.1, 0.8, 1.0)
            sideDecal(root, x: 0.205 + 0.002, y: 0.15, z: -0.02, w: 0.45, h: 0.11) { fl in
                image("storm-side-\(fl)", 800, 200) { ctx, sz in
                    flipped(ctx, sz, fl) {
                        cyan.setFill()
                        poly([CGPoint(x: 0, y: sz.height * 0.55), CGPoint(x: sz.width * 0.4, y: sz.height * 0.1),
                              CGPoint(x: sz.width * 0.55, y: sz.height * 0.1), CGPoint(x: sz.width * 0.3, y: sz.height * 0.5),
                              CGPoint(x: sz.width * 0.85, y: sz.height * 0.5), CGPoint(x: sz.width * 0.5, y: sz.height * 0.95),
                              CGPoint(x: sz.width * 0.35, y: sz.height * 0.95), CGPoint(x: sz.width * 0.55, y: sz.height * 0.62),
                              CGPoint(x: sz.width * 0.1, y: sz.height * 0.62)]).fill()
                    }
                    drawText("20", in: CGRect(x: sz.width * 0.68, y: 0, width: sz.width * 0.3, height: sz.height), size: sz.height * 0.7, fill: cyan, stroke: rgb(0, 0.05, 0.1))
                }
            }
            // неоновая подсветка снизу
            let neon = lampMat(cyan)
            for s: CGFloat in [-1, 1] {
                let n = rbox(0.008, 0.008, 0.5, 0.003, neon)
                n.position = vec(s * 0.19, 0.03, 0)
                root.addChildNode(n)
            }
            spoiler(root, d, y: 0.345, z: -0.325, w: 0.38, mat: paint(rgb(0.07, 0.08, 0.1)))
            exhausts(root, d)
        }
        return d
    }

    private static func boost() -> Def {
        let b: CGFloat = 0.045
        var d = Def(
            color: rgb(0.45, 0.17, 0.62), L: 0.64, W: 0.43, belly: b,
            top: [S(-0.32, b), P(-0.33, 0.12), P(-0.32, 0.22), P(-0.28, 0.265), P(-0.2, 0.28), P(-0.05, 0.285),
                  P(0.06, 0.285), P(0.16, 0.285), P(0.25, 0.275), P(0.305, 0.245), P(0.325, 0.185), P(0.325, 0.1), S(0.315, b)],
            cabin: [S(-0.25, 0.275), P(-0.22, 0.35), P(-0.16, 0.4), P(-0.07, 0.42), S(0.0, 0.41), S(0.11, 0.285)],
            cabW: 0.33,
            wheels: [Wheel(z: 0.205, r: 0.095, w: 0.08, hub: rgb(0.3, 1, 0.5)), Wheel(z: -0.205, r: 0.095, w: 0.08, hub: rgb(0.3, 1, 0.5))],
            iris: rgb(0.3, 1.0, 0.5), brow: 0.3, mouth: .grin, mouthY: 0.115, mouthW: 0.22, lampY: 0.185, lampX: 0.155)
        d.extras = { root, d in
            let neon = rgb(0.3, 1.0, 0.5)
            // нагнетатель на капоте
            let blower = cyl(0.04, 0.09, chromeMat, axis: .x)
            blower.position = vec(0, 0.325, 0.17)
            root.addChildNode(blower)
            for i in 0..<4 {
                let st = cyl(0.012, 0.045, chromeMat)
                st.position = vec((CGFloat(i) - 1.5) * 0.02, 0.37, 0.17)
                root.addChildNode(st)
            }
            sideDecal(root, x: 0.215 + 0.002, y: 0.16, z: -0.02, w: 0.4, h: 0.1) { fl in
                image("boost-side-\(fl)", 800, 200) { ctx, sz in
                    flipped(ctx, sz, fl) {
                        neon.setFill()
                        let p = UIBezierPath()
                        p.move(to: CGPoint(x: 0, y: sz.height * 0.7))
                        for i in 0..<5 {
                            let x0 = sz.width * (0.05 + CGFloat(i) * 0.19)
                            p.addQuadCurve(to: CGPoint(x: x0 + sz.width * 0.19, y: sz.height * 0.7), controlPoint: CGPoint(x: x0 + sz.width * 0.02, y: sz.height * (0.1 + CGFloat(i) * 0.1)))
                        }
                        p.close(); p.fill()
                    }
                }
            }
            spoiler(root, d, y: 0.4, z: -0.3, w: 0.42, mat: paint(rgb(0.3, 0.1, 0.45)))
            exhausts(root, d, x: 0.08, y: 0.075, r: 0.02)
        }
        return d
    }

    private static func professorZ() -> Def {
        let b: CGFloat = 0.04
        var d = Def(
            color: rgb(0.45, 0.5, 0.36), L: 0.46, W: 0.34, belly: b,
            top: [S(-0.23, b), P(-0.24, 0.09), P(-0.225, 0.15), P(-0.18, 0.187), P(-0.08, 0.2), P(0.06, 0.2),
                  P(0.15, 0.19), P(0.205, 0.16), P(0.225, 0.11), S(0.215, b)],
            cabin: [S(-0.19, 0.195), P(-0.185, 0.27), P(-0.12, 0.345), P(-0.03, 0.385), P(0.06, 0.365), S(0.11, 0.29), S(0.15, 0.2)],
            cabW: 0.26,
            wheels: [Wheel(z: 0.14, r: 0.07, w: 0.06), Wheel(z: -0.14, r: 0.07, w: 0.06)],
            iris: rgb(0.35, 0.3, 0.1), mouth: .smile, mouthY: 0.1, mouthW: 0.14, lampY: 0.14, lampX: 0.11, lampR: 0.025)
        d.bubble = true
        d.extras = { root, d in exhausts(root, d, x: 0.05, y: 0.06, r: 0.012) }
        return d
    }

    // MARK: - Грузовики и техника

    private static func mack() -> Def {
        let b: CGFloat = 0.08
        var d = Def(
            color: rgb(0.82, 0.08, 0.1), L: 0.74, W: 0.44, belly: b,
            top: [S(-0.13, b), S(-0.13, 0.22), P(-0.04, 0.26), P(0.1, 0.3), P(0.2, 0.315), P(0.3, 0.315), P(0.36, 0.295), P(0.375, 0.24), S(0.375, b)],
            cabin: [S(-0.1, 0.26), S(-0.1, 0.46), P(-0.08, 0.5), P(0.04, 0.505), S(0.1, 0.48), S(0.15, 0.31)],
            cabW: 0.38,
            wheels: [Wheel(z: 0.27, r: 0.09, w: 0.07), Wheel(z: -0.01, r: 0.095, w: 0.075), Wheel(z: -0.26, r: 0.085, w: 0.07, arch: false, track: 0.46)],
            iris: rgb(0.2, 0.5, 0.9), brow: 0.15, mouth: .smile, mouthY: 0.135, mouthW: 0.2, lampY: 0.265, lampX: 0.165, lampR: 0.034)
        d.extras = { root, d in
            let red = paint(d.color)
            // прицеп
            let tb: CGFloat = 0.075
            var td = d
            td.top = [S(-0.372, tb), S(-0.372, 0.43), P(-0.36, 0.445), P(-0.14, 0.445), S(-0.125, 0.43), S(-0.125, tb)]
            td.belly = tb
            td.wheels = [Wheel(z: -0.26, r: 0.085, w: 0.07)]
            let trailerMat = paint(rgb(0.9, 0.9, 0.92), metal: 0.2, rough: 0.3)
            let trailer = extrude(bodyPath(td), depth: 0.43, chamfer: 0.02, trailerMat)
            root.addChildNode(trailer)
            // красные полосы прицепа и логотип-молния
            sideDecal(root, x: 0.215 + 0.002, y: 0.27, z: -0.25, w: 0.24, h: 0.14) { fl in
                image("mack-trailer-\(fl)", 600, 350) { ctx, sz in
                    rgb(0.85, 0.08, 0.1).setFill()
                    ctx.fill(CGRect(x: 0, y: sz.height * 0.78, width: sz.width, height: sz.height * 0.22))
                    flipped(ctx, sz, fl) {
                        let p = boltPath(CGSize(width: sz.width * 0.8, height: sz.height * 0.7))
                        p.apply(CGAffineTransform(translationX: sz.width * 0.1, y: sz.height * 0.04))
                        rgb(0.85, 0.08, 0.1).setFill(); p.fill()
                    }
                }
            }
            let rear = decalPlane(image("mack-rear", 300, 200) { ctx, sz in
                rgb(0.85, 0.08, 0.1).setFill()
                ctx.fill(CGRect(x: 0, y: sz.height * 0.8, width: sz.width, height: sz.height * 0.2))
            }, w: 0.4, h: 0.26)
            rear.position = vec(0, 0.27, -0.3735); rear.eulerAngles.y = .pi
            root.addChildNode(rear)
            // решётка радиатора
            let grille = rbox(0.28, 0.17, 0.02, 0.01, chromeMat)
            grille.position = vec(0, 0.215, d.zFront + 0.002)
            root.addChildNode(grille)
            for i in 0..<7 {
                let sl = rbox(0.008, 0.15, 0.006, 0.002, blackMat)
                sl.position = vec((CGFloat(i) - 3) * 0.038, 0.215, d.zFront + 0.013)
                root.addChildNode(sl)
            }
            // трубы-стаки и баки
            for s: CGFloat in [-1, 1] {
                let st = cyl(0.017, 0.3, chromeMat)
                st.position = vec(s * 0.2, 0.4, -0.075)
                root.addChildNode(st)
                let cap = sphere(0.019, chromeMat)
                cap.position = vec(s * 0.2, 0.55, -0.075)
                root.addChildNode(cap)
                let tank = cyl(0.036, 0.12, chromeMat, axis: .z)
                tank.position = vec(s * 0.21, 0.13, 0.14)
                root.addChildNode(tank)
            }
            // огни на крыше кабины
            for i in 0..<5 {
                let l = sphere(0.014, lampMat(rgb(1, 0.7, 0.1)), scale: SCNVector3(1, 0.8, 1))
                l.position = vec((CGFloat(i) - 2) * 0.05, 0.512, 0.065 - 0.0)
                root.addChildNode(l)
            }
            _ = red
        }
        return d
    }

    private static func mater() -> Def {
        let b: CGFloat = 0.07
        var d = Def(
            color: rgb(0.64, 0.43, 0.27), L: 0.72, W: 0.4, belly: b,
            top: [S(-0.36, b), S(-0.36, 0.27), S(-0.1, 0.27), P(-0.03, 0.28), P(0.05, 0.3), P(0.17, 0.3), P(0.3, 0.285), P(0.35, 0.25), S(0.36, 0.2), S(0.36, b)],
            cabin: [S(-0.08, 0.3), S(-0.08, 0.45), P(-0.05, 0.49), P(0.04, 0.5), S(0.08, 0.485), S(0.13, 0.31)],
            cabW: 0.33,
            wheels: [Wheel(z: 0.24, r: 0.09, w: 0.07, hub: rgb(0.7, 0.45, 0.2)), Wheel(z: -0.2, r: 0.095, w: 0.075, hub: rgb(0.7, 0.45, 0.2))],
            iris: rgb(0.25, 0.6, 0.3), mouth: .buck, mouthY: 0.125, mouthW: 0.2, lampY: 0.2, lampX: 0.14)
        d.extras = { root, d in
            let steel = paint(rgb(0.45, 0.47, 0.5), metal: 0.5, rough: 0.35)
            let rust = paint(rgb(0.42, 0.25, 0.14), metal: 0.1, rough: 0.6)
            // борта платформы
            for s: CGFloat in [-1, 1] {
                let rail = rbox(0.018, 0.05, 0.22, 0.006, rust)
                rail.position = vec(s * 0.19, 0.295, -0.25)
                root.addChildNode(rail)
            }
            let back = rbox(0.38, 0.05, 0.018, 0.006, rust)
            back.position = vec(0, 0.295, -0.35)
            root.addChildNode(back)
            // основание крана
            let base = rbox(0.14, 0.07, 0.1, 0.012, steel)
            base.position = vec(0, 0.3, -0.19)
            root.addChildNode(base)
            // стрела
            let boom = rbox(0.045, 0.045, 0.34, 0.01, steel)
            let bh = SCNNode(); bh.position = vec(0, 0.33, -0.19)
            bh.eulerAngles.x = 0.62   // вверх и назад
            boom.position = vec(0, 0, -0.14)
            bh.addChildNode(boom)
            root.addChildNode(bh)
            // гидроцилиндр
            let hyd = cyl(0.012, 0.2, chromeMat)
            hyd.position = vec(0, 0.4, -0.2)
            hyd.eulerAngles.x = -0.9
            root.addChildNode(hyd)
            // трос и крюк (конец стрелы)
            let ex: CGFloat = 0.33 - 0.19 * 0 // не используется
            _ = ex
            let tipZ: CGFloat = -0.19 - 0.34 * sin(0.62)
            let tipY: CGFloat = 0.33 + 0.34 * cos(0.62)
            let rope = cyl(0.005, 0.13, blackMat)
            rope.position = vec(0, tipY - 0.07, tipZ)
            root.addChildNode(rope)
            let hook = SCNTorus(ringRadius: 0.026, pipeRadius: 0.0075)
            hook.materials = [chromeMat]
            let hn = SCNNode(geometry: hook)
            hn.eulerAngles.x = 0
            hn.eulerAngles.y = .pi / 2
            hn.position = vec(0, tipY - 0.165, tipZ)
            root.addChildNode(hn)
            // мигалка на кабине
            let lb = rbox(0.12, 0.03, 0.04, 0.012, lampMat(rgb(1, 0.65, 0.05)))
            lb.position = vec(0, 0.505, -0.03)
            root.addChildNode(lb)
            // ржавые пятна и бирюзовая дверь
            sideDecal(root, x: 0.2 + 0.002, y: 0.36, z: -0.015, w: 0.15, h: 0.12) { fl in
                image("mater-door", 300, 240) { ctx, sz in
                    rgb(0.3, 0.55, 0.55, 0.9).setFill()
                    UIBezierPath(roundedRect: CGRect(x: 4, y: 4, width: sz.width - 8, height: sz.height - 8), cornerRadius: 30).fill()
                    rgb(0.45, 0.22, 0.1, 0.85).setFill()
                    UIBezierPath(ovalIn: CGRect(x: sz.width * 0.1, y: sz.height * 0.55, width: sz.width * 0.35, height: sz.height * 0.3)).fill()
                    UIBezierPath(ovalIn: CGRect(x: sz.width * 0.6, y: sz.height * 0.1, width: sz.width * 0.25, height: sz.height * 0.2)).fill()
                }
            }
            exhausts(root, d, x: 0.1, y: 0.1, r: 0.016)
        }
        return d
    }

    private static func frank() -> Def {
        let b: CGFloat = 0.07
        var d = Def(
            color: rgb(0.78, 0.13, 0.1), L: 0.74, W: 0.34, belly: b,
            top: [S(-0.37, b), S(-0.37, 0.44), P(-0.34, 0.455), P(-0.14, 0.455), S(-0.1, 0.4), S(-0.06, 0.34), P(0.1, 0.34), P(0.2, 0.31), S(0.25, 0.24), S(0.25, b)],
            cabin: [S(-0.06, 0.33), S(-0.06, 0.5), P(-0.03, 0.54), P(0.08, 0.54), S(0.14, 0.51), S(0.19, 0.34)],
            cabW: 0.3,
            wheels: [Wheel(z: 0.07, r: 0.14, w: 0.09, arch: false, track: 0.52, hub: rgb(0.9, 0.8, 0.2)),
                     Wheel(z: -0.28, r: 0.09, w: 0.07, arch: false, track: 0.46, hub: rgb(0.9, 0.8, 0.2))],
            iris: rgb(0.1, 0.1, 0.1), brow: 0.4, mouth: .none, lampY: 0.3, lampX: 0.13, lampR: 0.026)
        d.bumper = false; d.rearBumper = false
        d.extras = { root, d in
            let red = paint(d.color)
            let steel = paint(rgb(0.4, 0.42, 0.45), metal: 0.5, rough: 0.35)
            let yellow = paint(rgb(0.95, 0.8, 0.15), metal: 0.2, rough: 0.35)
            // жатка: платформа, режущий брус
            let plat = rbox(0.5, 0.07, 0.16, 0.02, steel)
            plat.position = vec(0, 0.12, 0.31)
            root.addChildNode(plat)
            let blade = rbox(0.5, 0.025, 0.05, 0.008, chromeMat)
            blade.position = vec(0, 0.085, 0.4)
            root.addChildNode(blade)
            for i in 0..<12 {
                let t = rbox(0.016, 0.02, 0.04, 0.004, blackMat)
                t.position = vec((CGFloat(i) - 5.5) * 0.04, 0.083, 0.43)
                root.addChildNode(t)
            }
            // мотовило
            let reel = SCNNode(); reel.position = vec(0, 0.215, 0.33)
            let axle = cyl(0.022, 0.5, steel, axis: .x)
            reel.addChildNode(axle)
            for i in 0..<6 {
                let holder = SCNNode(); holder.eulerAngles.x = Float(CGFloat(i) * .pi / 3)
                let bar = rbox(0.5, 0.02, 0.05, 0.006, yellow)
                bar.position = vec(0, 0.085, 0)
                holder.addChildNode(bar)
                reel.addChildNode(holder)
            }
            root.addChildNode(reel)
            for s: CGFloat in [-1, 1] {
                let arm = rbox(0.018, 0.22, 0.03, 0.005, steel)
                arm.position = vec(s * 0.25, 0.2, 0.29)
                arm.eulerAngles.x = 0.4
                root.addChildNode(arm)
                // боковая стенка бункера
                let hop = rbox(0.016, 0.1, 0.18, 0.006, red)
                hop.position = vec(s * 0.25, 0.17, 0.305)
                root.addChildNode(hop)
            }
            // рот на жатке
            let m = mouthNode(.grin, w: 0.24)
            m.position = vec(0, 0.14, 0.396)
            root.addChildNode(m)
            // выгрузной шнек
            let aug = cyl(0.022, 0.26, steel)
            aug.position = vec(0.14, 0.58, -0.22)
            aug.eulerAngles.z = -0.9
            root.addChildNode(aug)
            let nozzle = cyl(0.03, 0.04, steel)
            nozzle.position = vec(0.23, 0.69, -0.22)
            root.addChildNode(nozzle)
            // мигалка и огни
            let beacon = sphere(0.022, lampMat(rgb(1, 0.6, 0.05)), scale: SCNVector3(1, 1.1, 1))
            beacon.position = vec(0, 0.555, 0.0)
            root.addChildNode(beacon)
            // выхлоп
            let pipe = cyl(0.018, 0.16, blackMat)
            pipe.position = vec(0.1, 0.55, -0.12)
            root.addChildNode(pipe)
        }
        return d
    }

    private static func tractor() -> Def {
        let b: CGFloat = 0.1
        var d = Def(
            color: rgb(0.24, 0.55, 0.26), L: 0.46, W: 0.2, belly: b,
            top: [S(-0.14, b), S(-0.14, 0.27), P(-0.08, 0.28), P(0.05, 0.275), P(0.17, 0.27), P(0.25, 0.25), S(0.27, 0.2), S(0.27, b)],
            cabin: [S(-0.14, 0.27), S(-0.14, 0.4), P(-0.12, 0.44), P(-0.04, 0.45), S(0.02, 0.42), S(0.075, 0.275)],
            cabW: 0.24,
            wheels: [Wheel(z: 0.17, r: 0.07, w: 0.06, arch: false, track: 0.3, hub: rgb(0.9, 0.8, 0.2)),
                     Wheel(z: -0.1, r: 0.12, w: 0.09, arch: false, track: 0.4, hub: rgb(0.9, 0.8, 0.2))],
            iris: rgb(0.3, 0.2, 0.1), mouth: .buck, mouthY: 0.16, mouthW: 0.12, lampY: 0.235, lampX: 0.065, lampR: 0.022)
        d.bumper = false; d.rearBumper = false
        d.extras = { root, d in
            let body = paint(d.color)
            let steel = paint(rgb(0.45, 0.47, 0.5), metal: 0.5, rough: 0.35)
            // брызговики над задними колёсами
            for s: CGFloat in [-1, 1] {
                let r: CGFloat = 0.12
                let path = UIBezierPath()
                var pts: [CGPoint] = []
                for i in 0...14 { let a = CGFloat(i) / 14 * .pi; pts.append(CGPoint(x: -0.1 + (r + 0.03) * cos(a), y: r + (r + 0.03) * sin(a))) }
                for i in (0...14).reversed() { let a = CGFloat(i) / 14 * .pi; pts.append(CGPoint(x: -0.1 + (r + 0.012) * cos(a), y: r + (r + 0.012) * sin(a))) }
                path.move(to: pts[0]); for q in pts.dropFirst() { path.addLine(to: q) }; path.close()
                let g = extrude(path, depth: 0.1, chamfer: 0.006, body)
                g.position.x = Float(s * 0.155)
                root.addChildNode(g)
            }
            // ковш-погрузчик
            let prof = poly([CGPoint(x: 0.29, y: 0.1), CGPoint(x: 0.29, y: 0.03), CGPoint(x: 0.4, y: 0.02),
                             CGPoint(x: 0.43, y: 0.045), CGPoint(x: 0.32, y: 0.075), CGPoint(x: 0.32, y: 0.1)])
            let bucket = extrude(prof, depth: 0.28, chamfer: 0.008, steel)
            root.addChildNode(bucket)
            for s: CGFloat in [-1, 1] {
                let arm = rbox(0.02, 0.025, 0.2, 0.006, steel)
                arm.position = vec(s * 0.115, 0.17, 0.2)
                arm.eulerAngles.x = -0.25
                root.addChildNode(arm)
                let side = rbox(0.012, 0.075, 0.14, 0.004, steel)
                side.position = vec(s * 0.14, 0.07, 0.36)
                side.eulerAngles.x = -0.0
                root.addChildNode(side)
            }
            // выхлопная труба и решётка
            let pipe = cyl(0.016, 0.14, blackMat)
            pipe.position = vec(0.06, 0.34, 0.13)
            root.addChildNode(pipe)
            let cap = cyl(0.02, 0.012, blackMat)
            cap.position = vec(0.06, 0.41, 0.13)
            root.addChildNode(cap)
            let grille = rbox(0.12, 0.035, 0.01, 0.004, chromeMat)
            grille.position = vec(0, 0.215, d.zFront)
            root.addChildNode(grille)
        }
        return d
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
