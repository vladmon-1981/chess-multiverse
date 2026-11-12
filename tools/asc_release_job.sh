#!/bin/zsh
# Задание launchd com.chessgm.release: раз в 20 мин проверяет версию и выпускает её после одобрения.
# После выпуска (10) или отказа (11) снимает себя. Ставится: tools/asc_release_job.sh --install <версия>
cd "$(dirname "$0")/.."
L=~/Library/LaunchAgents/com.chessgm.release.plist
if [ "${1:-}" = --install ]; then
  cat > $L <<P
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.chessgm.release</string>
  <key>ProgramArguments</key><array><string>$PWD/tools/asc_release_job.sh</string><string>$2</string></array>
  <key>StartInterval</key><integer>1200</integer>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin</string></dict>
  <key>StandardOutPath</key><string>$PWD/.state/release.out</string>
  <key>StandardErrorPath</key><string>$PWD/.state/release.out</string>
</dict></plist>
P
  mkdir -p .state; launchctl bootout gui/$(id -u) $L 2>/dev/null; launchctl bootstrap gui/$(id -u) $L && echo "установлено для $2"; exit
fi
python3 -B tools/asc_release.py "$1" --notify; rc=$?
if [ $rc = 10 ] || [ $rc = 11 ]; then launchctl bootout gui/$(id -u) $L; rm -f $L; fi
