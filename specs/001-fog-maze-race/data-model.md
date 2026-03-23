# 데이터 모델: Fog Maze Race MVP

## 개요

authoritative 상태는 서버에 존재하며, 클라이언트에는 전체 방 스냅샷과 선택적인 델타
이벤트로 동기화된다. 클라이언트 전용 뷰 상태는 authoritative 스냅샷에서 파생될 뿐이며,
절대 원본 상태로 취급하지 않는다.

## 엔터티

### `PlayerSession`

재접속을 포함해 하나의 브라우저 식별자를 나타낸다.

| 필드 | 타입 | 규칙 |
|-------|------|-------|
| `playerId` | UUID | `localStorage`에 저장되는 안정적인 식별자 |
| `nickname` | string | 필수, 길이 1~5 |
| `lastSeenAt` | timestamp | 의미 있는 소켓 활동마다 갱신 |
| `currentRoomId` | string \| null | 동시에 한 방만 허용 |
| `connectionState` | enum | `connected`, `disconnected`, `left` |
| `reconnectDeadlineAt` | timestamp \| null | 예기치 않은 연결 끊김 뒤에만 설정 |

### `Room`

멀티플레이 로비와 그 안의 경기 생명주기를 함께 나타낸다.

| 필드 | 타입 | 규칙 |
|-------|------|-------|
| `roomId` | string | 고유 방 식별자 |
| `name` | string | 현재 방장이 수정 가능 |
| `hostPlayerId` | UUID | 방이 존재하는 동안 현재 멤버 중 하나여야 함 |
| `status` | enum | `waiting`, `countdown`, `playing`, `ended` |
| `maxPlayers` | integer | MVP에서는 15로 고정 |
| `memberIds` | UUID[] | 방장 위임을 위한 입장 순서 유지 |
| `activeMatchId` | string \| null | `countdown`, `playing`, `ended` 동안 존재 |
| `revision` | integer | authoritative 방 상태가 바뀔 때마다 증가 |

### `RoomMember`

특정 방 생명주기 안에서 플레이어를 투영한 레코드다.

| 필드 | 타입 | 규칙 |
|-------|------|-------|
| `playerId` | UUID | `PlayerSession.playerId` 참조 |
| `roomId` | string | `Room.roomId` 참조 |
| `nickname` | string | 방 입장 시점 세션 값 복사 |
| `color` | string | 입장 시 할당 |
| `joinOrder` | integer | 방장 위임 순서 결정 |
| `state` | enum | `waiting`, `playing`, `finished`, `disconnected`, `left` |
| `position` | `GridPosition` | authoritative 타일 위치 |
| `finishedAt` | timestamp \| null | 골인 시 설정 |
| `finishRank` | integer \| null | 서버 순서대로 부여 |
| `disconnectStartedAt` | timestamp \| null | 예기치 않은 끊김 시 설정 |

### `Match`

방 안에서 한 번 진행되는 레이스 라운드를 나타낸다.

| 필드 | 타입 | 규칙 |
|-------|------|-------|
| `matchId` | string | 라운드마다 고유 |
| `roomId` | string | `Room.roomId` 참조 |
| `mapId` | string | `MapDefinition.mapId` 참조 |
| `status` | enum | `countdown`, `playing`, `ended` |
| `countdownValue` | integer \| null | 카운트다운 중 `3`, `2`, `1`, `0` |
| `startedAt` | timestamp \| null | 실제 플레이 시작 시 설정 |
| `endedAt` | timestamp \| null | 라운드 종료 시 설정 |
| `resultsDurationMs` | integer \| null | 결과 화면 자동 닫힘 타이머 |
| `activePlayerIds` | UUID[] | 종료 계산에 포함되는 플레이어 |
| `finishOrder` | UUID[] | 완주 순서 |
| `results` | `ResultEntry[]` | 결과 화면용 스냅샷 |

### `MapDefinition`

서버가 무작위로 선택할 수 있는 사전 제작 미로를 나타낸다.

| 필드 | 타입 | 규칙 |
|-------|------|-------|
| `mapId` | string | 안정적인 식별자 |
| `name` | string | 사람이 읽을 수 있는 맵 이름 |
| `width` | integer | 고정 격자 너비 |
| `height` | integer | 고정 격자 높이 |
| `tiles` | tile[][] | 벽/바닥/구역 정보를 인코딩 |
| `startZone` | `ZoneBounds` | `3x5` 고정 시작 영역 |
| `mazeZone` | `ZoneBounds` | `25x25` 고정 미로 영역 |
| `goalZone` | `ZoneBounds` | 미로 내부 단일 골 타일 |
| `startSlots` | `GridPosition[]` | 시작 영역의 15개 고정 슬롯 |
| `connectorTiles` | `GridPosition[]` | 시작 구역과 미로를 잇는 `1x5` 세로 통로 |
| `visibilityRadius` | integer | 기본 3칸으로, 실제 시야는 7x7 |

### `ResultEntry`

6초 결과 화면에 표시되는 한 줄 데이터를 나타낸다.

| 필드 | 타입 | 규칙 |
|-------|------|-------|
| `playerId` | UUID | 플레이어 참조 |
| `nickname` | string | 결과 화면용으로 고정 |
| `color` | string | 결과 UI에서 사용 |
| `outcome` | enum | `finished`, `left` |
| `rank` | integer \| null | 완주자에게만 존재 |

### `GridPosition`

맵 격자 위의 단순한 2D 좌표다.

| 필드 | 타입 | 규칙 |
|-------|------|-------|
| `x` | integer | 맵 경계를 벗어나면 안 됨 |
| `y` | integer | 맵 경계를 벗어나면 안 됨 |

## 관계

- 하나의 `PlayerSession`은 동시에 최대 하나의 활성 `RoomMember`만 가진다.
- 하나의 `Room`은 여러 `RoomMember`를 가진다.
- 하나의 `Room`은 동시에 최대 하나의 활성 `Match`만 가진다.
- 하나의 `Match`는 정확히 하나의 `MapDefinition`을 사용한다.
- 하나의 `Match`는 여러 `ResultEntry`를 만든다.

## 검증 규칙

- 닉네임 길이는 항상 1~5자를 유지해야 한다.
- `waiting` 상태의 방만 새 멤버를 받을 수 있다.
- 방 멤버 수는 절대 15명을 넘지 않는다.
- 현재 방장만 방 이름 변경, 경기 시작, 강제 종료를 할 수 있다.
- `waiting` 상태 클라이언트 프리뷰에서는 시작 영역과 시작 슬롯만 렌더링한다.
- 이동 명령은 한 번에 하나의 상하좌우 방향만 받는다.
- 서버는 벽이나 맵 바깥으로의 이동을 거절한다.
- 플레이어끼리 서로를 막지 않는다. 같은 타일을 동시에 점유할 수 있다.
- 골인 순위는 서버가 처리한 authoritative 순서대로 부여한다.
- 시야 밖 미로 타일은 벽과 통로가 구분되지 않도록 완전히 가린다.
- 예기치 않은 연결 끊김은 `RoomMember.state = disconnected`로 두고 30초 복구 타이머를 시작한다.
- 수동 나가기는 즉시 `RoomMember.state = left`로 전환하고 매치 복구를 비활성화한다.

## 상태 전이

### 방 상태

```text
waiting -> countdown -> playing -> ended -> waiting
```

- `waiting -> countdown`: 방장이 라운드를 시작함
- `countdown -> playing`: 카운트다운이 0이 됨
- `playing -> ended`: 남아 있는 활성 플레이어가 모두 완주하거나 떠남
- `ended -> waiting`: 결과 표시 시간이 끝남

### 플레이어 상태

```text
waiting -> playing -> finished
playing -> disconnected -> playing
playing -> disconnected -> left
waiting -> left
playing -> left
finished -> left
```

- `disconnected -> playing`: 제한 시간 안 재접속했고 아직 완주 전
- `disconnected -> finished`: 이미 완주했고 방 초기화 전 복귀 성공
- `disconnected -> left`: 30초 제한 시간이 만료됨

### 매치 상태

```text
countdown -> playing -> ended
```

## 스냅샷 투영

서버는 내부 레코드 원본이 아니라 전송용 투영 데이터를 보낸다.

### `RoomSummary`

방 목록 갱신에 사용한다.

| 필드 | 타입 |
|-------|------|
| `roomId` | string |
| `name` | string |
| `hostNickname` | string |
| `playerCount` | integer |
| `status` | 방 상태 |

### `RoomSnapshot`

입장, 재접속, 드리프트 보정 시 전체 동기화 단위로 사용한다.

| 필드 | 타입 |
|-------|------|
| `room` | 방 메타데이터 |
| `members` | `RoomMemberView[]` |
| `previewMap` | `MapView \| null` |
| `match` | `MatchView \| null` |
| `revision` | integer |

### UI 투영 메모

- 상단 상태 표시는 `room.status === "countdown"` 이어도 `playing` 으로 단순 표기할 수 있고,
  실제 카운트다운 값은 중앙 오버레이가 담당한다.
- `waiting` 과 `countdown` 동안 플레이어 위치는 시작 구역 안에서만 바뀔 수 있다.
- 플레이어 마커는 색상 원형이며, 현재 플레이어만 흰색 테두리로 구분한다.

### `ClientRenderState`

`RoomSnapshot`과 현재 플레이어 식별자만으로 클라이언트에서 파생한다.

| 필드 | 소스 |
|-------|--------|
| `visibleTiles` | `waiting`에서는 시작 영역 프리뷰, `playing`에서는 맵 + 내 위치 + 시야 규칙 |
| `visiblePlayers` | 시야 규칙으로 필터링한 멤버 위치 |
| `showFullMap` | `self.state === finished` |
| `sidebarPlayers` | 방 스냅샷 기반 투영 |

이 분리는 필수다. `ClientRenderState`는 버려도 되는 파생 상태이며, 언제든 최신
authoritative 스냅샷에서 다시 계산할 수 있어야 한다.
