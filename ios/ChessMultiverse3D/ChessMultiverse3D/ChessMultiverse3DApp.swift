import SwiftUI

@main
struct ChessMultiverse3DApp: App {
    init() { ModelSnapshot.runIfRequested() }
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
