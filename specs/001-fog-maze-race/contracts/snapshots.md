# Snapshot Shapes Contract

## RoomSnapshot

```ts
type RoomSnapshot = {
  revision: number;
  room: {
    roomId: string;
    name: string;
    status: "waiting" | "countdown" | "playing" | "ended";
    hostPlayerId: string;
    maxPlayers: number;
  };
  members: RoomMemberView[];
  match: MatchView | null;
};
```

## RoomMemberView

```ts
type RoomMemberView = {
  playerId: string;
  nickname: string;
  color: string;
  state: "waiting" | "playing" | "finished" | "disconnected" | "left";
  position: { x: number; y: number } | null;
  finishRank: number | null;
  isHost: boolean;
};
```

## MatchView

```ts
type MatchView = {
  matchId: string;
  mapId: string;
  status: "countdown" | "playing" | "ended";
  countdownValue: 3 | 2 | 1 | 0 | null;
  startedAt: string | null;
  endedAt: string | null;
  finishOrder: string[];
  map: {
    width: number;
    height: number;
    tiles: string[];
    startZone: ZoneBounds;
    goalZone: ZoneBounds;
    visibilityRadius: number;
  };
};
```

## Result Snapshot

```ts
type ResultRow = {
  playerId: string;
  nickname: string;
  color: string;
  outcome: "finished" | "left";
  rank: number | null;
};
```

## Visibility Projection Rules

The server snapshot contains enough information for all players, but the client only
renders what its current player is allowed to see.

### Inputs

- `RoomSnapshot.match.map`
- current player position
- all member positions
- current player state

### Derived behavior

- Start zone and goal zone are always visible.
- Maze tiles outside the current player's 7x7 vision window are obscured.
- Players inside the maze are visible only when inside the current player's vision window.
- Once the current player finishes, the client reveals the entire map and every player.

## Snapshot Replacement Policy

- `ROOM_JOINED` and `ROOM_STATE_UPDATE` replace the local authoritative snapshot entirely.
- Delta events may patch the current snapshot, but only if their `revision` is exactly the
  next expected revision.
- If a delta arrives with a gap, the client should discard speculative local patches and
  wait for the next full snapshot.
