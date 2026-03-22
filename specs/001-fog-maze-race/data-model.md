# Data Model: Fog Maze Race MVP

## Overview

The authoritative state lives on the server and is synchronized to clients through full
room snapshots plus targeted delta events. Client-only view state is derived from the
authoritative snapshot and is never treated as the source of truth.

## Entities

### PlayerSession

Represents one browser identity across reconnects.

| Field | Type | Rules |
|-------|------|-------|
| `playerId` | UUID | Stable identity stored in localStorage |
| `nickname` | string | Required, length 1-5 |
| `lastSeenAt` | timestamp | Updated on every meaningful socket activity |
| `currentRoomId` | string \| null | Only one room at a time |
| `connectionState` | enum | `connected`, `disconnected`, `left` |
| `reconnectDeadlineAt` | timestamp \| null | Set only after unexpected disconnect |

### Room

Represents one multiplayer lobby plus its attached match lifecycle.

| Field | Type | Rules |
|-------|------|-------|
| `roomId` | string | Unique room identifier |
| `name` | string | User-editable by current host |
| `hostPlayerId` | UUID | Must belong to a current member while room is populated |
| `status` | enum | `waiting`, `countdown`, `playing`, `ended` |
| `maxPlayers` | integer | Fixed at 15 for MVP |
| `memberIds` | UUID[] | Ordered by join sequence for host reassignment |
| `activeMatchId` | string \| null | Present during countdown, playing, ended |
| `revision` | integer | Incremented on every authoritative room mutation |

### RoomMember

Room-scoped projection of a player during a specific room lifecycle.

| Field | Type | Rules |
|-------|------|-------|
| `playerId` | UUID | References `PlayerSession.playerId` |
| `roomId` | string | References `Room.roomId` |
| `nickname` | string | Copied from session at join time |
| `color` | string | Assigned on join |
| `joinOrder` | integer | Determines host reassignment |
| `state` | enum | `waiting`, `playing`, `finished`, `disconnected`, `left` |
| `position` | `GridPosition` | Authoritative tile position |
| `finishedAt` | timestamp \| null | Set on goal arrival |
| `finishRank` | integer \| null | Assigned in server order |
| `disconnectStartedAt` | timestamp \| null | Set on unexpected disconnect |

### Match

Represents one race round inside a room.

| Field | Type | Rules |
|-------|------|-------|
| `matchId` | string | Unique per round |
| `roomId` | string | References `Room.roomId` |
| `mapId` | string | References `MapDefinition.mapId` |
| `status` | enum | `countdown`, `playing`, `ended` |
| `countdownValue` | integer \| null | `3`, `2`, `1`, `0` during countdown |
| `startedAt` | timestamp \| null | Set when play begins |
| `endedAt` | timestamp \| null | Set when round ends |
| `activePlayerIds` | UUID[] | Members still relevant to completion logic |
| `finishOrder` | UUID[] | Ordered list of finishers |
| `results` | `ResultEntry[]` | Snapshot shown during result phase |

### MapDefinition

Represents a prebuilt maze that the server can select randomly.

| Field | Type | Rules |
|-------|------|-------|
| `mapId` | string | Stable identifier |
| `name` | string | Human-readable map name |
| `width` | integer | Fixed grid width |
| `height` | integer | Fixed grid height |
| `tiles` | tile[][] | Encodes wall/floor/zone information |
| `startZone` | `ZoneBounds` | Always visible |
| `goalZone` | `ZoneBounds` | Always visible |
| `startSlots` | `GridPosition[]` | Predefined player spawn slots |
| `mazeEntrance` | `GridPosition[]` | Connects start zone to maze |
| `visibilityRadius` | integer | Fixed at 3 cells each side, producing 7x7 view |

### ResultEntry

Represents one row in the six-second result screen.

| Field | Type | Rules |
|-------|------|-------|
| `playerId` | UUID | References player |
| `nickname` | string | Frozen for this result display |
| `color` | string | Used by result UI |
| `outcome` | enum | `finished`, `left` |
| `rank` | integer \| null | Present for finishers only |

### GridPosition

Simple 2D coordinate on the map grid.

| Field | Type | Rules |
|-------|------|-------|
| `x` | integer | Must stay within map bounds |
| `y` | integer | Must stay within map bounds |

## Relationships

- One `PlayerSession` can have at most one active `RoomMember`.
- One `Room` has many `RoomMember` records.
- One `Room` has at most one active `Match`.
- One `Match` uses exactly one `MapDefinition`.
- One `Match` produces many `ResultEntry` rows.

## Validation Rules

- Nickname length must stay between 1 and 5 characters.
- Only rooms in `waiting` state accept new members.
- Room membership must never exceed 15 players.
- Only the current host can rename a room, start a match, or force-end a match.
- Movement accepts only one cardinal direction per command.
- The server rejects moves into walls or outside map bounds.
- Players do not block each other; two players may occupy the same tile at the same time.
- Goal entry assigns ranks in authoritative server processing order.
- Unexpected disconnect sets `RoomMember.state = disconnected` and starts a 30-second
  recovery timer.
- Manual leave immediately sets `RoomMember.state = left` and disables match recovery.

## State Transitions

### Room Status

```text
waiting -> countdown -> playing -> ended -> waiting
```

- `waiting -> countdown`: host starts a round
- `countdown -> playing`: countdown reaches zero
- `playing -> ended`: all remaining active players have either finished or left
- `ended -> waiting`: result display timer completes

### Player State

```text
waiting -> playing -> finished
playing -> disconnected -> playing
playing -> disconnected -> left
waiting -> left
playing -> left
finished -> left
```

- `disconnected -> playing`: reconnect succeeds before deadline and player had not finished
- `disconnected -> finished`: reconnect succeeds after finishing but before room reset
- `disconnected -> left`: 30-second deadline expires

### Match Status

```text
countdown -> playing -> ended
```

## Snapshot Projections

The server sends projections rather than raw internal records.

### RoomSummary

Used in room list updates.

| Field | Type |
|-------|------|
| `roomId` | string |
| `name` | string |
| `hostNickname` | string |
| `playerCount` | integer |
| `status` | room status |

### RoomSnapshot

Used as the full sync unit on join, reconnect, and drift correction.

| Field | Type |
|-------|------|
| `room` | room metadata |
| `members` | `RoomMemberView[]` |
| `match` | `MatchView \| null` |
| `revision` | integer |

### ClientRenderState

Derived only on the client from `RoomSnapshot` plus the current player identity.

| Field | Source |
|-------|--------|
| `visibleTiles` | map + self position + visibility rules |
| `visiblePlayers` | member positions filtered by visibility rules |
| `showFullMap` | `self.state === finished` |
| `sidebarPlayers` | room snapshot projection |

This separation is mandatory: `ClientRenderState` is disposable and can always be
recomputed from the latest authoritative snapshot.
