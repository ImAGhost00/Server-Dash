# Ghost Dash

Milestone 1: a hardware stats monitor backend.

## What it does

- Starts a Node.js Express server
- Attaches Socket.io for websocket updates
- Reads current CPU load and RAM usage with `systeminformation`
- Emits hardware stats every 2 seconds
- Reads disk usage from the host mount at `/hostfs` for future Storage-room work

## Run

```bash
npm install
npm start
```

The app is currently being tested at `http://192.168.69.1:3030`.

## Project layout

- `src/server.js` owns the HTTP server and Socket.io wiring
- `src/services/systemStats.js` fetches hardware stats
- `src/services/systemStats.js` also exposes host disk reads from `/hostfs`
- `src/realtime/hardwareStream.js` emits stats on an interval
- `src/client/phaser/serverRoomScene.js` draws the Phaser grid background
- `src/client/components/HudOverlay.jsx` renders the live React HUD
- `src/client/hooks/useHardwareStats.js` subscribes to Socket.io telemetry
- `src/modules/storage/` is reserved for the future Storage module
- `src/modules/qbittorrent/` is reserved for the future qBittorrent module