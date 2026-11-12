#!/usr/bin/env zsh
# Монтаж App Preview из сырой записи AppStore/record_preview.sh: cut_preview.sh <сырое.mov> <выход.mp4>
# Отрезки (секунды сырой записи 1.1, 13.11.2026): меню, гонки с шахом, хоккей, ветклиника, мат в классике, доска почёта.
# Итог 29,5 с, 886×1920, 30 к/с, H.264 10 Мбит/с + беззвучная стерео-дорожка (звук WebKit ReplayKit не пишет).
# Загрузка в Connect: версию на время вынуть из черновика заявки (иначе 409 «Can't Create Preview Set while Ready For Review»).
set -eu
SEGS=${SEGS:-"1:3 24:31 43:49 75:80 110:117 121:123.5"}
FC=$(python3 -c '
import sys
segs=[tuple(x.split(":")) for x in sys.argv[1].split()]
f="".join(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,fps=30,scale=886:1920,setsar=1[v{i}];" for i,(a,b) in enumerate(segs))
print(f+"".join(f"[v{i}]" for i in range(len(segs)))+f"concat=n={len(segs)}:v=1:a=0[v]")' "$SEGS")
ffmpeg -y -v error -i "$1" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "$FC" -map "[v]" -map 1:a -shortest \
  -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -b:v 10M -maxrate 12M -bufsize 20M -c:a aac -b:a 256k -movflags +faststart "$2"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$2"
