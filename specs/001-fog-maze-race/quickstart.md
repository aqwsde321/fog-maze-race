# Quickstart: Fog Maze Race MVP

## Goal

Get the first playable vertical slice running locally with the minimum amount of tooling
and infrastructure.

## Prerequisites

- Node.js 22 LTS
- `pnpm` workspace support
- Modern desktop browser

## Recommended Bootstrap

### 1. Create the workspace layout

```text
apps/server
apps/web
packages/shared
tests/e2e
```

### 2. Scaffold the web client

- Use Vite React TypeScript for `apps/web`.
- Keep React responsible for page layout, overlays, sidebar, and session/room flow.
- Keep the maze canvas inside a dedicated `GameCanvas` boundary.

### 3. Scaffold the server

- Create a TypeScript Node service in `apps/server`.
- Start with Fastify for HTTP bootstrapping and health checks.
- Mount Socket.IO on the same server instance.

### 4. Create the shared package first

Implement these shared modules before UI polish:

- room and match status enums
- event payload types
- snapshot shapes
- map definitions
- visibility helper types

## Suggested Dependency Split

### `apps/web`

- `react`
- `react-dom`
- `pixi.js`
- `socket.io-client`
- `zustand`

### `apps/server`

- `fastify`
- `socket.io`

### Workspace development tools

- `typescript`
- `vite`
- `vitest`
- `@testing-library/react`
- `playwright`
- `tsx`

## Recommended Local Commands

Once the workspace is scaffolded, keep the command surface small:

```bash
pnpm install
pnpm dev
pnpm test
pnpm test:e2e
pnpm build
pnpm start
```

Suggested behavior:

- `pnpm dev`: runs `apps/server` and `apps/web` concurrently
- `pnpm start`: runs the production server, which also serves the built frontend assets

## Fastest MVP Build Order

1. Implement shared contracts and map definitions.
2. Implement the authoritative room and match state engine on the server.
3. Add Socket.IO connection, room join/leave, countdown, and movement commands.
4. Add reconnect grace handling and full snapshot resync.
5. Build the React shell for nickname entry, room list, and sidebar.
6. Build the PixiJS renderer for map, fog, and player markers.
7. Add result screen and automatic reset to `waiting`.
8. Cover the main loop with Playwright multi-client tests.

## Local Validation Checklist

- Two browsers can connect to the same room.
- Host can start a match from the game screen.
- Both clients see synchronized countdown transitions.
- Movement is authoritative and walls block correctly.
- Fog rules hide off-vision maze players.
- Finishing reveals the whole map only to the finisher.
- Disconnect and reconnect within 30 seconds restores the player.
- Result screen returns the room to `waiting` after 6 seconds.

## Deployment Shape

- One Render Web Service
- Same-origin static asset delivery and Socket.IO transport
- One instance only for MVP
- Health check through `GET /health`

If active-match continuity across deploys or multi-instance scale becomes important, the
next step is shared session storage plus a multi-instance Socket.IO adapter.
