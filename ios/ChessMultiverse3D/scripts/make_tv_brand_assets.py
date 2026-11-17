#!/usr/bin/env python3
"""Генерирует tvOS-ассеты (иконка с параллаксом + Top Shelf) из иконки iOS.
Запуск: python3 scripts/make_tv_brand_assets.py  (нужен Pillow). Результат: tvOS/Assets.xcassets."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = Image.open(ROOT / "ChessMultiverse3D/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png").convert("RGB")
OUT = ROOT / "tvOS/Assets.xcassets"
BRAND = OUT / "App Icon & Top Shelf Image.brandassets"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False))


def cover(img, size):
    s = max(size[0] / img.width, size[1] / img.height)
    r = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (r.width - size[0]) // 2, (r.height - size[1]) // 2
    return r.crop((x, y, x + size[0], y + size[1]))


def back_layer(size):
    # размытый «задний план»: та же сцена, увеличенная и затемнённая
    b = cover(SRC, size).filter(ImageFilter.GaussianBlur(size[1] / 40))
    return Image.eval(b, lambda v: int(v * 0.78))


def front_layer(size):
    # передний план: иконка по центру со скруглением на прозрачном фоне
    h = int(size[1] * 0.94)
    ic = SRC.resize((h, h), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (h, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, h - 1, h - 1), radius=int(h * 0.12), fill=255)
    ic.putalpha(m)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    layer.paste(ic, ((size[0] - h) // 2, (size[1] - h) // 2), ic)
    return layer


def imagestack(name, size, scales):
    stack = BRAND / f"{name}.imagestack"
    layers = [("Back", back_layer), ("Front", front_layer)]
    w(stack / "Contents.json", {"layers": [{"filename": f"{n}.imagestacklayer"} for n, _ in layers][::-1],
                                "info": {"author": "xcode", "version": 1}})
    for lname, fn in layers:
        lay = stack / f"{lname}.imagestacklayer"
        w(lay / "Contents.json", {"info": {"author": "xcode", "version": 1}})
        imgs = []
        for sc in scales:
            px = (size[0] * sc, size[1] * sc)
            fname = f"{lname}@{sc}x.png" if sc > 1 else f"{lname}.png"
            d = lay / "Content.imageset"
            d.mkdir(parents=True, exist_ok=True)
            im = fn(px)
            if lname == "Back":
                im = im.convert("RGB")
            im.save(d / fname)
            e = {"idiom": "tv", "filename": fname}
            e["scale"] = f"{sc}x"
            imgs.append(e)
        w(lay / "Content.imageset/Contents.json", {"images": imgs, "info": {"author": "xcode", "version": 1}})


def shelf(name, size):
    d = BRAND / f"{name}.imageset"
    d.mkdir(parents=True, exist_ok=True)
    imgs = []
    for sc in (1, 2):
        px = (size[0] * sc, size[1] * sc)
        # лента: сцена, кадрированная по полосе с фигурами, и мягкое затемнение снизу
        big = SRC.resize((px[0], px[0]), Image.LANCZOS)
        top = int(px[0] * 0.30)
        band = big.crop((0, top, px[0], top + px[1])).convert("RGB")
        fname = f"{name}@{sc}x.png" if sc > 1 else f"{name}.png"
        band.save(d / fname)
        e = {"idiom": "tv", "filename": fname}
        e["scale"] = f"{sc}x"
        imgs.append(e)
    w(d / "Contents.json", {"images": imgs, "info": {"author": "xcode", "version": 1}})


def main():
    imagestack("App Icon - Small", (400, 240), (1, 2))
    imagestack("App Icon - Large", (1280, 768), (1,))
    shelf("Top Shelf Image", (1920, 720))
    shelf("Top Shelf Image Wide", (2320, 720))
    w(BRAND / "Contents.json", {
        "assets": [
            {"filename": "App Icon - Large.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "1280x768"},
            {"filename": "App Icon - Small.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "400x240"},
            {"filename": "Top Shelf Image Wide.imageset", "idiom": "tv", "role": "top-shelf-image-wide", "size": "2320x720"},
            {"filename": "Top Shelf Image.imageset", "idiom": "tv", "role": "top-shelf-image", "size": "1920x720"},
        ],
        "info": {"author": "xcode", "version": 1}})
    w(OUT / "Contents.json", {"info": {"author": "xcode", "version": 1}})


main()
