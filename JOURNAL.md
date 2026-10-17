# Журнал

## 17.10.2026 — iOS 2.1: звук и компактное меню
- В приложении не было звука. Причина: Web Audio в WKWebView идёт как «ambient» и молчит при беззвучном режиме. Лечится скриптом `navigator.audioSession.type = 'playback'` (Audio Session API, iOS 17+). Плюс sounds.js теперь включает звук и по touchend/click: iOS не считает pointerdown жестом для запуска звука.
- Проверка звука без ушей: запуск с аргументом `-webLog` пишет в системный лог состояние AudioContext (`[web] audio running@… session=playback`).
- Главное меню на телефоне (≤720px) целиком влезает в экран: карточки вселенных 2×2, логотип и кнопки меньше. Касается и веб-версии.

## 16.10.2026 — iOS 2.0: приложение показывает веб-версию
- Владелец: веб-версия красивее, перенести на iOS с максимальным сходством. Выбран вариант «веб внутри приложения»: WKWebView грузит index.html, css, js из бандла (без интернета, кроме шрифтов Google Fonts).
- Шаг сборки «Copy Web Version» в Xcode-проекте копирует index.html, css/, js/ из корня репозитория в бандл (папка Web). Любая правка веба попадает в iOS при следующей сборке.
- Нативный SceneKit-код (Scene3D/, Views/, ViewModels/) больше не используется, но остаётся в проекте.
- Грабля: под SwiftUI с ignoresSafeArea CSS env(safe-area-inset-*) в WKWebView нулевой — шапка уезжала под часы. Лечится: WebView только ignoresSafeArea(edges: .bottom).
- Кнопка «Во весь экран» в приложении скрыта (Fullscreen API в WKWebView на iPhone нет).
