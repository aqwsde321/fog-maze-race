---

description: "Fog Maze Race MVP 구현 작업 목록"
---

# 작업 목록: Fog Maze Race MVP

**입력 문서**: `/specs/001-fog-maze-race/` 아래 설계 문서
**선행 문서**: `plan.md`(필수), `spec.md`(사용자 스토리용 필수), `research.md`, `data-model.md`, `contracts/`

**테스트 원칙**: 이 기능은 TDD가 필수다. 모든 사용자 스토리는 실패하는 계약 테스트와
엔드투엔드 테스트를 먼저 작성한 뒤 구현 작업으로 들어간다.

**구성 원칙**: 작업은 사용자 스토리별로 묶어서 각 스토리를 독립적으로 구현하고 검증할 수 있게 한다.

## 형식: `[ID] [P?] [스토리] 설명`

- **[P]**: 병렬 실행 가능(서로 다른 파일, 의존성 없음)
- **[스토리]**: 해당 작업이 속한 사용자 스토리(`US1`, `US2`, `US3` 등)
- 설명에는 정확한 파일 경로를 포함한다

## 경로 규칙

- **워크스페이스 루트**: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- **백엔드**: `apps/server/src/`, `apps/server/tests/`
- **프론트엔드**: `apps/web/src/`, `apps/web/tests/`
- **공유 계약/도메인**: `packages/shared/src/`
- **엔드투엔드**: `tests/e2e/`

## 1단계: 설정 (공유 인프라)

**목적**: 모노레포를 초기화하고 빠른 MVP 반복에 필요한 최소 개발 도구를 마련한다.

- [x] T001 `/Users/jino/study/project/fog-maze-race/package.json`, `/Users/jino/study/project/fog-maze-race/pnpm-workspace.yaml`, `/Users/jino/study/project/fog-maze-race/tsconfig.base.json`에 루트 워크스페이스 매니페스트를 만든다
- [x] T002 [P] `/Users/jino/study/project/fog-maze-race/apps/server/package.json`, `/Users/jino/study/project/fog-maze-race/apps/server/tsconfig.json`, `/Users/jino/study/project/fog-maze-race/apps/server/src/app/server.ts`에 백엔드 패키지 골격을 만든다
- [x] T003 [P] `/Users/jino/study/project/fog-maze-race/apps/web/package.json`, `/Users/jino/study/project/fog-maze-race/apps/web/tsconfig.json`, `/Users/jino/study/project/fog-maze-race/apps/web/src/app/App.tsx`에 웹 패키지 골격을 만든다
- [x] T004 [P] `/Users/jino/study/project/fog-maze-race/vitest.workspace.ts`, `/Users/jino/study/project/fog-maze-race/playwright.config.ts`, `/Users/jino/study/project/fog-maze-race/tests/e2e/helpers/multi-client.ts`에 공통 테스트 도구를 설정한다

---

## 2단계: 기반 작업 (막히는 선행 조건)

**목적**: 모든 사용자 스토리가 공통으로 의존하는 도메인 경계, 공유 계약, 실시간 인프라를 만든다.

**⚠️ 중요**: 이 단계가 끝나기 전에는 어떤 사용자 스토리도 시작할 수 없다.

- [x] T005 `/Users/jino/study/project/fog-maze-race/packages/shared/src/domain/status.ts`, `/Users/jino/study/project/fog-maze-race/packages/shared/src/domain/grid-position.ts`, `/Users/jino/study/project/fog-maze-race/packages/shared/src/domain/result-entry.ts`에 공유 도메인 enum과 값 객체를 정의한다
- [x] T006 [P] `/Users/jino/study/project/fog-maze-race/packages/shared/src/contracts/realtime.ts`, `/Users/jino/study/project/fog-maze-race/packages/shared/src/contracts/snapshots.ts`에 실시간 이벤트와 스냅샷 계약을 정의한다
- [x] T007 [P] `/Users/jino/study/project/fog-maze-race/packages/shared/src/maps/map-definitions.ts`, `/Users/jino/study/project/fog-maze-race/packages/shared/src/visibility/apply-visibility.ts`에 사전 제작 맵 정의와 시야 헬퍼를 추가한다
- [x] T008 `/Users/jino/study/project/fog-maze-race/apps/server/src/core/room.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/core/match.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/core/player-session.ts`에 authoritative 방/매치 집합체를 구현한다
- [x] T009 `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/race-gateway.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/revision-sync.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/disconnect-grace.ts`에 `Socket.IO` 게이트웨이 골격, revision 추적기, 연결 유예 타이머 인프라를 구현한다
- [x] T010 `/Users/jino/study/project/fog-maze-race/apps/web/src/stores/sessionStore.ts`, `/Users/jino/study/project/fog-maze-race/apps/web/src/stores/roomStore.ts`, `/Users/jino/study/project/fog-maze-race/apps/web/src/services/socket-client.ts`에 렌더링 전용 클라이언트 상태 경계를 구현한다

**체크포인트**: 기반 작업 완료. 이제 우선순위에 따라 사용자 스토리 구현을 시작할 수 있다.

---

## 3단계: 사용자 스토리 1 - 방에 들어가 레이스를 완주한다 (우선순위: P1) 🎯 MVP

**목표**: 플레이어가 닉네임을 입력하고, 대기 중인 방을 만들거나 입장하고, 레이스를 시작하고, 안개 시야 아래 미로를 이동해 완주한 뒤 결과를 보고 다시 `waiting`으로 돌아갈 수 있어야 한다.

**독립 검증 방법**: 두 개의 브라우저가 같은 `waiting` 방에 입장하고, 방장이 매치를 시작하고, 양쪽이 동기화된 카운트다운과 이동을 보고, 한 명이 먼저 완주하고, 결과가 6초 표시된 뒤 방이 `waiting`으로 돌아오면 된다.

### 사용자 스토리 1 테스트 ⚠️

> **주의**: 이 테스트들을 먼저 작성하고, 반드시 실패하는 것을 확인한 뒤 구현한다.

- [x] T011 [P] [US1] `/Users/jino/study/project/fog-maze-race/apps/server/tests/contracts/us1-race-flow.contract.test.ts`에 연결, 방 생성, 방 입장, 게임 시작, 이동, 결과를 검증하는 실패 계약 테스트를 작성한다
- [x] T012 [P] [US1] `/Users/jino/study/project/fog-maze-race/tests/e2e/us1-race-flow.spec.ts`에 실패하는 멀티 브라우저 레이스 흐름 테스트를 작성한다

### 사용자 스토리 1 구현

- [x] T013 [P] [US1] `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/room-service.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/session-handlers.ts`에 세션 연결, 방 생성, 방 입장 애플리케이션 서비스를 구현한다
- [x] T014 [US1] `/Users/jino/study/project/fog-maze-race/apps/server/src/matches/match-service.ts`에 카운트다운, 이동 검증, 완주 순위, 자동 종료 조건을 구현한다
- [x] T015 [US1] `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/match-handlers.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/revision-sync.ts`에 authoritative 스냅샷/델타 브로드캐스트를 구현한다
- [x] T016 [P] [US1] `/Users/jino/study/project/fog-maze-race/apps/web/src/features/session/NicknameGate.tsx`, `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/RoomListPanel.tsx`에 닉네임 게이트와 방 목록 화면을 구현한다
- [x] T017 [P] [US1] `/Users/jino/study/project/fog-maze-race/apps/web/src/views/GameScreen.tsx`, `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/PlayerSidebar.tsx`에 단일 게임 화면 셸과 사이드바를 구현한다
- [x] T018 [US1] `/Users/jino/study/project/fog-maze-race/apps/web/src/game/GameCanvas.tsx`, `/Users/jino/study/project/fog-maze-race/apps/web/src/game/pixi/scene-controller.ts`, `/Users/jino/study/project/fog-maze-race/apps/web/src/game/pixi/renderers/fog-renderer.ts`에 `PixiJS` 미로, 안개, 플레이어 렌더링을 구현한다
- [x] T019 [US1] `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/ResultOverlay.tsx`, `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/reset-room.ts`에 결과 오버레이, 6초 리셋 흐름을 구현하고 US1 테스트를 통과시킨다

**체크포인트**: 사용자 스토리 1만으로도 첫 플레이 가능한 MVP를 데모할 수 있다.

---

## 4단계: 사용자 스토리 2 - 연결이 끊겨도 경기 상태를 복구한다 (우선순위: P2)

**목표**: 경기 중 일시적으로 연결이 끊긴 플레이어가 30초 안에 재접속하면 방과 경기 상태를 수동 개입 없이 복구해야 한다.

**독립 검증 방법**: 진행 중인 매치에서 브라우저 하나를 끊고 30초 안 복구와 30초 초과 복구 실패를 각각 시험해 위치/상태 복원과 이탈 처리를 확인한다.

### 사용자 스토리 2 테스트 ⚠️

- [x] T020 [P] [US2] `/Users/jino/study/project/fog-maze-race/apps/server/tests/contracts/us2-recovery.contract.test.ts`에 실패하는 복구/타임아웃 계약 테스트를 작성한다
- [x] T021 [P] [US2] `/Users/jino/study/project/fog-maze-race/tests/e2e/us2-reconnect.spec.ts`에 실패하는 브라우저 재접속 복구 테스트를 작성한다

### 사용자 스토리 2 구현

- [x] T022 [US2] `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/recovery-service.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/disconnect-grace.ts`에 연결 유예 추적, 재접속 자격 판정, 유예 초과 제거를 구현한다
- [x] T023 [US2] `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/recovery-handlers.ts`, `/Users/jino/study/project/fog-maze-race/apps/web/src/stores/roomStore.ts`에 재접속 스냅샷 재동기화와 revision gap 처리 로직을 구현한다
- [x] T024 [US2] `/Users/jino/study/project/fog-maze-race/apps/web/src/features/session/ConnectionBanner.tsx`, `/Users/jino/study/project/fog-maze-race/apps/web/src/services/socket-client.ts`에 연결 끊김 배너, 재접속 UX를 구현하고 US2 테스트를 통과시킨다

**체크포인트**: 사용자 스토리 1, 2가 독립적으로 동작하고, 복구가 새로고침이나 관리자 수동 개입에 의존하지 않는다.

---

## 5단계: 사용자 스토리 3 - 방을 관리하고 다음 판을 이어서 진행한다 (우선순위: P3)

**목표**: 플레이어가 방 목록을 탐색할 수 있고, 방장은 방 이름 변경과 강제 종료를 할 수 있으며, 방장이 나가면 권한이 자동 위임되어야 한다.

**독립 검증 방법**: 여러 방을 만든 뒤 방 목록 갱신, 방 이름 변경, 방장 위임, 강제 종료 후 대기 상태 복귀를 확인한다.

### 사용자 스토리 3 테스트 ⚠️

- [x] T025 [P] [US3] `/Users/jino/study/project/fog-maze-race/apps/server/tests/contracts/us3-room-admin.contract.test.ts`에 실패하는 방 운영 계약 테스트를 작성한다
- [x] T026 [P] [US3] `/Users/jino/study/project/fog-maze-race/tests/e2e/us3-room-admin.spec.ts`에 실패하는 방 운영 브라우저 흐름 테스트를 작성한다

### 사용자 스토리 3 구현

- [x] T027 [US3] `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/room-service.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/ws/handlers/admin-handlers.ts`에 방 목록 투영 갱신, 방 이름 변경, 강제 종료 명령을 구현한다
- [x] T028 [US3] `/Users/jino/study/project/fog-maze-race/apps/server/src/core/room.ts`, `/Users/jino/study/project/fog-maze-race/apps/server/src/rooms/force-end-match.ts`에 방장 위임과 강제 종료 결과 생성을 구현한다
- [x] T029 [US3] `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/HostControls.tsx`, `/Users/jino/study/project/fog-maze-race/apps/web/src/app/App.tsx`에 방 목록 갱신, 방 이름 변경 컨트롤, 방장 전용 액션을 구현한다
- [x] T030 [US3] `/Users/jino/study/project/fog-maze-race/apps/web/src/features/rooms/ResultOverlay.tsx`, `/Users/jino/study/project/fog-maze-race/apps/web/src/views/GameScreen.tsx`에 강제 종료 결과 렌더링을 구현하고 US3 테스트를 통과시킨다

**체크포인트**: 모든 사용자 스토리가 독립적으로 동작하고, 같은 방 생명주기 안에서 반복 플레이를 지원한다.

---

## 6단계: 마감 및 공통 관심사

**목적**: 여러 사용자 스토리에 걸치는 배포, 문서, 신뢰도 검증을 마무리한다.

- [x] T031 [P] `/Users/jino/study/project/fog-maze-race/package.json`, `/Users/jino/study/project/fog-maze-race/apps/server/src/app/server.ts`에 같은 오리진 배포용 프로덕션 빌드/시작 스크립트를 추가한다
- [x] T032 [P] `/Users/jino/study/project/fog-maze-race/tests/e2e/perf-smoke.spec.ts`에 15인 렌더링/전송 스모크 테스트를 추가한다
- [x] T033 `/Users/jino/study/project/fog-maze-race/specs/001-fog-maze-race/quickstart.md`를 실제 구현 기준으로 검증하고 개발자 실행 가이드를 갱신한다

---

## 의존성과 실행 순서

### 단계 의존성

- **설정(1단계)**: 즉시 시작 가능, 선행 의존성 없음
- **기반 작업(2단계)**: 설정 완료 후 시작하며 모든 사용자 스토리를 막는다
- **사용자 스토리 1(3단계)**: 기반 작업 이후 시작하며 MVP 조각을 정의한다
- **사용자 스토리 2(4단계)**: US1의 전송/스냅샷 인프라에 의존한다
- **사용자 스토리 3(5단계)**: US1의 방 생명주기와 UI 셸에 의존한다
- **마감(6단계)**: 현재 배포하려는 사용자 스토리들이 완료된 뒤 진행한다

### 사용자 스토리 의존성

- **사용자 스토리 1(P1)**: 이후 스토리에 의존하지 않는 MVP
- **사용자 스토리 2(P2)**: US1의 authoritative 방/스냅샷 흐름 위에 쌓인다
- **사용자 스토리 3(P3)**: US1의 방 생명주기와 UI 표면 위에 쌓인다

### 각 사용자 스토리 내부 규칙

- 계약 테스트와 엔드투엔드 테스트는 반드시 먼저 작성하고 실패를 확인해야 한다
- 공유 도메인/값 객체/집합체가 애플리케이션 서비스보다 먼저 온다
- 애플리케이션 서비스가 `Socket.IO` 핸들러와 UI 어댑터보다 먼저 온다
- 서버 authoritative 동작이 먼저 있어야 클라이언트 렌더링을 연결할 수 있다
- 다음 우선순위로 넘어가기 전에 해당 스토리 테스트가 모두 통과해야 한다

### 병렬 작업 기회

- T001 이후 T002, T003, T004는 병렬 가능
- T005 이후 T006, T007은 병렬 가능
- US1에서는 T011, T012를 병렬로 진행할 수 있고, 서버 핸들러가 잡히면 T016, T017도 병렬 가능
- US2에서는 T020, T021을 T022 이전에 병렬로 진행 가능
- US3에서는 T025, T026을 T027 이전에 병렬로 진행 가능
- T031, T032는 원하는 사용자 스토리가 완료된 뒤 병렬 가능

---

## 병렬 실행 예시: 사용자 스토리 1

```bash
# 먼저 실패 테스트 두 개를 동시에 준비
Task: "T011 [US1] apps/server/tests/contracts/us1-race-flow.contract.test.ts에 실패 계약 테스트 작성"
Task: "T012 [US1] tests/e2e/us1-race-flow.spec.ts에 실패 멀티 브라우저 테스트 작성"

# 서버 흐름이 잡히면 UI 작업을 분리
Task: "T016 [US1] apps/web/src/features/session/NicknameGate.tsx와 apps/web/src/features/rooms/RoomListPanel.tsx 구현"
Task: "T017 [US1] apps/web/src/views/GameScreen.tsx와 apps/web/src/features/rooms/PlayerSidebar.tsx 구현"
```

---

## 구현 전략

### MVP 우선 전략 (사용자 스토리 1만 먼저)

1. 1단계 설정 완료
2. 2단계 기반 작업 완료
3. `tests -> domain -> services -> transport -> UI` 순서로 3단계 사용자 스토리 1 완료
4. 두 브라우저 레이스 루프를 엔드투엔드로 검증
5. 복구와 방 운영으로 넘어가기 전에 데모

### 점진적 전달 전략

1. 설정 + 기반 작업을 기본 아키텍처로 먼저 완성
2. 사용자 스토리 1을 첫 플레이 가능한 레이스 MVP로 출하
3. 사용자 스토리 2를 추가해 재접속 동작을 단단하게 만듦
4. 사용자 스토리 3을 추가해 방 운영성과 반복 플레이를 강화
5. 이 스토리들이 끝나기 전에는 비-MVP 아이디어를 활성 브랜치에 들이지 않음

### 병렬 팀 전략

여러 개발자가 있을 때:

1. 한 명은 2단계에서 `packages/shared`와 서버 집합체를 맡는다
2. 다른 한 명은 2단계 이후 웹 셸과 스토어 경계를 준비한다
3. US1 서버 핸들러가 안정되면 프론트엔드 게임 렌더링과 일반 UI 작업을 분리한다
4. DDD 경계를 유지한다. 도메인 변경은 UI 코드보다 먼저 공유 계약과 서버 집합체를 거쳐야 한다

---

## 메모

- 모든 작업은 명시적인 파일 경로를 포함하며, 사람과 LLM 모두 바로 실행할 수 있다
- 이 기능에서는 TDD가 필수다. 실패 테스트 단계를 건너뛰지 않는다
- DDD는 작업 순서로 강제된다. 도메인/집합체 작업이 전송과 표현 작업보다 먼저 온다
- `ROOM_STATE_UPDATE`는 복구의 기준점이며, 클라이언트 렌더 상태는 항상 버릴 수 있어야 한다
- 권장 MVP 범위는 **Phase 1 + Phase 2 + Phase 3**이다
- US1이 안정되기 전에는 채팅, 꾸미기, 리플레이, 스케일링 인프라를 추가하지 않는다
