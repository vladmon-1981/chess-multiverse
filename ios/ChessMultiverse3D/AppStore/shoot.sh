#!/usr/bin/env zsh
# Снимки для App Store из DEBUG-сборки на уже загруженном симуляторе.
#   AppStore/shoot.sh <UDID> <ru|en> <папка> [APP]
# APP — путь к ChessMultiverse3D.app (Debug, симулятор). Сборка:
#   xcodebuild -project ChessMultiverse3D.xcodeproj -scheme ChessMultiverse3D -configuration Debug \
#     -destination "platform=iOS Simulator,id=<UDID>" -derivedDataPath /tmp/chessmv-dd CODE_SIGNING_ALLOWED=NO build
# Сцены задаёт переменная CM_SCRIPT (JS, выполняется через 1,5 с после загрузки; код только в DEBUG,
# см. ContentView.swift). Партии разыгрываются «вдвоём» заранее заданными ходами, ИИ не нужен.
# SLEEP=<сек> — ожидание кадра партии (по умолчанию 60; на iPad 110: 3D в симуляторе рисуется медленно).
# MENU_SLEEP=<сек> — ожидание кадра меню (35; на iPad 130, иначе в карточках вселенных нет фигур).
# Язык системы симулятора для iPad-кадров ставился отдельно (в статус-баре iPad видны дата и имя
# приложения): xcrun simctl spawn <UDID> defaults write .GlobalPreferences AppleLanguages -array en
# (и AppleLocale en_US), затем перезагрузка симулятора.
# ONLY="02-classic 05-hockey" — переснять только эти кадры.
# Статус-бар: 9:41, полная батарея. Каждый запуск ставит приложение заново (чистое хранилище).
set -eu
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
U=$1; LANGC=$2; O=$3
APP=${4:-/tmp/chessmv-dd/Build/Products/Debug-iphonesimulator/ChessMultiverse3D.app}
B=com.chessmultiverse.app
if [ "$LANGC" = ru ]; then LOC=ru_RU; N1='Алекс'; N2='Саша'; else LOC=en_US; N1='Alex'; N2='Sam'; fi
mkdir -p "$O"
xcrun simctl status_bar $U override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiBars 3 --dataNetwork wifi
xcrun simctl uninstall $U $B >/dev/null 2>&1 || true
xcrun simctl install $U "$APP"

PRE="const sleep=ms=>new Promise(r=>setTimeout(r,ms));const a=chessApp;
const mv=async(l)=>{for(const m of l.split(' ')){await a.commitMove({from:m.slice(0,2),to:m.slice(2,4)});await sleep(300);}};
const play=async(t,l)=>{await a.applyTheme(t);document.getElementById('whiteName').value='$N1';document.getElementById('blackName').value='$N2';await a.startGame('pvp');await sleep(3000);await mv(l);};"
OPEN="e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 c1g5 h7h6 g5f6 d8f6"
MATE="e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7"

shot(){ n=$1; w=$2; js=$3
  if [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $n "* ]]; then return; fi
  xcrun simctl terminate $U $B >/dev/null 2>&1 || true
  env SIMCTL_CHILD_CM_SCRIPT="$js" xcrun simctl launch $U $B -AppleLanguages "($LANGC)" -AppleLocale $LOC >/dev/null
  sleep $w; xcrun simctl io $U screenshot "$O/$n.png" >/dev/null 2>&1; }
W=${SLEEP:-60}
# Прогрев: первый запуск WebKit на свежем симуляторе рисует страницу по полминуты
xcrun simctl launch $U $B -AppleLanguages "($LANGC)" -AppleLocale $LOC >/dev/null; sleep 45
shot 01-menu    ${MENU_SLEEP:-35} ""
shot 02-classic $W "$PRE play('classic','$OPEN');"
shot 03-cars    $W "$PRE play('cars','$OPEN');"
shot 04-hospital $W "$PRE play('hospital','$OPEN');"
shot 05-hockey  $W "$PRE play('hockey','$OPEN');"
shot 06-goal    $((W+20)) "$PRE a.cinematic=false;play('hockey','$MATE');"
xcrun simctl terminate $U $B >/dev/null 2>&1 || true
xcrun simctl status_bar $U clear >/dev/null 2>&1 || true
