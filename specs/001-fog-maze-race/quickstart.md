# Quickstart: Fog Maze Race MVP

## Goal

Run the playable MVP locally, validate the three user stories, and start the same-origin
production server that serves both the web client and Socket.IO backend.

## Prerequisites

- Node.js 22 LTS
- `pnpm` 10+
- Modern desktop browser

## Workspace Layout

```text
apps/server
apps/web
packages/shared
tests/e2e
```

## Tech Stack

- `apps/web`: React 19, Vite 7, PixiJS 8, Zustand
- `apps/server`: Fastify 5, Socket.IO 4.x
- `packages/shared`: shared contracts, map definitions, visibility rules
- Tests: Vitest, Playwright

## Local Development

Install dependencies and run the web client plus authoritative server together:

```bash
pnpm install
pnpm dev
```

- Web client: `http://127.0.0.1:4173`
- Server health check: `http://127.0.0.1:3000/health`

## Core Validation

Run the required static and automated checks:

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

Key browser flows covered in `tests/e2e`:

- `us1-race-flow.spec.ts`: room create/join, countdown, movement, finish, waiting reset
- `us2-reconnect.spec.ts`: disconnect grace, reconnect restore, timeout leave
- `us3-room-admin.spec.ts`: room rename, host reassignment, force-end, waiting reset
- `perf-smoke.spec.ts`: 15-player join and start smoke check

## Production Build

Build all workspaces, then run the production server:

```bash
pnpm build
pnpm start
```

Production behavior:

- `apps/web/dist` is served by `apps/server`
- Socket.IO uses the same origin as the page
- Health check remains available at `GET /health`

## Manual MVP Checklist

- Two or more players can create and join a waiting room.
- Only the host can start, rename, or force-end a room.
- Server-authoritative movement blocks walls and broadcasts positions.
- Fog of war hides off-vision maze players until the finisher reveal.
- Disconnect within the grace window restores the player state and position.
- Leaving or timing out excludes the player from completion logic.
- Results show finish order or `나감`, then the room returns to `waiting`.

## Deployment Shape

- One Render Web Service
- Same-origin static asset delivery and Socket.IO transport
- Single instance only for MVP
- In-memory runtime state with client-side localStorage for nickname/player identity

If persistent rooms, zero-downtime recovery, or multi-instance scale becomes necessary,
add external session/state storage and a multi-instance Socket.IO adapter.
