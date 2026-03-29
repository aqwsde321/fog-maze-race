# Codex 레이스 봇 가이드

`pnpm race:join`은 외부 게임 서버 또는 로컬 서버에 `Socket.IO` 클라이언트로 접속해 방에 참가하는 CLI 봇입니다. 수동 플레이 보조, 멀티플레이 테스트, 간단한 자동 주행 검증에 사용합니다.

## 실행 위치

리포지토리 루트에서 실행합니다.

```bash
pnpm race:join
```

내부적으로는 `apps/web/scripts/race-bot.mjs`를 실행합니다.

## 기본 동작

- 서버에 접속한 뒤 방 목록을 구독합니다.
- `RACE_BOT_ROOM` 또는 `--room`이 없으면 첫 번째 `waiting` 방에 참가합니다.
- 특정 방 이름이 지정되면 그 방이 `waiting` 상태가 될 때까지 기다립니다.
- 방 참가 후 기본적으로 `들어왔다.` 채팅을 한 번 보냅니다.
- 완주하면 기본적으로 `도착했다.` 채팅을 한 번 보냅니다.
- 게임 상태가 `playing`이 되면 기본적으로 목표 지점까지 자동 주행합니다.
- 표준 입력 명령으로 상태 확인, 채팅, 수동 이동, 종료를 제어할 수 있습니다.

## 자주 쓰는 예시

기본 참가:

```bash
pnpm race:join
```

두 명 이상 동시에 참가:

```bash
RACE_BOT_COUNT=2 pnpm race:join
pnpm race:join -- --count 3
```

특정 방 대기 후 참가:

```bash
RACE_BOT_ROOM=Alpha pnpm race:join
```

외부 공개 주소로 접속:

```bash
RACE_BOT_URL=https://your-host.ngrok-free.dev pnpm race:join
```

입장 직후 채팅 보내기:

```bash
RACE_BOT_JOIN_MESSAGE="들어왔다." RACE_BOT_FINISH_MESSAGE="도착했다." pnpm race:join
```

자동 주행 끄기:

```bash
RACE_BOT_AUTOPILOT=false pnpm race:join
```

CLI 옵션으로 한 번만 덮어쓰기:

```bash
pnpm race:join -- --url https://your-host.ngrok-free.dev --room Alpha --join-message "들어왔어요" --finish-message "도착했어요"
pnpm race:join -- --nickname BotA --no-autopilot
pnpm race:join -- --no-join-message --no-finish-message
```

## 환경변수와 CLI 옵션

| 환경변수 | CLI 옵션 | 설명 | 기본값 |
| --- | --- | --- | --- |
| `RACE_BOT_URL` | `--url` | 접속할 게임 서버 URL | `https://nonmaturely-unloaning-merilyn.ngrok-free.dev` |
| `RACE_BOT_NICKNAME` | `--nickname` | 봇 닉네임 | `Codex` |
| `RACE_BOT_COUNT` | `--count` | 동시에 띄울 봇 수 | `1` |
| `RACE_BOT_ROOM` | `--room` | 참가를 기다릴 방 이름 | 없음 |
| `RACE_BOT_JOIN_MESSAGE` | `--join-message` | 입장 직후 보낼 채팅 | `들어왔다.` |
| `RACE_BOT_FINISH_MESSAGE` | `--finish-message` | 완주 시 보낼 채팅 | `도착했다.` |
| `RACE_BOT_GREETING` | `--greeting` | 구버전 입장 채팅 별칭 | `RACE_BOT_JOIN_MESSAGE` 참조 |
| `RACE_BOT_AUTOPILOT` | `--no-autopilot` | 자동 주행 제어 | 기본 활성화 |

메모:

- 닉네임은 서버 규칙에 맞춰 공백 제거 후 최대 5자까지 사용합니다.
- 멀티 봇일 때는 닉네임 뒤에 번호를 붙이되 5자 제한 안에 들어오도록 줄입니다. 예를 들어 기본 `Codex`는 `bot1`, `bot2`, `bot3`처럼 생성됩니다.
- CLI 옵션이 환경변수보다 우선합니다.
- `--no-autopilot`은 환경변수보다 우선해서 자동 주행을 끕니다.
- `--no-join-message`, `--no-finish-message`로 자동 채팅을 끌 수 있습니다.

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

## 운영 팁

- 외부 테스트 시 ngrok 주소가 자주 바뀌면 `RACE_BOT_URL`만 바꿔 재사용하면 됩니다.
- 여러 방이 동시에 열리는 환경에서는 `RACE_BOT_ROOM`을 지정하는 편이 안전합니다.
- 게임에 계속 남아 있으려면 프로세스를 종료하지 않아야 합니다.
- 자동 주행은 서버가 내려주는 맵 스냅샷을 기준으로 경로를 계산하므로, 일반 사용자 UI 조작과는 별개로 빠르게 반응합니다.

## 검증

봇 설정 파싱, 방 선택, 자동 경로 계산은 스크립트 테스트로 검증합니다.

```bash
pnpm test:scripts
```
