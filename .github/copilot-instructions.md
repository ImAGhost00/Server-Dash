# Spaceship Station project guidance

This repository is a slim Docker-first prototype for a real-time server monitoring dashboard styled as a sci-fi cutaway spaceship station.

## Goals
- Keep the first phase intentionally small and focused on a single Engine Room module.
- Prefer simple modular Python and frontend code over premature abstraction.
- Build a clean Docker Compose setup so the stack can be launched with a single command.

## Backend
- Use FastAPI with a WebSocket endpoint on `/ws` for real-time updates.
- Collect host metrics with `psutil` and broadcast them every 2 seconds.

## Frontend
- Use a static HTML shell with Tailwind for layout and Phaser 3 for rendering.
- Keep the ship hull scene reusable with room registry definitions for future modules.
- Use terminal-green UI accents and a dark metallic station palette.

## Deployment
- The app should run via `docker compose up --build` from this repository root.
- Frontend is served by Nginx, and WebSocket traffic is proxied to the backend service.
