# Fog Maze Race Render 배포 가이드

## 목적

이 문서는 `Fog Maze Race`를 Render에 배포할 때 필요한 최소 설정과 운영 전제를 정리합니다.

현재 프로젝트는 프로덕션에서 다음 구조를 사용합니다.

- 단일 Docker 이미지
- `apps/server`가 API, WebSocket, 정적 웹 파일을 함께 제공
- `apps/web/dist`를 서버가 직접 서빙

즉 Render에는 `Web Service` 1개만 올리면 됩니다.

## 현재 배포 구조

코드 기준 동작은 다음과 같습니다.

- 서버는 `WEB_DIST_PATH`가 가리키는 웹 빌드 산출물을 정적으로 서빙합니다.
- SPA 라우팅은 서버의 `index.html` fallback으로 처리합니다.
- Docker 이미지에는 서버 런타임과 웹 빌드 결과가 함께 포함됩니다.

관련 파일:

- [apps/server/src/app/server.ts](../apps/server/src/app/server.ts)
- [Dockerfile](../Dockerfile)
- [docker-compose.yml](../docker-compose.yml)

## Render에 맞는 운영 전제

이 프로젝트는 런타임 상태를 메모리에 보관합니다.

- 방 목록
- 플레이어 세션
- 진행 중 매치 상태

따라서 Render Free 인스턴스가 슬립되거나 재시작되면 기존 방과 진행 상태는 초기화됩니다.

이 프로젝트를 다음 용도로 쓸 때는 Free 플랜도 충분합니다.

- 지인 테스트
- 데모
- 내부 검수
- 기존 방이 날아가도 괜찮은 운영

다만 아래는 알고 시작해야 합니다.

- 첫 접속 시 서버가 깨어나는 동안 대기 시간이 있을 수 있습니다.
- 기존 방, 경기 중 상태, 연결 복구 정보는 유지되지 않습니다.
- `data/maps.json` 같은 로컬 파일 변경도 영속적이지 않을 수 있습니다.

관리자 맵 편집 결과까지 유지하려면 Render 유료 플랜의 persistent disk 또는 외부 저장소가 필요합니다.

## 배포 방식

권장 방식은 `GitHub repo -> Render Web Service -> Dockerfile build` 입니다.

이 저장소는 이미 Docker 기반 프로덕션 실행 경로를 갖고 있으므로, Render에서 `Language: Docker`로 배포하는 편이 가장 단순합니다.

저장소 루트에는 바로 사용할 수 있는 Render Blueprint 파일도 포함합니다.

- [render.yaml](../render.yaml)

자동 배포 기준 권장값:

- 프로덕션 배포 브랜치: `main`
- Render Auto-Deploy: `After CI Checks Pass`
- CI: GitHub Actions

`main`을 실제 운영 배포 브랜치로 두고, 테스트용 브랜치가 필요하면 별도 Render 서비스에 다른 브랜치를 연결하는 편이 관리가 단순합니다.

현재 저장소의 `render.yaml`은 `buildFilter.paths`를 사용합니다. 따라서 문서, 테스트, Playwright 설정처럼 런타임 산출물에 직접 영향이 없는 변경만 있을 때는 Render가 새 배포를 시작하지 않는 것이 정상입니다.

자동 배포가 실제로 시작되는 조건은 다음과 같습니다.

1. `main` 브랜치에 푸시
2. GitHub Actions CI 전체 성공
3. 변경 파일이 `buildFilter.paths`에 포함됨
4. Render가 새 deploy를 시작

즉 `README`, `docs`, `tests`만 바뀐 커밋은 `main`에 올라가도 자동배포가 생략될 수 있습니다.

## 사전 준비

- GitHub 저장소 push 완료
- Render 계정 준비
- 배포 대상 브랜치 결정

선택 사항:

- 커스텀 맵을 유지해야 하면 유료 플랜 + persistent disk 준비

## Render 서비스 생성

### 1. 서비스 타입

- `New > Web Service`

### 2. 소스 선택

- GitHub 저장소 연결
- 이 저장소 선택

### 3. 기본 설정

권장값:

- Name: `fog-maze-race`
- Branch: `main`
- Region: 사용자와 가까운 리전
- Language: `Docker`
- Dockerfile Path: `Dockerfile`

Auto-Deploy 권장값:

- `After CI Checks Pass`

별도 Build Command / Start Command는 필요 없습니다.

현재 Dockerfile의 `CMD`가 그대로 사용됩니다.

## 환경변수

필수는 많지 않습니다.

기본 권장값:

```text
APP_VERSION=render
```

선택 변수:

```text
FORCED_MAP_ID=
COUNTDOWN_STEP_MS=
RESULTS_DURATION_MS=
RECOVERY_GRACE_MS=
```

포트 관련 메모:

- 서버는 `process.env.PORT`를 우선 사용합니다.
- Render는 웹 서비스에 `PORT`를 주입합니다.
- 별도 사유가 없으면 `PORT`는 Render 기본 동작에 맡기면 됩니다.

## 디스크와 데이터

현재 런타임 데이터 파일 경로는 다음과 같습니다.

```text
/app/data/maps.json
```

이 경로는 Docker 이미지 안에 포함되지만, Render Free에서는 로컬 파일 변경을 영구 저장한다고 가정하면 안 됩니다.

정리:

- Free 플랜: 커스텀 맵 저장 결과가 재배포/재시작/슬립 후 사라질 수 있음
- Paid 플랜 + persistent disk: `/app/data`를 영속 디스크로 연결 가능

커스텀 맵 유지가 중요하지 않다면 Free 플랜으로 그대로 운영해도 됩니다.

## 배포 후 확인 항목

최소 확인 순서:

1. `/health` 응답 확인
2. 메인 페이지 로딩 확인
3. 방 생성 확인
4. 다른 브라우저에서 방 입장 확인
5. 경기 시작 후 WebSocket 이벤트 정상 동작 확인
6. 결과 모달 표시와 `새 게임 준비` 버튼 동작 확인

헬스 체크 예시:

```text
https://<service-name>.onrender.com/health
```

정상 예시:

```json
{
  "ok": true,
  "service": "fog-maze-race",
  "version": "render",
  "uptimeSeconds": 12
}
```

## 자동배포가 안 붙는 것처럼 보일 때

다음 순서로 확인합니다.

1. GitHub Actions 최신 `main` 런이 모두 초록인지 확인
2. Render 서비스의 연결 브랜치가 `main`인지 확인
3. Render Auto-Deploy가 `After CI Checks Pass`인지 확인
4. 이번 커밋에서 바뀐 파일이 `render.yaml`의 `buildFilter.paths` 대상인지 확인
5. Render `Events`에서 해당 커밋 SHA 기준 deploy가 생성됐는지 확인

예를 들어 `tests/**`, `docs/**`, `README.md`만 바뀐 경우에는 자동배포가 생략되는 편이 맞습니다.

## Free 플랜 운영 팁

- 기존 방 상태가 날아가도 괜찮다면 keepalive 없이 운영해도 됩니다.
- 사용자가 오랜만에 접속하면 Render가 서버를 다시 깨우는 동안 대기 시간이 생길 수 있습니다.
- 이 프로젝트는 그 상황에서도 새로 접속한 사용자가 다시 로비부터 시작하는 운영을 전제로 두는 편이 맞습니다.

추천 운영 원칙:

- 방 상태 유지보다 배포 단순성을 우선한다
- 테스트/데모 환경으로 사용한다
- 운영 데이터 저장은 기대하지 않는다

## 로컬 Docker와의 차이

로컬 Compose는 다음처럼 `./data`를 `/app/data`에 마운트해 맵 데이터를 유지합니다.

```yaml
volumes:
  - ./data:/app/data
```

반면 Render Free는 이 로컬 볼륨 마운트 방식이 없으므로, 같은 방식의 파일 영속성을 기대하면 안 됩니다.

## 문제 해결

### 첫 접속이 느리다

Free 인스턴스 슬립 후 재기동일 가능성이 큽니다. 잠시 기다린 뒤 새로고침합니다.

### 방이 사라졌다

현재 구조상 정상입니다. 방/세션/매치 상태는 메모리 기반입니다.

### 관리자 맵이 유지되지 않는다

`/app/data/maps.json` 변경이 영속 저장되지 않은 상태입니다. Free 플랜에서는 예상 가능한 동작입니다.

### 소켓 연결이 불안정하다

서버가 재시작되면 기존 연결 복구는 보장되지 않습니다. 페이지 새로고침 후 다시 입장하는 흐름을 기본으로 봅니다.

## 추후 개선 후보

- Redis 기반 세션/룸 저장소 분리
- 관리자 맵 저장소를 DB 또는 object storage로 이전
- Render Blueprint 또는 IaC 템플릿 추가
- 배포 후 점검 체크리스트 자동화
