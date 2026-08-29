# Spaceship Station

A Docker-ready Phase 1 prototype for a real-time homelab server monitoring dashboard styled as a 2D cutaway spaceship station.

## Stack
- Backend: FastAPI + WebSocket telemetry
- Frontend: static HTML + Tailwind CDN + Phaser 3
- Proxy: Nginx
- Orchestration: Docker Compose

## Run locally
```bash
docker compose up --build
```

Then visit:
- http://localhost
- http://localhost:8000/health

## Included features
- Ship hull visualization and engine room cutaway
- CPU, RAM, and disk telemetry from host metrics
- Animated engine pulse tied to live CPU load
- Warning tint for CPU over 80%
- Room registry pattern for future modules like qbittorrent, jellyfin, sonarr, radarr, and seerr
