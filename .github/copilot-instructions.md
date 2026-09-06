# Project Overview
Ghost Dash starts with a hardware stats monitor backend. The first milestone is a Node.js service that streams CPU and RAM data over Socket.io, with modular room for Storage and qBittorrent modules later.

# Tech Stack
- Backend API: Node.js, Express, Socket.io
- System metrics: systeminformation

# Architecture Rules
- Keep system metric collection isolated from transport code.
- The Socket.io layer should only broadcast normalized stats objects.
- Add future modules behind dedicated folders so Storage and qBittorrent can be wired in without reshaping the server entrypoint.
- Build iteratively: establish the hardware monitor first, then add storage stats, then qBittorrent integration.