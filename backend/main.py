import asyncio
import json
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.collectors.system import collect_system_metrics
except ModuleNotFoundError:  # pragma: no cover - fallback for local run from backend directory
    from collectors.system import collect_system_metrics

app = FastAPI(title="Spaceship Station Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_clients: Set[WebSocket] = set()
current_metrics = {
    "cpu_percent": 0.0,
    "ram_percent": 0.0,
    "disk_percent": 0.0,
    "disk_used_gb": 0.0,
    "disk_free_gb": 0.0,
    "timestamp": 0,
}


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


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
        current_metrics = collect_system_metrics()
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
