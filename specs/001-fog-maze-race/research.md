# Phase 0 조사: Fog Maze Race MVP

**기능 문서**: [spec.md](./spec.md)
**작성일**: 2026-03-22

## 결정 1: 프론트엔드 셸은 `React 19 + Vite 7 + TypeScript`를 사용한다

**결정**: 브라우저 클라이언트는 `Vite`로 구성한 `React` 애플리케이션으로 만들고,
`TypeScript`로 작성한다.

**근거**: 닉네임 입력, 방 목록, 플레이어 목록, 상태 배너, 결과 오버레이처럼 캔버스 밖 UI는
`React`가 가장 잘 맞는다. `Vite`는 초기 구성이 가볍고 반복 속도가 빠르며, 현재 가이드가
`React` 템플릿과 모노레포 친화적인 프로젝트 구조를 잘 지원한다.

**검토한 대안**:
- `Next.js`: MVP는 SEO 중심 사이트가 아니라 같은 오리진에서 동작하는 실시간 앱이라서
  프레임워크가 과하다.
- 순수 `TypeScript DOM` 렌더링: 더 가볍지만 방 흐름과 오버레이 UI를 빠르게 반복하기 어렵다.

## 결정 2: 게임 렌더링은 풀 엔진 대신 `PixiJS 8`을 사용한다

**결정**: 미로, 안개, 플레이어 마커는 전용 `GameCanvas` 모듈 안에서 `PixiJS 8`으로
렌더링하고, 레이아웃과 UI는 계속 `React`가 담당한다.

**근거**: `PixiJS`는 렌더링 엔진 성격이 강해서, 게임 규칙을 서버에 두는 현재 아키텍처와
맞는다. 렌더 루프와 retained scene graph만으로도 2D 격자 게임을 충분히 다룰 수 있고,
물리 엔진이나 클라이언트 게임 규칙까지 끌어오지 않아도 된다.

**검토한 대안**:
- `Canvas 2D` 직접 구현: 가능하지만 장면 구성, 자산 처리, 리드로우 관리가 즉시 커스텀 작업이 된다.
- `Phaser`: 클라이언트 중심 게임 로직엔 강하지만, 단순 2D 렌더링을 하는 서버 authoritative 격자 레이스엔 범위가 크다.

## 결정 3: 백엔드 런타임은 `Node.js 22 LTS` 위의 `Fastify 5`를 사용한다

**결정**: 백엔드의 HTTP 서버와 애플리케이션 셸은 `Fastify`로 구성한다.

**근거**: `Fastify`는 가벼운 플러그인 구조, 스키마 친화적인 라우트 처리, 내장 로깅을 제공해서
MVP 웹 서비스에 적합하다. 또한 한 프로세스 안에서 헬스 체크와 WebSocket 업그레이드를 함께
노출하기 좋다.

**검토한 대안**:
- `Express`: 인지도는 높지만 플러그인 구조, 검증, 로깅 면에서 약하다.
- `NestJS`: 강력하지만 MVP를 빨리 출하하는 데 필요한 범위를 넘는 프레임워크 비용이 있다.

## 결정 4: 실시간 전송은 `Socket.IO room + snapshot recovery`를 사용한다

**결정**: 같은 HTTP 서버 위에 `Socket.IO 4.x`를 올리고, 각 게임 방을 `Socket.IO room`으로
모델링한다. 연결 상태 복구 기능은 켜되, 최종 복구 기준은 항상 전체 방 스냅샷으로 둔다.

**근거**: `Socket.IO`는 room 브로드캐스트, 재접속 처리, 연결 상태 복구 기능을 기본 제공한다.
문서에서도 일시적 끊김과 이벤트 누락, 복구 실패 가능성을 명시하고 있어 헌장 원칙과 맞다.
즉, 반응성을 위해 델타 이벤트를 쓰더라도 최종 복구는 전체 스냅샷 경로가 필요하다.

**검토한 대안**:
- 순수 `ws`: 더 저수준이라 유연하지만, room fan-out과 복구를 직접 많이 구현해야 한다.
- `Colyseus`: 제공 기능은 많지만 이번 MVP가 필요로 하지 않는 게임 프레임워크 성격이 강하다.

## 결정 5: 클라이언트 상태는 `Zustand` 스토어를 분리해 사용한다

**결정**: 두 개의 집중된 `Zustand` 스토어를 사용한다.

- `sessionStore`: 닉네임, `playerId`, 연결 상태, 얕은 클라이언트 설정을 저장한다.
- `roomStore`: 현재 방 스냅샷, 매치 스냅샷, revision, `React/PixiJS`가 쓰는 파생 선택자를 저장한다.

**근거**: `Zustand`는 작고 빠르며 slices 패턴으로 나누기 쉽다. `localStorage` 기반 닉네임과
플레이어 식별자 저장도 큰 상태 관리 프레임워크 없이 처리할 수 있다. 이렇게 해야 클라이언트
상태가 렌더링 중심으로 유지되고 authoritative 전이가 브라우저로 넘어가지 않는다.

**검토한 대안**:
- `Redux Toolkit`: 생태계는 강하지만 얇은 클라이언트 MVP에는 절차가 많다.
- `React Context`만 사용: 단순 플래그엔 괜찮지만, 방 스냅샷과 재접속 메타데이터가 늘어나면 불편하다.

## 결정 6: MVP 저장소는 메모리 상태로 유지한다

**결정**: 활성 방, 플레이어, 매치, 연결 유예 상태는 서버 메모리에 둔다. 맵 정의는 공유 패키지의
버전 관리되는 상수로 저장하고, 브라우저 `localStorage`는 닉네임과 `playerId`에만 사용한다.

**근거**: MVP는 계정, 장기 기록, 분석용 보존, 경기 이력 영속화가 필요하지 않다. 메모리 상태가
플레이 가능한 authoritative 버전을 가장 빨리 만들 수 있는 방식이다. 또한 초기 구현의 중심을
게임 흐름에 두고 스키마 설계와 마이그레이션으로 새지 않게 해 준다.

**검토한 대안**:
- `PostgreSQL`: 영속성이 중요해질 때는 유용하지만, 일회성 방에는 불필요하다.
- `Redis`나 `Render Key Value`를 처음부터 사용: 다중 인스턴스 복구엔 도움이 되지만, MVP
  검증 전 단계에선 인프라 비용이 앞선다.

## 결정 7: 배포는 단일 `Render Web Service`로 시작한다

**결정**: 초기 MVP는 빌드된 프론트엔드와 `Fastify + Socket.IO`를 같은 오리진에서 제공하는
단일 `Render Web Service`로 배포한다.

**근거**: 운영 표면적을 최소화하고, CORS나 교차 오리진 쿠키 문제를 피하며, WebSocket URL도
같은 오리진으로 단순하게 맞출 수 있다. `Render`는 공개 WebSocket 연결을 지원하고, 초기
플레이 가능한 릴리스에는 서비스 하나면 충분하다.

**검토한 대안**:
- `Render Static Site + Web Service` 분리: 정적 자산 분리엔 좋지만 초기부터 배포와 교차 오리진 구성이 복잡해진다.
- `Fly.io` 멀티 리전: 제어권은 높지만 MVP에는 운영 결정이 과도하다.

**확장 메모**: `Render` 문서는 재접속 사용자가 같은 인스턴스에 붙는 것이 보장되지 않고, 배포나
유지보수 중 인스턴스가 교체될 수 있다고 안내한다. 그래서 MVP는 의도적으로 단일 인스턴스만
사용한다. 수평 확장이 필요해지면 공유 세션 저장소와 다중 인스턴스용 `Socket.IO` 어댑터를
후속 과제로 둔다.

## 결정 8: 테스트는 `Vitest`와 `Playwright`를 사용한다

**결정**: 단위/통합 테스트는 `Vitest`, 엔드투엔드 멀티 클라이언트 흐름은 `Playwright`를 사용한다.

**근거**: `Vitest`는 `Vite/TypeScript` 스택과 잘 맞고 피드백이 빠르다. `Playwright`는 이
프로젝트의 핵심 리스크를 직접 검증하기 가장 좋다. 예를 들면 같은 방에 두 명 이상 입장,
동기화된 카운트다운, 레이스 진행, 재접속 복구, 결과 후 초기화 같은 흐름이다.

**검토한 대안**:
- `Jest`: 가능하지만 현대적인 `Vite` 중심 스택과의 정렬이 덜하다.
- `Cypress`: 단일 사용자 브라우저 흐름엔 괜찮지만, 멀티 컨텍스트 실시간 레이스 검증엔 덜 적합하다.

## 권장 스택 요약

- **프론트엔드**: `React 19 + Vite 7 + TypeScript`
- **게임 렌더링**: 전용 imperative scene controller를 둔 `PixiJS 8`
- **백엔드**: `Node.js 22 LTS` 위의 `Fastify 5 + Socket.IO 4.x`
- **상태 관리**: 영속 세션 상태와 일회성 방/게임 상태로 나눈 `Zustand`
- **저장 방식**: 메모리 런타임 상태 + 공유 맵 파일 + 식별자용 `localStorage`
- **배포**: 단일 `Render Web Service`, 단일 인스턴스, 같은 오리진의 프론트엔드와 실시간 백엔드

## 참고 자료

- [Vite 시작하기](https://vite.dev/guide/)
- [PixiJS Quick Start](https://pixijs.com/8.x/guides/getting-started/quick-start)
- [PixiJS Render Loop](https://pixijs.com/8.x/guides/concepts/render-loop)
- [PixiJS Ecosystem](https://pixijs.com/8.x/guides/getting-started/ecosystem)
- [Fastify 시작하기](https://fastify.dev/docs/latest/Guides/Getting-Started/)
- [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/)
- [Socket.IO 연결 끊김 처리](https://socket.io/docs/v4/tutorial/handling-disconnections)
- [Socket.IO Rooms](https://socket.io/docs/v4/rooms)
- [Socket.IO Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery)
- [Zustand 소개](https://zustand.docs.pmnd.rs/getting-started/introduction)
- [Zustand Persist 미들웨어](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- [Render WebSockets](https://render.com/docs/websocket)
