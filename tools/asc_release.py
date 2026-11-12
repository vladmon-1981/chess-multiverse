#!/usr/bin/env python3
"""Выпуск версии после одобрения: python3 tools/asc_release.py <версия> [--notify]

Смотрит статус версии в App Store Connect (ключ из .secrets.local/asc.env). Если Apple одобрила
(PENDING_DEVELOPER_RELEASE) — выпускает в App Store (appStoreVersionReleaseRequests).
Если отклонена — сообщает. Пишет строку в .state/release.log, с --notify — уведомление macOS.
Код выхода: 0 — ещё ждём, 10 — выпущено/уже в продаже, 11 — отклонено, 2 — ошибка API.
Запускается launchd-агентом com.chessgm.release (каждые 20 мин), агент снимает себя сам при коде 10/11.
"""
import json, os, subprocess, sys, time, urllib.request, urllib.error
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asc_monitor as m

VER = sys.argv[1]
NOTIFY = '--notify' in sys.argv
LOG = os.path.join(m.STATE_DIR, 'release.log')


def req(method, path, body=None):
    r = urllib.request.Request(m.API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + TOK, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=60) as f:
            t = f.read().decode()
            return f.status, (json.loads(t) if t else {})
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]


def say(msg, notify=False):
    os.makedirs(m.STATE_DIR, exist_ok=True)
    with open(LOG, 'a') as f:
        f.write(time.strftime('%d.%m.%Y %H:%M ') + msg + '\n')
    print(msg)
    if notify and NOTIFY:
        subprocess.run(['osascript', '-e', f'display notification "{msg}" with title "ChessGM {VER}" sound name "Glass"'])


env = m.load_env()
TOK = m.token(env)
try:
    st, r = req('GET', f'/v1/apps/{env["ASC_APP_ID"]}/appStoreVersions?filter[platform]=IOS&filter[versionString]={VER}')
except Exception as e:
    say(f'сеть: {e}'); sys.exit(2)
if st >= 300 or not r.get('data'):
    say(f'API {st}: {r}'); sys.exit(2)
v = r['data'][0]
state = v['attributes']['appStoreState']
if state == 'PENDING_DEVELOPER_RELEASE':
    st, r = req('POST', '/v1/appStoreVersionReleaseRequests', {'data': {'type': 'appStoreVersionReleaseRequests',
        'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': v['id']}}}}})
    if st < 300:
        say('одобрена Apple и выпущена в App Store ✅', True); sys.exit(10)
    say(f'одобрена, но выпуск не прошёл: {st} {r}', True); sys.exit(2)
if state in ('READY_FOR_SALE', 'PROCESSING_FOR_APP_STORE', 'READY_FOR_DISTRIBUTION'):
    say(f'уже выпущена ({state})', True); sys.exit(10)
if state in ('REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'DEVELOPER_REJECTED'):
    say(f'не прошла проверку: {state} — смотреть App Store Connect', True); sys.exit(11)
say(f'ждём: {state}')
sys.exit(0)
