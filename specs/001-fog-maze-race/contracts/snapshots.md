# 스냅샷 형태 계약

## `RoomSnapshot`

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
  previewMap: MapView | null;
  match: MatchView | null;
};
```

## `RoomMemberView`

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

## `MapView`

```ts
type MapView = {
  mapId: string;
  width: number;
  height: number;
  tiles: string[];
  startZone: ZoneBounds;
  mazeZone: ZoneBounds;
  goalZone: ZoneBounds;
  startSlots: Array<{ x: number; y: number }>;
  connectorTiles: Array<{ x: number; y: number }>;
  visibilityRadius: number;
};
```

## `MatchView`

```ts
type MatchView = {
  matchId: string;
  mapId: string;
  status: "countdown" | "playing" | "ended";
  countdownValue: 3 | 2 | 1 | 0 | null;
  startedAt: string | null;
  endedAt: string | null;
  finishOrder: string[];
  results: ResultRow[];
  map: MapView;
};
```

## 결과 스냅샷

```ts
type ResultRow = {
  playerId: string;
  nickname: string;
  color: string;
  outcome: "finished" | "left";
  rank: number | null;
};
```

## 시야 투영 규칙

서버 스냅샷은 모든 플레이어에 대한 충분한 정보를 담고 있지만, 클라이언트는 현재
플레이어가 볼 수 있는 것만 렌더링한다.

### 입력

- `RoomSnapshot.previewMap`
- `RoomSnapshot.match.map`
- 현재 플레이어 위치
- 모든 멤버 위치
- 현재 플레이어 상태

### 파생 동작

- `waiting` 상태에서는 `previewMap`의 시작 구역과 시작 슬롯만 렌더링한다.
- 플레이 중에는 시작 구역, 연결 통로, 골 타일을 계속 구분할 수 있다.
- 현재 플레이어의 7x7 시야 밖 미로 타일은 완전히 가려져서 벽과 통로를 구분할 수 없다.
- 미로 안 플레이어는 현재 플레이어 시야 안에 있을 때만 보인다.
- 현재 플레이어가 완주하면 클라이언트는 전체 맵과 모든 플레이어를 공개한다.

## 스냅샷 교체 정책

- `ROOM_JOINED`, `ROOM_STATE_UPDATE`는 로컬 authoritative 스냅샷을 전체 교체한다.
- 델타 이벤트는 `revision`이 정확히 다음 값일 때만 현재 스냅샷에 패치할 수 있다.
- 중간 revision이 비면 클라이언트는 추측성 패치를 버리고 다음 전체 스냅샷을 기다려야 한다.
