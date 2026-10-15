import SwiftUI

/// Корневой роутер экранов — аналог showScreen() в js/chess-app.js.
struct ContentView: View {
    @StateObject private var vm = ChessGameViewModel()

    var body: some View {
        switch vm.screen {
        case .menu: MenuView(vm: vm)
        case .pveSetup: PveSetupView(vm: vm)
        case .pvpSetup: PvpSetupView(vm: vm)
        case .game: GameView(vm: vm)
        }
    }
}


#Preview {
    ContentView()
}
