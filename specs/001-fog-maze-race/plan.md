# 구현 계획: Fog Maze Race MVP

**브랜치**: `001-fog-maze-race` | **작성일**: 2026-03-22 | **스펙**: [spec.md](./spec.md)
**입력 문서**: `/specs/001-fog-maze-race/spec.md`

**메모**: 이 문서는 서버 authoritative 실시간 미로 레이스 MVP를 실제로 구현하기 위한
구체적인 기술 스택과 구조를 제안한다.

## 요약

MVP는 같은 오리진에서 동작하는 실시간 웹 애플리케이션으로 구현한다. `React`는 얇은 UI
셸을 담당하고, `PixiJS`는 미로와 안개 시야를 렌더링하며, `Fastify + Socket.IO`
백엔드는 모든 게임 상태를 authoritative하게 관리한다. 첫 번째 출하 범위에는 닉네임
저장, 방 생성/입장, `waiting -> countdown -> playing -> ended -> waiting` 흐름,
authoritative 이동 판정, 안개 시야 렌더링, 완주 순위, 재접속 복구, 결과 후 대기 상태
복귀가 포함된다. MVP 밖 기능은 계속 제외한다.

## 기술 맥락

**언어/버전**: `TypeScript`, `Node.js 22 LTS`
**주요 의존성**: `React 19 + Vite 7`, `PixiJS 8`, `Fastify 5`, `Socket.IO 4.x`, `Zustand`, `Vitest`, `Playwright`
**저장 방식**: 서버 메모리 기반 방/매치 상태, 저장소 내부 맵 정의 파일, 닉네임과 `playerId`용 `localStorage`
**테스트**: UI와 스토어 로직은 `Vitest`, authoritative 규칙은 서버 계약 테스트, 레이스 흐름과 재접속 복구는 `Playwright` 멀티 브라우저 테스트
**대상 플랫폼**: 최신 데스크톱/모바일 브라우저, Linux 기반 `Node.js` 웹 서비스
**프로젝트 유형**: 프론트엔드, 백엔드, 공유 계약 패키지를 분리한 실시간 웹 애플리케이션
**아키텍처 스타일**: `packages/shared`와 `apps/server/src/core`에 명시적인 도메인 집합체를 두는 DDD-lite 구조. 애플리케이션 서비스는 방/매치 서비스에 두고, `Socket.IO` 핸들러와 `React/PixiJS` UI는 어댑터로만 사용
**권한 모델**: 방 생명주기, 카운트다운, 이동 검증, 완주 순위, 연결 유예 처리는 서버가 최종 권한을 가진다
**테스트 규율**: TDD 필수. 실패하는 계약 테스트와 `Playwright` 시나리오를 먼저 만들고, 관련 테스트가 모두 통과해야 스토리를 완료로 본다
**동기화 복구**: `Socket.IO` 재연결 처리 + 전체 방 스냅샷 재동기화 + 서버가 보관하는 30초 연결 유예
**성능 목표**: 로컬 렌더링 60 FPS, 방당 최대 15명, 단일 리전에서 상태 전파 150ms 이하, 한 판 1~2분
**제약 사항**: MVP는 단일 백엔드 인스턴스만 사용, 인스턴스 간 상태 복제 없음, 클라이언트는 방향만 전송, 채팅/아이템/리플레이/커스터마이징 제외, 방 입장은 `waiting` 상태에서만 허용
**규모/범위**: 단일 리전 공개 MVP, 한 인스턴스에서 수십 개 방, 방당 활성 매치는 1개, 방당 동시 플레이어는 최대 15명

## 헌장 검증

*게이트: Phase 0 조사 전에 반드시 통과해야 하며, Phase 1 설계 후 다시 확인한다.*

- [x] 사용자 스토리 1을 독립적으로 출하 가능한 MVP 조각으로 정의했고, 비-MVP 작업은 뒤로 미뤘다.
- [x] 서버가 기본적으로 authoritative 상태, 규칙 판정, 충돌 해결을 소유한다.
- [x] 클라이언트 책임은 렌더링, 입력 수집, 표현으로 제한되며 예외가 있으면 명시한다.
- [x] 도메인/동기화 상태와 표현 상태를 명확한 모듈 경계로 분리했다.
- [x] 도메인 규칙은 전송 계층이나 UI보다 먼저 도메인/애플리케이션 계층에서 모델링한다.
- [x] 구현 완료 전에 반드시 통과해야 할 실패 테스트와 테스트 명령을 정의했다.
- [x] 실시간 기능에 이벤트 전파와 스냅샷 기반 복구 경로를 모두 포함했다.

설계 후 재검토 결과: 통과. 게임 규칙은 서버에 머물고, 클라이언트 상태는 렌더링용 투영으로만 사용되며, 델타 전달만으로 부족할 때는 전체 방 스냅샷이 복구 경로가 된다.

## 프로젝트 구조

### 기능 문서

```text
specs/001-fog-maze-race/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-endpoints.md
│   ├── realtime-events.md
│   └── snapshots.md
└── tasks.md
```

### 소스 코드

```text
apps/
├── server/
│   ├── src/
│   │   ├── app/
│   │   ├── core/
│   │   ├── rooms/
│   │   ├── matches/
│   │   ├── maps/
│   │   ├── ws/
│   │   └── http/
│   └── tests/
├── web/
│   ├── src/
│   │   ├── app/
│   │   ├── game/
│   │   ├── features/session/
│   │   ├── features/rooms/
│   │   ├── stores/
│   │   ├── services/
│   │   └── views/
│   └── tests/
packages/
└── shared/
    └── src/
        ├── contracts/
        ├── domain/
        ├── maps/
        └── visibility/
tests/
└── e2e/
```

**구조 결정**: authoritative 도메인 로직은 `apps/server`, 렌더링 중심 클라이언트는
`apps/web`, 공유 이벤트 타입/맵 정의/시야 헬퍼는 `packages/shared`에 둔다. 이렇게 해야
게임 규칙이 클라이언트로 새지 않고, 계약 타입도 중복하지 않는다.

## 복잡도 추적

헌장 위반은 없다. 가장 큰 트레이드오프는 MVP 속도를 위해 런타임 상태를 단일 인스턴스
메모리에 유지한다는 점이며, 수평 확장과 공유 세션 저장소는 의도적으로 뒤로 미뤘다.
