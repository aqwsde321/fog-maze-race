# Implementation Plan: Fog Maze Race MVP

**Branch**: `001-fog-maze-race` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fog-maze-race/spec.md`

**Note**: This plan proposes a concrete MVP stack and implementation shape for a
server-authoritative real-time maze race.

## Summary

Build the MVP as a same-origin real-time web application with a thin React UI shell,
PixiJS-based maze renderer, and a Fastify + Socket.IO backend that owns all gameplay
state. The first shippable slice includes nickname persistence, room create/join,
waiting/countdown/playing/result transitions, authoritative movement, fog-of-war
rendering, finish ranking, reconnect recovery, and return to waiting state after results.
Non-MVP features remain deferred.

## Technical Context

**Language/Version**: TypeScript, Node.js 22 LTS  
**Primary Dependencies**: React 19 + Vite 7, PixiJS 8, Fastify 5, Socket.IO 4.x, Zustand, Vitest, Playwright  
**Storage**: In-memory room and match state on the server, JSON map definition files in the repo, localStorage for nickname and playerId  
**Testing**: Vitest + React Testing Library for UI and store logic, Fastify injection
tests for authoritative rules, Playwright multi-context browser tests for race flow and
reconnect recovery  
**Target Platform**: Modern desktop and mobile browsers, Linux Node.js web service  
**Project Type**: Real-time web application with separate frontend, backend, and shared contract packages  
**Architecture Style**: DDD-lite with explicit domain aggregates in `packages/shared` and
`apps/server/src/core`, application services in room and match services, and adapters in
Socket.IO handlers and React/PixiJS UI  
**Authority Model**: Server authoritative for room lifecycle, countdown, movement validation, finish ordering, and disconnect grace handling  
**Test Discipline**: TDD required; failing contract and Playwright scenarios are written
before implementation, and each story is only complete after the relevant test suites
pass  
**Sync Recovery**: Socket.IO reconnect handling plus explicit room snapshot resync and a 30-second disconnected grace window stored on the server  
**Performance Goals**: 60 FPS local render, 15 players per room, typical state propagation under 150 ms within one region, 1-2 minute matches  
**Constraints**: Single backend instance for MVP, no cross-instance state replication, client sends directions only, no chat/items/replay/customization, room joins only in `waiting` state  
**Scale/Scope**: Single-region public MVP, dozens of rooms on one instance, one active match per room, maximum 15 concurrent players per room

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The plan identifies a shippable MVP slice in User Story 1 and defers non-MVP work.
- [x] The server owns authoritative state, rule evaluation, and conflict resolution by
      default.
- [x] Client responsibilities are limited to rendering, input capture, and presentation
      unless a justified exception is documented.
- [x] Domain/sync state and presentation state are separated with clear module
      boundaries.
- [x] Domain rules are modeled in explicit domain/application layers before transport or UI
      adapters are implemented.
- [x] The plan identifies the failing automated tests and passing test commands required
      before implementation is considered complete.
- [x] Realtime features define both event propagation and snapshot-based recovery.

Post-design review: Pass. The design keeps gameplay rules on the server, treats client
state as a render projection, and uses full room snapshots as the recovery path when
delta delivery is insufficient.

## Project Structure

### Documentation (this feature)

```text
specs/001-fog-maze-race/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-endpoints.md
│   ├── realtime-events.md
│   └── snapshots.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── server/
│   ├── src/
│   │   ├── app/
│   │   ├── core/
│   │   ├── rooms/
│   │   ├── matches/
│   │   ├── maps/
│   │   ├── ws/
│   │   └── http/
│   └── tests/
├── web/
│   ├── src/
│   │   ├── app/
│   │   ├── game/
│   │   ├── features/session/
│   │   ├── features/rooms/
│   │   ├── stores/
│   │   ├── services/
│   │   └── views/
│   └── tests/
packages/
└── shared/
    └── src/
        ├── contracts/
        ├── domain/
        ├── maps/
        └── visibility/
tests/
└── e2e/
```

**Structure Decision**: Use a three-package workspace so authoritative domain logic lives
in `apps/server`, the render-focused client lives in `apps/web`, and shared event types,
map definitions, and visibility helpers live in `packages/shared`. This prevents gameplay
rules from leaking into the client while avoiding duplicated contracts.

## Complexity Tracking

No constitution violations identified. The only notable tradeoff is keeping runtime state
in memory on a single instance for MVP speed; horizontal scaling and shared session
storage are explicitly deferred.
