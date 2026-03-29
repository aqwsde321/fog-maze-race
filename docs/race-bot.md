# Codex 레이스 봇 가이드

`pnpm race:join`, `pnpm race:explore`, `pnpm race:fill`은 외부 게임 서버 또는 로컬 서버에 `Socket.IO` 클라이언트로 접속해 방에 참가시키는 CLI 도구입니다. 수동 플레이 보조, 멀티플레이 테스트, 간단한 자동 주행 검증에 사용합니다.

추가로, 이제 방 안에서는 방장이 UI로 직접 봇을 추가할 수 있습니다. CLI는 대량 자동화나 외부 프로세스 기반 검증이 필요할 때만 쓰면 됩니다.

## 실행 위치

리포지토리 루트에서 실행합니다.

```bash
pnpm race:join
```

탐험형 봇:

```bash
pnpm race:explore
```

내가 만든 봇 전용 방 자동 채우기:

```bash
pnpm race:fill -- --room Alpha --count 3
```

내부적으로는 빠른 최단 경로 봇 `apps/web/scripts/race-bot.mjs`, 시야 제한 탐험형 봇 `apps/web/scripts/race-bot-explorer.mjs`, 이를 감싸는 자동 채우기 매니저 `apps/web/scripts/race-bot-fill.mjs`를 사용합니다.

## 기본 동작

- 서버에 접속한 뒤 방 목록을 구독합니다.
- `RACE_BOT_ROOM` 또는 `--room`이 없으면 첫 번째 `waiting` 방에 참가합니다.
- 특정 방 이름이 지정되면 그 방이 `waiting` 상태가 될 때까지 기다립니다.
- 방 참가 후 기본적으로 `들어왔다.` 채팅을 한 번 보냅니다.
- 완주하면 기본적으로 `도착했다.` 채팅을 한 번 보냅니다.
- 게임 상태가 `playing`이 되면 기본적으로 목표 지점까지 자동 주행합니다.
- 표준 입력 명령으로 상태 확인, 채팅, 수동 이동, 종료를 제어할 수 있습니다.

## 두 봇의 차이

- `pnpm race:join`: 서버가 내려준 전체 맵을 기준으로 즉시 최단 경로를 계산합니다.
- `pnpm race:explore`: 현재 시야에서 보인 타일만 기억하고, 모르는 구역을 frontier 방식으로 탐험합니다.
- `pnpm race:fill`: 내가 UI에서 만든 대상 방을 기다렸다가, 지정한 수만큼 `join` 또는 `explore` 봇만 자동으로 띄웁니다.
- 기존 빠른 봇은 그대로 유지되고, 탐험형 봇은 별도 엔트리로 추가되었습니다.

## 탐험형 봇 길찾기 알고리즘

탐험형 봇은 전체 맵을 바로 풀지 않고, 현재 시야로 확인한 타일만 기억하면서 이동합니다.

의사결정 순서는 아래와 같습니다.

1. 현재 스냅샷에서 보이는 타일만 `knownTiles`에 반영합니다.
2. 현재 위치는 `visitCounts`와 최근 이동 기록에 저장합니다.
3. 아직 시작 구역이나 커넥터에 있으면, 봇마다 seed가 다른 진입 행을 먼저 택해 입구 분산을 유도합니다.
4. 이미 목표 구역 경로가 보이면 BFS로 목표까지 가장 짧은 경로를 택합니다.
5. 목표가 안 보이면, 바로 옆에 아직 모르는 칸이 있는지 먼저 확인하고 한 칸 탐색합니다.
6. 바로 탐색할 칸이 없으면, `unknown neighbor`를 가진 frontier 타일 중 도달 가능한 후보를 전부 찾습니다.
7. 각 frontier 후보는 아래 점수로 비교합니다.

- 경로 길이: 가까운 frontier를 우선합니다.
- 방문 횟수 패널티: 자주 간 칸은 덜 선호합니다.
- seed bias: 여러 봇이 같은 후보만 고르지 않도록 선호 행/열을 살짝 나눕니다.
- 최근 경로 패널티: 방금 지나온 칸이나 즉시 되돌아가는 경로는 큰 벌점을 줘서 3x3 같은 좁은 시야에서 왕복 반복을 줄입니다.

막힌 방향을 실제로 시도했다가 이동하지 못하면, 그 칸을 벽으로 기억하고 다음 탐색에서 제외합니다.

정리하면 탐험형 봇은 다음 조합입니다.

- `가시 타일 기억`
- `BFS 목표/프런티어 탐색`
- `시드 기반 분산`
- `최근 경로 패널티로 루프 완화`

그래서 `race:join`보다 느릴 수 있지만, 시야 제한을 지키는 테스트에는 더 가깝습니다.

## UI에서 봇 추가하기

권장 흐름:

1. 웹 UI에서 방을 만듭니다.
2. 방에 들어간 뒤, 방장만 보이는 `Bot Control` 영역에서 봇 종류와 이름을 확인합니다.
3. 기본 이름으로 채워진 입력값을 원하는 이름으로 수정합니다.
4. 일반 방이면 `봇 참가시키기`, 봇 전용 방이면 `봇 채우기`를 누릅니다.
5. 이미 들어온 봇은 같은 패널의 `현재 봇` 목록에서 개별 제거하거나 `모두 제거`할 수 있습니다.
5. 시작과 재시작은 계속 방장이 UI에서 직접 합니다.

UI 동작 메모:

- 기본적으로 `bot1`, `bot2`처럼 이름이 미리 채워집니다.
- 입력칸은 최대 5자까지 사용합니다.
- 일반 방에서는 사람과 봇이 함께 참가합니다.
- 봇 전용 방에서는 사람은 관전/호스트 역할을 유지하고 봇만 참가합니다.
- 현재는 `waiting` 상태일 때만 방장 UI에서 봇을 추가할 수 있습니다.
- 현재는 `waiting` 상태일 때만 방장 UI에서 봇을 제거할 수 있습니다.
- 마지막 사람 플레이어가 방을 떠나면 남아 있던 봇은 서버에서 함께 정리됩니다.

## 자주 쓰는 예시

기본 참가:

```bash
pnpm race:join
pnpm race:explore
pnpm race:fill -- --room Alpha --count 3
```

두 명 이상 동시에 참가:

```bash
RACE_BOT_COUNT=2 pnpm race:join
pnpm race:join -- --count 3
pnpm race:fill -- --room Alpha --count 3
```

특정 방 대기 후 참가:

```bash
RACE_BOT_ROOM=Alpha pnpm race:join
pnpm race:fill -- --room Alpha
```

추천 흐름:

1. 웹 UI에서 `봇 전용 방`을 원하는 이름으로 만듭니다.
2. 같은 이름으로 `pnpm race:fill -- --room 방이름 --count 3`를 실행합니다.
3. 봇이 모두 들어오면 시작과 재시작은 계속 UI에서 직접 합니다.

CLI가 꼭 필요하지 않다면 위 흐름보다 방 안의 `Bot Control` UI를 먼저 쓰는 편이 간단합니다.

로컬 서버 주소를 명시해서 접속:

```bash
RACE_BOT_URL=http://127.0.0.1:3000 pnpm race:join
RACE_BOT_URL=http://127.0.0.1:3000 pnpm race:explore
RACE_BOT_URL=http://127.0.0.1:3000 pnpm race:fill -- --room Alpha
```

입장 직후 채팅 보내기:

```bash
RACE_BOT_JOIN_MESSAGE="들어왔다." RACE_BOT_FINISH_MESSAGE="도착했다." pnpm race:join
RACE_BOT_JOIN_MESSAGE="들어왔다." RACE_BOT_FINISH_MESSAGE="도착했다." pnpm race:fill -- --room Alpha --count 2
```

자동 주행 끄기:

```bash
RACE_BOT_AUTOPILOT=false pnpm race:join
RACE_BOT_AUTOPILOT=false pnpm race:explore
RACE_BOT_AUTOPILOT=false pnpm race:fill -- --room Alpha --count 2
```

CLI 옵션으로 한 번만 덮어쓰기:

```bash
pnpm race:join -- --url http://127.0.0.1:3000 --room Alpha --join-message "들어왔어요" --finish-message "도착했어요"
pnpm race:join -- --nickname BotA --no-autopilot
pnpm race:join -- --no-join-message --no-finish-message
pnpm race:explore -- --room Alpha --count 2
pnpm race:fill -- --room Alpha --names red,blue,green
pnpm race:fill -- --room Alpha --bot join --count 2
pnpm race:fill -- --room Alpha --create --count 3
```

이름 목록 메모:

- `--names red,blue,green` 또는 `RACE_BOT_NAMES=red,blue,green`으로 봇 이름을 직접 지정할 수 있습니다.
- 이름 개수가 `--count`보다 많으면 이름 개수에 맞춰 봇 수가 자동으로 늘어납니다.
- 이름 개수가 부족하면 남은 봇은 `bot1`, `bot2`처럼 자동 생성됩니다.
- 닉네임은 서버 규칙에 맞춰 최대 5자까지 사용하고, 중복되면 뒤에 숫자를 붙여 고유하게 만듭니다.

## 환경변수와 CLI 옵션

| 환경변수 | CLI 옵션 | 설명 | 기본값 |
| --- | --- | --- | --- |
| `RACE_BOT_URL` | `--url` | 접속할 게임 서버 URL | `http://127.0.0.1:3000` |
| `RACE_BOT_NICKNAME` | `--nickname` | 봇 닉네임 | `Codex` |
| `RACE_BOT_COUNT` | `--count` | 동시에 띄울 봇 수 | `1` |
| `RACE_BOT_ROOM` | `--room` | 참가를 기다릴 방 이름 | 없음 |
| `RACE_BOT_NAMES` | `--names` | `race:fill`에서 우선 사용할 봇 이름 목록 (`쉼표 구분`) | 없음 |
| `RACE_BOT_JOIN_MESSAGE` | `--join-message` | 입장 직후 보낼 채팅 | `들어왔다.` |
| `RACE_BOT_FINISH_MESSAGE` | `--finish-message` | 완주 시 보낼 채팅 | `도착했다.` |
| `RACE_BOT_GREETING` | `--greeting` | 구버전 입장 채팅 별칭 | `RACE_BOT_JOIN_MESSAGE` 참조 |
| `RACE_BOT_AUTOPILOT` | `--no-autopilot` | 자동 주행 제어 | 기본 활성화 |
| `RACE_FILL_CREATE` | `--create` | `race:fill`에서 방을 직접 만들지 여부 | `false` |
| `RACE_FILL_BOT_KIND` | `--bot` | `race:fill`이 띄울 봇 종류 (`explore` 또는 `join`) | `explore` |
| `RACE_FILL_HOST_NICKNAME` | `--host-nickname` | `race:fill` 컨트롤러 닉네임 | `host` |
| `RACE_FILL_TIMEOUT_MS` | `--timeout` | `race:fill` 대기 제한 시간(ms) | `30000` |

메모:

- 닉네임은 서버 규칙에 맞춰 공백 제거 후 최대 5자까지 사용합니다.
- 멀티 봇일 때는 닉네임 뒤에 번호를 붙이되 5자 제한 안에 들어오도록 줄입니다. 예를 들어 기본 `Codex`는 `bot1`, `bot2`, `bot3`처럼 생성됩니다.
- CLI 옵션이 환경변수보다 우선합니다.
- `--no-autopilot`은 환경변수보다 우선해서 자동 주행을 끕니다.
- `--no-join-message`, `--no-finish-message`로 자동 채팅을 끌 수 있습니다.
- `race:fill`은 기본적으로 내가 만든 기존 `waiting` 방을 기다렸다가 봇만 채웁니다.
- `race:fill -- --create`는 보조 옵션입니다. 같은 이름의 `waiting` 방이 없을 때 새 `bot_race` 방을 만든 뒤 봇을 채우며, 이 경우 컨트롤러가 방 호스트가 됩니다.
- `race:fill -- --bot join`이면 빠른 최단 경로 봇, `--bot explore`면 시야 제한 탐험형 봇을 띄웁니다.

## 실행 중 콘솔 명령

프로세스가 살아 있는 동안 표준 입력으로 아래 명령을 보낼 수 있습니다.

| 명령 | 설명 |
| --- | --- |
| `status` | 현재 연결 상태와 방 상태 출력 |
| `chat <메시지>` | 현재 방에 채팅 전송 |
| `auto on` | 자동 주행 활성화 |
| `auto off` | 자동 주행 비활성화 |
| `start` | 현재 방에 시작 요청 |
| `leave` | 현재 방에서 나가기 |
| `up` `down` `left` `right` | 수동 이동 |
| `quit` / `exit` | 봇 종료 |

멀티 봇 모드 메모:

- 표준 입력 명령은 모든 워커 봇에게 브로드캐스트됩니다.
- `quit`를 입력하면 모든 워커가 함께 종료됩니다.

`race:fill` 컨트롤러 명령:

| 명령 | 설명 |
| --- | --- |
| `status` | 생성/대기 상태와 대상 봇 목록 출력 |
| `start` | 컨트롤러가 들어가 있는 방에 시작 요청 |
| `chat <메시지>` | 컨트롤러로 방 채팅 전송 |
| `leave` | 컨트롤러가 현재 방에서 나가기 |
| `quit` / `exit` | 컨트롤러와 워커 봇 함께 종료 |

## 운영 팁

- 기본값은 로컬 서버 `http://127.0.0.1:3000`입니다. 다른 서버에 붙을 때만 `RACE_BOT_URL`을 덮어쓰면 됩니다.
- 여러 방이 동시에 열리는 환경에서는 `RACE_BOT_ROOM`을 지정하는 편이 안전합니다.
- 게임에 계속 남아 있으려면 프로세스를 종료하지 않아야 합니다.
- 자동 주행은 서버가 내려주는 맵 스냅샷을 기준으로 경로를 계산하므로, 일반 사용자 UI 조작과는 별개로 빠르게 반응합니다.
- 탐험형 봇은 현재 시야에 보인 타일만 기억하고, 막힌 방향은 벽으로 학습한 뒤 다른 frontier를 탐색합니다.
- 보통은 UI에서 방을 먼저 만들고 `race:fill`로 봇만 넣는 흐름이 가장 자연스럽습니다.
- `--create`를 쓰지 않으면 시작과 재시작은 계속 UI에서 직접 하면 됩니다.
- `--create`를 쓰면 컨트롤러도 같은 방에 들어가고 호스트가 되므로, 이 경우에만 `start` 같은 콘솔 명령이 실질적으로 유용합니다.

## 검증

봇 설정 파싱, 방 선택, 자동 경로 계산은 스크립트 테스트로 검증합니다.

```bash
pnpm test:scripts
```
