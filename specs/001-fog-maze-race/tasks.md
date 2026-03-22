---

description: "Task list for Fog Maze Race MVP implementation"
---

# Tasks: Fog Maze Race MVP

**Input**: Design documents from `/specs/001-fog-maze-race/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD is required for this feature. Every user story starts with failing contract and end-to-end tests before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Workspace root**: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- **Backend**: `apps/server/src/`, `apps/server/tests/`
- **Frontend**: `apps/web/src/`, `apps/web/tests/`
- **Shared contracts/domain**: `packages/shared/src/`
- **End-to-end**: `tests/e2e/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the monorepo and create the minimum developer tooling for fast MVP iteration.

- [x] T001 Create root workspace manifests in `/Users/jino/study/project/fog-maze-race/package.json`, `/Users/jino/study/project/fog-maze-race/pnpm-workspace.yaml`, and `/Users/jino/study/project/fog-maze-race/tsconfig.base.json`
- [x] T002 [P] Scaffold the backend package in `/Users/jino/study/project/fog-maze-race/apps/server/package.json`, `/Users/jino/study/project/fog-maze-race/apps/server/tsconfig.json`, and `/Users/jino/study/project/fog-maze-race/apps/server/src/app/server.ts`
- [x] T003 [P] Scaffold the web package in `/Users/jino/study/project/fog-maze-race/apps/web/package.json`, `/Users/jino/study/project/fog-maze-race/apps/web/tsconfig.json`, and `/Users/jino/study/project/fog-maze-race/apps/web/src/app/App.tsx`
- [x] T004 [P] Configure shared test tooling in `/Users/jino/study/project/fog-maze-race/vitest.workspace.ts`, `/Users/jino/study/project/fog-maze-race/playwright.config.ts`, and `/Users/jino/study/project/fog-maze-race/tests/e2e/helpers/multi-client.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish domain boundaries, shared contracts, and realtime infrastructure that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Define shared domain enums and value objects in `/Users/jino/study/project/fog-maze-race/packages/shared/src/domain/status.ts`, `/Users/jino/study/project/fog-maze-race/packages/shared/src/domain/grid-position.ts`, and `/Users/jino/study/project/fog-maze-race/packages/shared/src/domain/result-entry.ts`
- [x] T006 [P] Define realtime event and snapshot contracts in `/Users/jino/study/project/fog-maze-race/packages/shared/src/contracts/realtime.ts` and `/Users/jino/study/project/fog-maze-race/packages/shared/src/contracts/snapshots.ts`
- [x] T007 [P] Add prebuilt map definitions and visibility helpers in `/Users/jino/study/project/fog-maze-race/packages/shared/src/maps/map-definitions.ts` and `/Users/jino/study/project/fog-maze-race/packages/shared/src/visibility/apply-visibility.ts`
- [x] T008 Implement authoritative room and match aggregates in `/Users/jino/study/project/fog-maze-race/apps/server/src/core/room.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/core/match.ts`, and `/Users/jino/study/project/fog-maze-race/apps/server/src/core/player-session.ts`
- [x] T009 Implement the Socket.IO gateway skeleton, revision tracker, and disconnect timer infrastructure in `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/race-gateway.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/revision-sync.ts`, and `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/disconnect-grace.ts`
- [x] T010 Implement render-only client state boundaries in `/Users/jino/study/project/fog-maze-race/apps/web/src/stores/sessionStore.ts`, `/Users/jino/study/project/fog-maze-race/apps/web/src/stores/roomStore.ts`, and `/Users/jino/study/project/fog-maze-race/apps/web/src/services/socket-client.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in priority order

---

## Phase 3: User Story 1 - 방에 들어가 레이스를 완주한다 (Priority: P1) 🎯 MVP

**Goal**: Players can enter a nickname, create or join a waiting room, start a race, move through the maze under fog-of-war, finish, and see results before the room resets to waiting.

**Independent Test**: Two browsers enter the same waiting room, the host starts the match, both clients see synchronized countdown and movement, one player finishes first, results display for 6 seconds, and the room returns to `waiting`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Write failing Socket.IO contract tests for connect, create room, join room, start game, move, and results in `/Users/jino/study/project/fog-maze-race/apps/server/tests/contracts/us1-race-flow.contract.test.ts`
- [x] T012 [P] [US1] Write failing multi-browser race flow test in `/Users/jino/study/project/fog-maze-race/tests/e2e/us1-race-flow.spec.ts`

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement session connect, room create, and room join application services in `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/room-service.ts` and `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/session-handlers.ts`
- [x] T014 [US1] Implement countdown, movement validation, finish ordering, and automatic end conditions in `/Users/jino/study/project/fog-maze-race/apps/server/src/matches/match-service.ts`
- [x] T015 [US1] Implement authoritative snapshot and delta broadcasts in `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/match-handlers.ts` and `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/revision-sync.ts`
- [x] T016 [P] [US1] Implement nickname gate and room list screen in `/Users/jino/study/project/fog-maze-race/apps/web/src/features/session/NicknameGate.tsx` and `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/RoomListPanel.tsx`
- [x] T017 [P] [US1] Implement the single game screen shell and sidebar in `/Users/jino/study/project/fog-maze-race/apps/web/src/views/GameScreen.tsx` and `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/PlayerSidebar.tsx`
- [x] T018 [US1] Implement PixiJS maze, fog, and player rendering in `/Users/jino/study/project/fog-maze-race/apps/web/src/game/GameCanvas.tsx`, `/Users/jino/study/project/fog-maze-race/apps/web/src/game/pixi/scene-controller.ts`, and `/Users/jino/study/project/fog-maze-race/apps/web/src/game/pixi/renderers/fog-renderer.ts`
- [x] T019 [US1] Implement result overlay, 6-second reset flow, and make US1 tests pass in `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/ResultOverlay.tsx` and `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/reset-room.ts`

**Checkpoint**: User Story 1 delivers the first playable MVP and can be demoed on its own

---

## Phase 4: User Story 2 - 연결이 끊겨도 경기 상태를 복구한다 (Priority: P2)

**Goal**: A temporarily disconnected player can reconnect within 30 seconds and recover room and match state without manual intervention.

**Independent Test**: During an active match, disconnect one browser, reconnect it within 30 seconds and verify position/state restoration; repeat with reconnect after 30 seconds and verify the player is marked as left and excluded from completion logic.

### Tests for User Story 2 ⚠️

- [x] T020 [P] [US2] Write failing recovery and timeout contract tests in `/Users/jino/study/project/fog-maze-race/apps/server/tests/contracts/us2-recovery.contract.test.ts`
- [x] T021 [P] [US2] Write failing reconnect recovery browser test in `/Users/jino/study/project/fog-maze-race/tests/e2e/us2-reconnect.spec.ts`

### Implementation for User Story 2

- [x] T022 [US2] Implement disconnect grace tracking, reconnect eligibility, and timeout removal in `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/recovery-service.ts` and `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/disconnect-grace.ts`
- [x] T023 [US2] Implement reconnect snapshot resync and revision gap handling in `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/recovery-handlers.ts` and `/Users/jino/study/project/fog-maze-race/apps/web/src/stores/roomStore.ts`
- [x] T024 [US2] Implement disconnect banners, reconnect UX, and make US2 tests pass in `/Users/jino/study/project/fog-maze-race/apps/web/src/features/session/ConnectionBanner.tsx` and `/Users/jino/study/project/fog-maze-race/apps/web/src/services/socket-client.ts`

**Checkpoint**: User Stories 1 and 2 both work independently, and recovery no longer depends on page refresh or manual admin action

---

## Phase 5: User Story 3 - 방을 관리하고 다음 판을 이어서 진행한다 (Priority: P3)

**Goal**: Players can browse rooms, hosts can rename or force-end rooms, and host authority is transferred automatically when the current host leaves.

**Independent Test**: Create multiple rooms, verify room list updates, rename a room, have the host leave to trigger reassignment, then force-end a match and confirm results plus return to waiting.

### Tests for User Story 3 ⚠️

- [ ] T025 [P] [US3] Write failing room administration contract tests in `/Users/jino/study/project/fog-maze-race/apps/server/tests/contracts/us3-room-admin.contract.test.ts`
- [ ] T026 [P] [US3] Write failing room administration browser flow test in `/Users/jino/study/project/fog-maze-race/tests/e2e/us3-room-admin.spec.ts`

### Implementation for User Story 3

- [ ] T027 [US3] Implement room list projection updates, room rename, and force-end commands in `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/room-service.ts` and `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/admin-handlers.ts`
- [ ] T028 [US3] Implement host reassignment and forced result generation in `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/reassign-host.ts` and `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/force-end-match.ts`
- [ ] T029 [US3] Implement room list refresh, rename controls, and host-only actions in `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/RoomListPanel.tsx` and `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/HostControls.tsx`
- [ ] T030 [US3] Implement forced-end result rendering and make US3 tests pass in `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/ResultOverlay.tsx` and `/Users/jino/study/project/fog-maze-race/apps/web/src/views/GameScreen.tsx`

**Checkpoint**: All user stories are independently functional and support repeat play in the same room lifecycle

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close the loop on deployment, documentation, and confidence checks that affect multiple user stories

- [ ] T031 [P] Add production build and start scripts for same-origin deployment in `/Users/jino/study/project/fog-maze-race/package.json` and `/Users/jino/study/project/fog-maze-race/apps/server/src/app/server.ts`
- [ ] T032 [P] Add a 15-player render and transport smoke test in `/Users/jino/study/project/fog-maze-race/tests/e2e/perf-smoke.spec.ts`
- [ ] T033 Validate the developer runbook against the implementation and update `/Users/jino/study/project/fog-maze-race/specs/001-fog-maze-race/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories
- **User Story 1 (Phase 3)**: Starts only after Foundational and defines the MVP slice
- **User Story 2 (Phase 4)**: Depends on User Story 1 transport and snapshot infrastructure
- **User Story 3 (Phase 5)**: Depends on User Story 1 room lifecycle and UI shell
- **Polish (Phase 6)**: Depends on the user stories you choose to ship in the current increment

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on later stories; this is the MVP
- **User Story 2 (P2)**: Builds on the authoritative room and snapshot flow from US1
- **User Story 3 (P3)**: Builds on the room lifecycle and UI surfaces from US1

### Within Each User Story

- Contract and end-to-end tests MUST be written and observed failing before implementation
- Shared domain/value objects and aggregates come before application services
- Application services come before Socket.IO handlers and UI adapters
- Server-side authoritative behavior must exist before client rendering is wired up
- Story-specific tests must pass before moving to the next priority

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001
- T006 and T007 can run in parallel after T005
- In US1, T011 and T012 can run in parallel, and T016 and T017 can run in parallel after server handlers exist
- In US2, T020 and T021 can run in parallel before T022
- In US3, T025 and T026 can run in parallel before T027
- T031 and T032 can run in parallel once the desired user stories are done

---

## Parallel Example: User Story 1

```bash
# Launch both failing tests first:
Task: "T011 [US1] Write failing Socket.IO contract tests in apps/server/tests/contracts/us1-race-flow.contract.test.ts"
Task: "T012 [US1] Write failing multi-browser race flow test in tests/e2e/us1-race-flow.spec.ts"

# Once the server-side flow exists, split UI work:
Task: "T016 [US1] Implement nickname gate and room list screen in apps/web/src/features/session/NicknameGate.tsx and apps/web/src/features/rooms/RoomListPanel.tsx"
Task: "T017 [US1] Implement the single game screen shell and sidebar in apps/web/src/views/GameScreen.tsx and apps/web/src/features/rooms/PlayerSidebar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 using the TDD order `tests -> domain -> services -> transport -> UI`
4. Validate the two-browser race loop end to end
5. Stop and demo before taking on recovery or room administration

### Incremental Delivery

1. Ship Setup + Foundational as the base architecture
2. Ship User Story 1 as the first playable race MVP
3. Add User Story 2 to harden reconnect behavior
4. Add User Story 3 to improve room operations and repeat play
5. Keep non-MVP ideas out of the active branch until these stories are complete

### Parallel Team Strategy

With multiple developers:

1. One developer owns `packages/shared` and server aggregates during Phase 2
2. One developer prepares web shell and store boundaries after Phase 2
3. After US1 server handlers settle, split frontend game rendering and frontend UI work
4. Keep DDD boundaries intact: domain changes flow through shared contracts and server aggregates before UI code changes

---

## Notes

- Every task includes an explicit file path and is ready for execution by an LLM or human developer
- TDD is mandatory for this feature: do not skip the failing-test step
- DDD is enforced by task ordering: domain and aggregate work precede transport and presentation work
- `ROOM_STATE_UPDATE` is the recovery anchor; client render state must remain disposable
- Suggested MVP scope is **Phase 1 + Phase 2 + Phase 3**
- Avoid adding chat, cosmetics, replay, or scaling infrastructure before US1 is stable
