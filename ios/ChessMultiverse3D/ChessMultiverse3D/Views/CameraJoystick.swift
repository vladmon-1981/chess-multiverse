import SwiftUI

/// Компактные кнопки камеры в углу доски: приблизить, отдалить, вернуть в исходное положение, сменить сторону.
/// (Имя файла историческое: джойстик убран по просьбе владельца.)
struct CameraJoystick: View {
    let camera: CameraController
    let resetPreset: CameraPreset
    let onFlip: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            roundButton("plus") { camera.zoom(0.72) }
            roundButton("minus") { camera.zoom(1.4) }
            roundButton("scope") { camera.reset(to: resetPreset) }
            roundButton("arrow.triangle.2.circlepath") { onFlip() }
        }
        .padding(10)
    }

    private func roundButton(_ name: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: name)
                .font(.system(size: 17, weight: .bold))
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1))
                .foregroundStyle(.white)
        }
        .accessibilityLabel(name)
    }
}
