#!/usr/bin/env python3
"""ASO-материалы ChessGM в черновик версии App Store Connect (15.11.2026). НЕ ЗАПУСКАЛСЯ.

  python3 ios/ChessMultiverse3D/scripts/asc_push_aso.py 1.1.1 [texts] [info] [shots] [ipadshots] [preview]   # без шагов — все

Создаёт версию iOS (если нет), НЕ привязывает сборку и НЕ отправляет на проверку (сборку привязать и отправить вручную).
  texts       — описание, ключи, промо, «что нового», ссылка поддержки для ВСЕХ папок AppStore/metadata/* кроме kk
  info        — название, подзаголовок, политика (appInfoLocalizations) в редактируемой карточке приложения
                (появляется после создания версии; 1.1 в продаже — её карточка READY_FOR_DISTRIBUTION и не правится)
  shots       — 6 кадров с подписями (AppStore/screenshots/framed) в набор iPhone 6.9" (APP_IPHONE_67), все языки версии
  ipadshots   — 6 кадров iPad 13" (screenshots/framed-ipad) в набор APP_IPAD_PRO_3GEN_129
  preview     — видеопревью IPHONE_67 из build/previews/preview_{ru,en}.mp4 (29,5 с, 886x1920, реальная запись, без звука)
                ТОЛЬКО для языков, где в наборе ещё нет превью (ru — preview_ru, остальные — preview_en)
Языки без своих файлов берут чужой набор (aso_titles.ASSETS: en-GB -> en-US, es-MX -> es-ES).
Ограничить языки: ASO_LOCALES=de-DE,fr-FR python3 ... 1.1.1 shots
Наборы скриншотов заменяются своими (старые удаляются). Ключ API живёт 20 минут — при долгом запуске перезапустить.
Состояние версии 1.1 при написании: READY_FOR_SALE; новая версия создаётся с releaseType MANUAL.
"""
import hashlib, os, sys, time, urllib.request
sys.path.insert(0, os.path.expanduser("~/Projects/IronNotes-iOS/scripts"))
import asc_profiles as a

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AS = os.path.join(ROOT, "AppStore")
sys.path.insert(0, AS)
from aso_titles import ASSETS  # noqa: E402
PREV = os.path.join(ROOT, "build", "previews")
SHOTS = ["01-menu", "02-cars", "03-hockey", "04-hospital", "05-classic", "06-honor"]
FIELDS = {"description": "description.txt", "keywords": "keywords.txt", "promotionalText": "promotional_text.txt",
          "whatsNew": "release_notes.txt", "supportUrl": "support_url.txt"}
SKIP = {"kk"}

_call = a.call
def call(*args, **kw):
    for i in range(5):  # Connect иногда молчит дольше минуты
        try:
            return _call(*args, **kw)
        except (TimeoutError, OSError) as e:
            print("  повтор после:", type(e).__name__); time.sleep(5)
    return _call(*args, **kw)


def rd(p): return open(p, encoding="utf-8").read().strip()


def attempt(label, fn):
    try:
        return fn()
    except Exception as e:  # noqa: BLE001 — печатаем причину и идём дальше
        print("  НЕ УДАЛОСЬ", label, "—", str(e)[:300].replace("\n", " "))


def put_asset(tok, kind, set_id, path):
    data = open(path, "rb").read(); name = os.path.basename(path)
    rel = "appScreenshotSet" if kind == "appScreenshots" else "appPreviewSet"
    attrs = {"fileName": name, "fileSize": len(data)}
    if kind == "appPreviews": attrs["mimeType"] = "video/mp4"
    r = call(tok, "POST", f"/v1/{kind}", body={"data": {"type": kind, "attributes": attrs,
        "relationships": {rel: {"data": {"type": rel + "s", "id": set_id}}}}})["data"]
    for op in r["attributes"]["uploadOperations"]:
        req = urllib.request.Request(op["url"], data=data[op["offset"]:op["offset"] + op["length"]], method=op["method"],
                                     headers={h["name"]: h["value"] for h in op["requestHeaders"]})
        for i in range(6):
            try: urllib.request.urlopen(req, timeout=300).read(); break
            except Exception as e:
                print("  повтор загрузки:", type(e).__name__); time.sleep(5)
                if i == 5: raise
    call(tok, "PATCH", f"/v1/{kind}/{r['id']}", body={"data": {"type": kind, "id": r["id"], "attributes": {
        "uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})
    print("  загружено", name)


def get_set(tok, lid, coll, typ_key, typ):
    sets = call(tok, "GET", f"/v1/appStoreVersionLocalizations/{lid}/{coll}")["data"]
    s = next((x for x in sets if x["attributes"][typ_key] == typ), None)
    if s is None:
        t = "appScreenshotSets" if coll == "appScreenshotSets" else "appPreviewSets"
        s = call(tok, "POST", f"/v1/{t}", body={"data": {"type": t, "attributes": {typ_key: typ},
            "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": lid}}}}})["data"]
    return s


def main():
    ver, steps = sys.argv[1], sys.argv[2:] or ["texts", "info", "shots", "ipadshots", "preview"]
    env = a.load_env(); APP = env["ASC_APP_ID"]
    tok = a.token(env)
    vs = call(tok, "GET", f"/v1/apps/{APP}/appStoreVersions", {"filter[platform]": "IOS", "filter[versionString]": ver})["data"]
    if vs:
        vid = vs[0]["id"]; state = vs[0]["attributes"]["appStoreState"]; print("версия есть:", ver, state)
        if state not in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"):
            sys.exit(f"версия {ver} в состоянии {state} — править нельзя")
    else:
        vid = call(tok, "POST", "/v1/appStoreVersions", body={"data": {"type": "appStoreVersions", "attributes": {
            "platform": "IOS", "versionString": ver, "releaseType": "MANUAL"},
            "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})["data"]["id"]
        print("версия создана:", ver)
    dirs = sorted(d for d in os.listdir(os.path.join(AS, "metadata"))
                  if os.path.isdir(os.path.join(AS, "metadata", d)) and d not in SKIP)
    locs = {l["attributes"]["locale"]: l["id"] for l in call(tok, "GET", f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations", {"limit": 50})["data"]}

    if "texts" in steps:
        for loc in dirs:
            attrs = {k: rd(os.path.join(AS, "metadata", loc, f)) for k, f in FIELDS.items()
                     if os.path.exists(os.path.join(AS, "metadata", loc, f))}
            def go(loc=loc, attrs=attrs):
                if loc not in locs:
                    locs[loc] = call(tok, "POST", "/v1/appStoreVersionLocalizations", body={"data": {
                        "type": "appStoreVersionLocalizations", "attributes": dict(attrs, locale=loc),
                        "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})["data"]["id"]
                else:
                    call(tok, "PATCH", f"/v1/appStoreVersionLocalizations/{locs[loc]}", body={"data": {
                        "type": "appStoreVersionLocalizations", "id": locs[loc], "attributes": attrs}})
                print(loc, "тексты")
            attempt(f"тексты {loc}", go)

    if "info" in steps:
        infos = call(tok, "GET", f"/v1/apps/{APP}/appInfos")["data"]
        edit = [i for i in infos if i["attributes"].get("state") != "READY_FOR_DISTRIBUTION"]
        if not edit:
            print("  нет редактируемой карточки приложения (appInfo) — название/подзаголовок вносить вручную")
        for info in edit[:1]:
            print("карточка приложения:", info["attributes"].get("state"))
            have = {l["attributes"]["locale"]: l["id"] for l in call(tok, "GET", f"/v1/appInfos/{info['id']}/appInfoLocalizations", {"limit": 50})["data"]}
            for loc in dirs:
                d = os.path.join(AS, "metadata", loc)
                attrs = {"name": rd(os.path.join(d, "name.txt")), "subtitle": rd(os.path.join(d, "subtitle.txt"))}
                if os.path.exists(os.path.join(d, "privacy_url.txt")):
                    attrs["privacyPolicyUrl"] = rd(os.path.join(d, "privacy_url.txt"))
                def go(loc=loc, attrs=attrs):
                    if loc in have:
                        call(tok, "PATCH", f"/v1/appInfoLocalizations/{have[loc]}", body={"data": {
                            "type": "appInfoLocalizations", "id": have[loc], "attributes": attrs}})
                    else:
                        call(tok, "POST", "/v1/appInfoLocalizations", body={"data": {
                            "type": "appInfoLocalizations", "attributes": dict(attrs, locale=loc),
                            "relationships": {"appInfo": {"data": {"type": "appInfos", "id": info["id"]}}}}})
                    print(loc, "название и подзаголовок")
                attempt(f"название/подзаголовок {loc}", go)

    only = [x for x in os.environ.get("ASO_LOCALES", "").split(",") if x]
    for loc in sorted(locs):
        if (only and loc not in only) or loc in SKIP:
            continue
        lid, src = locs[loc], ASSETS.get(loc, loc)
        for step, folder, dtype in (("shots", "framed", "APP_IPHONE_67"), ("ipadshots", "framed-ipad", "APP_IPAD_PRO_3GEN_129")):
            if step in steps:
                def shots(loc=loc, lid=lid, src=src, folder=folder, dtype=dtype):
                    s = get_set(tok, lid, "appScreenshotSets", "screenshotDisplayType", dtype)
                    for old in call(tok, "GET", f"/v1/appScreenshotSets/{s['id']}/appScreenshots")["data"]:
                        call(tok, "DELETE", f"/v1/appScreenshots/{old['id']}")
                    for n in SHOTS:
                        put_asset(tok, "appScreenshots", s["id"], os.path.join(AS, "screenshots", folder, src, n + ".png"))
                    print(loc, "скриншоты", dtype)
                attempt(f"{step} {loc}", shots)
        if "preview" in steps:
            def prev(loc=loc, lid=lid):
                s = get_set(tok, lid, "appPreviewSets", "previewType", "IPHONE_67")
                if call(tok, "GET", f"/v1/appPreviewSets/{s['id']}/appPreviews")["data"]:
                    print(loc, "превью уже есть — не трогаю"); return
                put_asset(tok, "appPreviews", s["id"], os.path.join(PREV, "preview_ru.mp4" if loc == "ru" else "preview_en.mp4"))
                print(loc, "видеопревью")
            attempt(f"превью {loc}", prev)
    print("готово; сборка не привязана, на проверку не отправлено")


if __name__ == "__main__":
    main()
