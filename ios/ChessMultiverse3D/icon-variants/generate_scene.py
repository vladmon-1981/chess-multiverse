#!/usr/bin/env python3
"""Иконка-сцена «Шахматы: Мультивселенная»: все герои на одной ледовой арене.

Запуск: python3 generate_scene.py  (нужен Pillow).
Результат рядом со скриптом: icon-scene.png (1024x1024, RGB, без альфы).

Вся сцена рисуется в 2x (2048 px), затем уменьшается LANCZOS.
Координаты задаются в системе 1024x1024 (начало в левом верхнем углу).
Все объекты стоят на одной линии льда GROUND: от неё считаются тени и отражения.
"""
from pathlib import Path
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent
W = H = 1024
K = 2                       # суперсэмплинг
SZ = (W * K, H * K)
GROUND = 880                # линия контакта всех объектов с льдом (1K)


# ---------- цвет ----------

def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def stops(points):
    """Кусочно-линейный градиент по позиции (в единицах points[i][0])."""
    def f(p):
        for (p0, c0), (p1, c1) in zip(points, points[1:]):
            if p <= p1:
                return lerp(c0, c1, (p - p0) / (p1 - p0))
        return points[-1][1]
    return f


def solid(c):
    return Image.new('RGB', SZ, c)


def hprof(fn, x0, x1):
    """Горизонтальный профиль цвета: fn(t), t = 0..1 между x0 и x1 (1K)."""
    strip = Image.new('RGB', (SZ[0], 1))
    data = []
    for i in range(SZ[0]):
        t = (i / K - x0) / (x1 - x0)
        data.append(fn(min(1.0, max(0.0, t))))
    strip.putdata(data)
    return strip.resize(SZ, Image.BILINEAR)


def vprof(fn, y0, y1):
    """Вертикальный профиль цвета: fn(t), t = 0..1 между y0 и y1 (1K)."""
    strip = Image.new('RGB', (1, SZ[1]))
    data = []
    for j in range(SZ[1]):
        t = (j / K - y0) / (y1 - y0)
        data.append(fn(min(1.0, max(0.0, t))))
    strip.putdata(data)
    return strip.resize(SZ, Image.BILINEAR)


# ---------- маски (координаты 1K, внутри растр 2K) ----------

def new_mask():
    return Image.new('L', SZ, 0)


def m_poly(pts):
    m = new_mask()
    ImageDraw.Draw(m).polygon([(x * K, y * K) for x, y in pts], fill=255)
    return m


def m_ell(box):
    m = new_mask()
    x0, y0, x1, y1 = box
    ImageDraw.Draw(m).ellipse([x0 * K, y0 * K, x1 * K, y1 * K], fill=255)
    return m


def m_rr(box, r):
    m = new_mask()
    x0, y0, x1, y1 = box
    ImageDraw.Draw(m).rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K],
                                        radius=r * K, fill=255)
    return m


def m_line(pts, w):
    """Линия с круглыми концами, толщина w (1K)."""
    m = new_mask()
    d = ImageDraw.Draw(m)
    width = max(1, int(round(w * K)))
    d.line([(x * K, y * K) for x, y in pts], fill=255, width=width, joint='curve')
    rad = width / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x * K - rad, y * K - rad, x * K + rad, y * K + rad], fill=255)
    return m


def union(*ms):
    out = ms[0]
    for m in ms[1:]:
        out = ImageChops.lighter(out, m)
    return out


def dilate(m, px):
    """Расширение маски на px пикселей 2K (px нечётное)."""
    return m.filter(ImageFilter.MaxFilter(px))


def paint(layer, fill, mask):
    """Накладывает цвет/градиент fill (SZ, RGB) через маску на RGBA-слой."""
    src = fill.convert('RGBA')
    src.putalpha(mask)
    return Image.alpha_composite(layer, src)


def smooth(pts, n=10, closed=False):
    """Catmull-Rom сглаживание ломаной: плавные контуры из опорных точек."""
    if closed:
        P = [pts[-1]] + list(pts) + [pts[0], pts[1]]
    else:
        P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2 = t * t
            t3 = t2 * t
            comp = []
            for c in (0, 1):
                v = 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t
                           + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2
                           + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)
                comp.append(v)
            out.append((comp[0], comp[1]))
    if not closed:
        out.append(pts[-1])
    return out


# ---------- шахматные фигуры: тела вращения, Стаунтон-подобные ----------

VY = 1.25   # растяжение профиля по высоте
# правый профиль ферзя: (радиус, высота вверх от подставки), база r=130
QUEEN_BODY = [(0, 0), (130, 0), (130, -16), (118, -30), (100, -42), (84, -58), (78, -84),
              (74, -112), (80, -140), (92, -168), (96, -190), (84, -214), (76, -238),
              (78, -262), (92, -282), (104, -296), (0, -300)]
QUEEN_CUP = [(0, -296), (104, -296), (120, -316), (126, -344), (120, -366), (104, -380), (0, -384)]
QUEEN_BALLS = [(0, -424, 34), (-66, -404, 26), (66, -404, 26), (-118, -372, 22), (118, -372, 22)]


def piece_mask(cx, base, s):
    def T(x, y):
        # профиль задан с отрицательным y вверх от подставки
        return (cx + x * s, base + y * s * VY)

    def revolve(profile):
        right = [T(x, y) for x, y in smooth(profile, n=8)]
        left = [(2 * cx - x, y) for x, y in reversed(right)]
        return m_poly(right + left)

    balls = []
    for x, y, r in QUEEN_BALLS:
        bx, by = T(x, y)
        balls.append(m_ell((bx - r * s, by - r * s, bx + r * s, by + r * s)))
    return union(revolve(QUEEN_BODY), revolve(QUEEN_CUP), *balls)


def paint_piece(layer, cx, base, s, col, hi, outline=None, outline_px=0):
    m = piece_mask(cx, base, s)
    if outline is not None:
        layer = paint(layer, solid(outline), dilate(m, outline_px))
    R = 130 * s

    def shade(t):
        e = math.sin(math.pi * t)
        k = 0.5 + 0.5 * (max(e, 0.0) ** 0.45)
        c = tuple(int(v * k) for v in col)
        hl = math.exp(-((t - 0.33) / 0.085) ** 2)
        return lerp(c, hi, 0.85 * hl)

    return paint(layer, hprof(shade, cx - R, cx + R), m)


# ---------- машинка «Тачки»: красная, с молнией ----------

CAR_OX, CAR_S = 14, 0.8


def car_map(x, y):
    """Координаты машины (земля = y 150) -> 1K-холст."""
    return (CAR_OX + x * CAR_S, GROUND - (150 - y) * CAR_S)


def car_poly(pts):
    return m_poly([car_map(x, y) for x, y in pts])


def car_ell(x0, y0, x1, y1):
    a = car_map(x0, y0)
    b = car_map(x1, y1)
    return m_ell((a[0], a[1], b[0], b[1]))


def car_rr(x0, y0, x1, y1, r):
    a = car_map(x0, y0)
    b = car_map(x1, y1)
    return m_rr((a[0], a[1], b[0], b[1]), r * CAR_S)


def car_line(pts, w):
    return m_line([car_map(x, y) for x, y in pts], w * CAR_S)


def paint_car(layer):
    body_pts = smooth([(8, 118), (18, 96), (55, 86), (110, 74), (150, 48), (232, 38),
                       (268, 44), (300, 60), (338, 80), (354, 106), (356, 126), (340, 134),
                       (60, 134), (12, 134)], n=8, closed=True)
    body = car_poly(body_pts)
    layer = paint(layer, solid((58, 10, 8)), dilate(body, 9))              # контур
    top, bottom = car_map(0, 38)[1], GROUND
    layer = paint(layer, vprof(lambda t: lerp((255, 104, 84), (146, 14, 12), t), top, bottom), body)
    # арки колёс (тень под колёсами)
    layer = paint(layer, solid((90, 12, 10)), union(car_ell(48, 82, 124, 158),
                                                    car_ell(232, 82, 308, 158)))
    # крыша и стекло
    glass = car_poly([(122, 74), (150, 50), (230, 40), (254, 48), (216, 80), (158, 82)])
    layer = paint(layer, solid((150, 216, 255)), glass)
    layer = paint(layer, solid((225, 245, 255)), car_line([(164, 56), (206, 48)], 4))
    # спойлер на корме
    layer = paint(layer, solid((30, 30, 36)), car_rr(296, 18, 358, 32, 4))
    layer = paint(layer, solid((30, 30, 36)), union(car_line([(316, 30), (320, 62)], 6),
                                                    car_line([(342, 30), (346, 62)], 6)))
    # белая гоночная полоса вдоль борта
    layer = paint(layer, solid((255, 255, 255)), car_line([(36, 104), (300, 98)], 5))
    # жёлтая молния на борту
    bolt = [(190, 60), (164, 100), (182, 100), (168, 132), (210, 86), (192, 86), (206, 60)]
    layer = paint(layer, solid((70, 46, 0)), dilate(car_poly(bolt), 7))
    layer = paint(layer, solid((255, 210, 31)), car_poly(bolt))
    # колёса и диски
    tyre = union(car_ell(56, 90, 116, 150), car_ell(240, 90, 300, 150))
    layer = paint(layer, solid((21, 21, 26)), tyre)
    layer = paint(layer, solid((201, 206, 214)),
                  union(car_ell(72, 106, 100, 134), car_ell(256, 106, 284, 134)))
    layer = paint(layer, solid((90, 97, 112)),
                  union(car_ell(82, 116, 90, 124), car_ell(266, 116, 274, 124)))
    return layer


# ---------- доктор-лиса в халате (Animal Hospital) ----------

def fox_parts(cx):
    """Список (маска, заливка) в порядке рисования."""
    orange = solid((242, 140, 56))
    coat = hprof(lambda t: lerp((255, 255, 255), (160, 180, 204), (abs(t - 0.5) * 2) ** 2),
                 cx - 110, cx + 110)
    white = solid((255, 255, 255))
    dark = solid((42, 27, 18))
    cream = solid((255, 243, 224))
    parts = [
        (m_ell((cx + 66, 690, cx + 142, 800)), orange),                     # хвост
        (m_ell((cx + 108, 652, cx + 150, 706)), white),                     # кончик хвоста
        (m_rr((cx - 84, 756, cx - 28, 892), 26), solid((44, 58, 92))),      # ноги
        (m_rr((cx + 28, 756, cx + 84, 892), 26), solid((44, 58, 92))),
        (m_ell((cx - 112, 866, cx - 22, 900)), solid((58, 36, 24))),        # ботинки
        (m_ell((cx + 18, 866, cx + 104, 900)), solid((58, 36, 24))),
        (m_poly([(cx - 84, 336), (cx - 112, 204), (cx - 28, 300)]), orange),  # уши
        (m_poly([(cx + 84, 336), (cx + 112, 204), (cx + 28, 300)]), orange),
        (m_poly([(cx - 80, 326), (cx - 102, 236), (cx - 40, 304)]), solid((255, 160, 160))),
        (m_poly([(cx + 80, 326), (cx + 102, 236), (cx + 40, 304)]), solid((255, 160, 160))),
        (m_rr((cx - 110, 502, cx + 110, 812), 76), coat),                   # халат
        (m_line([(cx - 92, 548), (cx - 128, 640), (cx - 118, 700)], 56), coat),  # рукава
        (m_line([(cx + 92, 548), (cx + 138, 636), (cx + 122, 694)], 56), coat),
        (m_ell((cx - 140, 686, cx - 96, 726)), orange),                     # лапы
        (m_ell((cx + 106, 674, cx + 146, 714)), orange),
        (m_poly([(cx - 46, 502), (cx - 6, 598), (cx + 6, 598), (cx + 46, 502),
                 (cx + 26, 502), (cx, 572), (cx - 26, 502)]), solid((214, 226, 236))),  # лацканы
        (m_line([(cx - 34, 560), (cx - 64, 632), (cx - 46, 684)], 10), solid((46, 50, 58))),
        (m_line([(cx + 34, 560), (cx + 60, 632), (cx - 40, 688)], 10), solid((46, 50, 58))),
        (m_ell((cx - 58, 680, cx - 26, 712)), solid((190, 198, 206))),      # диск фонендоскопа
        (m_ell((cx - 108, 298, cx + 108, 512)), orange),                    # голова
        (m_ell((cx - 64, 424, cx + 64, 512)), cream),                       # морда
        (m_ell((cx - 15, 430, cx + 15, 453)), dark),                        # нос
        (m_ell((cx - 48, 376, cx - 26, 408)), dark),                        # глаза
        (m_ell((cx + 26, 376, cx + 48, 408)), dark),
        (m_ell((cx - 42, 380, cx - 36, 388)), white),                       # блики
        (m_ell((cx + 32, 380, cx + 38, 388)), white),
        (m_ell((cx - 80, 438, cx - 54, 462)), solid((255, 150, 150))),      # щёки
        (m_ell((cx + 54, 438, cx + 80, 462)), solid((255, 150, 150))),
        (m_line([(cx, 454), (cx - 13, 470)], 4), dark),                     # рот
        (m_line([(cx, 454), (cx + 13, 470)], 4), dark),
        (m_rr((cx - 90, 290, cx + 90, 346), 22), white),                    # шапочка
        (m_rr((cx - 10, 304, cx + 10, 336), 4), solid((224, 52, 59))),      # красный крест
        (m_rr((cx - 26, 314, cx + 26, 326), 4), solid((224, 52, 59))),
    ]
    return parts


def paint_fox(layer, cx):
    parts = fox_parts(cx)
    body = union(*[m for m, _ in parts])
    layer = paint(layer, solid((26, 40, 66)), dilate(body, 13))             # контур
    for m, fill in parts:
        layer = paint(layer, fill, m)
    return layer


# ---------- фон: арена, трибуны, борт, лёд ----------

def draw_players(F):
    """Мелкие игроки на заднем плане (рисуются на RGBA-слое F, координаты 1K)."""
    d = ImageDraw.Draw(F)

    def player(x, base, sc, jersey, stripe):
        def P(dx, dy):
            return ((x + dx * sc) * K, (base + dy * sc) * K)

        def R(box, r, fill):
            d.rounded_rectangle([*P(*box[:2]), *P(*box[2:])], radius=r * sc * K, fill=fill)

        def E(box, fill):
            d.ellipse([*P(*box[:2]), *P(*box[2:])], fill=fill)

        def L(pts, w, fill):
            d.line([P(*p) for p in pts], fill=fill, width=max(1, int(w * sc * K)), joint='curve')

        R((-12, -66, -2, 0), 4, (30, 42, 60, 255))
        R((2, -66, 12, 0), 4, (30, 42, 60, 255))
        R((-20, -124, 20, -54), 18, jersey + (255,))
        R((-20, -98, 20, -88), 0, stripe + (255,))
        E((-10, -146, 10, -126), (236, 190, 150, 255))
        E((-14, -156, 14, -132), jersey + (255,))
        L([(16, -94), (36, -30), (40, 0)], 7, (90, 58, 30, 255))
        L([(40, 0), (56, 0)], 7, (20, 20, 25, 255))

    blue, black_red = (22, 79, 160), (25, 25, 28)
    player(110, 560, 0.9, blue, (240, 240, 240))
    player(205, 552, 0.8, black_red, (200, 30, 40))
    player(640, 556, 0.75, blue, (240, 240, 240))
    player(760, 548, 0.7, black_red, (200, 30, 40))
    # ворота слева
    d.line([(44 * K, 556 * K), (44 * K, 440 * K), (118 * K, 440 * K), (118 * K, 556 * K)],
           fill=(222, 40, 46, 255), width=10 * K, joint='curve')
    for gx in range(52, 118, 12):
        d.line([(gx * K, 448 * K), (gx * K, 556 * K)], fill=(255, 255, 255, 120), width=2 * K)


def build_background():
    grad = stops([(0, (10, 28, 52)), (300, (40, 88, 135)), (340, (150, 205, 236)),
                  (552, (214, 236, 250)), (600, (200, 230, 248)), (900, (118, 176, 222)),
                  (1024, (80, 140, 200))])
    bg = vprof(lambda t: grad(t * H), 0, H).convert('RGBA')

    # свет прожекторов над ареной
    glow = Image.new('RGBA', SZ, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([260 * K, 110 * K, 764 * K, 430 * K], fill=(255, 255, 255, 150))
    glow = glow.filter(ImageFilter.GaussianBlur(70 * K))
    bg = Image.alpha_composite(bg, glow)

    # боке огней трибун
    rnd = random.Random(7)
    bokeh = Image.new('RGBA', SZ, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bokeh)
    for _ in range(22):
        x = rnd.uniform(0, W)
        y = rnd.uniform(30, 230)
        r = rnd.uniform(6, 16)
        c = (255, 233, 168, 110) if rnd.random() < 0.5 else (191, 230, 255, 110)
        bd.ellipse([(x - r) * K, (y - r) * K, (x + r) * K, (y + r) * K], fill=c)
    bokeh = bokeh.filter(ImageFilter.GaussianBlur(5 * K))
    bg = Image.alpha_composite(bg, bokeh)

    # далёкий хоккей, приглушён туманом
    far = Image.new('RGBA', SZ, (0, 0, 0, 0))
    draw_players(far)
    far = far.filter(ImageFilter.GaussianBlur(1.3 * K))
    fog = Image.blend(far.convert('RGB'), solid((196, 226, 246)), 0.4).convert('RGBA')
    fog.putalpha(far.getchannel('A').point(lambda v: int(v * 0.85)))
    bg = Image.alpha_composite(bg, fog)

    # борт катка и красная полоса
    d = ImageDraw.Draw(bg)
    d.rectangle([0, 546 * K, SZ[0], 556 * K], fill=(240, 246, 252, 255))
    d.rectangle([0, 556 * K, SZ[0], 596 * K], fill=(23, 58, 107, 255))
    d.rectangle([0, 572 * K, SZ[0], 582 * K], fill=(200, 26, 31, 255))

    # штрихи коньков на льду
    arcs = Image.new('RGBA', SZ, (0, 0, 0, 0))
    ad = ImageDraw.Draw(arcs)
    for (bx, by, bw, bh, a0, a1) in [(-80, 640, 420, 240, 200, 320), (560, 700, 500, 260, 210, 330),
                                     (120, 760, 360, 200, 20, 150), (620, 820, 480, 240, 30, 160)]:
        ad.arc([bx * K, by * K, (bx + bw) * K, (by + bh) * K], a0, a1,
               fill=(255, 255, 255, 70), width=3 * K)
    arcs = arcs.filter(ImageFilter.GaussianBlur(1.2 * K))
    bg = Image.alpha_composite(bg, arcs)
    return bg


def shadow_layer(ellipses):
    m = new_mask()
    dm = ImageDraw.Draw(m)
    for x0, y0, x1, y1 in ellipses:
        dm.ellipse([x0 * K, y0 * K, x1 * K, y1 * K], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(7 * K)).point(lambda v: int(v * 0.5))
    return paint(Image.new('RGBA', SZ, (0, 0, 0, 0)), solid((8, 26, 56)), m)


def main():
    bg = build_background()

    # тени на льду
    bg = Image.alpha_composite(bg, shadow_layer([
        (40, GROUND - 12, 300, GROUND + 12),       # машинка
        (280, GROUND - 14, 490, GROUND + 14),      # белый ферзь
        (530, GROUND - 14, 740, GROUND + 14),      # чёрный ферзь
        (770, GROUND - 14, 940, GROUND + 14),      # доктор
    ]))

    # объекты переднего плана
    O = Image.new('RGBA', SZ, (0, 0, 0, 0))
    O = paint_car(O)
    # фигуры слегка наклонены друг к другу (поворот вокруг подставки)
    black = paint_piece(Image.new('RGBA', SZ, (0, 0, 0, 0)), 635, GROUND, 0.8,
                        col=(36, 38, 48), hi=(130, 142, 170), outline=None)
    black = black.rotate(2.5, resample=Image.BICUBIC, center=(635 * K, GROUND * K))
    O = Image.alpha_composite(O, black)
    white = paint_piece(Image.new('RGBA', SZ, (0, 0, 0, 0)), 385, GROUND, 0.8,
                        col=(246, 244, 238), hi=(255, 255, 255),
                        outline=(28, 44, 74), outline_px=9)
    white = white.rotate(-2.5, resample=Image.BICUBIC, center=(385 * K, GROUND * K))
    O = Image.alpha_composite(O, white)
    # доктор чуть уменьшен к линии льда, чтобы фигуры оставались главным акцентом
    FOX_S, fox_x = 0.85, 852
    fox = paint_fox(Image.new('RGBA', SZ, (0, 0, 0, 0)), fox_x)
    ax, ay = fox_x * K, GROUND * K
    fox = fox.transform(SZ, Image.AFFINE,
                        (1 / FOX_S, 0, ax - ax / FOX_S, 0, 1 / FOX_S, ay - ay / FOX_S),
                        resample=Image.BICUBIC)
    O = Image.alpha_composite(O, fox)

    # отражение на льду: верхняя часть объектов, перевёрнутая и приглушённая
    strip = O.crop((0, 0, SZ[0], GROUND * K)).transpose(Image.FLIP_TOP_BOTTOM)
    strip.putalpha(strip.getchannel('A').point(lambda v: int(v * 0.22)))
    strip = strip.filter(ImageFilter.GaussianBlur(3 * K))
    refl = Image.new('RGBA', SZ, (0, 0, 0, 0))
    refl.paste(strip, (0, GROUND * K))
    img = Image.alpha_composite(bg, refl)
    img = Image.alpha_composite(img, O)

    # лёгкая виньетка по краям
    vign = Image.radial_gradient('L').resize(SZ).point(lambda v: int(max(0, v - 120) * 0.45))
    img = Image.composite(solid((8, 22, 44)).convert('RGBA'), img, vign)

    img.convert('RGB').resize((W, H), Image.LANCZOS).save(OUT / 'icon-scene.png', optimize=True)
    print('wrote', OUT / 'icon-scene.png')


if __name__ == '__main__':
    main()
