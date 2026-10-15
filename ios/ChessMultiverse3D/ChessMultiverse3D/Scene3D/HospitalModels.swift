import SceneKit
import UIKit

/// Тема «Animal Hospital»: большеголовые мультяшные звери-медики. Белые — персонал больницы
/// (светлые халаты, тёплый мех), чёрные — «аномалии» (тёмный мех, тёмно-синие/бордовые халаты,
/// чёрные глянцевые глаза). Мордочки, уши, шапочки и атрибуты собраны из эллипсоидов, выдавленных
/// контуров и тел вращения. Перед фигуры — +z, ноги на y = 0.
///   король — олень-мунтжак (главврач: налобное зеркало, золотой обруч, планшет); у чёрных — кролик в берете с короной
///   ферзь — кролик-медсестра (шапочка с крестом, шприц, маска, жемчуг)
///   ладья — утка-фельдшер в машине скорой помощи
///   слон — вислоухий кролик-бухгалтер (очки, колпак-митра, термометр-посох)
///   конь — каракал-санитар с каталкой, пациентом-мишкой и капельницей
///   пешка — крыс-интерн (налобный фонарик, чемоданчик); у чёрных — слизень с пластырем
enum HospitalModels {

    static func make(kind: PieceKind, color: PieceColor) -> SCNNode {
        let anomaly = color == .black
        let root = SCNNode()
        switch kind {
        case .king:
            let pal = anomaly
                ? Pal(fur: c(0.22, 0.22, 0.27), light: c(0.42, 0.4, 0.48), dark: c(0.1, 0.1, 0.13), inner: c(0.55, 0.3, 0.42),
                      nose: c(0.9, 0.45, 0.6), iris: c(0.9, 0.2, 0.35), coat: c(0.1, 0.13, 0.32), trim: c(0.6, 0.1, 0.22), anomaly: true)
                : Pal(fur: c(0.66, 0.46, 0.3), light: c(0.95, 0.87, 0.74), dark: c(0.38, 0.24, 0.14), inner: c(0.95, 0.68, 0.66),
                      nose: c(0.12, 0.1, 0.1), iris: c(0.45, 0.25, 0.1), coat: c(0.97, 0.98, 1.0), trim: c(0.3, 0.72, 0.78), anomaly: false)
            let ch = character(anomaly ? .rabbit : .muntjac, pal, .king)
            ch.scale = SCNVector3(1.02, 1.02, 1.02)
            root.addChildNode(ch)
        case .queen:
            let pal = anomaly
                ? Pal(fur: c(0.27, 0.24, 0.32), light: c(0.5, 0.45, 0.55), dark: c(0.12, 0.1, 0.15), inner: c(0.6, 0.32, 0.45),
                      nose: c(0.9, 0.45, 0.6), iris: c(0.95, 0.3, 0.5), coat: c(0.4, 0.06, 0.17), trim: c(0.12, 0.14, 0.34), anomaly: true)
                : Pal(fur: c(0.98, 0.87, 0.78), light: c(1.0, 0.95, 0.9), dark: c(0.8, 0.62, 0.52), inner: c(1.0, 0.7, 0.75),
                      nose: c(1.0, 0.5, 0.6), iris: c(0.5, 0.28, 0.18), coat: c(0.98, 0.98, 1.0), trim: c(0.95, 0.6, 0.72), anomaly: false)
            let ch = character(.rabbit, pal, .queen)
            ch.scale = SCNVector3(1.0, 1.0, 1.0)
            root.addChildNode(ch)
        case .rook:
            let pal = anomaly
                ? Pal(fur: c(0.2, 0.2, 0.25), light: c(0.4, 0.4, 0.46), dark: c(0.08, 0.08, 0.1), inner: c(0.5, 0.3, 0.3),
                      nose: c(0.9, 0.5, 0.15), iris: c(0.9, 0.2, 0.3), coat: c(0.1, 0.13, 0.32), trim: c(0.6, 0.1, 0.22), anomaly: true)
                : Pal(fur: c(1.0, 0.83, 0.2), light: c(1.0, 0.93, 0.55), dark: c(0.85, 0.62, 0.1), inner: c(1.0, 0.75, 0.6),
                      nose: c(1.0, 0.55, 0.1), iris: c(0.12, 0.12, 0.2), coat: c(0.97, 0.98, 1.0), trim: c(0.85, 0.15, 0.2), anomaly: false)
            root.addChildNode(ambulance(pal))
        case .bishop:
            let pal = anomaly
                ? Pal(fur: c(0.25, 0.22, 0.24), light: c(0.45, 0.4, 0.43), dark: c(0.1, 0.09, 0.1), inner: c(0.55, 0.3, 0.35),
                      nose: c(0.9, 0.45, 0.55), iris: c(0.9, 0.2, 0.3), coat: c(0.1, 0.13, 0.32), trim: c(0.6, 0.1, 0.22), anomaly: true)
                : Pal(fur: c(0.86, 0.82, 0.74), light: c(0.97, 0.94, 0.88), dark: c(0.55, 0.45, 0.35), inner: c(0.98, 0.72, 0.72),
                      nose: c(0.95, 0.5, 0.58), iris: c(0.35, 0.22, 0.12), coat: c(0.97, 0.98, 1.0), trim: c(0.3, 0.72, 0.78), anomaly: false)
            let ch = character(.lop, pal, .bishop)
            ch.scale = SCNVector3(0.94, 0.94, 0.94)
            root.addChildNode(ch)
        case .knight:
            root.addChildNode(gurneyKnight(anomaly))
        case .pawn:
            if anomaly {
                root.addChildNode(slug())
            } else {
                let pal = Pal(fur: c(0.62, 0.62, 0.68), light: c(0.84, 0.84, 0.88), dark: c(0.4, 0.4, 0.46), inner: c(1.0, 0.7, 0.74),
                              nose: c(1.0, 0.55, 0.62), iris: c(0.15, 0.1, 0.1), coat: c(0.88, 0.97, 0.95), trim: c(0.3, 0.72, 0.78), anomaly: false)
                let ch = character(.rat, pal, .pawn)
                ch.scale = SCNVector3(0.82, 0.82, 0.82)
                root.addChildNode(ch)
            }
        case .none:
            break
        }
        return root
    }

    // MARK: - Типы

    private enum Species { case muntjac, rabbit, lop, duck, caracal, rat }
    private enum Role { case king, queen, rook, bishop, knight, pawn }

    private struct Pal {
        var fur: UIColor, light: UIColor, dark: UIColor, inner: UIColor, nose: UIColor, iris: UIColor
        var coat: UIColor, trim: UIColor
        var anomaly: Bool
    }

    private static let gold = c(0.95, 0.76, 0.2)
    private static let red = c(0.88, 0.1, 0.16)

    // MARK: - Помощники

    private static func c(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> UIColor { UIColor(red: r, green: g, blue: b, alpha: 1) }
    private static func v(_ x: CGFloat, _ y: CGFloat, _ z: CGFloat) -> SCNVector3 { SCNVector3(Float(x), Float(y), Float(z)) }

    private static func mat(_ col: UIColor, _ rough: CGFloat = 0.8, metal: CGFloat = 0, emit: UIColor? = nil) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = col
        m.roughness.contents = rough
        m.metalness.contents = metal
        if let e = emit { m.emission.contents = e }
        return m
    }
    private static func fur(_ col: UIColor) -> SCNMaterial { mat(col, 0.85) }
    private static func cloth(_ col: UIColor) -> SCNMaterial { let m = mat(col, 0.8); m.isDoubleSided = true; return m }
    private static func plastic(_ col: UIColor) -> SCNMaterial { mat(col, 0.3) }
    private static func metalMat(_ col: UIColor) -> SCNMaterial { mat(col, 0.35, metal: 0.8) }

    @discardableResult
    private static func ell(_ parent: SCNNode, _ rx: CGFloat, _ ry: CGFloat, _ rz: CGFloat, _ m: SCNMaterial, _ p: SCNVector3,
                            seg: Int? = nil) -> SCNNode {
        let s = SCNSphere(radius: 1)
        s.segmentCount = seg ?? ((rx + ry + rz) > 0.3 ? 22 : 12)
        s.materials = [m]
        let n = SCNNode(geometry: s)
        n.scale = v(rx, ry, rz)
        n.position = p
        parent.addChildNode(n)
        return n
    }

    @discardableResult
    private static func box(_ parent: SCNNode, _ w: CGFloat, _ h: CGFloat, _ l: CGFloat, _ m: SCNMaterial, _ p: SCNVector3,
                            chamfer: CGFloat = 0) -> SCNNode {
        let b = SCNBox(width: w, height: h, length: l, chamferRadius: chamfer)
        b.chamferSegmentCount = 2
        b.materials = [m]
        let n = SCNNode(geometry: b)
        n.position = p
        parent.addChildNode(n)
        return n
    }

    @discardableResult
    private static func cyl(_ parent: SCNNode, _ r: CGFloat, _ h: CGFloat, _ m: SCNMaterial, _ p: SCNVector3, seg: Int = 16) -> SCNNode {
        let g = SCNCylinder(radius: r, height: h)
        g.radialSegmentCount = seg
        g.materials = [m]
        let n = SCNNode(geometry: g)
        n.position = p
        parent.addChildNode(n)
        return n
    }

    @discardableResult
    private static func torus(_ parent: SCNNode, _ ring: CGFloat, _ pipe: CGFloat, _ m: SCNMaterial, _ p: SCNVector3) -> SCNNode {
        let t = SCNTorus(ringRadius: ring, pipeRadius: pipe)
        t.ringSegmentCount = 28
        t.pipeSegmentCount = 8
        t.materials = [m]
        let n = SCNNode(geometry: t)
        n.position = p
        parent.addChildNode(n)
        return n
    }

    /// Капсула/цилиндр между двумя точками.
    @discardableResult
    private static func limb(_ parent: SCNNode, from a: SCNVector3, to b: SCNVector3, r: CGFloat, _ m: SCNMaterial, round: Bool = true) -> SCNNode {
        let dx = CGFloat(b.x - a.x), dy = CGFloat(b.y - a.y), dz = CGFloat(b.z - a.z)
        let len = max(sqrt(dx * dx + dy * dy + dz * dz), 0.0001)
        let geo: SCNGeometry
        if round {
            let cap = SCNCapsule(capRadius: r, height: len + 2 * r)
            cap.radialSegmentCount = 12
            cap.capSegmentCount = 4
            geo = cap
        } else {
            let cy = SCNCylinder(radius: r, height: len)
            cy.radialSegmentCount = 12
            geo = cy
        }
        geo.materials = [m]
        let n = SCNNode(geometry: geo)
        n.position = v(CGFloat(a.x + b.x) / 2, CGFloat(a.y + b.y) / 2, CGFloat(a.z + b.z) / 2)
        let d = SCNVector3(Float(dx / len), Float(dy / len), Float(dz / len))
        // поворот оси Y к направлению d
        let dotY = CGFloat(d.y)
        if dotY < -0.9999 {
            n.eulerAngles = SCNVector3(Float.pi, 0, 0)
        } else if dotY < 0.9999 {
            let ax = SCNVector3(d.z, 0, -d.x) // cross((0,1,0), d)
            let axLen = sqrt(ax.x * ax.x + ax.z * ax.z)
            n.rotation = SCNVector4(ax.x / axLen, 0, ax.z / axLen, Float(acos(dotY)))
        }
        parent.addChildNode(n)
        return n
    }

    private static func smooth(_ pts: [CGPoint], steps: Int = 4) -> [CGPoint] {
        guard pts.count > 2 else { return pts }
        var out: [CGPoint] = []
        for i in 0..<(pts.count - 1) {
            let p0 = pts[max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[min(i + 2, pts.count - 1)]
            for s in 0..<steps {
                let t = CGFloat(s) / CGFloat(steps)
                let t2 = t * t
                let t3 = t2 * t
                let ax: CGFloat = 2 * p1.x
                let bx: CGFloat = (p2.x - p0.x) * t
                let cx: CGFloat = (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
                let dx: CGFloat = (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3
                let ay: CGFloat = 2 * p1.y
                let by: CGFloat = (p2.y - p0.y) * t
                let cy: CGFloat = (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
                let dy: CGFloat = (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3
                out.append(CGPoint(x: max(0, 0.5 * (ax + bx + cx + dx)), y: 0.5 * (ay + by + cy + dy)))
            }
        }
        out.append(pts[pts.count - 1])
        return out
    }

    /// Тело вращения вокруг Y по профилю (r, y), идущему снизу вверх.
    private static func revolve(_ profile: [CGPoint], seg: Int = 26, steps: Int = 4, _ m: SCNMaterial) -> SCNNode {
        let pts = smooth(profile, steps: steps)
        var verts: [SCNVector3] = [], norms: [SCNVector3] = []
        var idx: [Int32] = []
        let n = pts.count
        for j in 0..<n {
            let a = pts[max(j - 1, 0)], b = pts[min(j + 1, n - 1)]
            var dr = b.x - a.x, dy = b.y - a.y
            let len = max(sqrt(dr * dr + dy * dy), 0.000001)
            dr /= len; dy /= len
            let nr = dy, ny = -dr
            for k in 0...seg {
                let ang = 2 * CGFloat.pi * CGFloat(k) / CGFloat(seg)
                let s = sin(ang), co = cos(ang)
                verts.append(v(pts[j].x * s, pts[j].y, pts[j].x * co))
                norms.append(v(nr * s, ny, nr * co))
            }
        }
        for j in 0..<(n - 1) {
            for k in 0..<seg {
                let a = Int32(j * (seg + 1) + k), b = a + 1, cc = a + Int32(seg + 1), d = cc + 1
                idx += [a, b, cc, b, d, cc]
            }
        }
        let geo = SCNGeometry(sources: [SCNGeometrySource(vertices: verts), SCNGeometrySource(normals: norms)],
                              elements: [SCNGeometryElement(indices: idx, primitiveType: .triangles)])
        m.isDoubleSided = true
        geo.materials = [m]
        return SCNNode(geometry: geo)
    }

    /// Выдавленный контур. Путь задаётся в сантиметрах (1 ед. = 1 см), результат масштабируется в метры.
    @discardableResult
    private static func shape(_ parent: SCNNode, _ path: UIBezierPath, depth: CGFloat, chamfer: CGFloat = 0.3, _ m: SCNMaterial,
                              at p: SCNVector3 = SCNVector3Zero) -> SCNNode {
        path.flatness = 0.04
        let s = SCNShape(path: path, extrusionDepth: depth)
        s.chamferRadius = chamfer
        s.materials = [m]
        let inner = SCNNode(geometry: s)
        inner.scale = v(0.01, 0.01, 0.01)
        let holder = SCNNode()
        holder.position = p
        holder.addChildNode(inner)
        parent.addChildNode(holder)
        return holder
    }

    /// Листовидное ухо: w — полуширина, h — высота (см), round 0…1 — закруглённость кончика.
    private static func leafPath(w: CGFloat, h: CGFloat, round: CGFloat) -> UIBezierPath {
        let p = UIBezierPath()
        p.move(to: .zero)
        p.addCurve(to: CGPoint(x: 0, y: h),
                   controlPoint1: CGPoint(x: w * 1.25, y: h * 0.05),
                   controlPoint2: CGPoint(x: w * (0.15 + 0.9 * round), y: h * (0.75 + 0.3 * round)))
        p.addCurve(to: .zero,
                   controlPoint1: CGPoint(x: -w * (0.15 + 0.9 * round), y: h * (0.75 + 0.3 * round)),
                   controlPoint2: CGPoint(x: -w * 1.25, y: h * 0.05))
        p.close()
        return p
    }

    /// Улыбка (дуга вниз), ширина w см.
    private static func smileNode(_ parent: SCNNode, width w: CGFloat, thick: CGFloat, _ m: SCNMaterial, at p: SCNVector3, open: CGFloat = 1) {
        let r = w * 0.9
        let line = UIBezierPath()
        let a: CGFloat = asin(min(w / 2 / r, 0.99))
        for i in 0...10 {
            let t = -a + 2 * a * CGFloat(i) / 10
            let pt = CGPoint(x: r * sin(t), y: (-r * cos(t) + r) * open)
            if i == 0 { line.move(to: pt) } else { line.addLine(to: pt) }
        }
        let stroked = line.cgPath.copy(strokingWithWidth: thick, lineCap: .round, lineJoin: .round, miterLimit: 1)
        let sp = UIBezierPath(cgPath: stroked)
        shape(parent, sp, depth: 0.6, chamfer: 0.1, m, at: p)
    }

    // MARK: - Глаза

    private static func eye(_ parent: SCNNode, R: CGFloat, pal: Pal, scale k: CGFloat = 1, lashes: Bool = false) -> SCNNode {
        let e = SCNNode()
        let white = pal.anomaly ? mat(c(0.03, 0.03, 0.05), 0.15) : mat(c(1, 1, 1), 0.25)
        ell(e, 0.23 * R * k, 0.28 * R * k, 0.1 * R * k, white, SCNVector3Zero, seg: 18)
        let irisM = pal.anomaly ? mat(c(0.08, 0.02, 0.06), 0.2, emit: pal.iris.withAlphaComponent(1)) : mat(pal.iris, 0.25)
        if pal.anomaly {
            // светящееся кольцо радужки у аномалий
            ell(e, 0.15 * R * k, 0.2 * R * k, 0.06 * R * k, mat(c(0.03, 0.03, 0.05), 0.15), v(0, -0.01 * R, 0.055 * R * k), seg: 16)
            let ring = torus(e, 0.13 * R * k, 0.022 * R * k, irisM, v(0, -0.01 * R * k, 0.1 * R * k))
            ring.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
            ring.scale = v(1, 1, 1.28)
        } else {
            ell(e, 0.175 * R * k, 0.225 * R * k, 0.07 * R * k, irisM, v(0, -0.015 * R * k, 0.05 * R * k), seg: 16)
            ell(e, 0.095 * R * k, 0.14 * R * k, 0.05 * R * k, mat(c(0.02, 0.02, 0.03), 0.2), v(0, -0.015 * R * k, 0.085 * R * k), seg: 14)
        }
        let glow = mat(c(1, 1, 1), 0.2, emit: .white)
        ell(e, 0.06 * R * k, 0.07 * R * k, 0.04 * R * k, glow, v(0.07 * R * k, 0.1 * R * k, 0.115 * R * k), seg: 10)
        ell(e, 0.03 * R * k, 0.035 * R * k, 0.025 * R * k, glow, v(-0.07 * R * k, -0.09 * R * k, 0.115 * R * k), seg: 8)
        parent.addChildNode(e)
        return e
    }

    // MARK: - Голова

    private static func headSurface(_ R: CGFloat, az: CGFloat, el: CGFloat, k: CGFloat = 1) -> SCNVector3 {
        v(1.06 * R * sin(az) * cos(el) * k, 0.94 * R * sin(el) * k, 1.0 * R * cos(az) * cos(el) * k)
    }

    private static func orient(_ n: SCNNode, az: CGFloat, el: CGFloat) {
        n.eulerAngles = SCNVector3(Float(-el), Float(az), 0)
    }

    /// Голова зверя в локальных координатах (центр = 0, радиус R).
    private static func head(_ sp: Species, _ pal: Pal, R: CGFloat, role: Role) -> SCNNode {
        let h = SCNNode()
        let furM = fur(pal.fur), lightM = fur(pal.light), darkM = fur(pal.dark)
        let innerM = fur(pal.inner)
        let noseM = mat(pal.nose, 0.25)
        let skull = ell(h, 1.06 * R, 0.94 * R, 1.0 * R, furM, SCNVector3Zero, seg: 32)
        skull.name = "skull"

        let eyeAz: CGFloat
        let eyeEl: CGFloat
        switch sp {
        case .duck: eyeAz = 0.56; eyeEl = 0.12
        case .rat: eyeAz = 0.5; eyeEl = 0.1
        case .muntjac: eyeAz = 0.5; eyeEl = 0.08
        default: eyeAz = 0.48; eyeEl = 0.1
        }
        let eyeK: CGFloat = sp == .duck ? 0.95 : 1.0
        for side: CGFloat in [-1, 1] {
            let e = eye(h, R: R, pal: pal, scale: eyeK)
            e.position = headSurface(R, az: side * eyeAz, el: eyeEl, k: 0.96)
            orient(e, az: side * eyeAz, el: eyeEl)
            // брови
            let browM = darkM
            let br = ell(h, 0.2 * R, 0.04 * R, 0.05 * R, browM, SCNVector3Zero, seg: 10)
            br.position = headSurface(R, az: side * (eyeAz + 0.05), el: eyeEl + 0.46, k: 1.0)
            br.eulerAngles = SCNVector3(Float(-(eyeEl + 0.46)), Float(side * (eyeAz + 0.05)), Float(side * 0.25 * (pal.anomaly ? -1.6 : 1)))
            // щёчки
            let ch = ell(h, 0.17 * R, 0.1 * R, 0.04 * R, mat(pal.anomaly ? c(0.5, 0.25, 0.4) : c(1.0, 0.55, 0.6), 1), SCNVector3Zero, seg: 10)
            ch.position = headSurface(R, az: side * (eyeAz + 0.5), el: eyeEl - 0.4, k: 0.99)
            orient(ch, az: side * (eyeAz + 0.5), el: eyeEl - 0.4)
        }

        let mouthM = mat(c(0.18, 0.08, 0.1), 0.6)
        let R100 = R * 100

        switch sp {
        case .muntjac:
            ell(h, 0.4 * R, 0.34 * R, 0.55 * R, lightM, v(0, -0.3 * R, 0.7 * R), seg: 22)
            ell(h, 0.17 * R, 0.12 * R, 0.11 * R, noseM, v(0, -0.2 * R, 1.23 * R), seg: 14)
            smileNode(h, width: R100 * 0.24, thick: R100 * 0.03, mouthM, at: v(0, -0.37 * R, 1.17 * R))
            // уши-листья
            for side: CGFloat in [-1, 1] {
                let ear = SCNNode()
                ear.position = v(side * 0.9 * R, 0.42 * R, -0.12 * R)
                ear.eulerAngles = SCNVector3(0, Float(side * 0.7), Float(-side * 1.15))
                shape(ear, leafPath(w: R100 * 0.32, h: R100 * 0.95, round: 0.35), depth: R100 * 0.07, furM)
                shape(ear, leafPath(w: R100 * 0.2, h: R100 * 0.75, round: 0.35), depth: R100 * 0.09, innerM, at: v(0, 0.04 * R, 0.0))
                h.addChildNode(ear)
            }
            // чёлка-хохолок
            ell(h, 0.2 * R, 0.14 * R, 0.16 * R, darkM, v(0, 0.86 * R, 0.4 * R), seg: 12)
            if role == .king {
                // небольшие рожки
                for side: CGFloat in [-1, 1] {
                    let a = SCNCone(topRadius: 0.008, bottomRadius: 0.026, height: R * 0.8)
                    a.radialSegmentCount = 10
                    a.materials = [mat(c(0.3, 0.2, 0.12), 0.7)]
                    let n = SCNNode(geometry: a)
                    n.position = v(side * 0.34 * R, 1.08 * R, 0.1 * R)
                    n.eulerAngles = SCNVector3(Float(-0.3), 0, Float(-side * 0.25))
                    h.addChildNode(n)
                }
            }
        case .rabbit, .lop:
            for side: CGFloat in [-1, 1] {
                ell(h, 0.31 * R, 0.27 * R, 0.3 * R, lightM, v(side * 0.26 * R, -0.34 * R, 0.82 * R), seg: 16)
            }
            ell(h, 0.2 * R, 0.17 * R, 0.2 * R, lightM, v(0, -0.2 * R, 0.96 * R), seg: 14)
            ell(h, 0.11 * R, 0.08 * R, 0.08 * R, noseM, v(0, -0.12 * R, 1.09 * R), seg: 12)
            for side: CGFloat in [-1, 1] {
                smileNode(h, width: R100 * 0.14, thick: R100 * 0.025, mouthM, at: v(side * 0.07 * R, -0.3 * R, 1.06 * R))
            }
            for side: CGFloat in [-1, 1] {
                box(h, 0.075 * R, 0.1 * R, 0.03 * R, mat(c(1, 1, 0.98), 0.4), v(side * 0.042 * R, -0.43 * R, 1.04 * R), chamfer: 0.005)
            }
            whiskers(h, R: R, y: -0.28 * R, z: 1.0 * R, spread: 0.45, color: c(0.95, 0.95, 0.95))
            for side: CGFloat in [-1, 1] {
                let ear = SCNNode()
                if sp == .rabbit {
                    ear.position = v(side * 0.46 * R, 0.78 * R, -0.06 * R)
                    ear.eulerAngles = SCNVector3(Float(-0.08), Float(side * 0.28), Float(-side * 0.2))
                    shape(ear, leafPath(w: R100 * 0.42, h: R100 * 1.45, round: 0.85), depth: R100 * 0.08, furM)
                    shape(ear, leafPath(w: R100 * 0.27, h: R100 * 1.2, round: 0.85), depth: R100 * 0.1, innerM, at: v(0, 0.06 * R, 0))
                } else {
                    ear.position = v(side * 0.95 * R, 0.38 * R, 0)
                    ear.eulerAngles = SCNVector3(0, Float(side * 0.5), Float(side * (CGFloat.pi + 0.28)))
                    shape(ear, leafPath(w: R100 * 0.5, h: R100 * 1.1, round: 0.9), depth: R100 * 0.1, furM)
                    shape(ear, leafPath(w: R100 * 0.33, h: R100 * 0.88, round: 0.9), depth: R100 * 0.12, innerM, at: v(0, 0.05 * R, 0))
                }
                h.addChildNode(ear)
            }
        case .duck:
            let billM = mat(c(1.0, 0.55, 0.1), 0.3)
            let bill2M = mat(c(0.95, 0.42, 0.08), 0.3)
            let up = ell(h, 0.5 * R, 0.14 * R, 0.4 * R, billM, v(0, -0.1 * R, 1.0 * R), seg: 20)
            up.eulerAngles = SCNVector3(Float(0.04), 0, 0)
            ell(h, 0.44 * R, 0.1 * R, 0.33 * R, bill2M, v(0, -0.25 * R, 0.98 * R), seg: 18)
            for side: CGFloat in [-1, 1] {
                ell(h, 0.03 * R, 0.02 * R, 0.05 * R, mat(c(0.6, 0.25, 0.05), 0.5), v(side * 0.12 * R, -0.04 * R, 1.26 * R), seg: 8)
            }
            smileNode(h, width: R100 * 0.5, thick: R100 * 0.025, mouthM, at: v(0, -0.22 * R, 1.28 * R), open: 0.6)
            // хохолок
            if role != .rook {
                for (i, dx) in [-0.14, 0, 0.14].enumerated() {
                    let f = ell(h, 0.07 * R, 0.26 * R, 0.05 * R, furM, v(CGFloat(dx) * R, 1.05 * R, 0.02 * R), seg: 10)
                    f.eulerAngles = SCNVector3(Float(-0.25), 0, Float(CGFloat(-dx) * 2.5))
                    _ = i
                }
            }
        case .caracal:
            ell(h, 0.3 * R, 0.25 * R, 0.37 * R, lightM, v(0, -0.28 * R, 0.84 * R), seg: 18)
            ell(h, 0.1 * R, 0.075 * R, 0.07 * R, mat(c(0.9, 0.5, 0.55), 0.3), v(0, -0.13 * R, 1.17 * R), seg: 12)
            smileNode(h, width: R100 * 0.26, thick: R100 * 0.026, mouthM, at: v(0, -0.37 * R, 1.08 * R))
            for side: CGFloat in [-1, 1] {
                ell(h, 0.35 * R, 0.28 * R, 0.3 * R, furM, v(side * 0.62 * R, -0.3 * R, 0.5 * R), seg: 14)
            }
            whiskers(h, R: R, y: -0.25 * R, z: 1.05 * R, spread: 0.5, color: c(0.98, 0.98, 0.98))
            // слёзные полоски
            for side: CGFloat in [-1, 1] {
                limb(h, from: headSurface(R, az: side * 0.52, el: -0.2, k: 1.0), to: headSurface(R, az: side * 0.6, el: -0.62, k: 1.0),
                     r: 0.02 * R, mat(c(0.12, 0.1, 0.1), 0.6))
                let ear = SCNNode()
                ear.position = v(side * 0.64 * R, 0.76 * R, -0.08 * R)
                ear.eulerAngles = SCNVector3(Float(-0.05), Float(side * 0.35), Float(-side * 0.32))
                shape(ear, leafPath(w: R100 * 0.4, h: R100 * 0.95, round: 0.15), depth: R100 * 0.08, furM)
                shape(ear, leafPath(w: R100 * 0.26, h: R100 * 0.7, round: 0.15), depth: R100 * 0.1, innerM, at: v(0, 0.04 * R, 0))
                // чёрная кисточка
                let t = SCNCone(topRadius: 0, bottomRadius: R * 0.06, height: R * 0.55)
                t.radialSegmentCount = 10
                t.materials = [mat(c(0.08, 0.07, 0.07), 0.7)]
                let tn = SCNNode(geometry: t)
                tn.position = v(0, R * 0.95 + R * 0.2, 0)
                ear.addChildNode(tn)
                h.addChildNode(ear)
            }
            // полоски на лбу
            for dx in [-0.12, 0, 0.12] {
                limb(h, from: v(CGFloat(dx) * R, 0.68 * R, 0.72 * R), to: v(CGFloat(dx) * R * 1.1, 0.9 * R, 0.4 * R), r: 0.018 * R, mat(c(0.2, 0.15, 0.1), 0.7))
            }
        case .rat:
            ell(h, 0.3 * R, 0.27 * R, 0.58 * R, lightM, v(0, -0.22 * R, 0.82 * R), seg: 18)
            ell(h, 0.11 * R, 0.1 * R, 0.1 * R, noseM, v(0, -0.12 * R, 1.38 * R), seg: 12)
            smileNode(h, width: R100 * 0.2, thick: R100 * 0.025, mouthM, at: v(0, -0.36 * R, 1.22 * R))
            box(h, 0.08 * R, 0.1 * R, 0.03 * R, mat(c(1, 1, 0.98), 0.4), v(0, -0.46 * R, 1.24 * R), chamfer: 0.005)
            whiskers(h, R: R, y: -0.2 * R, z: 1.2 * R, spread: 0.6, color: c(0.95, 0.95, 0.97))
            for side: CGFloat in [-1, 1] {
                let ear = SCNNode()
                ear.position = v(side * 0.72 * R, 0.68 * R, -0.12 * R)
                ear.eulerAngles = SCNVector3(0, Float(side * 0.55), Float(-side * 0.4))
                ell(ear, 0.46 * R, 0.5 * R, 0.07 * R, furM, v(0, 0.2 * R, 0), seg: 18)
                ell(ear, 0.34 * R, 0.38 * R, 0.04 * R, innerM, v(0, 0.2 * R, 0.045 * R), seg: 16)
                h.addChildNode(ear)
            }
        }
        return h
    }

    private static func whiskers(_ h: SCNNode, R: CGFloat, y: CGFloat, z: CGFloat, spread: CGFloat, color: UIColor) {
        let m = mat(color, 0.5)
        for side: CGFloat in [-1, 1] {
            for (i, dy) in [0.07, 0.0, -0.07].enumerated() {
                let a = v(side * 0.2 * R, y + CGFloat(dy) * R, z)
                let b = v(side * (0.2 + spread) * R, y + CGFloat(dy) * R + CGFloat(1 - i) * 0.05 * R, z - 0.12 * R)
                limb(h, from: a, to: b, r: 0.006, m, round: false)
            }
        }
    }

    // MARK: - Персонаж

    private static func gownRadius(_ y: CGFloat) -> CGFloat {
        let prof: [(CGFloat, CGFloat)] = [(0.03, 0.0), (0.06, 0.2), (0.14, 0.185), (0.24, 0.16), (0.32, 0.14), (0.38, 0.125), (0.42, 0.09)]
        for i in 0..<(prof.count - 1) where y >= prof[i].0 && y <= prof[i + 1].0 {
            let t = (y - prof[i].0) / (prof[i + 1].0 - prof[i].0)
            return prof[i].1 + (prof[i + 1].1 - prof[i].1) * t
        }
        return 0.1
    }

    private static func character(_ sp: Species, _ pal: Pal, _ role: Role, feet: Bool = true) -> SCNNode {
        let n = SCNNode()
        let furM = fur(pal.fur), darkM = fur(pal.dark)
        let coatM = cloth(pal.coat)
        let trimM = cloth(pal.trim)
        let R: CGFloat = 0.18
        let headY: CGFloat = 0.6

        // ноги (лапки/башмаки)
        if feet {
            let shoeM: SCNMaterial = sp == .duck ? mat(c(1.0, 0.55, 0.1), 0.4) : (pal.anomaly ? plastic(c(0.08, 0.08, 0.12)) : fur(pal.dark))
            for side: CGFloat in [-1, 1] {
                let f = ell(n, 0.065, 0.032, sp == .duck ? 0.1 : 0.085, shoeM, v(side * 0.085, 0.032, 0.13), seg: 14)
                f.eulerAngles = SCNVector3(0, Float(side * 0.15), 0)
            }
        }

        // халат (тело вращения)
        let gown = revolve([CGPoint(x: 0, y: 0.03), CGPoint(x: 0.2, y: 0.03), CGPoint(x: 0.185, y: 0.14), CGPoint(x: 0.16, y: 0.24),
                            CGPoint(x: 0.14, y: 0.32), CGPoint(x: 0.125, y: 0.38), CGPoint(x: 0.09, y: 0.42), CGPoint(x: 0.07, y: 0.45),
                            CGPoint(x: 0, y: 0.45)], seg: 28, coatM)
        n.addChildNode(gown)
        // нижняя окантовка халата
        let hem = torus(n, 0.192, 0.011, trimM, v(0, 0.045, 0))
        hem.scale = v(1, 1.0, 1)

        // шея
        cyl(n, 0.065, 0.12, furM, v(0, 0.46, 0.01))

        // воротник: отложной, два лацкана
        let collar = torus(n, 0.085, 0.022, coatM, v(0, 0.425, -0.005))
        collar.scale = v(1, 1, 0.95)
        for side: CGFloat in [-1, 1] {
            let lap = box(n, 0.075, 0.06, 0.012, trimM, v(side * 0.042, 0.39, 0.097), chamfer: 0.004)
            lap.eulerAngles = SCNVector3(Float(-0.2), Float(side * -0.35), Float(side * 0.55))
        }

        // пуговицы
        for (y, r) in [(0.33, 0.0), (0.25, 0.0), (0.17, 0.0)] as [(CGFloat, CGFloat)] {
            _ = r
            ell(n, 0.014, 0.014, 0.012, role == .king || role == .queen ? mat(gold, 0.3, metal: 0.8) : mat(c(0.8, 0.82, 0.88), 0.3, metal: 0.4),
                v(0, y, gownRadius(y) + 0.004), seg: 10)
        }
        // красный крест на груди (на кармане)
        let pocket = box(n, 0.07, 0.065, 0.01, trimM, v(-0.065, 0.3, gownRadius(0.3) + 0.0), chamfer: 0.003)
        pocket.eulerAngles = SCNVector3(0, Float(-0.35), 0)
        let cross = SCNNode()
        cross.position = v(-0.07, 0.3, gownRadius(0.3) + 0.011)
        cross.eulerAngles = SCNVector3(0, Float(-0.4), 0)
        box(cross, 0.04, 0.012, 0.006, plastic(red), SCNVector3Zero)
        box(cross, 0.012, 0.04, 0.006, plastic(red), SCNVector3Zero)
        n.addChildNode(cross)

        // голова
        let hd = head(sp, pal, R: R, role: role)
        hd.position = v(0, headY, 0.01)
        n.addChildNode(hd)

        // руки (по умолчанию висят; роль может переопределить)
        func arm(_ side: CGFloat, wrist: SCNVector3) {
            let sh = v(side * 0.128, 0.37, 0)
            let elbow = v(side * 0.17, 0.3, 0.025)
            limb(n, from: sh, to: elbow, r: 0.042, coatM)
            limb(n, from: elbow, to: wrist, r: 0.037, coatM)
            let paw = ell(n, 0.04, 0.036, 0.04, sp == .duck ? mat(pal.fur, 0.6) : furM, wrist, seg: 14)
            _ = paw
            // манжета
            let cuff = torus(n, 0.034, 0.008, trimM, v(CGFloat(wrist.x) * 0.96 + CGFloat(elbow.x) * 0.04, CGFloat(wrist.y) + 0.03, CGFloat(wrist.z)))
            cuff.isHidden = true
        }

        switch role {
        case .king:
            arm(1, wrist: v(0.2, 0.2, 0.05))
            arm(-1, wrist: v(-0.15, 0.27, 0.14))
            stethoscope(n, pal: pal)
            // планшет в руке
            let cb = SCNNode()
            cb.position = v(-0.15, 0.3, 0.19)
            cb.eulerAngles = SCNVector3(Float(-0.3), Float(0.25), 0)
            box(cb, 0.125, 0.165, 0.012, plastic(c(0.5, 0.33, 0.2)), SCNVector3Zero, chamfer: 0.004)
            box(cb, 0.105, 0.14, 0.006, mat(c(0.98, 0.98, 0.96), 0.7), v(0, -0.005, 0.008))
            box(cb, 0.06, 0.02, 0.014, metalMat(c(0.8, 0.82, 0.85)), v(0, 0.08, 0.008))
            box(cb, 0.032, 0.008, 0.004, plastic(red), v(-0.0, 0.035, 0.013))
            box(cb, 0.008, 0.032, 0.004, plastic(red), v(0, 0.035, 0.013))
            for (i, yy) in [-0.01, -0.035, -0.06].enumerated() {
                box(cb, i == 2 ? 0.05 : 0.075, 0.007, 0.003, mat(c(0.45, 0.5, 0.6), 0.6), v(i == 2 ? -0.012 : 0, CGFloat(yy), 0.012))
            }
            n.addChildNode(cb)
            if sp == .muntjac {
                // золотой обруч + налобное зеркало
                let band = torus(hd, 0.99 * R, 0.05 * R, mat(gold, 0.3, metal: 0.8), v(0, 0.46 * R, 0))
                band.scale = v(1.0, 1, 1.0)
                band.eulerAngles = SCNVector3(Float(0.0), 0, 0)
                for i in 0..<5 {
                    let a = CGFloat(i) * 0.5 - 1.0
                    let spike = SCNCone(topRadius: 0, bottomRadius: R * 0.07, height: R * 0.28)
                    spike.radialSegmentCount = 8
                    spike.materials = [mat(gold, 0.3, metal: 0.8)]
                    let sn = SCNNode(geometry: spike)
                    let pt = headSurface(R, az: a, el: 0.5, k: 1.02)
                    sn.position = pt
                    sn.position.y += Float(R * 0.1)
                    hd.addChildNode(sn)
                }
                let mirror = SCNNode()
                mirror.position = v(0, 0.52 * R, 0.94 * R)
                mirror.eulerAngles = SCNVector3(Float(Double.pi / 2 - 0.2), 0, 0)
                let rim = torus(mirror, 0.3 * R, 0.045 * R, mat(gold, 0.3, metal: 0.8), SCNVector3Zero)
                rim.scale = v(1, 1, 1)
                cyl(mirror, 0.3 * R, 0.03 * R, mat(c(0.9, 0.95, 1), 0.08, metal: 0.9), SCNVector3Zero, seg: 24)
                cyl(mirror, 0.06 * R, 0.05 * R, mat(c(0.15, 0.15, 0.18), 0.4), v(0, 0.01 * R, 0))
                hd.addChildNode(mirror)
            } else {
                beret(hd, R: R, pal: pal)
                crown(hd, R: R)
            }
        case .queen:
            arm(-1, wrist: v(-0.2, 0.2, 0.05))
            arm(1, wrist: v(0.15, 0.32, 0.14))
            stethoscope(n, pal: pal)
            // жемчужное ожерелье
            for i in 0..<9 {
                let a = (CGFloat(i) - 4) * 0.22
                ell(n, 0.014, 0.014, 0.014, mat(c(0.98, 0.96, 0.95), 0.2), v(0.08 * sin(a * 1.3), 0.435 - 0.012 * (1 - cos(a * 1.0)) * 0 - 0.02 * (1 - cos(a)), 0.085 * cos(a)), seg: 8)
            }
            syringe(n, pal: pal, at: v(0.15, 0.4, 0.17))
            nurseHat(hd, R: R, pal: pal)
            mask(hd, R: R, pal: pal)
        case .rook:
            arm(1, wrist: v(0.2, 0.22, 0.06))
            arm(-1, wrist: v(-0.2, 0.22, 0.06))
            paramedicCap(hd, R: R, pal: pal)
            mask(hd, R: R, pal: pal)
        case .bishop:
            arm(-1, wrist: v(-0.17, 0.2, 0.07))
            arm(1, wrist: v(0.2, 0.3, 0.1))
            thermometerStaff(n, pal: pal, at: v(0.22, 0.0, 0.1))
            bishopCap(hd, R: R, pal: pal)
            glasses(hd, R: R, eyeAz: 0.48, eyeEl: 0.1)
        case .knight:
            arm(1, wrist: v(0.17, 0.26, 0.11))
            arm(-1, wrist: v(-0.17, 0.26, 0.11))
            headband(hd, R: R, pal: pal, lamp: false)
            mask(hd, R: R, pal: pal)
        case .pawn:
            arm(-1, wrist: v(-0.2, 0.2, 0.05))
            arm(1, wrist: v(0.2, 0.22, 0.05))
            medBag(n, pal: pal, at: v(0.235, 0.12, 0.06))
            headband(hd, R: R, pal: pal, lamp: true)
            // хвост
            let tail = mat(c(0.88, 0.62, 0.66), 0.6)
            var prev = v(0, 0.08, -0.17)
            for i in 1...6 {
                let t = CGFloat(i)
                let next = v(sin(t * 0.9) * 0.1, 0.06 + t * 0.003, -0.17 - t * 0.04)
                limb(n, from: prev, to: next, r: max(0.016 - t * 0.0015, 0.006), tail)
                prev = next
            }
            if sp == .rat { }
        }
        return n
    }

    // MARK: - Аксессуары

    private static func stethoscope(_ n: SCNNode, pal: Pal) {
        let m = metalMat(c(0.55, 0.58, 0.64))
        let tube = mat(c(0.15, 0.15, 0.2), 0.4)
        let ring = torus(n, 0.075, 0.009, tube, v(0, 0.4, 0.015))
        ring.scale = v(1, 1, 1.0)
        // две трубки вниз на груди
        for side: CGFloat in [-1, 1] {
            limb(n, from: v(side * 0.07, 0.4, 0.05), to: v(side * 0.015, 0.25, gownRadius(0.25) + 0.012), r: 0.008, tube)
        }
        let disc = cyl(n, 0.026, 0.012, m, v(0.0, 0.24, gownRadius(0.24) + 0.014))
        disc.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
    }

    private static func syringe(_ n: SCNNode, pal: Pal, at p: SCNVector3) {
        let g = SCNNode()
        g.position = p
        g.eulerAngles = SCNVector3(Float(0.25), 0, Float(-0.15))
        let glass = mat(c(0.85, 0.95, 1.0), 0.15)
        glass.transparency = 0.45
        cyl(g, 0.02, 0.15, glass, SCNVector3Zero)
        let liquid = pal.anomaly ? c(0.7, 0.2, 0.9) : c(0.25, 0.9, 0.6)
        cyl(g, 0.0155, 0.1, mat(liquid, 0.2, emit: liquid.withAlphaComponent(1)), v(0, 0.02, 0))
        cyl(g, 0.006, 0.07, plastic(c(0.9, 0.9, 0.92)), v(0, -0.11, 0))
        cyl(g, 0.022, 0.008, plastic(red), v(0, -0.15, 0))
        box(g, 0.075, 0.008, 0.026, plastic(c(0.95, 0.95, 0.97)), v(0, -0.07, 0), chamfer: 0.003)
        cyl(g, 0.0045, 0.075, metalMat(c(0.85, 0.87, 0.9)), v(0, 0.113, 0))
        n.addChildNode(g)
    }

    private static func thermometerStaff(_ n: SCNNode, pal: Pal, at p: SCNVector3) {
        let g = SCNNode()
        g.position = p
        let glass = mat(c(0.9, 0.97, 1.0), 0.12)
        glass.transparency = 0.5
        cyl(g, 0.02, 0.7, glass, v(0, 0.4, 0))
        let hot = red
        cyl(g, 0.009, 0.5, mat(hot, 0.2, emit: hot.withAlphaComponent(0.4)), v(0, 0.32, 0))
        ell(g, 0.038, 0.038, 0.038, mat(hot, 0.2, emit: hot.withAlphaComponent(0.4)), v(0, 0.03, 0), seg: 16)
        ell(g, 0.045, 0.045, 0.045, glass, v(0, 0.03, 0), seg: 16)
        ell(g, 0.022, 0.03, 0.022, mat(gold, 0.3, metal: 0.8), v(0, 0.76, 0), seg: 12)
        for i in 0..<6 {
            box(g, 0.012, 0.004, 0.004, mat(c(0.2, 0.25, 0.4), 0.5), v(0.016, 0.2 + CGFloat(i) * 0.08, 0.016))
        }
        n.addChildNode(g)
    }

    private static func medBag(_ n: SCNNode, pal: Pal, at p: SCNVector3) {
        let g = SCNNode()
        g.position = p
        let leather = mat(c(0.42, 0.24, 0.12), 0.55)
        box(g, 0.1, 0.075, 0.055, leather, SCNVector3Zero, chamfer: 0.012)
        box(g, 0.102, 0.012, 0.057, mat(c(0.3, 0.17, 0.08), 0.5), v(0, 0.02, 0), chamfer: 0.004)
        let h = torus(g, 0.03, 0.006, metalMat(c(0.7, 0.72, 0.78)), v(0, 0.05, 0))
        h.scale = v(1, 1, 1)
        h.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
        h.scale = v(1, 1, 0.7)
        cyl(g, 0.02, 0.006, mat(c(1, 1, 1), 0.4), v(0, 0, 0.028)).eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
        box(g, 0.026, 0.008, 0.004, plastic(red), v(0, 0, 0.032))
        box(g, 0.008, 0.026, 0.004, plastic(red), v(0, 0, 0.032))
        n.addChildNode(g)
    }

    private static func mask(_ hd: SCNNode, R: CGFloat, pal: Pal) {
        // хирургическая маска, спущенная на подбородок
        let m = cloth(pal.anomaly ? c(0.2, 0.5, 0.55) : c(0.6, 0.86, 0.95))
        let mk = ell(hd, 0.46 * R, 0.2 * R, 0.4 * R, m, v(0, -0.78 * R, 0.55 * R), seg: 16)
        mk.eulerAngles = SCNVector3(Float(-0.35), 0, 0)
        for side: CGFloat in [-1, 1] {
            limb(hd, from: v(side * 0.42 * R, -0.75 * R, 0.5 * R), to: v(side * 0.98 * R, -0.2 * R, 0.1 * R), r: 0.012, m, round: false)
        }
    }

    private static func headband(_ hd: SCNNode, R: CGFloat, pal: Pal, lamp: Bool) {
        let band = torus(hd, 1.0 * R, 0.055 * R, pal.anomaly ? plastic(c(0.1, 0.13, 0.32)) : plastic(c(0.3, 0.72, 0.78)), v(0, 0.42 * R, 0))
        band.eulerAngles = SCNVector3(Float(0.0), 0, 0)
        if lamp {
            let l = SCNNode()
            l.position = v(0, 0.5 * R, 0.96 * R)
            l.eulerAngles = SCNVector3(Float(Double.pi / 2 - 0.1), 0, 0)
            cyl(l, 0.2 * R, 0.28 * R, metalMat(c(0.7, 0.74, 0.8)), SCNVector3Zero, seg: 18)
            cyl(l, 0.15 * R, 0.04 * R, mat(c(1, 0.95, 0.6), 0.1, emit: c(1, 0.92, 0.5)), v(0, 0.15 * R, 0), seg: 18)
            hd.addChildNode(l)
        } else {
            let badge = cyl(hd, 0.2 * R, 0.04 * R, mat(c(1, 1, 1), 0.4), v(0, 0.5 * R, 0.96 * R), seg: 18)
            badge.eulerAngles = SCNVector3(Float(Double.pi / 2 - 0.1), 0, 0)
            let cr = SCNNode()
            cr.position = v(0, 0.51 * R, 0.995 * R)
            cr.eulerAngles = SCNVector3(Float(-0.1), 0, 0)
            box(cr, 0.28 * R, 0.08 * R, 0.02 * R, plastic(red), SCNVector3Zero)
            box(cr, 0.08 * R, 0.28 * R, 0.02 * R, plastic(red), SCNVector3Zero)
            hd.addChildNode(cr)
        }
    }

    private static func glasses(_ hd: SCNNode, R: CGFloat, eyeAz: CGFloat, eyeEl: CGFloat) {
        let m = mat(c(0.1, 0.1, 0.12), 0.3)
        let lens = mat(c(0.9, 0.97, 1.0), 0.05)
        lens.transparency = 0.2
        for side: CGFloat in [-1, 1] {
            let g = SCNNode()
            g.position = headSurface(R, az: side * eyeAz, el: eyeEl, k: 1.07)
            orient(g, az: side * eyeAz, el: eyeEl)
            let t = torus(g, 0.3 * R, 0.035 * R, m, SCNVector3Zero)
            t.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
            cyl(g, 0.29 * R, 0.01 * R, lens, SCNVector3Zero, seg: 20).eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
            hd.addChildNode(g)
        }
        limb(hd, from: headSurface(R, az: -0.18, el: eyeEl, k: 1.08), to: headSurface(R, az: 0.18, el: eyeEl, k: 1.08), r: 0.02 * R, m)
    }

    private static func cap(_ hd: SCNNode, _ profile: [CGPoint], _ m: SCNMaterial, tilt: CGFloat = 0) -> SCNNode {
        let n = revolve(profile, seg: 28, steps: 5, m)
        n.eulerAngles = SCNVector3(Float(tilt), 0, 0)
        hd.addChildNode(n)
        return n
    }

    private static func bishopCap(_ hd: SCNNode, R: CGFloat, pal: Pal) {
        let m = cloth(pal.anomaly ? c(0.1, 0.13, 0.32) : c(0.3, 0.72, 0.78))
        let trim = cloth(pal.anomaly ? c(0.6, 0.1, 0.22) : c(1, 1, 1))
        _ = cap(hd, [CGPoint(x: 1.07 * R, y: 0.22 * R), CGPoint(x: 1.0 * R, y: 0.55 * R), CGPoint(x: 0.78 * R, y: 0.95 * R),
                     CGPoint(x: 0.45 * R, y: 1.3 * R), CGPoint(x: 0.16 * R, y: 1.58 * R), CGPoint(x: 0, y: 1.66 * R)], m, tilt: -0.1)
        let rim = torus(hd, 1.065 * R, 0.07 * R, trim, v(0, 0.24 * R, -0.015 * R))
        rim.eulerAngles = SCNVector3(Float(-0.1), 0, 0)
        // крест на колпаке
        let cr = SCNNode()
        cr.position = v(0, 0.78 * R, 0.9 * R)
        cr.eulerAngles = SCNVector3(Float(0.35), 0, 0)
        box(cr, 0.4 * R, 0.11 * R, 0.04 * R, plastic(pal.anomaly ? gold : red), SCNVector3Zero)
        box(cr, 0.11 * R, 0.4 * R, 0.04 * R, plastic(pal.anomaly ? gold : red), SCNVector3Zero)
        hd.addChildNode(cr)
        ell(hd, 0.09 * R, 0.09 * R, 0.09 * R, mat(gold, 0.3, metal: 0.8), v(0, 1.64 * R, -0.0), seg: 10)
    }

    private static func nurseHat(_ hd: SCNNode, R: CGFloat, pal: Pal) {
        let m = cloth(pal.anomaly ? c(0.3, 0.1, 0.18) : c(1, 1, 1))
        let trim = pal.anomaly ? c(0.12, 0.14, 0.34) : red
        let hat = SCNNode()
        hat.position = v(0, 0.98 * R, 0.1 * R)
        hat.eulerAngles = SCNVector3(Float(-0.12), 0, 0)
        let body = revolve([CGPoint(x: 0.0, y: -0.12 * R), CGPoint(x: 0.55 * R, y: -0.12 * R), CGPoint(x: 0.7 * R, y: 0.08 * R),
                            CGPoint(x: 0.72 * R, y: 0.26 * R), CGPoint(x: 0.6 * R, y: 0.34 * R), CGPoint(x: 0.0, y: 0.35 * R)], seg: 28, steps: 4, m)
        body.scale = v(1.0, 1, 0.78)
        hat.addChildNode(body)
        let cr = SCNNode()
        cr.position = v(0, 0.12 * R, 0.56 * R)
        cr.eulerAngles = SCNVector3(Float(-0.18), 0, 0)
        box(cr, 0.34 * R, 0.1 * R, 0.03 * R, plastic(trim), SCNVector3Zero)
        box(cr, 0.1 * R, 0.34 * R, 0.03 * R, plastic(trim), SCNVector3Zero)
        hat.addChildNode(cr)
        hd.addChildNode(hat)
        // золотая заколка-звезда
        ell(hd, 0.09 * R, 0.09 * R, 0.05 * R, mat(gold, 0.3, metal: 0.8), v(0.5 * R, 0.88 * R, 0.55 * R), seg: 10)
    }

    private static func paramedicCap(_ hd: SCNNode, R: CGFloat, pal: Pal) {
        let m = cloth(pal.anomaly ? c(0.1, 0.13, 0.32) : c(0.98, 0.98, 1.0))
        let band = cloth(pal.anomaly ? c(0.6, 0.1, 0.22) : red)
        _ = cap(hd, [CGPoint(x: 1.03 * R, y: 0.4 * R), CGPoint(x: 1.05 * R, y: 0.62 * R), CGPoint(x: 1.0 * R, y: 0.98 * R),
                     CGPoint(x: 0.75 * R, y: 1.1 * R), CGPoint(x: 0.0, y: 1.12 * R)], m, tilt: -0.08)
        let t = torus(hd, 1.04 * R, 0.07 * R, band, v(0, 0.5 * R, 0))
        t.eulerAngles = SCNVector3(Float(-0.08), 0, 0)
        let brim = ell(hd, 0.72 * R, 0.05 * R, 0.5 * R, plastic(c(0.08, 0.08, 0.12)), v(0, 0.52 * R, 0.95 * R), seg: 20)
        brim.eulerAngles = SCNVector3(Float(0.18), 0, 0)
        let badge = SCNNode()
        badge.position = v(0, 0.86 * R, 1.0 * R)
        badge.eulerAngles = SCNVector3(Float(0.2), 0, 0)
        box(badge, 0.36 * R, 0.1 * R, 0.04 * R, plastic(pal.anomaly ? gold : red), SCNVector3Zero)
        box(badge, 0.1 * R, 0.36 * R, 0.04 * R, plastic(pal.anomaly ? gold : red), SCNVector3Zero)
        hd.addChildNode(badge)
    }

    private static func beret(_ hd: SCNNode, R: CGFloat, pal: Pal) {
        let m = cloth(c(0.1, 0.13, 0.32))
        let b = ell(hd, 1.0 * R, 0.4 * R, 1.0 * R, m, v(0.1 * R, 0.82 * R, -0.02 * R), seg: 24)
        b.eulerAngles = SCNVector3(Float(-0.15), 0, Float(-0.15))
        ell(hd, 0.08 * R, 0.1 * R, 0.08 * R, m, v(0.22 * R, 1.2 * R, -0.05 * R), seg: 8)
        let cr = SCNNode()
        cr.position = v(-0.3 * R, 0.96 * R, 0.82 * R)
        cr.eulerAngles = SCNVector3(Float(0.8), 0, 0)
        box(cr, 0.36 * R, 0.1 * R, 0.04 * R, plastic(red), SCNVector3Zero)
        box(cr, 0.1 * R, 0.36 * R, 0.04 * R, plastic(red), SCNVector3Zero)
        hd.addChildNode(cr)
    }

    private static func crown(_ hd: SCNNode, R: CGFloat) {
        let gm = mat(gold, 0.3, metal: 0.8)
        let ring = torus(hd, 0.68 * R, 0.05 * R, gm, v(0.08 * R, 1.0 * R, -0.02 * R))
        ring.eulerAngles = SCNVector3(Float(-0.15), 0, Float(-0.15))
        for i in 0..<7 {
            let a = CGFloat(i) / 7 * 2 * CGFloat.pi
            let spike = SCNCone(topRadius: 0, bottomRadius: R * 0.07, height: R * 0.3)
            spike.radialSegmentCount = 8
            spike.materials = [gm]
            let sn = SCNNode(geometry: spike)
            sn.position = v(0.08 * R + 0.68 * R * sin(a), 1.13 * R + 0.0 * R, -0.02 * R + 0.68 * R * cos(a))
            hd.addChildNode(sn)
            if i % 2 == 0 {
                ell(hd, 0.045 * R, 0.045 * R, 0.045 * R, mat(red, 0.2, emit: red.withAlphaComponent(0.4)),
                    v(0.08 * R + 0.68 * R * sin(a), 0.99 * R, -0.02 * R + 0.72 * R * cos(a)), seg: 8)
            }
        }
    }

    // MARK: - Ладья: машина скорой помощи с уткой

    private static func ambulance(_ pal: Pal) -> SCNNode {
        let root = SCNNode()
        let body = pal.anomaly ? plastic(c(0.1, 0.13, 0.32)) : plastic(c(0.97, 0.98, 1.0))
        let stripe = pal.anomaly ? plastic(c(0.62, 0.1, 0.24)) : plastic(c(0.86, 0.14, 0.2))
        let dark = plastic(c(0.1, 0.12, 0.16))
        // кузов
        box(root, 0.46, 0.2, 0.56, body, v(0, 0.17, 0), chamfer: 0.045)
        // кабина спереди — ниже
        box(root, 0.44, 0.1, 0.18, body, v(0, 0.3, 0.2), chamfer: 0.035)
        // лобовое стекло
        let ws = box(root, 0.36, 0.1, 0.02, mat(c(0.5, 0.78, 0.95), 0.05, metal: 0.2), v(0, 0.25, 0.287), chamfer: 0.012)
        ws.eulerAngles = SCNVector3(Float(-0.25), 0, 0)
        // бампер, решётка, фары
        box(root, 0.4, 0.045, 0.03, metalMat(c(0.75, 0.78, 0.82)), v(0, 0.08, 0.285), chamfer: 0.012)
        box(root, 0.2, 0.05, 0.015, dark, v(0, 0.14, 0.287), chamfer: 0.005)
        for side: CGFloat in [-1, 1] {
            ell(root, 0.04, 0.035, 0.025, mat(c(1, 0.97, 0.7), 0.1, emit: c(1, 0.95, 0.6)), v(side * 0.16, 0.14, 0.284), seg: 12)
            // красная полоса и крест на бортах
            box(root, 0.012, 0.045, 0.5, stripe, v(side * 0.228, 0.15, -0.0), chamfer: 0.004)
            let cr = SCNNode()
            cr.position = v(side * 0.234, 0.22, -0.08)
            box(cr, 0.006, 0.07, 0.022, plastic(red), SCNVector3Zero)
            box(cr, 0.006, 0.022, 0.07, plastic(red), SCNVector3Zero)
            root.addChildNode(cr)
            // колёса
            for zz in [-0.19, 0.19] as [CGFloat] {
                let w = cyl(root, 0.075, 0.06, plastic(c(0.08, 0.08, 0.1)), v(side * 0.215, 0.075, zz), seg: 20)
                w.eulerAngles = SCNVector3(0, 0, Float.pi / 2)
                let hub = cyl(root, 0.04, 0.064, metalMat(c(0.75, 0.78, 0.82)), v(side * 0.215, 0.075, zz), seg: 14)
                hub.eulerAngles = SCNVector3(0, 0, Float.pi / 2)
            }
        }
        // мигалка
        box(root, 0.22, 0.035, 0.07, plastic(c(0.2, 0.2, 0.25)), v(0, 0.35, 0.2), chamfer: 0.01)
        let rm = mat(red, 0.2, emit: red.withAlphaComponent(0.55))
        let bm = mat(c(0.2, 0.45, 0.95), 0.2, emit: c(0.15, 0.35, 0.9))
        ell(root, 0.045, 0.03, 0.03, rm, v(-0.055, 0.375, 0.2), seg: 12)
        ell(root, 0.045, 0.03, 0.03, bm, v(0.055, 0.375, 0.2), seg: 12)
        // люк на крыше + утка
        cyl(root, 0.17, 0.012, dark, v(0, 0.272, -0.1), seg: 24)
        let ch = character(.duck, pal, .rook, feet: false)
        ch.scale = v(0.78, 0.78, 0.78)
        ch.position = v(0, 0.2, -0.1)
        root.addChildNode(ch)
        root.scale = v(0.9, 0.9, 0.9)
        return root
    }

    // MARK: - Конь: каракал-санитар с каталкой

    private static func gurneyKnight(_ anomaly: Bool) -> SCNNode {
        let root = SCNNode()
        let pal = anomaly
            ? Pal(fur: c(0.2, 0.17, 0.19), light: c(0.42, 0.38, 0.4), dark: c(0.08, 0.07, 0.08), inner: c(0.55, 0.3, 0.35),
                  nose: c(0.9, 0.5, 0.55), iris: c(0.95, 0.35, 0.2), coat: c(0.4, 0.06, 0.17), trim: c(0.12, 0.14, 0.34), anomaly: true)
            : Pal(fur: c(0.8, 0.57, 0.3), light: c(0.98, 0.93, 0.82), dark: c(0.5, 0.33, 0.16), inner: c(1.0, 0.72, 0.72),
                  nose: c(1.0, 0.55, 0.6), iris: c(0.75, 0.6, 0.1), coat: c(0.84, 0.96, 0.94), trim: c(0.3, 0.72, 0.78), anomaly: false)
        let ch = character(.caracal, pal, .knight)
        ch.scale = v(0.78, 0.78, 0.78)
        ch.position = v(0, 0, -0.2)
        root.addChildNode(ch)

        // каталка
        let g = SCNNode()
        g.position = v(0, 0, 0.17)
        let frame = metalMat(c(0.75, 0.78, 0.84))
        let mattress = pal.anomaly ? plastic(c(0.1, 0.13, 0.32)) : plastic(c(0.55, 0.85, 0.9))
        box(g, 0.28, 0.05, 0.46, mattress, v(0, 0.265, 0), chamfer: 0.02)
        box(g, 0.3, 0.018, 0.48, frame, v(0, 0.235, 0), chamfer: 0.006)
        // ножки и колёса
        for sx in [-1, 1] as [CGFloat] {
            for sz in [-1, 1] as [CGFloat] {
                limb(g, from: v(sx * 0.12, 0.23, sz * 0.19), to: v(sx * 0.12, 0.06, sz * 0.19), r: 0.009, frame, round: false)
                ell(g, 0.032, 0.032, 0.032, plastic(c(0.12, 0.12, 0.15)), v(sx * 0.12, 0.035, sz * 0.19), seg: 12)
            }
        }
        limb(g, from: v(-0.12, 0.09, -0.19), to: v(0.12, 0.09, -0.19), r: 0.007, frame, round: false)
        limb(g, from: v(-0.12, 0.09, 0.19), to: v(0.12, 0.09, 0.19), r: 0.007, frame, round: false)
        // поручни у изголовья (сзади, где держит санитар)
        for sx in [-1, 1] as [CGFloat] {
            limb(g, from: v(sx * 0.14, 0.27, -0.2), to: v(sx * 0.14, 0.4, -0.25), r: 0.008, frame)
        }
        limb(g, from: v(-0.14, 0.4, -0.25), to: v(0.14, 0.4, -0.25), r: 0.01, frame)
        // подушка
        ell(g, 0.1, 0.035, 0.07, plastic(c(1, 1, 1)), v(0, 0.31, -0.14), seg: 14)
        // пациент: мишка под одеялом
        let tm = fur(c(0.7, 0.5, 0.32))
        ell(g, 0.085, 0.06, 0.09, tm, v(0, 0.34, -0.14), seg: 16)
        for sx in [-1, 1] as [CGFloat] {
            ell(g, 0.03, 0.03, 0.02, tm, v(sx * 0.06, 0.395, -0.17), seg: 10)
            ell(g, 0.013, 0.013, 0.01, fur(c(0.95, 0.7, 0.7)), v(sx * 0.06, 0.395, -0.16), seg: 8)
            ell(g, 0.012, 0.016, 0.01, mat(c(0.05, 0.05, 0.06), 0.2), v(sx * 0.03, 0.355, -0.085), seg: 8)
        }
        ell(g, 0.03, 0.022, 0.025, fur(c(0.95, 0.85, 0.7)), v(0, 0.34, -0.075), seg: 10)
        ell(g, 0.01, 0.008, 0.008, mat(c(0.05, 0.05, 0.06), 0.2), v(0, 0.345, -0.055), seg: 6)
        let ban = torus(g, 0.064, 0.012, cloth(c(1, 1, 1)), v(0, 0.345, -0.14))
        ban.scale = v(1, 1, 1)
        // одеяло
        let blanket = box(g, 0.27, 0.03, 0.26, pal.anomaly ? cloth(c(0.4, 0.06, 0.17)) : cloth(c(0.95, 0.65, 0.75)), v(0, 0.3, 0.1), chamfer: 0.012)
        _ = blanket
        let cr = SCNNode()
        cr.position = v(0, 0.318, 0.1)
        box(cr, 0.09, 0.006, 0.026, plastic(c(1, 1, 1)), SCNVector3Zero)
        box(cr, 0.026, 0.006, 0.09, plastic(c(1, 1, 1)), SCNVector3Zero)
        g.addChildNode(cr)
        // капельница
        limb(g, from: v(0.17, 0.24, 0.22), to: v(0.17, 0.78, 0.22), r: 0.007, frame, round: false)
        limb(g, from: v(0.17, 0.78, 0.22), to: v(0.1, 0.78, 0.22), r: 0.006, frame, round: false)
        let bagM = mat(pal.anomaly ? c(0.75, 0.3, 0.95) : c(0.5, 0.95, 0.85), 0.15)
        bagM.transparency = 0.7
        ell(g, 0.032, 0.05, 0.016, bagM, v(0.1, 0.72, 0.22), seg: 12)
        limb(g, from: v(0.1, 0.67, 0.22), to: v(0.08, 0.34, 0.2), r: 0.003, plastic(c(0.9, 0.95, 1)), round: false)
        root.addChildNode(g)
        root.scale = v(0.86, 0.86, 0.86)
        return root
    }

    // MARK: - Пешка-аномалия: слизень

    private static func slug() -> SCNNode {
        let root = SCNNode()
        let slime = mat(c(0.28, 0.5, 0.2), 0.25)
        let dark = mat(c(0.16, 0.32, 0.12), 0.3)
        let belly = mat(c(0.55, 0.65, 0.3), 0.4)
        let pal = Pal(fur: .black, light: .black, dark: c(0.12, 0.22, 0.08), inner: .black, nose: .black, iris: c(0.9, 0.2, 0.3),
                      coat: .black, trim: .black, anomaly: true)
        ell(root, 0.2, 0.025, 0.3, belly, v(0, 0.025, -0.02), seg: 16)
        ell(root, 0.17, 0.14, 0.28, slime, v(0, 0.12, -0.04), seg: 22)
        ell(root, 0.14, 0.14, 0.14, slime, v(0, 0.28, 0.1), seg: 20)
        ell(root, 0.12, 0.11, 0.14, slime, v(0, 0.2, 0.0), seg: 16)
        // хвост
        for i in 1...3 {
            let t = CGFloat(i)
            ell(root, 0.13 - t * 0.03, 0.08 - t * 0.017, 0.12 - t * 0.02, slime, v(0, 0.065 + t * 0.003, -0.2 - t * 0.1), seg: 14)
        }
        // пятна
        for (x, y, z) in [(0.1, 0.19, -0.1), (-0.08, 0.2, -0.16), (0.04, 0.14, -0.22)] as [(CGFloat, CGFloat, CGFloat)] {
            ell(root, 0.035, 0.015, 0.035, dark, v(x, y + 0.02, z), seg: 8)
        }
        // голова с глазами на стебельках
        for side: CGFloat in [-1, 1] {
            let stalkTop = v(side * 0.075, 0.46, 0.13)
            limb(root, from: v(side * 0.065, 0.36, 0.1), to: stalkTop, r: 0.017, slime)
            let e = eye(root, R: 0.13, pal: pal, scale: 1.0)
            e.position = v(CGFloat(stalkTop.x), CGFloat(stalkTop.y) + 0.02, CGFloat(stalkTop.z) + 0.03)
            e.eulerAngles = SCNVector3(Float(-0.1), Float(side * 0.3), 0)
        }
        // мордочка и улыбка
        for side: CGFloat in [-1, 1] {
            ell(root, 0.03, 0.015, 0.015, mat(c(0.95, 0.45, 0.55), 1), v(side * 0.1, 0.25, 0.22), seg: 8)
        }
        smileNode(root, width: 6, thick: 0.9, mat(c(0.1, 0.05, 0.05), 0.5), at: v(-0.018, 0.255, 0.238))
        // клычки
        for side: CGFloat in [-1, 1] {
            let f = SCNCone(topRadius: 0, bottomRadius: 0.006, height: 0.022)
            f.materials = [mat(c(1, 1, 1), 0.3)]
            let fn = SCNNode(geometry: f)
            fn.position = v(side * 0.02, 0.25, 0.235)
            fn.eulerAngles = SCNVector3(0, 0, Float.pi)
            root.addChildNode(fn)
        }
        // пластырь на голове
        let pl = box(root, 0.15, 0.06, 0.02, plastic(c(0.95, 0.78, 0.6)), v(0.02, 0.385, 0.03), chamfer: 0.008)
        pl.eulerAngles = SCNVector3(Float(-0.5), 0, Float(0.5))
        box(pl, 0.045, 0.05, 0.004, plastic(c(0.9, 0.5, 0.45)), v(0, 0, 0.012))
        // шапочка-колпак
        let cap = revolve([CGPoint(x: 0.1, y: 0.0), CGPoint(x: 0.095, y: 0.05), CGPoint(x: 0.06, y: 0.1), CGPoint(x: 0.0, y: 0.115)], seg: 18, steps: 4, cloth(c(0.1, 0.13, 0.32)))
        _ = cap
        root.scale = v(0.95, 0.95, 0.95)
        return root
    }
}
