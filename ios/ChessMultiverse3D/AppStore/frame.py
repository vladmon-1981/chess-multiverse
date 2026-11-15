#!/usr/bin/env python3
"""Снимки App Store ChessGM с подписями-пользой (15.11.2026; код — по образцу LocalTyper-iOS/AppStore/frame.py).

  ~/.lt-venv/bin/python AppStore/frame.py [--device iphone|ipad] [язык ...]     # нужен Pillow
Сырые кадры: screenshots/<ru|en-US>/{iphone-6.9,ipad-13}/ (их снимает shoot.sh, не перезаписываются).
Результат: screenshots/framed/<язык>/ (1320x2868, iPhone 6.9") и screenshots/framed-ipad/<язык>/ (2064x2752, iPad 13").
Подписи — aso_titles.py. Кадр 07-pro не берём: на нём цена из StoreKit симулятора ($1.99), а не реальная.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent
FONT = "/System/Library/Fonts/SFNSRounded.ttf"
# порядок кадров = порядок в магазине: сначала самые сильные
SHOTS = ["01-menu", "03-cars", "05-hockey", "04-hospital", "02-classic", "06-honor"]
ACCENT, ACCENT2, BG = (10, 132, 255), (100, 210, 255), (8, 14, 30)

# Параметры вёрстки по устройствам. iPad = iPhone, умноженный на ~1,56 (ширина 2064 против 1320).
# fit=True: экран целиком в кадр (с полем снизу) и по центру свободной области; у iPhone экран
# уходит за нижний край, как раньше.
DEVICES = {
    "iphone": dict(W=1320, H=2868, raw="iphone-6.9", out="framed", title=118, maxw=1200, y0=170,
                   gap=90, sw=1080, r=90, border=12, fit=False),
    "ipad":   dict(W=2064, H=2752, raw="ipad-13", out="framed-ipad", title=184, maxw=1880, y0=230,
                   gap=110, sw=1700, r=120, border=18, fit=True),
}

def font(size, weight=800):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def background(dv):
    W, H = dv["W"], dv["H"]
    k = W / 1320
    glow = Image.new("RGB", (W, H), BG)
    ImageDraw.Draw(glow).ellipse((int(-400 * k), int(-500 * k), W + int(400 * k), int(1100 * k)), fill=(18, 58, 120))
    return glow.filter(ImageFilter.GaussianBlur(int(220 * k)))


def fit_font(d, lines, maxw=1200, size=118):
    lo = int(size * 60 / 118)
    while size > lo:
        f = font(size)
        if max(d.textlength(l, font=f) for l in lines) <= maxw:
            return f, size
        size -= 4
    return font(size), size


def frame(raw: Image.Image, title: str, crop_top: float, device: str = "iphone", crop_bottom: float = 0.0) -> Image.Image:
    dv = DEVICES[device]
    W, H = dv["W"], dv["H"]
    img = background(dv)
    d = ImageDraw.Draw(img)
    lines = title.split("\n")
    f, size = fit_font(d, lines, dv["maxw"], dv["title"])
    y = dv["y0"]
    for i, ln in enumerate(lines):
        w = d.textlength(ln, font=f)
        mask = Image.new("L", (W, size + 40), 0)
        ImageDraw.Draw(mask).text(((W - w) / 2, 0), ln, font=f, fill=255)
        if i == 0:
            img.paste((255, 255, 255), (0, y), mask)
        else:
            grad = Image.new("RGB", (W, size + 40))
            gd = ImageDraw.Draw(grad)
            for x in range(W):
                t = x / W
                gd.line([(x, 0), (x, size + 40)], fill=tuple(int(ACCENT[k] + (ACCENT2[k] - ACCENT[k]) * t) for k in range(3)))
            img.paste(grad, (0, y), mask)
        y += int(size * 1.2)
    top = dv["y0"] + int(dv["title"] * 1.2) * 2 + dv["gap"]
    raw = raw.convert("RGB")
    if crop_top or crop_bottom:
        raw = raw.crop((0, int(raw.height * crop_top), raw.width, int(raw.height * (1 - crop_bottom))))
    sw = dv["sw"]
    if dv["fit"]:
        margin = dv["gap"]
        free = H - top - margin
        sw = min(sw, int(free * raw.width / raw.height))
    shot = raw.resize((sw, int(raw.height * sw / raw.width)), Image.LANCZOS)
    if dv["fit"]:
        top += max(0, (H - top - margin - shot.height) // 2)
    r = dv["r"]
    m = Image.new("L", shot.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, shot.width, shot.height), r, fill=255)
    x = (W - sw) // 2
    b = dv["border"]
    border = Image.new("L", (shot.width + 2 * b, shot.height + 2 * b), 0)
    ImageDraw.Draw(border).rounded_rectangle((0, 0, border.width, border.height), r + b, fill=255)
    img.paste((54, 66, 92), (x - b, top - b), border)
    img.paste(shot, (x, top), m)
    return img


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(ROOT))
    from aso_titles import TITLES, SOURCE
    args = sys.argv[1:]
    device = "iphone"
    if "--device" in args:
        k = args.index("--device")
        device = args[k + 1]
        del args[k:k + 2]
    dv = DEVICES[device]
    for lang in TITLES:
        if args and lang not in args:
            continue
        out = ROOT / "screenshots" / dv["out"] / lang
        out.mkdir(parents=True, exist_ok=True)
        for i, name in enumerate(SHOTS):
            raw = Image.open(ROOT / "screenshots" / SOURCE[lang] / dv["raw"] / f"{name}.png")
            frame(raw, TITLES[lang][i], 0.0, device).save(out / f"{i + 1:02d}-{name.split('-', 1)[1]}.png")
        print(lang, len(SHOTS), "кадров ->", out)
