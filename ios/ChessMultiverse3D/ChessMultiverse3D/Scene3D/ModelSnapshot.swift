import SceneKit
import UIKit
import Metal

/// Отладочный рендер листа фигур темы в PNG (без UI):
/// запуск с аргументами `-snapshotTheme cars|hockey|hospital|classic -snapshotOut /path.png [-snapshotYaw 35] [-snapshotZoom 1]`.
/// Нужен, чтобы оценивать модели фигур глазами без игры (на симуляторе: xcrun simctl launch ... -snapshotTheme ...).
enum ModelSnapshot {
    static func runIfRequested() {
        let args = CommandLine.arguments
        guard let ti = args.firstIndex(of: "-snapshotTheme"), ti + 1 < args.count,
              let theme = ThemeKey(rawValue: args[ti + 1]),
              let oi = args.firstIndex(of: "-snapshotOut"), oi + 1 < args.count else { return }
        let yaw = value(args, "-snapshotYaw") ?? 0
        let zoom = value(args, "-snapshotZoom") ?? 1
        let out = args[oi + 1]
        DispatchQueue.main.async {
            let image = render(theme: theme, yawDegrees: Float(yaw), zoom: zoom)
            try? image.pngData()?.write(to: URL(fileURLWithPath: out))
            exit(0)
        }
    }

    private static func value(_ args: [String], _ key: String) -> Double? {
        guard let i = args.firstIndex(of: key), i + 1 < args.count else { return nil }
        return Double(args[i + 1])
    }

    static func render(theme: ThemeKey, yawDegrees: Float, zoom: Double) -> UIImage {
        let scene = SCNScene()
        scene.background.contents = UIColor(red: 0.85, green: 0.9, blue: 0.95, alpha: 1)
        let kinds: [PieceKind] = [.king, .queen, .rook, .bishop, .knight, .pawn]
        let spacing: Float = 1.25
        for (row, color) in [PieceColor.white, .black].enumerated() {
            for (col, kind) in kinds.enumerated() {
                let node = PieceFactory.makeNode(piece: Piece(color: color, kind: kind), theme: theme)
                let holder = SCNNode()
                holder.addChildNode(node)
                holder.eulerAngles.y = yawDegrees * .pi / 180
                holder.position = SCNVector3((Float(col) - 2.5) * spacing, 0, (row == 0 ? 0.7 : -0.7) * 1.0)
                scene.rootNode.addChildNode(holder)
            }
        }
        let floor = SCNNode(geometry: SCNPlane(width: 14, height: 8))
        floor.eulerAngles.x = -.pi / 2
        floor.geometry?.firstMaterial?.diffuse.contents = UIColor(white: 0.78, alpha: 1)
        scene.rootNode.addChildNode(floor)
        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light?.type = .ambient
        ambient.light?.intensity = 500
        scene.rootNode.addChildNode(ambient)
        let sun = SCNNode(); sun.light = SCNLight(); sun.light?.type = .directional; sun.light?.intensity = 1200
        sun.eulerAngles = SCNVector3(-0.9, 0.5, 0)
        scene.rootNode.addChildNode(sun)
        let cam = SCNNode(); cam.camera = SCNCamera(); cam.camera?.fieldOfView = 30
        cam.position = SCNVector3(0, 3.3 / Float(zoom), 8.5 / Float(zoom))
        cam.look(at: SCNVector3(0, 0.35, 0))
        scene.rootNode.addChildNode(cam)

        let renderer = SCNRenderer(device: MTLCreateSystemDefaultDevice(), options: nil)
        renderer.scene = scene
        renderer.pointOfView = cam
        return renderer.snapshot(atTime: 0, with: CGSize(width: 2000, height: 900), antialiasingMode: .multisampling4X)
    }
}
