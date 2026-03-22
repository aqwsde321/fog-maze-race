<!--
Sync Impact Report
- Version change: N/A -> 1.0.0
- Modified principles:
  - Initialized constitution with five concrete principles
- Added sections:
  - Architectural Constraints
  - Delivery Workflow
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
- Follow-up TODOs:
  - None
-->

# Fog Maze Race Constitution

## Core Principles

### I. MVP First
Every feature MUST start from the smallest playable slice that delivers user value.
Specifications, plans, and tasks MUST identify the P1 path that can ship as a usable MVP
without depending on P2 or later work. Any idea that does not improve the first playable
loop MUST be deferred.

### II. Server-Authoritative Gameplay
The server MUST own authoritative game state, rule evaluation, and conflict resolution by
default. Clients MUST NOT be treated as the source of truth for gameplay outcomes.
Exceptions require explicit justification in the implementation plan and a simpler
server-authoritative alternative must be rejected in writing.

### III. State and Presentation Separation
Domain state, synchronization state, and presentation state MUST be designed as separate
concerns. Client code MUST remain focused on rendering, input capture, and view updates,
while server and shared domain layers manage game rules and synchronized state transitions.
UI convenience MUST NOT leak into authoritative game logic.

### IV. Recoverable Realtime Synchronization
Realtime synchronization MUST be recoverable after reconnects, packet loss, or client drift.
Every realtime feature MUST define both event propagation and snapshot-based restoration so a
client can rebuild the current state without manual intervention. Recovery behavior MUST be
testable in isolation.

### V. Ruthless Scope Control
Anything outside the MVP scope MUST be excluded from initial implementation. Backlog items,
polish ideas, speculative optimizations, and optional social or cosmetic features MUST be
documented as deferred work instead of being folded into active delivery. Scope expansion
requires an explicit amendment to the spec or plan.

## Architectural Constraints

- The default architecture is a server-authoritative multiplayer system with rendering-led
  clients.
- Plans MUST describe server responsibilities, client responsibilities, state boundaries, and
  synchronization recovery paths before implementation starts.
- If a feature is not realtime, the plan MUST explicitly mark synchronization recovery as
  `N/A` and explain why.
- Shared contracts MUST favor deterministic inputs, explicit events, and snapshot payloads
  that can restore the same gameplay state across clients.

## Delivery Workflow

- Each spec MUST identify the MVP user story and list explicit out-of-scope items.
- Each implementation plan MUST pass a constitution check covering MVP scope,
  server-authoritative ownership, state/presentation separation, and recovery design.
- Each task list MUST schedule foundational work for authoritative state handling before
  client-facing polish or secondary stories.
- Reviews MUST reject changes that move authority into clients, mix view concerns into domain
  state, or add non-MVP work without approval.

## Governance

This constitution overrides conflicting local conventions for planning and delivery. Every
specification, implementation plan, task list, and review MUST verify compliance. Amendments
require the changed principle or section to be documented, dependent templates to be updated,
and semantic versioning to be applied as follows: MAJOR for incompatible governance changes,
MINOR for new principles or materially expanded rules, and PATCH for clarifications that do
not change the meaning of existing rules.

**Version**: 1.0.0 | **Ratified**: 2026-03-22 | **Last Amended**: 2026-03-22
