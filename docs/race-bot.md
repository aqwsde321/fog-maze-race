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
- `pnpm race:explore`: 현재 시야에서 보인 타일만 기억하고, 선택한 전략에 따라 모르는 구역을 탐험합니다.
- `pnpm race:fill`: 내가 UI에서 만든 대상 방을 기다렸다가, 지정한 수만큼 `join` 또는 `explore` 봇만 자동으로 띄웁니다.
- 기존 빠른 봇은 그대로 유지되고, 탐험형 봇은 별도 엔트리로 추가되었습니다.
- 라운드가 시작되면 사람과 봇을 포함한 모든 레이서는 같은 첫 시작 슬롯에서 출발합니다. 차이는 출발 위치가 아니라 이후 의사결정 정책에서 생깁니다.

## 탐험형 봇 전략

현재 탐험형 봇은 공통 메모리를 공유하고, 탐색 정책만 전략별로 나뉩니다.

- `frontier`: 기본 전략입니다. 현재 알고 있는 타일 중 미지 칸과 맞닿은 경계 후보를 넓게 모아, 점수가 가장 좋은 후보군 안에서 seed별로 다른 경로를 고릅니다.
- `tremaux`: `frontier` 기반을 유지하되, 이미 지나간 통로(edge)를 더 강하게 기록하고 다시 밟는 경로에 큰 패널티를 줍니다. 복도 왕복이나 같은 갈림길 반복을 줄일 때 더 유리합니다.
- `wall`: 최근 진행 방향을 기준으로 좌수법/우수법에 가까운 우선순위를 정해, 벽을 더듬듯 탐험합니다. 같은 길이의 목표 경로가 여러 개면 그 손잡이 순서를 먼저 따릅니다.

방 안의 `봇 참가시키기` 패널에서는 이름 입력 행마다 전략을 따로 선택할 수 있습니다. 예를 들어 `bot1=frontier`, `bot2=tremaux`, `bot3=wall`처럼 같은 방 안에서 서로 다른 탐험형 전략을 섞어 테스트할 수 있습니다.

## 탐험형 봇 길찾기 알고리즘

탐험형 봇은 전체 맵을 바로 풀지 않고, 실제로 본 타일만 기억하면서 움직입니다. 빠른 봇이 "전체 맵 최단 경로"라면, 탐험형 봇은 "부분 관측 + 기억 + 전략 기반 탐험"에 가깝습니다.

핵심 상태는 네 가지입니다.

- `knownTiles`: 현재까지 실제로 본 타일만 저장합니다.
- `visitCounts`: 각 칸을 몇 번 밟았는지 기록합니다.
- `edgeVisitCounts`: 두 칸 사이 통로를 몇 번 지났는지 기록합니다. `tremaux` 전략에서 특히 중요합니다.
- `recentTileKeys`: 최근에 지나온 칸 8개를 저장해 바로 되돌아가는 경로를 억제합니다.

시야 규칙도 빠른 봇과 다릅니다.

- 탐험형 봇은 시작 구역과 커넥터는 항상 알 수 있지만, goal 구역은 처음부터 공개되지 않습니다.
- 즉, goal 좌표를 먼저 아는 상태로 달리지 않고, goal이 실제 시야 안에 들어온 뒤에만 목표 경로를 계산합니다.

의사결정 순서는 아래와 같습니다.

1. 현재 시야에 들어온 타일만 `knownTiles`에 반영합니다.
2. 현재 위치를 `visitCounts`와 `recentTileKeys`에 기록합니다.
3. 아직 시작 구역이나 커넥터에 있으면 `staging` 단계로 보고, seed마다 다른 선호 진입 행을 골라 입구 혼잡을 분산합니다.
4. goal 타일이나 goal 구역 일부가 실제로 밝혀졌다면, 그 시점부터는 `knownTiles` 위에서 BFS로 goal까지 최단 경로를 찾습니다. 넓은 시야에서는 동점 최단경로가 여러 개일 때 seed별로 다른 경로를 고르도록 한 번 더 분산합니다.
5. goal이 아직 안 보이면, 바로 옆의 미지 칸을 먼저 한 칸 탐색하는 `probe`를 시도합니다.
6. 바로 탐색할 칸이 없으면, 미지 칸과 맞닿아 있는 알려진 타일들을 frontier 후보로 모읍니다.
7. 각 frontier 후보까지의 경로를 BFS로 구하고, 전략에 맞는 점수식을 적용한 뒤 좋은 후보군 안에서 seed별로 하나를 고릅니다.

공통 점수는 아래 요소를 합쳐 계산합니다.

- 경로 길이: 가까운 frontier를 우선합니다.
- 방문 횟수 패널티: 이미 자주 간 칸은 다시 덜 고릅니다.
- 최근 경로 패널티: 방금 지나간 칸을 또 지나가면 큰 벌점을 줍니다.
- 즉시 역주행 패널티: 바로 직전 칸으로 되돌아가면 더 큰 벌점을 줍니다.
- 입구 접근 bias: 시작 구역 근처에서만 seed별 선호 행을 조금 다르게 둬서, 초반 진입이 한 줄로만 겹치지 않게 합니다.

전략별 차이는 아래와 같습니다.

- `frontier`: 현재 타일 방문 수와 최근 경로 패널티를 중심으로 점수를 계산합니다. 가장 균형적인 기본 전략입니다.
- `tremaux`: `frontier` 점수에 더해 `edgeVisitCounts` 기반 통로 재방문 패널티를 강하게 적용합니다. 목표가 보여서 최단 경로를 고를 때도, 길이가 같은 후보면 덜 지난 통로를 우선합니다.
- `wall`: frontier 점수 비교보다 "현재 바라보는 방향에서 어느 손을 벽에 붙이고 도는가"를 더 강하게 따릅니다. 미지 칸을 프로브할 때도, 이미 보인 통로 중 하나를 고를 때도 그 우선순위를 그대로 사용합니다.

현재 분산 방식은 "멀리 돌아가게 만드는 랜덤"이 아니라, 점수가 비슷한 근접 후보군 안에서만 seed별로 다른 후보를 고르는 방식입니다.

- 큰 품질 차이가 나는 경로는 그대로 좋은 경로를 택합니다.
- 품질이 비슷한 frontier 후보가 여러 개 있으면, 봇마다 다른 후보를 선택해 움직임이 갈라집니다.
- 그래서 모든 봇이 같은 시작 슬롯에서 출발해도 초반과 중반 경로가 완전히 겹치지 않게 됩니다.

추가 학습도 있습니다.

- 막힌 방향으로 실제 이동을 시도했는데 제자리라면, 그 방향의 타일을 벽(`#`)으로 기억합니다.
- 3x3 같은 좁은 시야에서는 최근 경로 패널티와 입구 접근 회피 규칙을 함께 써서, 시작 구역 근처 왕복을 줄입니다.
- `tremaux`는 여기에 더해 이미 여러 번 지난 통로를 명시적으로 피해서, 좁은 시야에서도 같은 복도를 계속 도는 빈도를 더 줄입니다.
- `wall`은 최근 진행 방향을 기억해 좌수법/우수법을 유지하기 때문에, 같은 시작점에서도 좀 더 고집스럽고 성향이 분명한 움직임을 보입니다.

정리하면 탐험형 봇은 다음 조합입니다.

- `부분 시야 기반 메모리`
- `goal 발견 전 frontier 탐험`
- `goal 발견 후 BFS 최단 경로 + 동점 경로 분산`
- `최근 경로/역주행 패널티`
- `같은 시작점에서도 갈라지는 seed 기반 근접 후보 분산`

그래서 `race:join`보다 느릴 수 있지만, 실제 제한 시야 플레이를 흉내 내는 테스트에는 더 가깝습니다.

## UI에서 봇 추가하기

권장 흐름:

1. 웹 UI에서 방을 만듭니다.
2. 방에 들어간 뒤, 방장만 보이는 `봇 참가시키기` 버튼으로 설정 패널을 엽니다.
3. 기본 이름으로 채워진 입력값을 원하는 이름으로 수정합니다.
4. 탐험형을 선택했다면 각 이름 입력 행마다 `frontier`, `tremaux`, `wall` 전략을 따로 고릅니다.
5. 패널 아래 `봇 참가시키기` 버튼으로 추가합니다.
6. 이미 들어온 봇은 같은 패널의 `현재 봇` 목록에서 개별 제거하거나 `모두 제거`할 수 있습니다.
7. 시작과 재시작은 계속 방장이 UI에서 직접 합니다.

UI 동작 메모:

- 기본적으로 `bot1`, `bot2`처럼 이름이 미리 채워집니다.
- 탐험형을 선택하면 각 이름 입력 행마다 `frontier`, `tremaux`, `wall` 전략을 따로 고를 수 있습니다.
- 탐험형일 때는 패널 안 `전략 설명` 툴팁으로 `frontier`, `tremaux`, `wall` 차이를 바로 확인할 수 있습니다.
- 입력칸은 최대 5자까지 사용합니다.
- 일반 방에서는 사람과 봇이 함께 참가합니다.
- 봇 전용 방에서는 사람은 관전/호스트 역할을 유지하고 봇만 참가합니다.
- 봇 전용 방에서는 사람 관전자가 우측 `레이서` 목록에 보이지 않고, `관전자 N명` 메타 정보로만 표시됩니다.
- 봇 전용 방의 사람 관전자는 채팅은 계속 사용할 수 있습니다.
- 봇 전용 방은 관전자가 레이서 슬롯을 차지하지 않으므로 `최대 15봇 + 사람 관전자` 구성이 가능합니다.
- 현재는 `waiting` 상태일 때만 방장 UI에서 봇을 추가/제거할 수 있습니다.
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

CLI가 꼭 필요하지 않다면 위 흐름보다 방 안의 `봇 참가시키기` UI를 먼저 쓰는 편이 간단합니다.

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
