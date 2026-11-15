"""Подписи к скриншотам ChessGM по языкам страницы (15.11.2026).

Порядок = SHOTS в frame.py: меню, гонки, хоккей, ветклиника, классика, доска почёта.
Интерфейс приложения только русский и английский: сами экраны для всех языков кроме ru — английские (SOURCE),
переводится подпись. en-GB и es-MX своих файлов не имеют — в Connect им грузятся наборы en-US и es-ES (ASSETS).
Переводы сделаны моделью, носителями не проверены.
"""
TITLES = {
    "ru":    ["Вдвоём, с компьютером\nили онлайн", "Гонки: фигуры —\nмультяшные машинки", "Мат — это гол\nна ледовой арене",
              "Ветклиника:\nвесёлые звери", "Классика в 3D:\nкрутите как хотите", "Доска почёта\nи серии побед"],
    "en-US": ["Play a friend,\nthe computer or online", "Racing: pieces are\ncartoon cars", "Checkmate is\na goal on ice",
              "Vet Clinic:\nfunny animals", "Classic in 3D:\nspin it any way", "Hall of Fame\nand win streaks"],
    "de-DE": ["Zu zweit, gegen den\nComputer oder online", "Rennen: Figuren sind\nComic-Autos", "Matt ist ein Tor\nauf dem Eis",
              "Tierklinik:\nlustige Tiere", "Klassik in 3D:\ndrehen, wie du willst", "Ehrentafel\nund Siegesserien"],
    "fr-FR": ["À deux, contre l’ordi\nou en ligne", "Course : les pièces\nsont des voitures", "L’échec et mat,\nc’est un but",
              "Clinique vétérinaire :\nanimaux rigolos", "Classique en 3D :\ntournez à volonté", "Tableau d’honneur\net séries de victoires"],
    "es-ES": ["A dos, contra el\nordenador u online", "Carreras: las piezas\nson coches", "El jaque mate\nes un gol",
              "Clínica veterinaria:\nanimales divertidos", "Clásico en 3D:\ngíralo a tu gusto", "Cuadro de honor\ny rachas de victorias"],
    "it":    ["In due, contro il\ncomputer o online", "Corse: i pezzi\nsono auto a fumetti", "Lo scacco matto\nè un gol",
              "Clinica veterinaria:\nanimali buffi", "Classico in 3D:\nruota a piacere", "Albo d’onore\ne serie di vittorie"],
    "pt-BR": ["Em dupla, contra o\ncomputador ou online", "Corrida: as peças\nsão carrinhos", "O xeque-mate\né um gol",
              "Clínica vet:\nbichinhos divertidos", "Clássico em 3D:\ngire como quiser", "Quadro de honra\ne sequências de vitórias"],
    "pl":    ["We dwoje, z komputerem\nlub online", "Wyścigi: figury\nto autka", "Mat to gol\nna lodowisku",
              "Lecznica: śmieszne\nzwierzaki", "Klasyka w 3D:\nobracaj do woli", "Tablica honorowa\ni serie zwycięstw"],
    "uk":    ["Удвох, з комп’ютером\nабо онлайн", "Перегони: фігури —\nмультяшні машинки", "Мат — це гол\nна льоду",
              "Ветклініка:\nвеселі звірі", "Класика в 3D:\nкрутіть як завгодно", "Дошка пошани\nта серії перемог"],
}
SOURCE = {loc: ("ru" if loc == "ru" else "en-US") for loc in TITLES}
# Локали страницы без своих файлов -> чей набор загружать в Connect.
ASSETS = {"en-GB": "en-US", "es-MX": "es-ES"}
