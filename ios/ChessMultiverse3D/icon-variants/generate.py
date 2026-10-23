#!/usr/bin/env python3
"""Генератор вариантов иконки «Шахматы: Мультивселенная».

Запуск: python3 generate.py  (нужен Pillow).
Результат рядом со скриптом: icon-1.png … icon-4.png (1024x1024, RGB без альфы)
и preview.png (контактный лист с подписями).

Все фигуры рисуются векторно в 2x (2048 px), затем уменьшаются LANCZOS.
Координаты задаются в системе 1024x1024 (начало в левом верхнем углу).
"""
from pathlib import Path
import math

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
W = H = 1024
K = 2                      # суперсэмплинг
SZ = (W * K, H * K)


# ---------- цвет и фон ----------

def rgb(hexstr):
    h = hexstr.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def vgradient(c1, c2):
    """Вертикальный градиент сверху c1 вниз c2."""
    mask = Image.linear_gradient('L').resize(SZ)
    return Image.composite(Image.new('RGB', SZ, c2), Image.new('RGB', SZ, c1), mask)


def glow(img, color, strength):
    """Мягкое свечение от центра: strength 0..255 (максимальная непрозрачность)."""
    mask = ImageOps.invert(Image.radial_gradient('L').resize(SZ))
    mask = mask.point(lambda v: int(v * strength / 255))
    img.paste(color, (0, 0), mask)


# ---------- примитивы (координаты в системе 1024, t = (ox, oy, масштаб)) ----------

def T(pt, t):
    ox, oy, s = t
    return ((ox + pt[0] * s) * K, (oy + pt[1] * s) * K)


def poly(d, pts, fill, t=(0, 0, 1)):
    d.polygon([T(p, t) for p in pts], fill=fill)


def ell(d, box, fill, t=(0, 0, 1)):
    x0, y0 = T(box[:2], t)
    x1, y1 = T(box[2:], t)
    d.ellipse([x0, y0, x1, y1], fill=fill)


def rr(d, box, r, fill, t=(0, 0, 1)):
    x0, y0 = T(box[:2], t)
    x1, y1 = T(box[2:], t)
    d.rounded_rectangle([x0, y0, x1, y1], radius=max(0, r * t[2] * K), fill=fill)


def line(d, pts, w, fill, t=(0, 0, 1)):
    s = t[2]
    width = max(1, int(round(w * s * K)))
    d.line([T(p, t) for p in pts], fill=fill, width=width, joint='curve')
    rad = width / 2
    for p in (pts[0], pts[-1]):
        cx, cy = T(p, t)
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=fill)


def drop_shadow(img, draw_fn, t, dx=12, dy=20, blur=20, opacity=0.5):
    """Мягкая тень фигуры: рисуем её маской, сдвигаем, размываем."""
    m = Image.new('L', SZ, 0)
    draw_fn(ImageDraw.Draw(m), lambda role: 255, t)
    m = ImageChops.offset(m, int(dx * K), int(dy * K))
    m = m.filter(ImageFilter.GaussianBlur(blur * K)).point(lambda v: int(v * opacity))
    img.paste((0, 0, 0), (0, 0), m)


def gold_outline(img, draw_fn, t, color, width=6):
    """Контур фигуры: штампуем фигуру цветом color со смещением по окружности."""
    d = ImageDraw.Draw(img)
    for k in range(16):
        a = 2 * math.pi * k / 16
        t2 = (t[0] + width * math.cos(a), t[1] + width * math.sin(a), t[2])
        draw_fn(d, lambda role, c=color: c, t2)


def piece(img, draw_fn, t, palette, outline=None):
    if outline is not None:
        gold_outline(img, draw_fn, t, outline)
    drop_shadow(img, draw_fn, t)
    draw_fn(ImageDraw.Draw(img), palette, t)


# ---------- вариант 1: хоккей «Ледяные Лисы» против «Полярных Ястребов» ----------

def hockey_bust(d, C, t):
    rr(d, (-205, -70, 205, 430), 110, C('jersey'), t)           # джерси, плечи
    rr(d, (-205, 30, 205, 78), 0, C('trim'), t)                 # полоса
    poly(d, [(-70, -75), (0, 30), (70, -75)], C('skin'), t)     # ворот
    ell(d, (-125, -335, 125, -45), C('helmet'), t)              # шлем
    rr(d, (-112, -225, 112, -112), 36, C('cage'), t)            # решётка визора
    for i in (-3, -2, -1, 0, 1, 2, 3):
        line(d, [(i * 30, -225), (i * 30, -112)], 9, C('bars'), t)
    line(d, [(-112, -170), (112, -170)], 9, C('bars'), t)


def icon_hockey():
    img = vgradient(rgb('#0A2446'), rgb('#4E8FCF'))
    glow(img, (235, 245, 255), 110)
    blue = {'jersey': rgb('#143A8C'), 'trim': rgb('#C71A1F'), 'helmet': rgb('#143A8C'),
            'cage': rgb('#D9DEE6'), 'bars': rgb('#2B2F38'), 'skin': rgb('#EBC29E')}
    black = {'jersey': rgb('#141417'), 'trim': rgb('#FFFFFF'), 'helmet': rgb('#BD141A'),
             'cage': rgb('#D9DEE6'), 'bars': rgb('#2B2F38'), 'skin': rgb('#EBC29E')}
    for t, pal in (((300, 560, 0.9), blue), ((724, 560, 0.9), black)):
        piece(img, hockey_bust, t, lambda r, p=pal: p[r])
    d = ImageDraw.Draw(img)
    # клюшки крест-накрест у шайбы
    line(d, [(410, 990), (530, 770)], 30, rgb('#2A2118'))
    line(d, [(530, 770), (485, 718)], 26, rgb('#101014'))
    line(d, [(620, 990), (505, 770)], 30, rgb('#2A2118'))
    line(d, [(505, 770), (552, 722)], 26, rgb('#101014'))
    # шайба
    ell(d, (466, 700, 558, 742), rgb('#101014'))
    ell(d, (480, 708, 500, 718), rgb('#5A5F6B'))
    return img


# ---------- вариант 2: Гонки: машина-конь ----------

KNIGHT_RAW = [(690, 440), (900, 440), (905, 400), (880, 330), (878, 260), (860, 205),
              (835, 160), (800, 120), (790, 85), (770, 110), (745, 130), (700, 150),
              (660, 215), (640, 260), (630, 300), (600, 330), (560, 350), (540, 390),
              (560, 425), (600, 420), (640, 440)]
KNIGHT = [(x - 200, y) for x, y in KNIGHT_RAW]
CAR = [(170, 700), (190, 620), (300, 590), (390, 520), (520, 488), (640, 508),
       (730, 570), (835, 600), (872, 640), (878, 705), (850, 730), (200, 735)]


def knight_fn(d, C, t):
    poly(d, KNIGHT, C('knight'), t)
    ell(d, (500, 232, 518, 250), C('eye'), t)


def car_fn(d, C, t):
    poly(d, [(140, 640), (120, 600), (195, 612)], C('body'), t)     # спойлер
    poly(d, CAR, C('body'), t)
    poly(d, [(380, 555), (450, 505), (555, 500), (610, 545)], C('glass'), t)
    poly(d, [(205, 650), (870, 650), (872, 668), (205, 668)], C('stripe'), t)
    poly(d, [(530, 600), (470, 672), (512, 672), (482, 742), (562, 648), (520, 648), (556, 600)],
         C('bolt'), t)
    ell(d, (250, 672, 374, 796), C('tyre'), t)
    ell(d, (650, 672, 774, 796), C('tyre'), t)
    ell(d, (285, 707, 339, 761), C('rim'), t)
    ell(d, (685, 707, 739, 761), C('rim'), t)


def icon_cars():
    img = vgradient(rgb('#FFB35C'), rgb('#C8431A'))
    glow(img, (255, 226, 150), 120)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 800 * K, W * K, H * K], fill=rgb('#2B2320'))     # дорога
    for x in range(0, W, 160):                                       # разметка
        rr(d, (x + 20, 905, x + 110, 917), 0, rgb('#F5F0E6'))
    piece(img, knight_fn, (0, 0, 1), lambda r: {'knight': rgb('#FFF4DC'), 'eye': rgb('#2B2320')}[r])
    piece(img, car_fn, (0, 0, 1), lambda r: {'body': rgb('#D7261E'), 'glass': rgb('#9AD8FF'),
                                   'stripe': rgb('#FFFFFF'), 'bolt': rgb('#FFD21F'),
                                   'tyre': rgb('#1B1B1F'), 'rim': rgb('#C9CED6')}[r])
    return img


# ---------- вариант 3: Ветклиника: врач-лиса ----------

def hospital_fn(d, C, t):
    poly(d, [(340, 400), (380, 200), (490, 330)], C('fox'), t)     # уши
    poly(d, [(684, 400), (644, 200), (534, 330)], C('fox'), t)
    poly(d, [(370, 360), (390, 255), (462, 335)], C('inner'), t)
    poly(d, [(654, 360), (634, 255), (562, 335)], C('inner'), t)
    ell(d, (300, 300, 724, 700), C('fox'), t)                       # голова
    ell(d, (410, 500, 614, 680), C('cream'), t)                     # морда
    ell(d, (490, 520, 534, 556), C('dark'), t)                      # нос
    ell(d, (400, 400, 444, 444), C('dark'), t)                      # глаза
    ell(d, (580, 400, 624, 444), C('dark'), t)
    ell(d, (412, 408, 424, 420), C('white'), t)
    ell(d, (592, 408, 604, 420), C('white'), t)
    line(d, [(512, 556), (512, 590), (480, 606)], 8, C('dark'), t)
    line(d, [(512, 590), (544, 606)], 8, C('dark'), t)
    rr(d, (400, 220, 624, 300), 20, C('cap'), t)                    # шапочка врача
    rr(d, (470, 245, 554, 275), 6, C('cross'), t)                   # красный крест
    rr(d, (497, 218, 527, 302), 6, C('cross'), t)
    rr(d, (220, 640, 804, 1100), 130, C('coat'), t)                 # халат
    poly(d, [(430, 650), (512, 760), (594, 650), (560, 640), (512, 700), (464, 640)], C('lapel'), t)
    line(d, [(420, 660), (400, 770), (470, 830), (512, 845)], 14, C('steth'), t)
    line(d, [(604, 660), (624, 770), (554, 830), (512, 845)], 14, C('steth'), t)
    ell(d, (486, 819, 538, 871), C('steth_disc'), t)


def icon_hospital():
    img = vgradient(rgb('#8DEBD9'), rgb('#0F8A86'))
    glow(img, (255, 255, 255), 90)
    pal = {'fox': rgb('#F28C38'), 'inner': rgb('#FFB3A7'), 'cream': rgb('#FFF3E0'),
           'dark': rgb('#2A1B12'), 'white': rgb('#FFFFFF'), 'cap': rgb('#FFFFFF'),
           'cross': rgb('#E0343B'), 'coat': rgb('#FFFFFF'), 'lapel': rgb('#DDE7EA'),
           'steth': rgb('#2A2A2E'), 'steth_disc': rgb('#B0B7BD')}
    piece(img, hospital_fn, (0, 0, 1), lambda r: pal[r], outline=None)
    return img


# ---------- вариант 4: классика: ивори против эбена ----------

def queen_fn(d, C, t):
    rr(d, (-190, -70, 190, 0), 16, C('body'), t)                    # основание
    rr(d, (-150, -120, 150, -70), 12, C('body'), t)
    ell(d, (-120, -300, 120, -120), C('body'), t)                   # чаша
    poly(d, [(-60, -300), (-40, -520), (40, -520), (60, -300)], C('body'), t)
    rr(d, (-80, -560, 80, -500), 14, C('body'), t)                  # воротник
    poly(d, [(-150, -580), (-120, -760), (-50, -640), (0, -800),
             (50, -640), (120, -760), (150, -580)], C('body'), t)   # корона
    for x, y in ((-120, -760), (0, -800), (120, -760)):
        ell(d, (x - 24, y - 24, x + 24, y + 24), C('body'), t)


def icon_classic():
    img = vgradient(rgb('#3B2A1F'), rgb('#0E0A07'))
    glow(img, (201, 162, 74), 80)
    d = ImageDraw.Draw(img)
    for i in range(8):                                              # полоса доски
        col = rgb('#2B2019') if i % 2 == 0 else rgb('#4A3A2B')
        d.rectangle([i * 128 * K, 900 * K, (i + 1) * 128 * K, H * K], fill=col)
    gold = rgb('#C9A24A')
    piece(img, queen_fn, (380, 880, 0.82), lambda r: rgb('#F4EBD9'), outline=gold)
    piece(img, queen_fn, (644, 880, 0.82), lambda r: rgb('#231A14'), outline=gold)
    return img


# ---------- сборка ----------

def font(size):
    for path in ('/System/Library/Fonts/Supplemental/Arial.ttf',
                 '/Library/Fonts/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


VARIANTS = [
    ('icon-1.png', icon_hockey, '1. Хоккей: Лисы против Ястребов'),
    ('icon-2.png', icon_cars, '2. Гонки: машина-конь'),
    ('icon-3.png', icon_hospital, '3. Ветклиника: врач-лиса'),
    ('icon-4.png', icon_classic, '4. Классика: ивори против эбена'),
]


def save_png(img, path):
    img.resize((W, H), Image.LANCZOS).convert('RGB').save(path, optimize=True)


def contact_sheet(paths_labels, out_path):
    thumb, pad, label_h = 480, 36, 90
    sheet = Image.new('RGB', (len(paths_labels) * thumb + (len(paths_labels) + 1) * pad,
                              thumb + label_h + 2 * pad), (246, 246, 244))
    draw = ImageDraw.Draw(sheet)
    f = font(30)
    for i, (p, label) in enumerate(paths_labels):
        x = pad + i * (thumb + pad)
        im = Image.open(p).convert('RGB').resize((thumb, thumb), Image.LANCZOS)
        mask = Image.new('L', (thumb, thumb), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, thumb - 1, thumb - 1], radius=96, fill=255)
        sheet.paste(im, (x, pad), mask)
        draw.text((x + thumb / 2, pad + thumb + 24), label, font=f, fill=(30, 30, 30), anchor='mt')
    sheet.save(out_path, optimize=True)


def main():
    made = []
    for name, fn, label in VARIANTS:
        path = OUT / name
        save_png(fn(), path)
        made.append((path, label))
        print('wrote', path)
    contact_sheet(made, OUT / 'preview.png')
    print('wrote', OUT / 'preview.png')


if __name__ == '__main__':
    main()
