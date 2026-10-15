import SwiftUI

/// Выбор цвета и сложности перед игрой с компьютером — аналог pveScreen.
struct PveSetupView: View {
    @ObservedObject var vm: ChessGameViewModel

    var body: some View {
        VStack(spacing: 24) {
            Text("Игра с компьютером").font(.title.bold())

            Text("Цвет").font(.headline)
            HStack(spacing: 12) {
                colorButton("Белые", .white)
                colorButton("Чёрные", .black)
                colorButton("Случайно", .random)
            }

            Text("Сложность").font(.headline)
            VStack(spacing: 10) {
                ForEach(Difficulty.allCases) { d in
                    Button {
                        vm.startGame(mode: .pve, difficulty: d)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(d.title).font(.headline)
                            Text(subtitle(for: d)).font(.caption).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.thinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)

            Button("Назад") { vm.screen = .menu }
                .buttonStyle(.bordered)
        }
        .padding()
    }

    private func subtitle(for d: Difficulty) -> String {
        switch d {
        case .easy: return "смотрит на один полуход вперёд, иногда зевает фигуры"
        case .medium: return "считает на три полухода, не отдаёт фигуры даром"
        case .hard: return "думает до 1,8 с на ход, глубокий расчёт"
        }
    }

    private func colorButton(_ title: String, _ choice: ColorChoice) -> some View {
        Button(title) { vm.colorChoice = choice }
            .buttonStyle(.bordered)
            .tint(vm.colorChoice == choice ? .accentColor : .gray)
    }
}

/// Настройка имён игроков перед партией вдвоём — аналог pvpScreen.
struct PvpSetupView: View {
    @ObservedObject var vm: ChessGameViewModel

    var body: some View {
        VStack(spacing: 20) {
            Text("Игра вдвоём").font(.title.bold())
            TextField("Имя белых", text: $vm.whiteName).textFieldStyle(.roundedBorder)
            TextField("Имя чёрных", text: $vm.blackName).textFieldStyle(.roundedBorder)
            Toggle("Автоповорот доски после каждого хода", isOn: $vm.settings.autoFlip)
            Button("Начать партию") { vm.startGame(mode: .pvp) }
                .buttonStyle(.borderedProminent)
            Button("Назад") { vm.screen = .menu }
                .buttonStyle(.bordered)
        }
        .padding()
    }
}
