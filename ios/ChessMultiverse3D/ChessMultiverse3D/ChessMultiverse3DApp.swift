import SwiftUI

@main
struct ChessMultiverse3DApp: App {
    init() {
        #if DEBUG
        ModelSnapshot.runIfRequested()
        #endif
    }
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
