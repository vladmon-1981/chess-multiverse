#!/bin/bash
# Сборка и установка tvOS-версии на Apple TV: DEVICE="Apple TV" ./scripts/tv_install.sh
# Один раз подготовить телевизор: Apple TV → Настройки → Пульты и устройства → Пульт и устройства (Remote and Devices) →
# Remote App and Devices; на Маке Xcode → Window → Devices and Simulators → «+» → выбрать Apple TV → ввести код с экрана.
# Mac и Apple TV в одной сети Wi-Fi; VPN (Shadowrocket) на Маке выключить — иначе туннель devicectl не поднимется.
# Первая установка регистрирует устройство в аккаунте разработчика (команда 646ZQ353UC), профиль создаётся автоматически.
set -e
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd "$(dirname "$0")/.."
DEVICE="${DEVICE:-Apple TV}"
UDID=$(xcrun devicectl list devices 2>/dev/null | awk -v d="$DEVICE" '$0 ~ "^"d {for(i=1;i<=NF;i++) if($i ~ /^[0-9A-F-]{20,}$/){print $i; exit}}')
[ -n "$UDID" ] || { echo "Устройство '$DEVICE' не найдено. Список: xcrun devicectl list devices"; exit 1; }
xcodegen generate --spec project-tvos.yml >/dev/null
OUT=$(mktemp -d)
set -o pipefail
xcodebuild -project ChessGM-tvOS.xcodeproj -scheme ChessGM-tvOS -configuration Debug \
  -destination "platform=tvOS,id=$UDID" -derivedDataPath "$OUT" -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=646ZQ353UC build | grep -E "error:|BUILD"
xcrun devicectl device install app --device "$UDID" "$OUT/Build/Products/Debug-appletvos/ChessGM.app"
xcrun devicectl device process launch --device "$UDID" com.chessmultiverse.app || true
