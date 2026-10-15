import SwiftUI

/// Круглый джойстик камеры в углу: ручка вправо/влево — поворот вокруг доски,
/// вверх/вниз — наклон; скорость зависит от отклонения. Рядом «+»/«−» зума,
/// сброс в исходное положение и смена стороны доски.
struct CameraJoystick: View {
    let camera: CameraController
    let resetPreset: CameraPreset
    let onFlip: () -> Void

    private let radius: CGFloat = 52
    @State private var knob: CGSize = .zero      // отклонение ручки, пункты
    @State private var active = false
    private let tick = Timer.publish(every: 1.0 / 30.0, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            VStack(spacing: 8) {
                roundButton("arrow.triangle.2.circlepath") { onFlip() }
                roundButton("scope") { camera.reset(to: resetPreset) }
            }
            VStack(spacing: 8) {
                roundButton("plus") { camera.zoom(0.85) }
                roundButton("minus") { camera.zoom(1.18) }
            }
            pad
        }
        .padding(10)
        .onReceive(tick) { _ in
            guard active else { return }
            let dt: Float = 1.0 / 30.0
            let nx = Float(knob.width / radius), ny = Float(knob.height / radius)
            camera.rotate(-nx * 1.8 * dt)
            camera.tilt(ny * 1.0 * dt)
        }
    }

    private var pad: some View {
        ZStack {
            Circle().fill(.ultraThinMaterial)
            Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1.5)
            Image(systemName: "chevron.up").offset(y: -radius + 12)
            Image(systemName: "chevron.down").offset(y: radius - 12)
            Image(systemName: "chevron.left").offset(x: -radius + 12)
            Image(systemName: "chevron.right").offset(x: radius - 12)
            Circle()
                .fill(Color.white.opacity(active ? 0.95 : 0.75))
                .frame(width: 44, height: 44)
                .shadow(radius: 3)
                .offset(knob)
        }
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(.white.opacity(0.8))
        .frame(width: radius * 2, height: radius * 2)
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { g in
                    active = true
                    let maxR = radius - 22
                    var dx = g.translation.width, dy = g.translation.height
                    let len = sqrt(dx * dx + dy * dy)
                    if len > maxR { dx *= maxR / len; dy *= maxR / len }
                    knob = CGSize(width: dx * radius / maxR, height: dy * radius / maxR)
                }
                .onEnded { _ in
                    active = false
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) { knob = .zero }
                }
        )
        .accessibilityLabel("Джойстик камеры")
    }

    private func roundButton(_ name: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: name)
                .font(.system(size: 16, weight: .bold))
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1))
                .foregroundStyle(.white)
        }
    }
}
