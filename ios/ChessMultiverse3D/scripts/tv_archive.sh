#!/bin/bash
# Архив и экспорт tvOS-версии для App Store (без выгрузки): ./scripts/tv_archive.sh
# Нужен профиль «ChessGM tvOS AppStore»: python3 scripts/asc_tv_profile.py (ключ ASC из chess-multiverse/.secrets.local).
# Результат: ~/Projects/ios-release-tmp/ChessGM-tvOS.xcarchive и export-tv/ChessGM.ipa.
# Выгрузка в App Store Connect: xcodebuild -exportArchive ... -exportOptionsPlist (destination upload) + -authenticationKeyPath/-KeyID/-KeyIssuerID, см. ~/.claude/CLAUDE.md.
set -e
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd "$(dirname "$0")/.."
OUT=~/Projects/ios-release-tmp; mkdir -p "$OUT"
rm -rf "$OUT/ChessGM-tvOS.xcarchive" "$OUT/export-tv"
xcodegen generate --spec project-tvos.yml >/dev/null
xcodebuild -project ChessGM-tvOS.xcodeproj -scheme ChessGM-tvOS -configuration Release -destination "generic/platform=tvOS" \
  -archivePath "$OUT/ChessGM-tvOS.xcarchive" archive CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="ChessGM tvOS AppStore" DEVELOPMENT_TEAM=646ZQ353UC | grep -E "error: |\*\* "
xcodebuild -exportArchive -archivePath "$OUT/ChessGM-tvOS.xcarchive" -exportPath "$OUT/export-tv" \
  -exportOptionsPlist scripts/ExportOptions-tvOS.plist | grep -E "error|EXPORT"
