# RELIGION Game Server

Standalone Colyseus WebSocket server for real-time spiritual spaces.

## Local development

```bash
cd apps/game-server
cp .env.example .env
npm install
npm run dev
```

Health check: `http://localhost:2567/health`

## Build

```bash
npm install
npm run build
npm start
```

## Room matchmaking

Connect to room type `spiritual-space` with one of these options:

- `{ "space": "chapel", "displayName": "..." }` — maximum 32 visitors per instance.
- `{ "space": "garden", "displayName": "..." }` — maximum 40 visitors per instance.

The room filter separates chapel and garden instances. Colyseus matchmaking reuses an
available room and creates another room when existing rooms reach their capacity.

Chapel visitors receive a reserved seat number from 1 to 32. The seat is released on
disconnect. The room server is authoritative for movement bounds, avatar spacing,
prayer-state protection, and nearby greetings.

## Messages

Client → server:

- `move`: `{ x, z, yaw }`
- `prayer:set`: `{ praying: boolean }`
- `greeting`: `{ targetId }`
- `visitors:request`: request current room snapshot

Server → client:

- `room:joined`: room, capacity, occupancy, assigned seat and local visitor
- `visitors:update`: current visitors and room occupancy
- `prayer:accepted` / `prayer:rejected`
- `greeting:received` / `greeting:rejected`

## Deployment

Deploy this directory as a separate Node/Docker service (Railway, Fly.io, or another
persistent WebSocket host). Set `PORT` and `ALLOWED_ORIGINS`. Do not deploy this
long-lived WebSocket process as a Vercel serverless function.

The current capacity values are policy defaults. The room process enforces its own
per-room capacity; production multi-process deployment should add a shared presence/
matchmaking driver and metrics before operating at scale.
