#!/usr/bin/env python3
"""Профиль App Store для ChessGM (tvOS) через App Store Connect API (без входа в Xcode).

Зачем: выгрузка ключом API с ролью App Manager не может пользоваться облачной подписью
(«Cloud signing permission error»), поэтому экспорт — ручной подписью: локальный сертификат
«Apple Distribution (646ZQ353UC)» + профили IOS_APP_STORE, созданные здесь.

Ключ — общий ключ команды: ASC_SECRETS (по умолчанию ~/Projects/chess-multiverse/.secrets.local),
файл asc.env (ASC_ISSUER_ID, ASC_KEY_ID, ASC_KEY_FILE). В git ничего не попадает.

  python3 scripts/asc_tv_profile.py          # создать недостающие профили и поставить их на Mac
Печатает имена профилей — их же ждёт scripts/ExportOptions-tvOS.plist.
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error, urllib.parse

SECRETS = os.environ.get("ASC_SECRETS", os.path.expanduser("~/Projects/chess-multiverse/.secrets.local"))
API = "https://api.appstoreconnect.apple.com"
PROFILES = {"com.chessmultiverse.app": "ChessGM tvOS AppStore"}   # bundle id → имя профиля
DIRS = [os.path.expanduser("~/Library/MobileDevice/Provisioning Profiles"),
        os.path.expanduser("~/Library/Developer/Xcode/UserData/Provisioning Profiles")]


def load_env():
    env = {}
    for line in open(os.path.join(SECRETS, "asc.env")):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v
    return env


def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def der_to_raw(der):
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    rl = der[i + 1]; r = der[i + 2:i + 2 + rl]; i += 2 + rl
    sl = der[i + 1]; s = der[i + 2:i + 2 + sl]
    return r.lstrip(b"\0").rjust(32, b"\0") + s.lstrip(b"\0").rjust(32, b"\0")


def token(env):
    now = int(time.time())
    h = {"alg": "ES256", "kid": env["ASC_KEY_ID"], "typ": "JWT"}
    p = {"iss": env["ASC_ISSUER_ID"], "iat": now, "exp": now + 1000, "aud": "appstoreconnect-v1"}
    signing = b64(json.dumps(h, separators=(",", ":")).encode()) + "." + b64(json.dumps(p, separators=(",", ":")).encode())
    der = subprocess.run(["openssl", "dgst", "-sha256", "-sign", os.path.join(SECRETS, env["ASC_KEY_FILE"])],
                         input=signing.encode(), capture_output=True, check=True).stdout
    return signing + "." + b64(der_to_raw(der))


def call(tok, method, path, params=None, body=None):
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"API {method} {path}: {e.code} {e.read().decode()[:4000]}")


def local_dist_serials():
    """Серийные номера локальных сертификатов Apple Distribution (с закрытым ключом)."""
    out = subprocess.run(["security", "find-certificate", "-a", "-c", "Apple Distribution", "-p"],
                         capture_output=True, text=True).stdout
    serials = set()
    for pem in out.split("-----END CERTIFICATE-----"):
        if "BEGIN" not in pem:
            continue
        r = subprocess.run(["openssl", "x509", "-noout", "-serial"], input=pem + "-----END CERTIFICATE-----\n",
                           capture_output=True, text=True).stdout
        if "=" in r:
            serials.add(r.strip().split("=", 1)[1].upper().lstrip("0"))
    return serials


def main():
    env = load_env()
    tok = token(env)
    serials = local_dist_serials()
    certs = call(tok, "GET", "/v1/certificates", {"limit": 200})["data"]
    dist = [c for c in certs if c["attributes"]["certificateType"] in ("DISTRIBUTION", "IOS_DISTRIBUTION")
            and c["attributes"]["serialNumber"].upper().lstrip("0") in serials]
    if not dist:
        sys.exit("нет сертификата Apple Distribution, который есть и в Connect, и в связке ключей")
    cert = dist[0]
    print("сертификат:", cert["attributes"]["name"], "до", cert["attributes"]["expirationDate"][:10])
    for ident, name in PROFILES.items():
        bid = call(tok, "GET", "/v1/bundleIds", {"filter[identifier]": ident, "limit": 5})["data"]
        bid = [b for b in bid if b["attributes"]["identifier"] == ident]
        if not bid:
            sys.exit(f"нет App ID {ident}")
        old = call(tok, "GET", "/v1/profiles", {"filter[name]": name, "limit": 20})["data"]
        for o in old:  # профиль на другой сертификат или протухший — пересоздать
            call(tok, "DELETE", f"/v1/profiles/{o['id']}")
        prof = call(tok, "POST", "/v1/profiles", body={"data": {
            "type": "profiles",
            "attributes": {"name": name, "profileType": "TVOS_APP_STORE"},
            "relationships": {
                "bundleId": {"data": {"type": "bundleIds", "id": bid[0]["id"]}},
                "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]}}}})["data"]
        content = base64.b64decode(prof["attributes"]["profileContent"])
        uuid = prof["attributes"]["uuid"]
        for d in DIRS:
            os.makedirs(d, exist_ok=True)
            open(os.path.join(d, uuid + ".mobileprovision"), "wb").write(content)
        print(f"{ident}: «{name}» {uuid}, до {prof['attributes']['expirationDate'][:10]}")


if __name__ == "__main__":
    main()
