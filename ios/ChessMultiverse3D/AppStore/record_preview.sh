#!/usr/bin/env zsh
# Видео для App Store (App Preview) с настоящего iPhone, по Wi‑Fi, без кабеля. ЗВУКА В ЗАПИСИ НЕТ:
# ReplayKit пишет звук процесса приложения, а WKWebView играет звук в отдельном процессе WebKit.
#   AppStore/record_preview.sh <UDID> <ru|en> <выход.mov> [секунд]
# Нужна DEBUG-сборка на телефоне (в ней хуки CM_SCRIPT и CM_RECORD, см. ContentView.swift).
# Приложение запускается с CM_RECORD — само пишет экран со звуком (ReplayKit) в Documents/preview.mov;
# iOS спрашивает «Разрешить запись экрана» — на телефоне нажать «Записать экран» (сценарий ждёт начала записи до 2 минут).
# Сценарий CM_SCRIPT: меню → гонки → хоккей → ветклиника → классика с матом → доска почёта.
# Лимит бесплатных партий, запись в доску почёта и счёт партий подменяются только на время записи,
# в конце возвращается прежняя вселенная. Монтаж — AppStore/cut_preview.sh.
set -eu
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
U=$1; LANGC=$2; OUT=$3; SECS=${4:-80}
rm -f "$OUT"
B=com.chessmultiverse.app
if [ "$LANGC" = ru ]; then N1='Алекс'; N2='Саша'; HN="['Алекс','Саша','Маша','Дима','Катя','Игорь']"; else N1='Alex'; N2='Sam'; HN="['Alex','Sam','Maya','Dan','Kate','Ivan']"; fi

JS="(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const a=chessApp;const was=a.theme;
const hn=$HN;const hh={};[[41,13,2,3,6,4],[33,11,1,4,4,2],[27,9,3,3,3,1],[18,6,1,5,2,0],[11,4,0,3,1,0],[6,2,2,4,1,0]].forEach((v,i)=>{hh[hn[i].toLowerCase()]={name:hn[i],pts:v[0],w:v[1],d:v[2],l:v[3],streak:0,best:v[4],hard:v[5],t:Date.now()-i*1000};});
a.allowGame=()=>true;a.recordHonor=()=>3;a.loadHonor=()=>hh;a.playerName=()=>'$N1';
const mv=async(l,gap)=>{for(const m of l.split(' ')){await a.commitMove({from:m.slice(0,2),to:m.slice(2,4)});await sleep(gap);}};
const scene=async(t,l,hold)=>{await a.applyTheme(t);document.getElementById('whiteName').value='$N1';document.getElementById('blackName').value='$N2';
 a.startGame('pvp');await sleep(500);for(let i=0;i<60&&!document.getElementById('boardLoading').classList.contains('is-hidden');i++)await sleep(250);
 await sleep(1800);await mv(l,1300);await sleep(hold);};
for(let i=0;i<240&&!window.CM_REC;i++)await sleep(500);await sleep(2500);
await scene('cars','e2e4 d7d5 e4d5 d8d5 b1c3 d5e5',1200);
await scene('hockey','e2e4 e7e5 g1f3 b8c6 f3e5 c6e5',1200);
await scene('hospital','d2d4 d7d5 c2c4 d5c4 e2e4',1200);
await scene('classic','e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7',5000);
document.getElementById('resultModal').hidden=true;a.showHonor();await sleep(5000);
document.getElementById('honorModal').hidden=true;a.showScreen('menu');await a.applyTheme(was);})();"

# Размер файла прошлой записи на телефоне — новый файл должен от него отличаться
OLD=$(xcrun devicectl device info files --device $U --domain-type appDataContainer --domain-identifier $B --subdirectory Documents 2>/dev/null | awk '/preview.mov/ {print $0}' | md5)
xcrun devicectl device process launch --device $U --terminate-existing \
  --environment-variables "$(python3 -c 'import json,sys;print(json.dumps({"CM_SCRIPT":sys.argv[1],"CM_RECORD":sys.argv[2]}))' "$JS" "$SECS")" \
  -- $B -AppleLanguages "($LANGC)" >/dev/null
echo "Запись $SECS с… на телефоне нажать «Записать экран»"
# На телефоне может лежать файл прошлой записи — ждём файл нужной длины
echo "ждём…"; for i in $(seq 1 80); do sleep 5
  [ "$(xcrun devicectl device info files --device $U --domain-type appDataContainer --domain-identifier $B --subdirectory Documents 2>/dev/null | awk '/preview.mov/ {print $0}' | md5)" = "$OLD" ] && continue
  xcrun devicectl device copy from --device $U --domain-type appDataContainer --domain-identifier $B --source Documents/preview.mov --destination "$OUT" >/dev/null 2>&1 || continue
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" 2>/dev/null); [ "${d%.*}" -ge $((SECS - 5)) ] 2>/dev/null && break; rm -f "$OUT"; done
ls -la "$OUT"
