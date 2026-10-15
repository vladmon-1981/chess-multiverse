#!/bin/bash
# Сборка Release и установка на устройство: DEVICE="iPhone Vlad" ./scripts/install_device.sh
# Нужен профиль подписи: один раз Run из Xcode на этом устройстве (бесплатный Apple ID, Team 4N9Z9JPM6C).
set -e
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd "$(dirname "$0")/.."
DEVICE="${DEVICE:-iPhone Vlad}"
UDID=$(xcrun devicectl list devices 2>/dev/null | awk -v d="$DEVICE" '$0 ~ "^"d"  " {for(i=1;i<=NF;i++) if($i ~ /^[0-9A-F-]{20,}$/){print $i; exit}}')
[ -n "$UDID" ] || { echo "Устройство '$DEVICE' не найдено"; exit 1; }
OUT=build
xcodebuild -project ChessMultiverse3D.xcodeproj -scheme ChessMultiverse3D -configuration Release \
  -destination "platform=iOS,id=$UDID" -derivedDataPath $OUT -allowProvisioningUpdates build | tail -3
APP=$OUT/Build/Products/Release-iphoneos/ChessMultiverse3D.app
xcrun devicectl device install app --device "$UDID" "$APP"
xcrun devicectl device process launch --device "$UDID" kz.vladmon.chessmultiverse || true
