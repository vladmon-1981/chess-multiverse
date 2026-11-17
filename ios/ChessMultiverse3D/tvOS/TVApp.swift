import SwiftUI

/// Apple TV: нативная версия на SceneKit (в tvOS нет WebKit, поэтому веб-оболочка iOS здесь не работает).
/// Общий код с iOS-целью: Models, Theme, Sound, ViewModels, Scene3D. Интерфейс — свой, под пульт Siri Remote.
@main
struct ChessGMTVApp: App {
    @StateObject private var vm = ChessGameViewModel()

    var body: some Scene {
        WindowGroup {
            TVRootView(vm: vm)
                .preferredColorScheme(.dark)
        }
    }
}
