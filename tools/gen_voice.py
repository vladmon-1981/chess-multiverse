#!/usr/bin/env python3
"""
Запись фраз диктора нейроголосом Piper (бесплатно, без интернета).

  phrases_<lang>.json — {ключ: текст}, получается в браузере из tools/voice_phrases.js
  Голоса Piper (.onnx + .onnx.json) — https://huggingface.co/rhasspy/piper-voices (v1.0.0):
    ru: ru_RU-irina-medium (женский), ru_RU-ruslan-medium (мужской)
    en: en_US-hfc_female-medium, en_US-hfc_male-medium

Запуск (нужен python с пакетом piper-tts; espeak-ng-data — по короткому пути,
у espeak предел длины пути, из длинной папки он молча не находит phontab):
  python gen_voice.py --phrases DIR --models DIR [--espeak ~/.cache/espeak-ng-data]

Пишет voice/<lang>-<f|m>/<ключ>.m4a (AAC моно) и voice/manifest.js. Уже записанные файлы
пропускает — после правки реплик достаточно запустить заново.
"""
import argparse, json, os, subprocess, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICES = {
    ('ru', 'f'): ('ru_RU-irina-medium', 0.95),
    ('ru', 'm'): ('ru_RU-ruslan-medium', 0.92),
    ('en', 'f'): ('en_US-hfc_female-medium', 0.95),
    ('en', 'm'): ('en_US-hfc_male-medium', 0.95),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--phrases', required=True)
    ap.add_argument('--models', required=True)
    ap.add_argument('--espeak', default=str(Path.home() / '.cache' / 'espeak-ng-data'))
    ap.add_argument('--only', default='', help='например ru-f,ru-m')
    a = ap.parse_args()

    from piper import PiperVoice, SynthesisConfig

    manifest = {}
    for (lang, g), (model, scale) in VOICES.items():
        tag = f'{lang}-{g}'
        phrases = json.load(open(Path(a.phrases) / f'phrases_{lang}.json'))
        out = ROOT / 'voice' / tag
        out.mkdir(parents=True, exist_ok=True)
        onnx = Path(a.models) / f'{model}.onnx'
        if (a.only and tag not in a.only.split(',')) or not onnx.exists():
            have = {p.stem for p in out.glob('*.m4a')}
        else:
            voice = PiperVoice.load(str(onnx), espeak_data_dir=a.espeak)
            cfg = SynthesisConfig(length_scale=scale, noise_scale=0.6, noise_w_scale=0.8)
            todo = [(k, t) for k, t in phrases.items() if not (out / f'{k}.m4a').exists()]
            for i, (k, t) in enumerate(todo, 1):
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    wav = tmp.name
                with wave.open(wav, 'wb') as w:
                    voice.synthesize_wav(t, w, syn_config=cfg)
                subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', wav, str(out / f'{k}.m4a')], check=True)
                os.unlink(wav)
                if i % 50 == 0:
                    print(f'{tag}: {i}/{len(todo)}', flush=True)
            have = {p.stem for p in out.glob('*.m4a')}
            print(f'{tag}: готово, {len(have)} файлов', flush=True)
        manifest.setdefault(lang, []).append({k for k in phrases if k in have})

    # В манифест — только фразы, записанные обоими голосами языка
    js = {lang: ','.join(sorted(set.intersection(*sets))) for lang, sets in manifest.items()}
    (ROOT / 'voice' / 'manifest.js').write_text(
        '/* Записанные фразы диктора (tools/gen_voice.py). Ключ — Voice.key(текст). */\n'
        'window.CM_VOICE_CLIPS = ' + json.dumps(js, ensure_ascii=False) + ';\n')
    print({lang: len(v.split(',')) if v else 0 for lang, v in js.items()})


if __name__ == '__main__':
    main()
