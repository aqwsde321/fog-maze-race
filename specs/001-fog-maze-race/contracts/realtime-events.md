# 실시간 이벤트 계약

## 전송 계층

- 백엔드 웹 서비스와 같은 오리진의 `Socket.IO` 연결
- 게임 서비스용 논리 네임스페이스는 하나만 사용
- 서버 측 room 채널 이름은 `roomId` 원문을 그대로 사용
- 모든 authoritative 스냅샷 페이로드는 단조 증가하는 `revision`을 포함

## 명령 모델

- 클라이언트 메시지는 요청 또는 명령이다.
- 서버 메시지는 스냅샷, 델타, 생명주기 이벤트, 에러 중 하나다.
- 클라이언트가 재접속하거나 드리프트를 감지하면, 서버는 긴 델타 재생보다 전체 스냅샷 전송을 우선한다.

## 클라이언트 -> 서버 이벤트

### `CONNECT`

초기 세션 연결 또는 재접속 시도다.

```ts
type ConnectPayload = {
  playerId?: string;
  nickname: string;
  requestedRoomId?: string | null;
};
```

**규칙**

- `nickname`은 필수이며 1~5자 제한을 만족해야 한다.
- `playerId`가 30초 유예 안의 disconnected 멤버와 일치하면 서버는 복구를 시도한다.
- 복구에 실패하면 서버는 일반 세션을 새로 만들거나 갱신하고 현재 방 목록 상태를 돌려준다.

### `CREATE_ROOM`

```ts
type CreateRoomPayload = {
  name: string;
};
```

**규칙**

- 호출자는 방장이 된다.
- 호출자는 이미 다른 방에 속해 있으면 안 된다.

### `JOIN_ROOM`

```ts
type JoinRoomPayload = {
  roomId: string;
};
```

**규칙**

- 방 상태가 `waiting`일 때만 허용한다.
- 방이 가득 차 있으면 거절한다.

### `LEAVE_ROOM`

```ts
type LeaveRoomPayload = {
  roomId: string;
};
```

**규칙**

- 수동 나가기는 현재 라운드에 대해 최종 이탈로 본다.
- 나가면 방 스냅샷과 방 목록이 즉시 갱신된다.

### `START_GAME`

```ts
type StartGamePayload = {
  roomId: string;
};
```

**규칙**

- 방장만 호출할 수 있다.
- `waiting` 상태에서만 허용한다.
- 무작위 맵을 고르고, 시작 슬롯을 배정한 뒤 카운트다운을 시작한다.

### `RENAME_ROOM`

```ts
type RenameRoomPayload = {
  roomId: string;
  name: string;
};
```

**규칙**

- 방장만 호출할 수 있다.
- 성공하면 방 내부 스냅샷과 방 목록이 같이 갱신된다.

### `FORCE_END_ROOM`

```ts
type ForceEndRoomPayload = {
  roomId: string;
};
```

**규칙**

- 방장만 호출할 수 있다.
- 진행 중 경기만 즉시 종료하며, 결과 표시 뒤 `waiting`으로 복귀한다.

### `MOVE`

```ts
type MovePayload = {
  roomId: string;
  direction: "up" | "down" | "left" | "right";
  inputSeq: number;
};
```

**규칙**

- 클라이언트는 방향만 전송한다.
- 서버는 방 상태, 멤버십, 벽 충돌, 매치 상태를 검증한 뒤 위치를 갱신한다.

### `SEND_CHAT_MESSAGE`

```ts
type SendChatMessagePayload = {
  roomId: string;
  content: string;
};
```

**규칙**

- 방 안에 있는 플레이어만 보낼 수 있다.
- `content`는 trim 후 1~80자여야 한다.
- 서버는 최신 30개 메시지만 보관하고, 결과는 다음 `ROOM_STATE_UPDATE` 스냅샷에 포함한다.

## 서버 -> 클라이언트 이벤트

### `CONNECTED`

`CONNECT` 이후 전송된다.

```ts
type ConnectedPayload = {
  playerId: string;
  nickname: string;
  recovered: boolean;
  currentRoomId: string | null;
};
```

### `ROOM_LIST_UPDATE`

로비 화면에서 사용하는 authoritative 방 목록이다.

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

로컬 플레이어가 방 입장이나 재복구에 성공했을 때 전송한다.

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

기본 전체 스냅샷 이벤트다.

```ts
type RoomStateUpdatePayload = {
  roomId: string;
  snapshot: RoomSnapshot;
};
```

**용도**

- 생성, 입장, 나가기, 방장 위임, 재접속 복구, 강제 종료 등 클라이언트 드리프트 가능성이 있는 모든 상태 전이 뒤에 보낸다.
- 클라이언트는 이 페이로드로 로컬 authoritative 스냅샷을 통째로 교체해야 한다.
- 전체 채팅 메시지 갱신도 이 이벤트를 사용한다.

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

플레이 중 반응성 있는 갱신을 위한 델타 이벤트다.

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

## 복구 규칙

- 일시적인 연결 끊김에서는 `Socket.IO` 복구가 성공하면 누락된 델타를 일부 다시 받을 수 있다.
- 그래도 최종 복구 기준은 항상 `ROOM_STATE_UPDATE`여야 한다.
- 수동 나가기는 복구 대상이 아니다.
- 복구가 실패하거나 revision 드리프트가 감지되면 서버는 새 스냅샷을 보내고, 클라이언트는 오래된 로컬 상태를 버린다.
