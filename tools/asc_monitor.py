#!/usr/bin/env python3
"""Мониторинг ChessGM в App Store Connect: новые отзывы и диагностика крашей.

Ключи — в .secrets.local/asc.env (не в git). Состояние — .state/seen.json.
Запуск: python3 tools/asc_monitor.py [--notify] [--init]
  --init    запомнить всё текущее как «уже виденное», ничего не сообщая
  --notify  показать уведомление macOS о новых событиях
Печатает только новые события; код выхода 0 всегда (кроме ошибки API → 2).
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECRETS = os.path.join(ROOT, ".secrets.local")
STATE_DIR = os.path.join(ROOT, ".state")
STATE = os.path.join(STATE_DIR, "seen.json")
API = "https://api.appstoreconnect.apple.com"


def load_env():
    env = {}
    with open(os.path.join(SECRETS, "asc.env")) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k] = v
    return env


def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def der_to_raw(der):
    # ECDSA DER -> r||s по 32 байта
    assert der[0] == 0x30
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    assert der[i] == 0x02
    rl = der[i + 1]
    r = der[i + 2:i + 2 + rl]
    i = i + 2 + rl
    assert der[i] == 0x02
    sl = der[i + 1]
    s = der[i + 2:i + 2 + sl]
    r = r.lstrip(b"\x00").rjust(32, b"\x00")
    s = s.lstrip(b"\x00").rjust(32, b"\x00")
    return r + s


def token(env):
    now = int(time.time())
    header = {"alg": "ES256", "kid": env["ASC_KEY_ID"], "typ": "JWT"}
    payload = {"iss": env["ASC_ISSUER_ID"], "iat": now, "exp": now + 1000,
               "aud": "appstoreconnect-v1"}
    signing = b64(json.dumps(header, separators=(",", ":")).encode()) + "." + \
        b64(json.dumps(payload, separators=(",", ":")).encode())
    der = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", os.path.join(SECRETS, env["ASC_KEY_FILE"])],
        input=signing.encode(), capture_output=True, check=True).stdout
    return signing + "." + b64(der_to_raw(der))


def get(env_tok, path, params=None):
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + env_tok})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        # тело ошибки ASC не содержит секретов; токен не печатаем
        return {"_error": e.code, "_body": e.read().decode()[:300]}


def main():
    init = "--init" in sys.argv
    notify = "--notify" in sys.argv
    env = load_env()
    tok = token(env)
    app = env["ASC_APP_ID"]
    os.makedirs(STATE_DIR, exist_ok=True)
    seen = {}
    if os.path.exists(STATE):
        seen = json.load(open(STATE))
    seen_reviews = set(seen.get("reviews", []))
    seen_diag = set(seen.get("diag", []))
    seen_feedback = set(seen.get("feedback", []))
    events, errors = [], []

    # 1. Отзывы
    d = get(tok, f"/v1/apps/{app}/customerReviews",
            {"sort": "-createdDate", "limit": 50})
    if "_error" in d:
        errors.append(f"reviews: {d['_error']} {d['_body']}")
    else:
        for r in d.get("data", []):
            if r["id"] in seen_reviews:
                continue
            seen_reviews.add(r["id"])
            a = r["attributes"]
            events.append(f"⭐ {a['rating']}/5 [{a.get('territory','?')}] "
                          f"{a.get('title','')} — {a.get('body','')[:200]}")

    # 2. Диагностика (краши, зависания) по последним сборкам
    b = get(tok, "/v1/builds", {"filter[app]": app, "sort": "-uploadedDate", "limit": 3})
    if "_error" in b:
        errors.append(f"builds: {b['_error']} {b['_body']}")
    else:
        for bld in b.get("data", []):
            v = bld["attributes"].get("version")
            s = get(tok, f"/v1/builds/{bld['id']}/diagnosticSignatures", {"limit": 50})
            if "_error" in s:
                if s["_error"] not in (404,):
                    errors.append(f"diag build {v}: {s['_error']} {s['_body']}")
                continue
            for sig in s.get("data", []):
                if sig["id"] in seen_diag:
                    continue
                seen_diag.add(sig["id"])
                a = sig["attributes"]
                events.append(f"💥 {a.get('diagnosticType')} в сборке {v}: "
                              f"{a.get('signature','')[:120]} (вес {a.get('weight')})")

    # 3. Краши и отзывы из TestFlight
    for kind, key, label in (("betaFeedbackCrashSubmissions", "crash", "TestFlight-краш"),
                             ("betaFeedbackScreenshotSubmissions", "shot", "TestFlight-отзыв")):
        f = get(tok, f"/v1/apps/{app}/{kind}", {"limit": 50})
        if "_error" in f:
            if f["_error"] not in (403, 404):
                errors.append(f"{kind}: {f['_error']} {f['_body']}")
            continue
        for x in f.get("data", []):
            if x["id"] in seen_feedback:
                continue
            seen_feedback.add(x["id"])
            events.append(f"🧪 {label}: {x['attributes'].get('comment') or x['attributes'].get('deviceModel','')}")

    json.dump({"reviews": sorted(seen_reviews), "diag": sorted(seen_diag),
               "feedback": sorted(seen_feedback)}, open(STATE, "w"))

    if errors:
        print("ОШИБКИ API:\n" + "\n".join(errors), file=sys.stderr)
    if init:
        print(f"init: запомнено отзывов {len(seen_reviews)}, диагностик {len(seen_diag)}, "
              f"отзывов TF {len(seen_feedback)}")
        return 2 if errors else 0
    if events:
        text = "\n".join(events)
        print(text)
        if notify:
            msg = (str(len(events)) + " нов.: " + events[0])[:200].replace('"', "'")
            subprocess.run(["osascript", "-e",
                            f'display notification "{msg}" with title "ChessGM App Store" sound name "Glass"'])
    else:
        print("новых событий нет")
    return 2 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
