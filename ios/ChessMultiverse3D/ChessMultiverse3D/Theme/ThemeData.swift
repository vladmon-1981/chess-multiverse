import Foundation

/// Ключ вселенной — те же 4 темы, что в js/themes.js.
enum ThemeKey: String, CaseIterable, Identifiable {
    case classic, cars, hospital, hockey
    var id: String { rawValue }
}

/// Реплики диктора для события конца партии / начала / шаха.
/// В фазе 1 озвучка не реализована (см. VoiceAnnouncer — заглушка), но структура
/// данных сохранена по мотивам js/themes.js: start/check/win/lose/draw/pvpWin/resign*.
struct VoiceLines {
    var rate: Double
    var pitch: Double
    var start: String
    var check: String
    var win: String
    var lose: String
    var pvpWin: (String) -> String
    var draw: String
    var resignWin: String
    var resignLose: String
}

/// Тексты статус-бара и баннеров — аналог texts.* в js/themes.js.
struct ThemeTexts {
    var start: String
    var yourMove: String
    var sideMove: (String) -> String
    var thinking: String
    var check: String
    var checkBanner: String
    var mateBanner: String
    var winTitle: String
    var winSub: String
    var loseTitle: String
    var loseSub: String
    var pvpWinTitle: String
    var pvpWinSub: (String) -> String
    var drawTitle: String
    var drawSub: String
}

/// Имена фигур на русском под конкретную тему, по цвету.
struct PieceNames {
    var white: [PieceKind: String]
    var black: [PieceKind: String]

    func name(for color: PieceColor, kind: PieceKind) -> String {
        (color == .white ? white : black)[kind] ?? kind.letter
    }
}

/// Полное описание вселенной — структура воспроизводит themes.js:
/// sides, pieceNames, texts.*, voice.*. Сами тексты не копируются дословно построчно,
/// но смысл и набор ключей сохранены.
struct ThemeSpec {
    var key: ThemeKey
    var name: String
    var tagline: String
    var sideName: [PieceColor: String]
    var pieceNames: PieceNames
    var texts: ThemeTexts
    var voice: VoiceLines
    /// Акцентный цвет для процедурных заглушек-фигур в SceneKit (пока единственное
    /// визуальное отличие темы cars/hospital/hockey от classic — см. отчёт по фазе 1).
    var accentColorHex: String
}

private let classicNames = PieceNames(
    white: [.king: "Король", .queen: "Ферзь", .rook: "Ладья", .bishop: "Слон", .knight: "Конь", .pawn: "Пешка"],
    black: [.king: "Король", .queen: "Ферзь", .rook: "Ладья", .bishop: "Слон", .knight: "Конь", .pawn: "Пешка"]
)

enum ThemeLibrary {
    static let classic = ThemeSpec(
        key: .classic,
        name: "Классика",
        tagline: "Слоновая кость и эбеновое дерево",
        sideName: [.white: "Белые", .black: "Чёрные"],
        pieceNames: classicNames,
        texts: ThemeTexts(
            start: "Партия начинается. Удачи!",
            yourMove: "Твой ход",
            sideMove: { "Ход: \($0)" },
            thinking: "Компьютер обдумывает ход",
            check: "Шах!",
            checkBanner: "Шах!",
            mateBanner: "Мат!",
            winTitle: "Победа!",
            winSub: "Блестящая партия: король соперника повержен.",
            loseTitle: "Поражение",
            loseSub: "Король пал. Возьмёте реванш?",
            pvpWinTitle: "Мат!",
            pvpWinSub: { "\($0) выигрывает партию!" },
            drawTitle: "Ничья",
            drawSub: "Достойная партия — силы оказались равны."
        ),
        voice: VoiceLines(
            rate: 0.95, pitch: 0.95,
            start: "Партия начинается. Удачи!",
            check: "Шах!",
            win: "Шах и мат! Победа!",
            lose: "Мат. Вы проиграли.",
            pvpWin: { "Шах и мат! Побеждает \($0)!" },
            draw: "Ничья.",
            resignWin: "Соперник сдался. Победа!",
            resignLose: "Вы сдались."
        ),
        accentColorHex: "#C9A24B"
    )

    static let cars = ThemeSpec(
        key: .cars,
        name: "Тачки",
        tagline: "Радиатор-Спрингс против соперников",
        sideName: [.white: "Радиатор-Спрингс", .black: "Соперники"],
        pieceNames: PieceNames(
            white: [.king: "Молния Маккуин", .queen: "Салли", .rook: "Мак", .bishop: "Док Хадсон", .knight: "Мэтр", .pawn: "Луиджи"],
            black: [.king: "Чик Хикс", .queen: "Джексон Шторм", .rook: "Фрэнк", .bishop: "Профессор Зет", .knight: "Бууст", .pawn: "Трактор"]
        ),
        texts: ThemeTexts(
            start: "На старт! Внимание! Марш!",
            yourMove: "Твой ход — жми на газ!",
            sideMove: { "Едет: \($0)" },
            thinking: "Соперник выбирает траекторию",
            check: "Шах! Королю нужен пит-стоп!",
            checkBanner: "Шах!",
            mateBanner: "Финиш!",
            winTitle: "Победа!",
            winSub: "Ка-чау! Кубок Поршня твой!",
            loseTitle: "Сход с трассы",
            loseSub: "Соперник пересёк финиш первым. Реванш?",
            pvpWinTitle: "Финиш!",
            pvpWinSub: { "\($0) первым пересекает черту!" },
            drawTitle: "Фотофиниш",
            drawSub: "Ничья — никто не пересёк черту первым."
        ),
        voice: VoiceLines(
            rate: 1.05, pitch: 1.05,
            start: "На старт! Внимание! Марш!",
            check: "Шах!",
            win: "Ка-чау! Победа!",
            lose: "Эх... Сход с трассы.",
            pvpWin: { "Финиш! Побеждает \($0)!" },
            draw: "Фотофиниш! Ничья!",
            resignWin: "Соперник сошёл с трассы. Победа!",
            resignLose: "Вы сошли с трассы."
        ),
        accentColorHex: "#D23B2E"
    )

    static let hospital = ThemeSpec(
        key: .hospital,
        name: "Animal Hospital",
        tagline: "Ночная смена против аномалий",
        sideName: [.white: "Персонал", .black: "Аномалии"],
        pieceNames: PieceNames(
            white: [.king: "Доктор Харлоу", .queen: "Медсестра", .rook: "Офицер Дакман", .bishop: "Рон из бухгалтерии", .knight: "Лиз", .pawn: "Рэттью"],
            black: [.king: "Барни", .queen: "Аномалия-медсестра", .rook: "Аномалия-Дакман", .bishop: "Аномалия-Рон", .knight: "Аномалия-Лиз", .pawn: "Слизень-аномалия"]
        ),
        texts: ThemeTexts(
            start: "Ночная смена началась. Будь начеку!",
            yourMove: "Твой ход, доктор",
            sideMove: { "Ходят: \($0)" },
            thinking: "Аномалии что-то замышляют",
            check: "Шах! Код синий!",
            checkBanner: "Шах!",
            mateBanner: "Мат!",
            winTitle: "Смена пережита!",
            winSub: "Аномалии изгнаны — больница спасена.",
            loseTitle: "Аномалии победили",
            loseSub: "Больница захвачена... Попробуешь снова?",
            pvpWinTitle: "Мат!",
            pvpWinSub: { "\($0) побеждает в ночной смене!" },
            drawTitle: "Ничья",
            drawSub: "Смена окончена — все остались при своих."
        ),
        voice: VoiceLines(
            rate: 1.0, pitch: 1.1,
            start: "Внимание! Ночная смена началась.",
            check: "Шах! Код синий!",
            win: "Ура! Смена пережита! Победа!",
            lose: "Аномалии захватили больницу...",
            pvpWin: { "Мат! Побеждает \($0)!" },
            draw: "Ничья. Все живы!",
            resignWin: "Аномалии отступили. Победа!",
            resignLose: "Вы покинули смену."
        ),
        accentColorHex: "#3EA66B"
    )

    static let hockey = ThemeSpec(
        key: .hockey,
        name: "Хоккей",
        tagline: "«Металлург» против «Авангарда»",
        sideName: [.white: "«Металлург»", .black: "«Авангард»"],
        pieceNames: PieceNames(
            white: [.king: "Вратарь Металлурга", .queen: "Капитан", .rook: "Защитник", .bishop: "Снайпер", .knight: "Тимоша", .pawn: "Юниор"],
            black: [.king: "Вратарь Авангарда", .queen: "Капитан", .rook: "Защитник", .bishop: "Снайпер", .knight: "Ястреб", .pawn: "Юниор"]
        ),
        texts: ThemeTexts(
            start: "Вбрасывание! Шайба в игре!",
            yourMove: "Твой ход — выходи на лёд!",
            sideMove: { "Атакует \($0)" },
            thinking: "Соперник разыгрывает комбинацию",
            check: "Шах! Вратарь под обстрелом!",
            checkBanner: "Шах!",
            mateBanner: "Гол!",
            winTitle: "Победа!",
            winSub: "Шайба в воротах — матч выигран!",
            loseTitle: "Поражение",
            loseSub: "Соперник забил решающую шайбу. Реванш в следующем матче?",
            pvpWinTitle: "Победа!",
            pvpWinSub: { "\($0) забивает победную шайбу!" },
            drawTitle: "Ничья",
            drawSub: "Финальная сирена — счёт равный."
        ),
        voice: VoiceLines(
            rate: 1.08, pitch: 1.0,
            start: "Вбрасывание! Шайба в игре!",
            check: "Шах! Опасный момент у ворот!",
            win: "Гол! Победа!",
            lose: "Шайба в наших воротах. Поражение.",
            pvpWin: { "Гол! Побеждает \($0)!" },
            draw: "Финальная сирена! Ничья!",
            resignWin: "Соперник ушёл со льда. Победа!",
            resignLose: "Вы ушли со льда."
        ),
        accentColorHex: "#1F5FA8"
    )

    static func spec(for key: ThemeKey) -> ThemeSpec {
        switch key {
        case .classic: return classic
        case .cars: return cars
        case .hospital: return hospital
        case .hockey: return hockey
        }
    }
}
