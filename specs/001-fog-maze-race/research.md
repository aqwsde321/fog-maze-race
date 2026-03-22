# Phase 0 Research: Fog Maze Race MVP

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-22

## Decision 1: Frontend shell uses React 19 + Vite 7 + TypeScript

**Decision**: Build the browser client as a React application scaffolded with Vite and
written in TypeScript.

**Rationale**: React is a good fit for the non-canvas parts of the product such as
nickname entry, room list, player list, status banners, and result overlays. Vite is the
fastest low-friction way to scaffold and iterate on that UI, and its current guide
supports React templates and monorepo-friendly project roots.

**Alternatives considered**:
- Next.js: more framework than needed because the MVP is a same-origin real-time app, not
  an SEO-heavy site.
- Plain TypeScript DOM rendering: lighter, but slower to iterate on room flow and overlay
  UI.

## Decision 2: Game rendering uses PixiJS 8, not a full game engine

**Decision**: Render the maze, fog, and player markers with PixiJS 8 inside a dedicated
`GameCanvas` module, while React remains responsible for layout and UI chrome.

**Rationale**: PixiJS is explicitly positioned as a rendering engine, which matches this
architecture well because gameplay rules stay on the server. Its render loop and retained
scene graph give enough control for a 2D grid game without introducing physics, scene
management, or client-side game-rule ownership.

**Alternatives considered**:
- Raw Canvas 2D: possible, but scene composition, asset handling, and redraw management
  would become custom work immediately.
- Phaser: strong for client-side game logic, but over-scoped for a server-authoritative
  grid race with simple 2D rendering needs.

## Decision 3: Backend runtime uses Fastify 5 on Node.js 22 LTS

**Decision**: Use Fastify as the HTTP server and application shell for the backend.

**Rationale**: Fastify provides lightweight plugin structure, schema-friendly route
handling, and built-in logging that fits an MVP web service. It also works well when one
process needs to expose both health endpoints and a WebSocket upgrade path.

**Alternatives considered**:
- Express: simpler mindshare, but weaker structure for plugins, validation, and logging.
- NestJS: powerful, but adds framework overhead that does not help the MVP ship faster.

## Decision 4: Realtime transport uses Socket.IO rooms plus snapshot recovery

**Decision**: Use Socket.IO 4.x on the same HTTP server and model each game room as a
Socket.IO room. Enable connection state recovery, but still treat full room snapshots as
the authoritative fallback.

**Rationale**: Socket.IO provides room broadcasts, reconnection behavior, and connection
state recovery. Its docs also make clear that clients can disconnect temporarily and miss
events, and that recovery is not always successful. That matches the constitution: deltas
are used for responsiveness, but the system always needs a full snapshot path to recover.

**Alternatives considered**:
- Raw `ws`: lower-level and flexible, but more custom work for room fan-out, recovery, and
  developer ergonomics.
- Colyseus: more batteries included, but it pushes more game-framework opinions than this
  MVP needs.

## Decision 5: Client state uses split Zustand stores

**Decision**: Use two focused Zustand stores.

- `sessionStore`: persisted nickname, playerId, connection status, and shallow client
  preferences.
- `roomStore`: current room snapshot, match snapshot, revision number, and derived
  selectors used by React and PixiJS.

**Rationale**: Zustand is small, fast, and easy to split with the slices pattern. It also
supports localStorage persistence for nickname and player identity without bringing in a
larger global state framework. This keeps client state render-focused and avoids moving
authoritative transitions into the browser.

**Alternatives considered**:
- Redux Toolkit: strong ecosystem, but too much ceremony for a thin-client MVP.
- React Context only: fine for a few flags, but awkward once room snapshots and reconnect
  metadata grow.

## Decision 6: MVP storage stays in memory

**Decision**: Keep active room, player, match, and disconnect-grace state in server
memory. Store map definitions as versioned JSON or TypeScript constants in the shared
package. Use browser localStorage only for nickname and playerId.

**Rationale**: The MVP does not require accounts, history, analytics-grade retention, or
cross-match persistence. In-memory state is the fastest way to ship a playable
server-authoritative version. This also keeps the first implementation centered on game
flow instead of schema design and data migrations.

**Alternatives considered**:
- PostgreSQL: useful when persistence matters, but unnecessary for ephemeral rooms.
- Redis or Render Key Value from day one: helpful for cross-instance recovery, but adds
  infrastructure before the MVP proves itself.

## Decision 7: Deploy as one Render Web Service

**Decision**: Deploy the initial MVP as a single Render Web Service that serves the built
frontend and hosts Fastify + Socket.IO on the same origin.

**Rationale**: This minimizes operational surface area, removes CORS and cross-origin
cookie concerns, and makes WebSocket URLs trivial because the browser connects back to the
same origin. Render supports public WebSocket connections on web services, and one service
is enough for the first playable release.

**Alternatives considered**:
- Render Static Site + separate Web Service: better static asset separation, but adds
  deployment complexity and cross-origin setup earlier than needed.
- Fly.io multi-region service: more control, but more operational decisions than the MVP
  needs.

**Scaling note**: Render documents that reconnecting clients are not guaranteed to land on
the same instance, and that instances are replaced during deploys and maintenance. For
that reason, this plan intentionally keeps the MVP at one instance with no horizontal
scaling. If scale-out becomes necessary, shared session storage and a multi-instance
Socket.IO adapter become a follow-up milestone.

## Decision 8: Testing uses Vitest and Playwright

**Decision**: Use Vitest for unit and integration tests, and Playwright for end-to-end
multi-client flows.

**Rationale**: Vitest fits the Vite/TypeScript stack cleanly and keeps feedback fast.
Playwright is the most direct way to validate the risky flows in this product: two or more
clients joining the same room, synchronized countdown, racing, reconnect recovery, and
result reset.

**Alternatives considered**:
- Jest: workable, but less aligned with a modern Vite-first stack.
- Cypress: fine for single-user browser flows, but less attractive for multi-context
  realtime race testing.

## Recommended Stack Summary

- **Frontend**: React 19 + Vite 7 + TypeScript
- **Game rendering**: PixiJS 8 with a dedicated imperative scene controller
- **Backend**: Fastify 5 + Socket.IO 4.x on Node.js 22 LTS
- **State management**: Zustand split into persisted session state and ephemeral room/game
  state
- **Storage**: In-memory runtime state + shared map files + localStorage for identity
- **Deployment**: Single Render Web Service, one instance, same-origin frontend and
  realtime backend

## References

- [Vite Getting Started](https://vite.dev/guide/)
- [PixiJS Quick Start](https://pixijs.com/8.x/guides/getting-started/quick-start)
- [PixiJS Render Loop](https://pixijs.com/8.x/guides/concepts/render-loop)
- [PixiJS Ecosystem](https://pixijs.com/8.x/guides/getting-started/ecosystem)
- [Fastify Getting Started](https://fastify.dev/docs/latest/Guides/Getting-Started/)
- [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/)
- [Socket.IO Handling Disconnections](https://socket.io/docs/v4/tutorial/handling-disconnections)
- [Socket.IO Rooms](https://socket.io/docs/v4/rooms)
- [Socket.IO Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery)
- [Zustand Introduction](https://zustand.docs.pmnd.rs/getting-started/introduction)
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- [Render WebSockets](https://render.com/docs/websocket)
