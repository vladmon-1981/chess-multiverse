#!/usr/bin/env python3
"""Проверка ASO-правил (15.11.2026): в keywords нет пробелов и повторов слов, слова названия и подзаголовка
своей локали в keywords не повторяются, слова названия не повторяются в подзаголовке.
  python3 AppStore/check_aso.py      (выход 1 при нарушении)
"""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parent / "metadata"
SKIP = {"kk"}
bad = 0
rd = lambda l, f: (ROOT / l / f"{f}.txt").read_text(encoding="utf-8").strip()
words = lambda s: [w.lower() for w in re.findall(r"[\w'’-]+", s)]
for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and p.name not in SKIP):
    l = d.name
    name, sub, kw = rd(l, "name"), rd(l, "subtitle"), rd(l, "keywords")
    nw = set(words(name)) - {"chessgm"}
    sw = set(words(sub))
    items = kw.split(",")
    probs = []
    if " " in kw: probs.append("пробел в keywords")
    kws = [w.lower() for i in items for w in words(i)]
    dup = sorted({w for w in kws if kws.count(w) > 1})
    if dup: probs.append(f"повтор в keywords: {dup}")
    c1 = sorted(set(kws) & (nw | sw))
    if c1: probs.append(f"keywords повторяют название/подзаголовок: {c1}")
    c2 = sorted(nw & sw)
    if c2: probs.append(f"подзаголовок повторяет название: {c2}")
    print(f"{l:6} name {len(name):2} sub {len(sub):2} kw {len(kw):3}  {'ok' if not probs else probs}")
    bad += bool(probs)
sys.exit(1 if bad else 0)
