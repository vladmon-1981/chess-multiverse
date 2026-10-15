import SwiftUI

/// Модалка настроек: кинорежим, спецэффекты взятия, звук, голос — пока только UI-состояние,
/// без реальной реализации (AVFoundation/AVSpeechSynthesizer — следующая фаза).
struct SettingsSheet: View {
    @ObservedObject var vm: ChessGameViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Вселенная") {
                    Picker("Тема", selection: $vm.theme) {
                        ForEach(ThemeKey.allCases) { key in
                            Text(ThemeLibrary.spec(for: key).name).tag(key)
                        }
                    }
                }
                Section("Партия") {
                    Toggle("Кинематографичные ходы", isOn: $vm.settings.cinematic)
                    Toggle("Спецэффекты взятия", isOn: $vm.settings.captureFx)
                }
                Section("Звук") {
                    Toggle("Звуковые эффекты", isOn: $vm.settings.sound)
                    Toggle("Голос диктора", isOn: $vm.settings.voice)
                }
                Section("Камера") {
                    Picker("Ракурс", selection: $vm.settings.cameraPreset) {
                        ForEach(CameraPreset.allCases, id: \.self) { preset in
                            Text(preset.label).tag(preset)
                        }
                    }
                }
            }
            .navigationTitle("Настройки")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") { dismiss() }
                }
            }
        }
    }
}
