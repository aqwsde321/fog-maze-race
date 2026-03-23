# TODO

Fog Maze Race의 다음 작업과 `v0.1.0` 릴리즈 준비 체크리스트입니다.

## 현재 상태

- 현재 루트 버전: `0.1.0`
- Git 태그: 없음
- 릴리즈 문서: `CHANGELOG.md`, `docs/releases/v0.1.0.md` 존재
- `RELEASE.md`, `.github/workflows/*` 부재
- README는 존재하지만, `specs/*` 문서와 일부 내용 정리가 더 필요함

## 우선 작업

### 1. CI 추가

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Docker 이미지 빌드 검증

목적:

- PR 단계에서 기본 품질 게이트 확보
- 배포 전 회귀 방지

### 2. 환경 설정 예제 추가

- `.env.example` 추가
- README의 환경변수 표와 실제 예제 파일 동기화

후보 변수:

- `PORT`
- `APP_VERSION`
- `MAP_STORE_PATH`
- `WEB_DIST_PATH`
- `VITE_HOST`
- `VITE_PORT`
- `VITE_PROXY_TARGET`
- `APP_PORT`

### 3. 배포 설정 파일 추가

- Render 기준 `render.yaml` 또는 배포 가이드 추가
- 영속 데이터(`data/maps.json`) 마운트/보존 전략 명시

### 4. 문서 동기화

- `README.md`와 `specs/001-fog-maze-race/quickstart.md` 내용 정렬
- 현재 구현 기준으로 `specs/*` 변경분 검토 및 반영
- LAN 접속, Docker 스크립트, 운영 포트 정보 일치 여부 재검토

### 5. 운영 편의성 보강

- 현재 머신 LAN 주소를 보여주는 스크립트 추가 검토
- 배포 후 점검 체크리스트 문서화

## v0.1.0 릴리즈 준비 체크리스트

### 릴리즈 전

- `specs/*` 미커밋 변경 정리
- `pnpm typecheck` 통과
- `pnpm test` 통과
- 필요 시 `pnpm test:e2e` 통과
- `pnpm docker:up` 기준 실행 확인
- README와 실행 명령 최신화 확인

### 릴리즈 산출물

- Git 태그 생성: 예시 `v0.1.0`
- 릴리즈 노트 검토 및 최종화
- 변경 사항 요약 검토
- 알려진 제약 사항 기록

### 릴리즈 노트에 포함할 항목

- 프로젝트 소개
- 이번 버전 핵심 기능
- Docker/Compose 실행 지원
- LAN 개발 접속 지원
- 관리자 맵 편집 기능
- 현재 제약 사항
  - 단일 인스턴스 전제
  - 메모리 기반 런타임 상태
  - `data/maps.json` 기반 맵 저장

## 릴리즈 문서 후속 작업

- `CHANGELOG.md` 내용 검토
- `docs/releases/v0.1.0.md`를 초안에서 최종본으로 확정
- 필요하면 `RELEASE.md`로 릴리즈 절차 문서 추가
