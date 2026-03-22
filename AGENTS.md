# fog-maze-race 개발 가이드

모든 기능 계획 문서를 기준으로 자동 생성되었으며, 마지막 갱신일은 2026-03-22 입니다.

## 현재 사용 기술

- `TypeScript`
- `Node.js 22 LTS`
- `React 19`
- `Vite 7`
- `PixiJS 8`
- `Fastify 5`
- `Socket.IO 4.x`
- `Zustand`
- `Vitest`
- `Playwright`

## 프로젝트 구조

```text
apps/server/
apps/web/
packages/shared/
tests/e2e/
```

## 주요 명령어

```bash
pnpm dev
pnpm test
pnpm test:e2e
pnpm build
```

## 코드 스타일

- `TypeScript`와 `Node.js 22 LTS`의 일반적인 관례를 따른다.
- 프론트엔드와 백엔드 계약은 공유 패키지에서 정의하고 중복 선언을 피한다.

## 최근 변경 사항

- `001-fog-maze-race`: `TypeScript`, `Node.js 22 LTS`, `React 19`, `Vite 7`, `PixiJS 8`, `Fastify 5`, `Socket.IO 4.x`, `Zustand`, `Vitest`, `Playwright`를 추가했다.

<!-- MANUAL ADDITIONS START -->
- 항상 DDD 경계를 유지한다. 도메인 규칙은 UI나 전송 어댑터가 아니라 공유/서버의 도메인 및 애플리케이션 계층에 둔다.
- 새로운 동작은 항상 TDD로 구현한다. 먼저 실패하는 자동화 테스트를 작성하고, 관련 테스트가 모두 통과하기 전에는 작업을 완료로 보지 않는다.
<!-- MANUAL ADDITIONS END -->
