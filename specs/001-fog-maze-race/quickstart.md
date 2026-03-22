# 빠른 시작: Fog Maze Race MVP

## 목적

로컬 환경에서 플레이 가능한 MVP를 실행하고, 세 개의 사용자 스토리를 검증한 뒤,
웹 클라이언트와 `Socket.IO` 백엔드를 같은 오리진으로 제공하는 프로덕션 서버까지
실행할 수 있게 한다.

## 사전 준비

- `Node.js 22 LTS`
- `pnpm 10+`
- 최신 데스크톱 브라우저

## 워크스페이스 구조

```text
apps/server
apps/web
packages/shared
tests/e2e
```

## 기술 스택

- `apps/web`: `React 19`, `Vite 7`, `PixiJS 8`, `Zustand`
- `apps/server`: `Fastify 5`, `Socket.IO 4.x`
- `packages/shared`: 공유 계약, 맵 정의, 시야 규칙
- 테스트: `Vitest`, `Playwright`

## 로컬 개발

의존성을 설치하고 웹 클라이언트와 authoritative 서버를 함께 실행한다.

```bash
pnpm install
pnpm dev
```

- 웹 클라이언트: `http://127.0.0.1:4173`
- 서버 헬스 체크: `http://127.0.0.1:3000/health`

## 핵심 검증

필수 정적 검사와 자동화 테스트를 실행한다.

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

`tests/e2e`가 검증하는 핵심 브라우저 흐름:

- `us1-race-flow.spec.ts`: 방 생성/입장, 카운트다운, 이동, 완주, 대기 상태 복귀
- `us2-reconnect.spec.ts`: 연결 유예, 재접속 복구, 유예 초과 시 이탈
- `us3-room-admin.spec.ts`: 방 이름 변경, 방장 위임, 강제 종료, 대기 상태 복귀
- `perf-smoke.spec.ts`: 15인 입장 및 시작 스모크 테스트

참고:

- `pnpm test:e2e`는 로컬 개발 서버와 충돌하지 않도록 분리된 테스트용 포트에서 서버와 웹을 각각 띄운다.

## 프로덕션 빌드

모든 워크스페이스를 빌드한 뒤 프로덕션 서버를 실행한다.

```bash
pnpm build
pnpm start
```

프로덕션 동작:

- `apps/web/dist`를 `apps/server`가 정적으로 서빙한다.
- `Socket.IO`는 페이지와 같은 오리진을 사용한다.
- 헬스 체크는 `GET /health`로 계속 제공된다.

## 수동 MVP 체크리스트

- 두 명 이상의 플레이어가 대기 중인 방을 생성하고 입장할 수 있다.
- 방장만 시작, 이름 변경, 강제 종료를 수행할 수 있다.
- 서버 authoritative 이동이 벽을 막고 위치를 브로드캐스트한다.
- 안개 시야가 시야 밖 미로 플레이어를 가리고, 완주자는 전체 맵을 본다.
- 유예 시간 안에 재접속하면 플레이어 상태와 위치가 복구된다.
- 나가기 또는 유예 초과는 경기 종료 계산에서 제외된다.
- 결과 화면은 완주 순위 또는 `나감`을 보여준 뒤 방을 `waiting`으로 되돌린다.

## 배포 형태

- 단일 `Render Web Service`
- 같은 오리진으로 정적 파일과 `Socket.IO` 전송 제공
- MVP 단계에서는 단일 인스턴스만 사용
- 닉네임과 플레이어 식별자는 클라이언트 `localStorage`, 런타임 상태는 서버 메모리 사용

영속 방, 무중단 복구, 다중 인스턴스 확장이 필요해지면 외부 세션/상태 저장소와
다중 인스턴스용 `Socket.IO` 어댑터를 후속 단계로 추가한다.
