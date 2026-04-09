# Speckit 작업 절차

새 Codex 세션에서 `Fog Maze Race` 초기 명세와 구현 계획을 만들 때 사용한 절차입니다.

## 1. 터미널 초기 설정

새 세션을 열면 먼저 아래를 실행합니다.

```bash
cd /Users/jino/study/project/fog-maze-race
export CODEX_HOME=/Users/jino/study/project/fog-maze-race/.codex
```

## 2. Codex 채팅 입력 순서

Codex 채팅 입력창에서 아래 순서대로 입력합니다.

### 2-1. 프로젝트 원칙 선언

```text
/speckit.constitution
이 프로젝트는 MVP 우선으로 빠르게 구현한다. 서버 authoritative를 기본 원칙으로 삼고, 클라이언트는 렌더링 중심으로 유지한다. 상태와 표현을 분리하고, 실시간 동기화는 이벤트와 스냅샷으로 복구 가능해야 한다. MVP 범위 밖 기능은 초기에 제외한다.
```

### 2-2. 기능 명세 생성

```text
/speckit.specify
[방금 작성한 Fog Maze Race 기획서 전체 붙여넣기]
```

- `speckit`이 질문을 던지면 답변합니다.
- 명세가 끝나면 설계 단계로 넘어갑니다.

### 2-3. 구현 계획 생성

```text
/speckit.plan
기술 스택은 아직 정하지 않았다. 위 spec을 기준으로 MVP에 적합한 프론트엔드, 게임 렌더링, 서버, WebSocket 구조, 상태 관리, 배포 방식을 제안하고 구현 계획을 만들어줘.
```

## 3. 의도

- MVP 범위를 먼저 확정합니다.
- 서버 authoritative 구조를 흔들지 않고 초기 설계를 정리합니다.
- 구현 전에 명세와 계획 문서를 먼저 확보합니다.

## 4. 참고 문서

- [초기 MVP 명세서](./mvp-initial-spec.md)
- [기능 명세](../specs/001-fog-maze-race/spec.md)
- [빠른 시작](../specs/001-fog-maze-race/quickstart.md)
