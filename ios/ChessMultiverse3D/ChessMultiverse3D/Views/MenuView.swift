import SwiftUI

/// Главное меню: выбор вселенной, имя игрока, вход в pve/pvp — аналог menuScreen в index.html.
struct MenuView: View {
    @ObservedObject var vm: ChessGameViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    Text("♟ Шахматы: Мультивселенная")
                        .font(.largeTitle.bold())
                        .multilineTextAlignment(.center)

                    TextField("Твоё имя", text: $vm.playerName)
                        .textFieldStyle(.roundedBorder)
                        .padding(.horizontal)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        ForEach(ThemeKey.allCases) { key in
                            UniverseCard(spec: ThemeLibrary.spec(for: key), isSelected: vm.theme == key)
                                .onTapGesture { vm.chooseTheme(key) }
                        }
                    }
                    .padding(.horizontal)

                    HStack(spacing: 16) {
                        Button("Против компьютера") { vm.screen = .pveSetup }
                            .buttonStyle(.borderedProminent)
                        Button("Вдвоём") { vm.screen = .pvpSetup }
                            .buttonStyle(.bordered)
                    }
                }
                .padding(.vertical, 24)
            }
            .navigationBarHidden(true)
        }
    }
}

struct UniverseCard: View {
    let spec: ThemeSpec
    let isSelected: Bool
    var body: some View {
        VStack(spacing: 6) {
            Text(spec.name).font(.headline)
            Text(spec.tagline).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(hex: spec.accentColorHex)?.opacity(isSelected ? 0.35 : 0.12) ?? .gray.opacity(0.1))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(isSelected ? Color.accentColor : .clear, lineWidth: 2))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

extension Color {
    init?(hex: String) {
        var s = hex
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self = Color(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}
