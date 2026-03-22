# Realtime Events Contract

## Transport

- Same-origin Socket.IO connection on the backend web service
- One logical namespace for the game service
- Server-side room channel naming pattern: `room:{roomId}`
- All authoritative snapshot payloads carry a monotonically increasing `revision`

## Command Model

- Client messages are requests or commands.
- Server messages are either snapshots, deltas, lifecycle events, or errors.
- When a client reconnects or detects drift, the server must prefer sending a full
  snapshot over replaying a long delta chain.

## Client -> Server Events

### `CONNECT`

Initial session binding or reconnect attempt.

```ts
type ConnectPayload = {
  playerId?: string;
  nickname: string;
  requestedRoomId?: string | null;
};
```

**Rules**

- `nickname` is required and must satisfy the 1-5 character limit.
- If `playerId` matches a disconnected member still inside the 30-second grace window, the
  server attempts recovery.
- If recovery fails, the server creates or refreshes a normal session and returns current
  room list state.

### `CREATE_ROOM`

```ts
type CreateRoomPayload = {
  name: string;
};
```

**Rules**

- Caller becomes host.
- Caller must not already belong to another room.

### `JOIN_ROOM`

```ts
type JoinRoomPayload = {
  roomId: string;
};
```

**Rules**

- Allowed only while the room status is `waiting`.
- Reject when room is full.

### `LEAVE_ROOM`

```ts
type LeaveRoomPayload = {
  roomId: string;
};
```

**Rules**

- Manual leave is final for the active round.
- Leaving updates the room snapshot and room list immediately.

### `START_GAME`

```ts
type StartGamePayload = {
  roomId: string;
};
```

**Rules**

- Host only.
- Allowed only in `waiting`.
- Chooses a random map, assigns start slots, and begins countdown.

### `MOVE`

```ts
type MovePayload = {
  roomId: string;
  direction: "up" | "down" | "left" | "right";
  inputSeq: number;
};
```

**Rules**

- Client sends direction only.
- Server validates room state, player membership, wall collision, and match status before
  updating position.

## Server -> Client Events

### `CONNECTED`

Sent after `CONNECT`.

```ts
type ConnectedPayload = {
  playerId: string;
  nickname: string;
  recovered: boolean;
  currentRoomId: string | null;
};
```

### `ROOM_LIST_UPDATE`

Authoritative list used by the lobby screen.

```ts
type RoomListUpdatePayload = {
  rooms: Array<{
    roomId: string;
    name: string;
    hostNickname: string;
    playerCount: number;
    status: "waiting" | "countdown" | "playing" | "ended";
  }>;
};
```

### `ROOM_JOINED`

Sent when the local player successfully enters or recovers a room.

```ts
type RoomJoinedPayload = {
  roomId: string;
  snapshot: RoomSnapshot;
  selfPlayerId: string;
};
```

### `ROOM_LEFT`

```ts
type RoomLeftPayload = {
  roomId: string;
  playerId: string;
  reason: "manual" | "timeout" | "removed";
};
```

### `ROOM_STATE_UPDATE`

Primary full snapshot event.

```ts
type RoomStateUpdatePayload = {
  roomId: string;
  snapshot: RoomSnapshot;
};
```

**Usage**

- Sent after create, join, leave, host reassignment, reconnect recovery, force end, and
  any other state transition where a client may drift.
- Client must replace its local authoritative snapshot with this payload.

### `GAME_STARTING`

```ts
type GameStartingPayload = {
  roomId: string;
  matchId: string;
  mapId: string;
  startsAt: string;
};
```

### `COUNTDOWN`

```ts
type CountdownPayload = {
  roomId: string;
  value: 3 | 2 | 1 | 0;
  endsAt: string;
  revision: number;
};
```

### `PLAYER_MOVED`

Delta event for responsive updates during play.

```ts
type PlayerMovedPayload = {
  roomId: string;
  playerId: string;
  position: { x: number; y: number };
  inputSeq: number;
  revision: number;
};
```

### `PLAYER_FINISHED`

```ts
type PlayerFinishedPayload = {
  roomId: string;
  playerId: string;
  rank: number;
  revision: number;
};
```

### `GAME_ENDED`

```ts
type GameEndedPayload = {
  roomId: string;
  results: Array<{
    playerId: string;
    nickname: string;
    color: string;
    outcome: "finished" | "left";
    rank: number | null;
  }>;
  returnToWaitingAt: string;
  revision: number;
};
```

### `ERROR`

```ts
type ErrorPayload = {
  code:
    | "INVALID_NICKNAME"
    | "ROOM_FULL"
    | "ROOM_NOT_JOINABLE"
    | "HOST_ONLY"
    | "INVALID_MOVE"
    | "RECOVERY_FAILED"
    | "NOT_IN_ROOM"
    | "UNKNOWN";
  message: string;
};
```

## Recovery Rules

- Temporary disconnects may deliver missed deltas if Socket.IO recovery succeeds.
- The client must still accept `ROOM_STATE_UPDATE` as the ultimate recovery mechanism.
- Manual leave does not qualify for recovery.
- If recovery fails or revision drift is detected, the server sends a fresh snapshot and
  the client discards stale local state.
