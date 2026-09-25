/*
 * Вселенные игры: названия, тексты интерфейса, реплики диктора и имена фигур.
 * 3D-модели и доски тем лежат в js/three/*.js, звуки — в js/sounds.js.
 */
(function () {
    'use strict';

    const CLASSIC_NAMES = { k: 'Король', q: 'Ферзь', r: 'Ладья', b: 'Слон', n: 'Конь', p: 'Пешка' };

    const THEMES = {
        classic: {
            key: 'classic',
            name: 'Классика',
            tagline: 'Слоновая кость и эбеновое дерево',
            sides: { w: 'Белые', b: 'Чёрные' },
            pieceNames: { w: CLASSIC_NAMES, b: CLASSIC_NAMES },
            texts: {
                start: 'Партия начинается. Удачи!',
                yourMove: 'Твой ход',
                sideMove: (side) => `Ход: ${side}`,
                thinking: 'Компьютер обдумывает ход',
                check: 'Шах!',
                checkBanner: 'Шах!',
                mateBanner: 'Мат!',
                win: { title: 'Победа!', sub: 'Блестящая партия: король соперника повержен.' },
                lose: { title: 'Поражение', sub: 'Король пал. Возьмёте реванш?' },
                pvpWin: { title: 'Мат!', sub: (name) => `${name} выигрывает партию!` },
                draw: { title: 'Ничья', sub: 'Достойная партия — силы оказались равны.' }
            },
            voice: {
                rate: 0.95, pitch: 0.95,
                start: 'Партия начинается. Удачи!',
                check: 'Шах!',
                win: 'Шах и мат! Победа!',
                lose: 'Мат. Вы проиграли.',
                pvpWin: (name) => `Шах и мат! Побеждает ${name}!`,
                draw: 'Ничья.',
                resignWin: 'Соперник сдался. Победа!',
                resignLose: 'Вы сдались.'
            }
        },
        cars: {
            key: 'cars',
            name: 'Тачки',
            tagline: 'Радиатор-Спрингс против соперников',
            sides: { w: 'Радиатор-Спрингс', b: 'Соперники' },
            texts: {
                start: 'На старт! Внимание! Марш!',
                yourMove: 'Твой ход — жми на газ!',
                sideMove: (side) => `Едет: ${side}`,
                thinking: 'Соперник выбирает траекторию',
                check: 'Шах! Королю нужен пит-стоп!',
                checkBanner: 'Шах!',
                mateBanner: 'Финиш!',
                win: { title: 'Победа!', sub: 'Ка-чау! Кубок Поршня твой!' },
                lose: { title: 'Сход с трассы', sub: 'Соперник пересёк финиш первым. Реванш?' },
                pvpWin: { title: 'Финиш!', sub: (name) => `${name} первым пересекает черту!` },
                draw: { title: 'Фотофиниш', sub: 'Ничья — никто не пересёк черту первым.' }
            },
            voice: {
                rate: 1.05, pitch: 1.05,
                start: 'На старт! Внимание! Марш!',
                check: 'Шах!',
                win: 'Ка-чау! Победа!',
                lose: 'Эх... Сход с трассы.',
                pvpWin: (name) => `Финиш! Побеждает ${name}!`,
                draw: 'Фотофиниш! Ничья!',
                resignWin: 'Соперник сошёл с трассы. Победа!',
                resignLose: 'Вы сошли с трассы.'
            }
        },
        hospital: {
            key: 'hospital',
            name: 'Animal Hospital',
            tagline: 'Ночная смена против аномалий',
            sides: { w: 'Персонал', b: 'Аномалии' },
            texts: {
                start: 'Ночная смена началась. Будь начеку!',
                yourMove: 'Твой ход, доктор',
                sideMove: (side) => `Ходят: ${side}`,
                thinking: 'Аномалии что-то замышляют',
                check: 'Шах! Код синий!',
                checkBanner: 'Шах!',
                mateBanner: 'Мат!',
                win: { title: 'Смена пережита!', sub: 'Аномалии изгнаны — больница спасена.' },
                lose: { title: 'Аномалии победили', sub: 'Больница захвачена... Попробуешь снова?' },
                pvpWin: { title: 'Мат!', sub: (name) => `${name} побеждает в ночной смене!` },
                draw: { title: 'Ничья', sub: 'Смена окончена — все остались при своих.' }
            },
            voice: {
                rate: 1.0, pitch: 1.1,
                start: 'Внимание! Ночная смена началась.',
                check: 'Шах! Код синий!',
                win: 'Ура! Смена пережита! Победа!',
                lose: 'Аномалии захватили больницу...',
                pvpWin: (name) => `Мат! Побеждает ${name}!`,
                draw: 'Ничья. Все живы!',
                resignWin: 'Аномалии отступили. Победа!',
                resignLose: 'Вы покинули смену.'
            }
        },
        hockey: {
            key: 'hockey',
            name: 'Хоккей',
            tagline: '«Металлург» против «Авангарда»',
            sides: { w: '«Металлург»', b: '«Авангард»' },
            texts: {
                start: 'Вбрасывание! Шайба в игре!',
                yourMove: 'Твой ход — выходи на лёд!',
                sideMove: (side) => `Атакует ${side}`,
                thinking: 'Соперник разыгрывает комбинацию',
                check: 'Шах! Вратарь под обстрелом!',
                checkBanner: 'Шах!',
                mateBanner: 'Гол!',
                win: { title: 'Победа!', sub: 'Шайба в воротах — матч выигран!' },
                lose: { title: 'Поражение', sub: 'Соперник забил решающую шайбу. Реванш в следующем матче?' },
                pvpWin: { title: 'Победа!', sub: (name) => `${name} забивает победную шайбу!` },
                draw: { title: 'Ничья', sub: 'Финальная сирена — счёт равный.' }
            },
            voice: {
                rate: 1.08, pitch: 1.0,
                start: 'Вбрасывание! Шайба в игре!',
                check: 'Шах! Опасный момент у ворот!',
                win: 'Гол! Победа!',
                lose: 'Шайба в наших воротах. Поражение.',
                pvpWin: (name) => `Гол! Побеждает ${name}!`,
                draw: 'Финальная сирена! Ничья!',
                resignWin: 'Соперник ушёл со льда. Победа!',
                resignLose: 'Вы ушли со льда.'
            }
        }
    };

    // Имена персонажей берём из 3D-модулей тем
    for (const key of ['cars', 'hospital', 'hockey']) {
        const spec = window.CM && window.CM.Themes3D && window.CM.Themes3D[key];
        if (spec && spec.names) THEMES[key].pieceNames = spec.names;
    }

    const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const RU_LETTERS = { K: 'Кр', Q: 'Ф', R: 'Л', B: 'С', N: 'К' };

    /** SAN → русская нотация: Nf3 → Кf3, exd8=Q+ → exd8=Ф+, O-O → 0-0 */
    function toRussianSan(san) {
        if (san.startsWith('O-O')) return san.replace(/O/g, '0');
        let s = san.replace(/^[KQRBN]/, (m) => RU_LETTERS[m]);
        s = s.replace(/=([QRBN])/, (m, p) => '=' + RU_LETTERS[p]);
        return s;
    }

    window.THEMES = THEMES;
    window.PIECE_VALUES = PIECE_VALUES;
    window.toRussianSan = toRussianSan;
})();
