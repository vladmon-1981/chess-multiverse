/*
 * Английский перевод. Ключ словаря — русский текст из index.html или из кода (см. js/i18n.js).
 * Тексты вселенных (THEMES_EN) накладываются на THEMES в themes.js.
 */
(function () {
    'use strict';
    if (!window.I18N || I18N.lang !== 'en') return;

    Object.assign(I18N.en, {
        // ---- index.html: шапка и меню ----
        'Шахматы: Мультивселенная': 'Chess Multiverse',
        'Шахматы в 3D: классика, гонки, ветклиника и хоккей «Ледяные Лисы» — «Полярные Ястребы». Игра вдвоём или против компьютера.':
            '3D chess in four universes: Classic, Racing, Vet Clinic and Hockey. Play a friend or the computer.',
        'В главное меню': 'Main menu',
        'Мультивселенная': 'Multiverse',
        'Настройки': 'Settings',
        'Звуковые эффекты': 'Sound effects',
        'Голос диктора': 'Announcer voice',
        'Во весь экран': 'Full screen',
        'Шахматы': 'Chess',
        'Трёхмерные фигуры, четыре вселенные, живой звук': '3D pieces, four universes, live sound',
        'Выбери вселенную': 'Choose a universe',
        'Вселенная': 'Universe',
        'Классика': 'Classic',
        'Слоновая кость и эбеновое дерево': 'Ivory and ebony',
        'Гонки': 'Racing',
        'Ветклиника': 'Vet Clinic',
        'Красная Стрела против Изумруда': 'Red Arrow vs. Emerald',
        'Доктор Ольха против аномалий': 'Dr. Alder vs. the anomalies',
        'Хоккей': 'Hockey',
        '«Ледяные Лисы» против «Полярных Ястребов»': 'Ice Foxes vs. Polar Hawks',
        'Как тебя зовут?': 'What is your name?',
        'Твоё имя': 'Your name',
        'Играть с компьютером': 'Play the computer',
        'Играть вдвоём': 'Play a friend',

        // ---- выбор уровня ----
        'Игра с компьютером': 'Play the Computer',
        'Твой цвет': 'Your color',
        'Цвет фигур': 'Piece color',
        'Белые': 'White',
        'Чёрные': 'Black',
        'Случайно': 'Random',
        'Сложность — нажми, чтобы начать': 'Difficulty: tap to start',
        'Лёгкий': 'Easy',
        'Средний': 'Medium',
        'Тяжёлый': 'Hard',
        'Для новичков: думает на ход вперёд и иногда зевает фигуры': 'For beginners: looks one move ahead and sometimes drops pieces',
        'Считает на три хода и не отдаёт фигуры даром': 'Looks three moves ahead and does not give pieces away',
        'Глубокий расчёт вариантов — серьёзный соперник': 'Deep calculation: a serious opponent',
        '← Назад': '← Back',

        // ---- игра вдвоём ----
        'Игра вдвоём': 'Two Players',
        'Игрок 1': 'Player 1',
        'Игрок 2': 'Player 2',
        'Игрок': 'Player',
        'Поворачивать доску к тому, чей ход': 'Turn the board toward the player to move',
        'Начать партию': 'Start game',

        // ---- партия ----
        'Партия': 'Game',
        'Взятые фигуры': 'Captured pieces',
        'Открываем портал во вселенную…': 'Opening the portal to the universe…',
        'Камера': 'Camera',
        'Повернуть доску против часовой стрелки (←)': 'Rotate board counterclockwise (←)',
        'Повернуть доску против часовой стрелки': 'Rotate board counterclockwise',
        'Повернуть доску по часовой стрелке (→)': 'Rotate board clockwise (→)',
        'Повернуть доску по часовой стрелке': 'Rotate board clockwise',
        'Приблизить (+)': 'Zoom in (+)',
        'Приблизить': 'Zoom in',
        'Отдалить (−)': 'Zoom out (−)',
        'Отдалить': 'Zoom out',
        'Обычный вид (0)': 'Default view (0)',
        'Вернуть обычный вид': 'Reset view',
        'Кинематографичные ходы': 'Cinematic moves',
        'Отменить ход': 'Undo move',
        'Отменить': 'Undo',
        'Развернуть доску': 'Flip board',
        'Развернуть': 'Flip',
        'Сменить ракурс камеры': 'Change camera angle',
        'Ракурс': 'Angle',
        'Новая партия': 'New game',
        'Заново': 'Restart',
        'Сдаться': 'Resign',
        'Меню': 'Menu',
        'Ходы': 'Moves',
        'Раскрыть': 'Expand',
        'Свернуть': 'Collapse',
        'Шахматная доска': 'Chessboard',

        // ---- окна ----
        'В кого превратится пешка?': 'Promote the pawn to:',
        'Отмена': 'Cancel',
        'Сменить вселенную': 'Change universe',
        '🌌 Вселенная': '🌌 Universe',
        '🎬 Кинематографичные ходы': '🎬 Cinematic moves',
        'Камера подлетает к фигуре и следит за ходом, взятие — в замедленной съёмке': 'The camera swoops in and follows the move; captures play in slow motion',
        '💥 Спецэффекты при взятии': '💥 Capture effects',
        'Фигура разлетается на осколки, машинка взрывается, аномалию бьёт разрядом, хоккеиста впечатывают в борт': 'Pieces shatter, cars explode, anomalies get zapped, hockey players are slammed into the boards',
        '🔊 Звуковые эффекты': '🔊 Sound effects',
        '🎙️ Голос диктора': '🎙️ Announcer voice',
        'Крутить доску': 'Rotate the board',
        '— тяни мышью мимо своих фигур или правой кнопкой; на телефоне — пальцем или поворотом двух пальцев': '— drag past your own pieces with the mouse or use the right button; on a phone, drag a finger or twist two fingers',
        'Приблизить': 'Zoom in',
        '— колёсико мыши, щипок двумя пальцами или кнопки ＋ －': '— mouse wheel, pinch with two fingers, or the ＋ － buttons',
        'Сдвинуть кадр': 'Pan the view',
        '— Shift + мышь или два пальца': '— Shift + mouse or two fingers',
        '— вернуть обычный вид; клавиши ← → + − 0 тоже работают': '— reset the view; the ← → + − 0 keys work too',
        'Готово': 'Done',
        'Нет': 'No',
        'Да': 'Yes',
        'Сыграть ещё': 'Play again',
        'Посмотреть доску': 'View the board',
        'В меню': 'Menu',
        'Для игры нужен JavaScript.': 'JavaScript is required to play.',

        // ---- chess-app.js ----
        'Обычный ракурс': 'Default angle',
        'Вид сверху': 'Top view',
        'Кинематографичный ракурс': 'Cinematic angle',
        'Король': 'King', 'Ферзь': 'Queen', 'Ладья': 'Rook', 'Слон': 'Bishop', 'Конь': 'Knight', 'Пешка': 'Pawn',
        'Звуковые эффекты включены': 'Sound effects on',
        'Звуковые эффекты выключены': 'Sound effects off',
        'В этом браузере нет синтеза речи': 'Speech synthesis is not available here',
        'Голос диктора включён': 'Announcer voice on',
        'Голос диктора выключен': 'Announcer voice off',
        'Диктор на месте!': 'The announcer is ready!',
        'Голос диктора недоступен в этом браузере': 'Announcer voice is not available here',
        '🎬 Кинематографичные ходы включены': '🎬 Cinematic moves on',
        'Кинематографичные ходы выключены': 'Cinematic moves off',
        'Полноэкранный режим недоступен': 'Full screen is not available',
        'Вселенная: {name}': 'Universe: {name}',
        '3D-режим недоступен в этом браузере — включена плоская доска': '3D is not available here, so a flat board is used',
        'Компьютер · {level}': 'Computer · {level}',
        'Доску можно крутить: веди пальцем мимо фигур. Два пальца — приблизить и повернуть': 'You can rotate the board: drag a finger past the pieces. Use two fingers to zoom and twist',
        'Доску можно крутить: тяни мимо фигур или правой кнопкой. Колёсико — приблизить': 'You can rotate the board: drag past the pieces or use the right button. Wheel to zoom',
        'Начать новую партию? Текущая будет потеряна.': 'Start a new game? The current one will be lost.',
        'Выйти в меню? Текущая партия будет потеряна.': 'Go to the menu? The current game will be lost.',
        'Подожди, соперник думает…': 'Wait, your opponent is thinking…',
        'Отменены твой ход и ответ соперника': 'Your move and the reply were undone',
        'Ход отменён': 'Move undone',
        'Сдаться и признать поражение?': 'Resign and concede the game?',
        '{name} сдаётся?': '{name} resigns?',
        'Пат': 'Stalemate',
        'Недостаточно фигур для мата': 'Insufficient material',
        'Троекратное повторение позиции': 'Threefold repetition',
        'Правило 50 ходов': 'Fifty-move rule',
        '{loser} сдаётся. {winner} — победитель!': '{loser} resigns. {winner} wins!',
        'Соперник признал поражение!': 'Your opponent resigned!',
        'Партия сдана — в следующий раз получится!': 'You resigned. Better luck next time!',
        'Уровень: {level}': 'Level: {level}',
        ' · белые': ' · White',
        ' · чёрные': ' · Black',
        ' · это ты': ' · you',
        'Ходов пока нет — начинают белые': 'No moves yet: White starts',
        'Ход {n} · {side}': 'Move {n} · {side}',
        'Партия окончена': 'Game over',
        '{loser} сдаётся': '{loser} resigns',
        '{mate} Победа: {name}': '{mate} Winner: {name}',
        '{banner} {name}, спасай короля!': '{banner} {name}, save your king!',
        '{name}, твой ход': '{name}, your move',
        '{pn} · ходов нет': '{pn} · no moves',
        '{pn} · доступно ходов: {n}': '{pn} · {n} {moves} available'
    });

    // ---- Тексты вселенных ----
    const CLASSIC_NAMES = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };

    I18N.themes = {
        classic: {
            name: 'Classic',
            tagline: 'Ivory and ebony',
            sides: { w: 'White', b: 'Black' },
            pieceNames: { w: CLASSIC_NAMES, b: CLASSIC_NAMES },
            texts: {
                start: 'The game begins. Good luck!',
                yourMove: 'Your move',
                sideMove: (side) => `${side} to move`,
                thinking: 'The computer is thinking',
                check: 'Check!',
                checkBanner: 'Check!',
                mateBanner: 'Checkmate!',
                win: { title: 'Victory!', sub: 'A brilliant game: the enemy king has fallen.' },
                lose: { title: 'Defeat', sub: 'Your king has fallen. Ready for a rematch?' },
                pvpWin: { title: 'Checkmate!', sub: (name) => `${name} wins the game!` },
                draw: { title: 'Draw', sub: 'A worthy game: the sides were equal.' }
            },
            voice: {
                start: ['The game begins. Good luck!', 'Welcome to the board. The game begins.'],
                check: 'Check!',
                win: 'Checkmate! Victory!',
                lose: 'Checkmate. You lost.',
                pvpWin: (name) => `Checkmate! ${name} wins!`,
                draw: 'Draw.',
                resignWin: 'Your opponent resigned. Victory!',
                resignLose: 'You resigned.'
            }
        },
        cars: {
            name: 'Racing',
            tagline: 'Team Apex vs. the rivals',
            sides: { w: 'Team Apex', b: 'Rivals' },
            pieceNames: {
                w: { k: 'Red Arrow', q: 'Azure', r: 'Thunder', b: 'Captain Blue', n: 'Rusty', p: 'Lemon' },
                b: { k: 'Emerald', q: 'Shadow', r: 'Reaper', b: 'Micro', n: 'Neon', p: 'Tractor' }
            },
            texts: {
                start: 'Ready, set, go!',
                yourMove: 'Your move: hit the gas!',
                sideMove: (side) => `Driving: ${side}`,
                thinking: 'The rival is picking a line',
                check: 'Check! The king needs a pit stop!',
                checkBanner: 'Check!',
                mateBanner: 'Finish!',
                win: { title: 'Victory!', sub: 'The Grand Prix is yours! The cup is yours!' },
                lose: { title: 'Out of the race', sub: 'The rival crossed the line first. Rematch?' },
                pvpWin: { title: 'Finish!', sub: (name) => `${name} crosses the line first!` },
                draw: { title: 'Photo finish', sub: 'A draw: nobody crossed the line first.' }
            },
            voice: {
                start: ['Ready, set, go!', 'Engines roaring! The race begins!'],
                check: 'Check!',
                win: 'Finish line! Victory!',
                lose: 'Oh no... Out of the race.',
                pvpWin: (name) => `Finish! ${name} wins!`,
                draw: 'Photo finish! It is a draw!',
                resignWin: 'Your rival is out of the race. Victory!',
                resignLose: 'You are out of the race.'
            }
        },
        hospital: {
            name: 'Vet Clinic',
            tagline: 'The night shift vs. the anomalies',
            sides: { w: 'Staff', b: 'Anomalies' },
            pieceNames: {
                w: { k: 'Dr. Alder', q: 'Nurse', r: 'Officer Mallard', b: 'Tim the Accountant', n: 'Reporter Kara', p: 'Little Tail' },
                b: { k: 'Mr. Floppy', q: 'Anomaly Nurse', r: 'Anomaly Mallard', b: 'Anomaly Tim', n: 'Anomaly Kara', p: 'Anomaly Slug' }
            },
            texts: {
                start: 'The night shift has begun. Stay alert!',
                yourMove: 'Your move, doctor',
                sideMove: (side) => `${side} to move`,
                thinking: 'The anomalies are plotting something',
                check: 'Check! Code blue!',
                checkBanner: 'Check!',
                mateBanner: 'Checkmate!',
                win: { title: 'Shift survived!', sub: 'The anomalies are banished. The hospital is saved.' },
                lose: { title: 'The anomalies win', sub: 'The hospital has been overrun... Try again?' },
                pvpWin: { title: 'Checkmate!', sub: (name) => `${name} wins the night shift!` },
                draw: { title: 'Draw', sub: 'The shift is over: everyone is still standing.' }
            },
            voice: {
                start: ['Attention! The night shift has begun.', 'All staff: the night shift has begun. Stay alert.'],
                check: 'Check! Code blue!',
                win: 'Hooray! Shift survived! Victory!',
                lose: 'The anomalies have taken over the hospital...',
                pvpWin: (name) => `Checkmate! ${name} wins!`,
                draw: 'A draw. Everyone is alive!',
                resignWin: 'The anomalies retreated. Victory!',
                resignLose: 'You left the shift.'
            }
        },
        hockey: {
            name: 'Hockey',
            tagline: 'Ice Foxes vs. Polar Hawks',
            sides: { w: 'Ice Foxes', b: 'Polar Hawks' },
            pieceNames: {
                w: { k: 'Ice Foxes Goalie', q: 'Ice Foxes Captain', r: 'Ice Foxes Defenseman', b: 'Ice Foxes Sniper', n: 'Ginger the Fox Cub', p: 'Ice Foxes Junior' },
                b: { k: 'Polar Hawks Goalie', q: 'Polar Hawks Captain', r: 'Polar Hawks Defenseman', b: 'Polar Hawks Sniper', n: 'The Hawk', p: 'Polar Hawks Junior' }
            },
            texts: {
                start: 'Face-off! The puck is in play!',
                yourMove: 'Your move: hit the ice!',
                sideMove: (side) => `${side} attacking`,
                thinking: 'The opponent is setting up a play',
                check: 'Check! The goalie is under fire!',
                checkBanner: 'Check!',
                mateBanner: 'Goal!',
                win: { title: 'Victory!', sub: 'The puck is in the net: the game is won!' },
                lose: { title: 'Defeat', sub: 'The opponent scored the winning goal. Rematch next game?' },
                pvpWin: { title: 'Victory!', sub: (name) => `${name} scores the winning goal!` },
                draw: { title: 'Draw', sub: 'Final horn: the score is level.' }
            },
            voice: {
                start: [
                    'Good evening, hockey fans! Tonight: Ice Foxes against Polar Hawks. Face-off! The puck is in play!',
                    'The arena is packed and the crowd is on its feet! The referee drops the puck. Here we go!',
                    'Welcome, hockey lovers! The teams are on the ice for the opening face-off!'
                ],
                check: 'Check! Danger in front of the net!',
                win: ['Goal! The puck is in the net! Victory! What a game, folks!', 'Goal! Final horn! We win this one!'],
                lose: ['The puck is in our net... the opponent scores the decider. Defeat.', 'Sorry, folks. A goal against us, and the game is lost.'],
                pvpWin: [
                    (name) => `Goal! ${name} scores the winner! The crowd is roaring!`,
                    (name) => `Goal! The puck is in the net! ${name} wins! What a finish!`
                ],
                draw: ['Final horn! A draw: no winner tonight!', 'Time is up! A hard-fought draw!'],
                resignWin: ['The opponent leaves the ice! Victory!', 'The opponent has thrown in the towel! Victory!'],
                resignLose: 'You leave the ice. The game is over.',
                comments: {
                    move: [
                        (c) => `${c.side} works the puck.`,
                        (c) => `A pass! ${c.side} in the neutral zone.`,
                        (c) => `${c.actor} skates forward.`,
                        (c) => `Passing at the blue line, ${c.side} attacking.`,
                        (c) => `${c.side} is pressing, ${c.opp} falls back to defend.`,
                        () => 'A battle along the boards!',
                        () => 'The puck is in the neutral zone, play goes end to end.',
                        (c) => `${c.actor} finds space for a pass.`,
                        () => 'A high tempo, both teams going for attacking hockey!'
                    ],
                    capture: [
                        (c) => `A big hit! ${c.victim} heads to the bench!`,
                        (c) => `Tough play! ${c.actor} takes a player off the ice: it is ${c.victim}!`,
                        (c) => `A turnover! ${c.side} wins the puck, ${c.victim} leaves the ice!`,
                        (c) => `What a collision! ${c.victim} is out!`,
                        () => 'A clean body check, and the referee stays silent!'
                    ],
                    bigCapture: [
                        (c) => `Unbelievable! ${c.victim} is out of the game! A serious loss for ${c.opp}!`,
                        (c) => `What a hit! ${c.side} takes out the opponent's leader: ${c.victim} leaves the ice!`,
                        (c) => `A sensation on the ice! ${c.victim} will not play again in this game!`
                    ],
                    check: [
                        (c) => `A shot! The goalie saves it! ${c.side} creates a dangerous moment!`,
                        (c) => `Check! ${c.side} is one on one with the goalie!`,
                        () => 'Check! Danger at the net, and the goalie makes the save at the last moment!',
                        (c) => `Shots on goal! ${c.opp} is barely holding on!`
                    ],
                    castle: [
                        (c) => `${c.side} changes lines, the goalie is covered.`,
                        () => 'Line change! Fresh legs come onto the ice.'
                    ],
                    promote: [
                        (c) => `What a turn! The junior has grown into a real star! ${c.side} gets stronger!`,
                        () => 'A new team leader is called up from the juniors!'
                    ]
                }
            }
        }
    };

    // Названия клубов на табло и бортах арены
    I18N.en['ПОЛЯРНЫЕ ЯСТРЕБЫ'] = 'POLAR HAWKS';
    I18N.en['ЛЕДЯНЫЕ ЛИСЫ'] = 'ICE FOXES';
    I18N.en['ПРЯМОЙ ЭФИР'] = 'LIVE';
})();
