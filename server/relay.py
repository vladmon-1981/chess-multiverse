#!/usr/bin/env python3
"""ChessGM: ретранслятор сетевой партии (WebSocket).

Заменяет прямое соединение Game Center между телефонами: игра шлёт ходы сюда, сервер
только подбирает пару и пересылает JSON-сообщения. Правил шахмат и часов тут нет —
их считает сама игра (js/chess-app.js), сервер ничего не хранит на диске.

Клиент → сервер (текстовые кадры, JSON):
  {"t":"find","group":60,"name":"Имя","id":"<случайный id устройства>"}   подбор по времени на ход
  {"t":"room","name":"Имя","id":...}                                      создать комнату для друга
  {"t":"join","code":"ABCD","name":"Имя","id":...}                        войти по коду
  {"t":"cancel"}                                                          отменить поиск/комнату
  {"t":"data","msg":{...}}                                                сообщение сопернику
  {"t":"leave"}                                                           выйти из партии
Сервер → клиент:
  {"t":"room","code":"ABCD"}   {"t":"match","opponent":"Имя"}   {"t":"data","msg":{...}}
  {"t":"left"}   {"t":"cancelled"}   {"t":"error","text":"..."}

Запуск: relay.py [порт] (слушает 127.0.0.1, TLS даёт nginx).
"""
import asyncio
import json
import logging
import random
import sys
import time

import websockets

HOST = "127.0.0.1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
GROUPS = {30, 60, 120, 300}
MAX_FRAME = 4096            # байт: ходы по 100–200 байт, больше не нужно
MAX_CONN_PER_IP = 20
RATE_LIMIT = 30             # сообщений в секунду на соединение
QUEUE_TTL = 15 * 60         # сколько ждать соперника, секунд
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # без похожих O/0, I/1

log = logging.getLogger("relay")


class Client:
    __slots__ = ("ws", "ip", "name", "cid", "peer", "queued", "room", "stamp", "tokens", "tstamp")

    def __init__(self, ws, ip):
        self.ws, self.ip = ws, ip
        self.name, self.cid = "Игрок", ""
        self.peer = None
        self.queued = None        # группа, в очереди которой стоит клиент
        self.room = None          # код созданной комнаты
        self.stamp = time.monotonic()
        self.tokens, self.tstamp = RATE_LIMIT, time.monotonic()

    async def send(self, obj):
        try:
            await self.ws.send(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        except websockets.ConnectionClosed:
            pass


queues = {g: [] for g in GROUPS}     # группа -> клиенты в ожидании
rooms = {}                           # код -> клиент-хозяин
per_ip = {}                          # ip -> число соединений


def clean_name(v):
    s = str(v or "").strip()[:24]
    return s or "Игрок"


def unqueue(c):
    if c.queued is not None:
        q = queues.get(c.queued, [])
        if c in q:
            q.remove(c)
        c.queued = None
    if c.room:
        if rooms.get(c.room) is c:
            del rooms[c.room]
        c.room = None


async def pair(a, b):
    unqueue(a)
    unqueue(b)
    a.peer, b.peer = b, a
    await asyncio.gather(a.send({"t": "match", "opponent": b.name}),
                         b.send({"t": "match", "opponent": a.name}))
    log.info("match %s <-> %s", a.name, b.name)


async def drop_peer(c, notify=True):
    p = c.peer
    c.peer = None
    if p is not None and p.peer is c:
        p.peer = None
        if notify:
            await p.send({"t": "left"})


async def handle(c, m):
    t = m.get("t")
    if t in ("find", "room", "join"):
        await drop_peer(c)
        unqueue(c)
        c.name = clean_name(m.get("name"))
        c.cid = str(m.get("id") or "")[:64]
    if t == "find":
        g = m.get("group")
        if g not in GROUPS:
            await c.send({"t": "error", "text": "bad group"})
            return
        q = queues[g]
        now = time.monotonic()
        q[:] = [x for x in q if now - x.stamp < QUEUE_TTL and not x.ws.closed]
        other = next((x for x in q if x.cid != c.cid or not c.cid), None)
        if other:
            await pair(other, c)
        else:
            c.stamp = now
            c.queued = g
            q.append(c)
    elif t == "room":
        for _ in range(20):
            code = "".join(random.choice(CODE_ALPHABET) for _ in range(4))
            if code not in rooms:
                break
        else:
            await c.send({"t": "error", "text": "no codes"})
            return
        c.room = code
        c.stamp = time.monotonic()
        rooms[code] = c
        await c.send({"t": "room", "code": code})
    elif t == "join":
        code = str(m.get("code") or "").upper().strip()[:8]
        host = rooms.get(code)
        if host is None or host.ws.closed or host is c:
            await c.send({"t": "error", "text": "no room"})
            return
        await pair(host, c)
    elif t == "cancel":
        unqueue(c)
        await c.send({"t": "cancelled"})
    elif t == "data":
        if c.peer is not None and isinstance(m.get("msg"), dict):
            await c.peer.send({"t": "data", "msg": m["msg"]})
    elif t == "leave":
        unqueue(c)
        await drop_peer(c)


async def conn(ws):
    xff = ws.request_headers.get("X-Real-IP") or ws.request_headers.get("X-Forwarded-For", "")
    ip = (xff.split(",")[0].strip() if xff else "") or (ws.remote_address[0] if ws.remote_address else "?")
    if per_ip.get(ip, 0) >= MAX_CONN_PER_IP:
        await ws.close(1013, "busy")
        return
    per_ip[ip] = per_ip.get(ip, 0) + 1
    c = Client(ws, ip)
    try:
        async for raw in ws:
            if not isinstance(raw, str) or len(raw) > MAX_FRAME:
                await ws.close(1009, "frame")
                return
            now = time.monotonic()
            c.tokens = min(RATE_LIMIT, c.tokens + (now - c.tstamp) * RATE_LIMIT)
            c.tstamp = now
            if c.tokens < 1:
                continue
            c.tokens -= 1
            try:
                m = json.loads(raw)
            except ValueError:
                continue
            if isinstance(m, dict):
                await handle(c, m)
    except websockets.ConnectionClosed:
        pass
    finally:
        per_ip[ip] = max(0, per_ip.get(ip, 1) - 1)
        unqueue(c)
        await drop_peer(c)


async def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    async with websockets.serve(conn, HOST, PORT, max_size=MAX_FRAME, ping_interval=20, ping_timeout=20):
        log.info("relay on %s:%s", HOST, PORT)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
