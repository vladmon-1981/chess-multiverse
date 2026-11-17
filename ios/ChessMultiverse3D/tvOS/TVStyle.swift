import SwiftUI
import UIKit

/// Оформление вселенных Apple TV по CSS веб-версии (css/styles.css): акценты и фоны.
enum TVStyle {
    struct Palette {
        let accent: Color
        let accent2: Color
        let ink: Color
        let name: Color
        let panel: Color
    }

    static func palette(_ key: ThemeKey?) -> Palette {
        switch key {
        case .classic?:
            return Palette(accent: Color(hex: 0xE3B85C), accent2: Color(hex: 0xC8743E), ink: Color(hex: 0x2A1708), name: Color(hex: 0xF7DFA6),
                           panel: Color(red: 0.15, green: 0.09, blue: 0.055).opacity(0.8))
        case .cars?:
            return Palette(accent: Color(hex: 0xEF3B36), accent2: Color(hex: 0xFFCC21), ink: Color(hex: 0x2A0707), name: Color(hex: 0xFFE14D),
                           panel: Color(red: 0.16, green: 0.06, blue: 0.17).opacity(0.8))
        case .hospital?:
            return Palette(accent: Color(hex: 0x2DD4BF), accent2: Color(hex: 0xFB7185), ink: Color(hex: 0x042A27), name: Color(hex: 0xB6FFF4),
                           panel: Color(red: 0.02, green: 0.15, blue: 0.17).opacity(0.8))
        case .hockey?:
            return Palette(accent: Color(hex: 0x3AA8FF), accent2: Color(hex: 0xE0262F), ink: Color(hex: 0x04203D), name: .white,
                           panel: Color(red: 0.03, green: 0.09, blue: 0.2).opacity(0.8))
        case nil:
            return Palette(accent: Color(hex: 0xA78BFA), accent2: Color(hex: 0xF472B6), ink: Color(hex: 0x1B1030), name: .white,
                           panel: Color(red: 0.1, green: 0.08, blue: 0.2).opacity(0.78))
        }
    }

    /// Фон сцены вселенной (градиенты из CSS .bg-*), картинкой для SceneKit.
    static func backdrop(_ key: ThemeKey) -> UIImage {
        let stops: [(CGFloat, UInt32)]
        switch key {
        case .classic: stops = [(0, 0x4A2C18), (0.55, 0x24140A), (1, 0x0E0804)]
        case .cars: stops = [(0, 0x2A1150), (0.30, 0x6A2463), (0.58, 0xD9534F), (0.76, 0xFF9F43), (1, 0xFFD28A)]
        case .hospital: stops = [(0, 0x06222A), (0.55, 0x0B3A42), (1, 0x061B20)]
        case .hockey: stops = [(0, 0x030813), (0.36, 0x0A1A33), (0.62, 0x10284A), (1, 0x0A1A31)]
        }
        let size = CGSize(width: 16, height: 512)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let cs = CGColorSpaceCreateDeviceRGB()
            let colors = stops.map { UIColor(hex: $0.1).cgColor } as CFArray
            let locs = stops.map { $0.0 }
            let g = CGGradient(colorsSpace: cs, colors: colors, locations: locs)!
            ctx.cgContext.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
    }
}

/// Фон меню (как .bg-menu в вебе): фиолетовая ночь с цветными пятнами и звёздами.
struct TVMenuBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x120F2A), Color(hex: 0x0B0A1C), Color(hex: 0x16102C)], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [Color(hex: 0xF472B6).opacity(0.28), .clear], center: UnitPoint(x: 0.2, y: 0.15), startRadius: 0, endRadius: 700)
            RadialGradient(colors: [Color(hex: 0x38BDF8).opacity(0.22), .clear], center: UnitPoint(x: 0.85, y: 0.25), startRadius: 0, endRadius: 650)
            RadialGradient(colors: [Color(hex: 0xA78BFA).opacity(0.35), .clear], center: UnitPoint(x: 0.5, y: 1.1), startRadius: 0, endRadius: 900)
            TVStars()
        }
        .ignoresSafeArea()
    }
}

private struct TVStars: View {
    // Псевдослучайные, но стабильные звёзды
    private let stars: [(CGFloat, CGFloat, CGFloat)] = {
        var g = SeededGenerator(seed: 7)
        return (0..<90).map { _ in (CGFloat.random(in: 0...1, using: &g), CGFloat.random(in: 0...1, using: &g), CGFloat.random(in: 1.5...4, using: &g)) }
    }()

    var body: some View {
        GeometryReader { geo in
            ForEach(0..<stars.count, id: \.self) { i in
                Circle().fill(Color.white.opacity(0.55))
                    .frame(width: stars[i].2, height: stars[i].2)
                    .position(x: stars[i].0 * geo.size.width, y: stars[i].1 * geo.size.height)
            }
        }
    }
}

private struct SeededGenerator: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E3779B97F4A7C15 }
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
    }
}

/// Кнопка в стиле веб-интерфейса: стеклянная плашка, при фокусе — цвет вселенной и увеличение.
struct TVChipStyle: ButtonStyle {
    var palette: TVStyle.Palette
    var active = false

    func makeBody(configuration: Configuration) -> some View {
        TVChipBody(label: configuration.label, palette: palette, active: active)
    }
}

private struct TVChipBody<L: View>: View {
    let label: L
    let palette: TVStyle.Palette
    let active: Bool
    @Environment(\.isFocused) private var focused

    var body: some View {
        label
            .padding(.horizontal, 26).padding(.vertical, 14)
            .foregroundStyle(focused ? palette.ink : .white)
            .background(
                Capsule().fill(focused ? AnyShapeStyle(LinearGradient(colors: [palette.accent, palette.accent2], startPoint: .leading, endPoint: .trailing))
                                       : AnyShapeStyle(active ? palette.accent.opacity(0.45) : Color.white.opacity(0.12)))
            )
            .overlay(Capsule().stroke(Color.white.opacity(focused ? 0.9 : 0.18), lineWidth: focused ? 4 : 1.5))
            .scaleEffect(focused ? 1.12 : 1)
            .shadow(color: palette.accent.opacity(focused ? 0.7 : 0), radius: 18)
            .animation(.easeOut(duration: 0.15), value: focused)
    }
}
