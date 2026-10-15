import SwiftUI

/// Экран результата партии — упрощённо: заголовок, статистика, кнопки "снова"/"в меню".
struct ResultView: View {
    @ObservedObject var vm: ChessGameViewModel
    let info: GameOverInfo
    @Environment(\.dismiss) private var dismiss

    private var outcome: String {
        if info.winner == nil { return "draw" }
        if vm.mode == .pve { return info.winner == vm.humanColor ? "win" : "lose" }
        return "win"
    }

    private var title: String {
        switch outcome {
        case "win": return vm.mode == .pvp ? vm.spec.texts.pvpWinTitle : vm.spec.texts.winTitle
        case "lose": return vm.spec.texts.loseTitle
        default: return vm.spec.texts.drawTitle
        }
    }

    private var subtitle: String {
        switch outcome {
        case "win":
            return vm.mode == .pvp ? vm.spec.texts.pvpWinSub(vm.nameFor(info.winner ?? .white)) : vm.spec.texts.winSub
        case "lose": return vm.spec.texts.loseSub
        default: return "\(info.reasonText). \(vm.spec.texts.drawSub)"
        }
    }

    var body: some View {
        VStack(spacing: 20) {
            Text(title).font(.largeTitle.bold())
            Text(subtitle).multilineTextAlignment(.center).foregroundStyle(.secondary)

            if let stats = vm.gameStats {
                HStack(spacing: 16) {
                    statChip("\((stats.plyCount + 1) / 2) ход.")
                    statChip(timeString(stats.seconds))
                    if let d = stats.difficulty { statChip("Уровень: \(d.title)") }
                }
            }

            HStack(spacing: 16) {
                Button("Снова") {
                    dismiss()
                    vm.newGame()
                }
                .buttonStyle(.borderedProminent)

                Button("В меню") {
                    dismiss()
                    vm.backToMenu()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }

    private func statChip(_ text: String) -> some View {
        Text(text).font(.caption).padding(6).background(.thinMaterial).clipShape(Capsule())
    }

    private func timeString(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
