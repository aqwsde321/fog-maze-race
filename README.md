# Fog Maze Race

여러 사용자가 제한된 시야 안에서 같은 미로를 달리는 실시간 멀티 레이스 게임입니다.

- `Fastify + Socket.IO` authoritative 서버
- `React + PixiJS` 기반 웹 클라이언트
- 공유 계약과 맵 정의를 가진 모노레포 구조
- 관리자 맵 편집 기능 제공

## 빠른 시작

사전 준비:

- `Node.js 22 LTS`
- `pnpm 10+`
- 최신 데스크톱 브라우저
- Docker 실행 시 `Docker` / `Docker Compose`

설치:

```bash
pnpm install
```

자주 쓰는 명령:

```bash
pnpm dev
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm build
pnpm start
pnpm race:join
pnpm race:explore
pnpm race:fill
```

## 개발 모드

로컬 개발 서버와 게임 서버를 함께 실행합니다.

```bash
pnpm dev
```

기본 주소:

- 웹 클라이언트: `http://127.0.0.1:4173`
- 서버 헬스 체크: `http://127.0.0.1:3000/health`
- 관리자 맵 URL: `http://127.0.0.1:4173/admin/maps`

개발 모드에서 웹은 Vite 프록시를 통해 `3000` 포트 서버와 통신합니다.

## Codex 레이스 봇

게임 방에 자동으로 참가시켜 함께 테스트하거나 플레이할 수 있는 CLI 봇을 제공합니다.

기본 실행:

```bash
pnpm race:join
```

탐험형 봇 실행:

```bash
pnpm race:explore
```

내가 만든 봇 전용 방 자동 채우기:

```bash
pnpm race:fill -- --room Alpha --count 3 --names red,blue,green
```

자주 쓰는 예시:

```bash
RACE_BOT_COUNT=2 pnpm race:join
RACE_BOT_ROOM=Alpha pnpm race:join
RACE_BOT_JOIN_MESSAGE="들어왔다." RACE_BOT_FINISH_MESSAGE="도착했다." pnpm race:join
RACE_BOT_URL=http://127.0.0.1:3000 pnpm race:join
RACE_BOT_AUTOPILOT=false pnpm race:join
RACE_BOT_ROOM=Alpha pnpm race:explore
pnpm race:fill -- --room Alpha --count 3
pnpm race:fill -- --room Alpha --names red,blue,green
pnpm race:fill -- --room Alpha --bot join --count 2
pnpm race:fill -- --room Alpha --create --count 3
```

동작 요약:

- 기본 닉네임은 `Codex`이며 서버 규칙에 맞춰 최대 5자로 사용
- `RACE_BOT_COUNT` 또는 `--count`로 여러 봇을 동시에 띄울 수 있음
- 지정한 방 이름이 있으면 해당 `waiting` 방만 기다렸다가 입장
- 방 이름을 지정하지 않으면 첫 번째 `waiting` 방에 입장
- 기본적으로 방 입장 시 `들어왔다.`, 완주 시 `도착했다.` 채팅을 자동 전송
- `playing` 상태가 되면 기본적으로 목표 지점까지 자동 주행
- 표준 입력으로 `status`, `chat <메시지>`, `auto on`, `auto off`, `leave`, `quit` 명령 사용 가능
- `pnpm race:fill`의 기본 동작은 내가 UI에서 만든 `waiting` 방을 기다렸다가 봇만 자동으로 채우는 것임
- `--create`는 보조 옵션이며, 이 경우 봇 매니저가 직접 `bot_race` 방을 만들고 호스트를 가져감
- `--names`를 주면 그 이름들을 우선 사용하고, 이름 수가 `--count`보다 많으면 이름 수에 맞춰 자동으로 인원 수가 늘어남
- `pnpm race:fill` 실행 중 표준 입력으로 `status`, `start`, `chat <메시지>`, `leave`, `quit` 명령 사용 가능
- 방 안에서는 방장이 UI로 봇 종류와 이름을 편집해 직접 추가하고, 현재 봇을 개별/일괄 제거할 수 있음
- 일반 방에서는 사람과 같이 뛰는 봇을 추가하고, 봇 전용 방에서는 관전 상태를 유지한 채 봇만 채울 수 있음
- 탐험형 봇은 goal을 처음부터 보지 않고, 현재 시야에 들어온 타일만 기억하면서 BFS + frontier 탐색으로 움직임
- 탐험형 봇은 모든 레이서가 같은 시작 슬롯에서 출발하더라도, seed별 진입 행과 근접 후보군 분산, 넓은 시야에서의 동점 goal 경로 분산으로 움직임이 갈라짐
- 최근 경로 패널티와 막힌 방향 벽 학습으로 3x3 시야에서 왕복 루프를 줄임
- 마지막 사람 플레이어가 방을 떠나면 남아 있는 봇은 서버에서 함께 정리됨

닉네임 참고:

- 서버 닉네임 제한이 5자라서 기본 멀티 봇일 때는 `bot1`, `bot2`, `bot3`처럼 생성됩니다.

자세한 사용법은 [Codex 레이스 봇 가이드](./docs/race-bot.md) 참고.

## Docker / Compose

단일 컨테이너가 웹 정적 파일과 API/WebSocket 서버를 함께 제공합니다.

```bash
pnpm docker:build
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:stop
pnpm docker:remove
```

기본 Compose 포트:

- 웹 + API + WebSocket: `http://127.0.0.1:3300`
- 관리자 맵 URL: `http://127.0.0.1:3300/admin/maps`

맵 편집 데이터는 `./data` 디렉터리를 컨테이너의 `/app/data`에 마운트해 유지합니다.

## LAN 접속

`pnpm dev`의 웹 서버는 기본적으로 `0.0.0.0`에 바인딩되어 같은 공유기 안의 다른 기기에서 접속할 수 있습니다.

- 로컬 개발 서버 예시: `http://<내_LAN_IP>:4173`
- Docker Compose 예시: `http://<내_LAN_IP>:3300`

접속이 안 되면 다음을 먼저 확인합니다.

- 현재 머신의 LAN IP를 확인했는지
- 서버가 실제로 실행 중인지
- macOS 방화벽이 로컬 인바운드를 막고 있지 않은지
- 공유기에 AP 격리 같은 설정이 켜져 있지 않은지

## 프로덕션 실행

프로덕션 산출물을 만든 뒤 서버가 정적 웹 자산까지 함께 서빙합니다.

```bash
pnpm build
pnpm start
```

현재 운영 구조:

- `apps/server`가 `apps/web/dist`를 정적으로 서빙
- `Socket.IO`는 페이지와 같은 오리진 사용
- 단일 인스턴스 전제
- 관리자 맵 데이터는 기본적으로 `data/maps.json` 사용

## 프로젝트 구조

```text
apps/server      Fastify + Socket.IO 서버
apps/web         React + PixiJS 클라이언트
packages/shared  공유 계약, 도메인 타입, 맵/시야 규칙
tests/e2e        Playwright 종단간 테스트
scripts/docker   Docker Compose 제어 스크립트
specs            기능 명세와 상세 설계 문서
```

## 환경변수

현재 저장소에는 `.env` 파일이 없고, `.env` 및 `.env.*`는 Git 업로드 제외 대상입니다. 필요하면 셸 환경변수나 Docker Compose 변수로 주입하면 됩니다.

| 변수명 | 용도 | 기본값 |
| --- | --- | --- |
| `PORT` | 서버 포트 | `3000` |
| `APP_VERSION` | `/health` 응답 버전 문자열 | `dev` |
| `MAP_STORE_PATH` | 관리자 맵 JSON 저장 위치 | `data/maps.json` |
| `WEB_DIST_PATH` | 서버가 서빙할 웹 빌드 산출물 경로 | `apps/web/dist` |
| `VITE_HOST` | 개발용 Vite 바인딩 호스트 | `0.0.0.0` |
| `VITE_PORT` | 개발용 웹 포트 | `4173` |
| `VITE_PROXY_TARGET` | 개발용 API/WebSocket 프록시 대상 | `http://127.0.0.1:3000` |
| `APP_PORT` | Docker Compose 호스트 공개 포트 | `3300` |
| `RACE_BOT_URL` | `pnpm race:join`, `pnpm race:explore` 대상 서버 URL | `http://127.0.0.1:3000` |
| `RACE_BOT_NICKNAME` | 봇 닉네임 | `Codex` |
| `RACE_BOT_COUNT` | 동시에 띄울 봇 수 | `1` |
| `RACE_BOT_ROOM` | 참가를 기다릴 방 이름 | 없음 |
| `RACE_BOT_NAMES` | `race:fill`에서 우선 사용할 봇 이름 목록 (`쉼표 구분`) | 없음 |
| `RACE_BOT_JOIN_MESSAGE` | 입장 직후 보낼 채팅 메시지 | `들어왔다.` |
| `RACE_BOT_FINISH_MESSAGE` | 완주 시 보낼 채팅 메시지 | `도착했다.` |
| `RACE_BOT_GREETING` | 구버전 입장 메시지 별칭 | `RACE_BOT_JOIN_MESSAGE` 참조 |
| `RACE_BOT_AUTOPILOT` | 자동 주행 사용 여부 (`false`면 비활성화) | `true` |
| `RACE_FILL_CREATE` | `race:fill`에서 봇 전용 방을 직접 생성할지 여부 | `false` |
| `RACE_FILL_BOT_KIND` | `race:fill`이 띄울 봇 종류 (`explore` 또는 `join`) | `explore` |
| `RACE_FILL_HOST_NICKNAME` | `race:fill` 컨트롤러 닉네임 | `host` |
| `RACE_FILL_TIMEOUT_MS` | `race:fill` 대기 제한 시간 | `30000` |

추가 서버 조정 변수:

- `COUNTDOWN_STEP_MS`
- `RESULTS_DURATION_MS`
- `RECOVERY_GRACE_MS`
- `FORCED_MAP_ID`

## 테스트

```bash
pnpm test
pnpm test:e2e
pnpm typecheck
```

검증 범위:

- 공유 도메인 규칙과 계약 테스트
- 서버 도메인/HTTP/실시간 계약 테스트
- 웹 UI와 게임 렌더링 테스트
- Playwright 기반 멀티 클라이언트 E2E 시나리오
- Docker 제어 스크립트 테스트

## 상세 문서

- [Render 배포 가이드](./docs/deploy-render.md)
- [Codex 레이스 봇 가이드](./docs/race-bot.md)
- [빠른 시작](./specs/001-fog-maze-race/quickstart.md)
- [기능 명세](./specs/001-fog-maze-race/spec.md)
- [실시간 이벤트 계약](./specs/001-fog-maze-race/contracts/realtime-events.md)
- [HTTP 엔드포인트 계약](./specs/001-fog-maze-race/contracts/http-endpoints.md)
- [스냅샷 계약](./specs/001-fog-maze-race/contracts/snapshots.md)
