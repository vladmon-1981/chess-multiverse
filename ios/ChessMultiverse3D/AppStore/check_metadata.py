#!/usr/bin/env python3
"""Проверка лимитов App Store Connect для AppStore/metadata/<lang>/*.txt.

  python3 AppStore/check_metadata.py

Выход 1, если что-то превышает лимит или поле пустое.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent / "metadata"
LIMITS = {"name": 30, "subtitle": 30, "promotional_text": 170,
          "description": 4000, "keywords": 100, "release_notes": 4000}
bad = 0
for lang_dir in sorted(p for p in ROOT.iterdir() if p.is_dir()):
    for field, limit in LIMITS.items():
        f = lang_dir / f"{field}.txt"
        if not f.exists():
            print(f"{lang_dir.name:6} {field:16} НЕТ ФАЙЛА"); bad += 1; continue
        text = f.read_text(encoding="utf-8").rstrip("\n")
        n = len(text)
        ok = 0 < n <= limit
        bad += not ok
        print(f"{lang_dir.name:6} {field:16} {n:5}/{limit:<5} {'ok' if ok else '<-- ОШИБКА'}")
sys.exit(1 if bad else 0)
