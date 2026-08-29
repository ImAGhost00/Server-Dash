import asyncio
import json
import os
import time
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.collectors.system import collect_media_pool_breakdown, collect_system_metrics
except ModuleNotFoundError:  # pragma: no cover - fallback for local run from backend directory
    from collectors.system import collect_media_pool_breakdown, collect_system_metrics

app = FastAPI(title="Spaceship Station Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIA_POOL_PATH = os.environ.get("MEDIA_POOL_PATH", "/mnt/mediapool")
MEDIA_BREAKDOWN_CACHE_SECONDS = 300

connected_clients: Set[WebSocket] = set()
current_metrics = {
    "cpu_percent": 0.0,
    "ram_percent": 0.0,
    "disk_percent": 0.0,
    "disk_used_gb": 0.0,
    "disk_total_gb": 0.0,
    "disk_free_gb": 0.0,
    "media_percent": 0.0,
    "media_used_gb": 0.0,
    "media_total_gb": 0.0,
    "media_free_gb": 0.0,
    "media_available": False,
    "timestamp": 0,
}
_media_breakdown_cache = {"data": None, "expires_at": 0.0}


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


@app.get("/mediapool/breakdown")
async def media_pool_breakdown() -> dict:
    now = time.time()
    if _media_breakdown_cache["data"] is not None and now < _media_breakdown_cache["expires_at"]:
        return _media_breakdown_cache["data"]

    breakdown = collect_media_pool_breakdown(MEDIA_POOL_PATH)
    _media_breakdown_cache["data"] = breakdown
    _media_breakdown_cache["expires_at"] = now + MEDIA_BREAKDOWN_CACHE_SECONDS
    return breakdown


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.discard(websocket)


async def broadcast_metrics_loop() -> None:
    global current_metrics

    while True:
        current_metrics = collect_system_metrics(MEDIA_POOL_PATH)
        payload = json.dumps({"type": "metrics", "data": current_metrics})
        stale_clients = []

        for client in list(connected_clients):
            try:
                await client.send_text(payload)
            except Exception:
                stale_clients.append(client)

        for stale in stale_clients:
            connected_clients.discard(stale)

        await asyncio.sleep(2)


@app.on_event("startup")
async def startup_event() -> None:
    asyncio.create_task(broadcast_metrics_loop())
