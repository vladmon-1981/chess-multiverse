# Журнал

## 16.10.2026 — iOS 2.0: приложение показывает веб-версию
- Владелец: веб-версия красивее, перенести на iOS с максимальным сходством. Выбран вариант «веб внутри приложения»: WKWebView грузит index.html, css, js из бандла (без интернета, кроме шрифтов Google Fonts).
- Шаг сборки «Copy Web Version» в Xcode-проекте копирует index.html, css/, js/ из корня репозитория в бандл (папка Web). Любая правка веба попадает в iOS при следующей сборке.
- Нативный SceneKit-код (Scene3D/, Views/, ViewModels/) больше не используется, но остаётся в проекте.
- Грабля: под SwiftUI с ignoresSafeArea CSS env(safe-area-inset-*) в WKWebView нулевой — шапка уезжала под часы. Лечится: WebView только ignoresSafeArea(edges: .bottom).
- Кнопка «Во весь экран» в приложении скрыта (Fullscreen API в WKWebView на iPhone нет).
