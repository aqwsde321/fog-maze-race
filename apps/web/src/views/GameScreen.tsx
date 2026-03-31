import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { ServerHealthSnapshot } from "@fog-maze-race/shared/contracts/server-health";
import type { RoomBotKind, RoomBotRequest } from "@fog-maze-race/shared/contracts/realtime";
import type { Direction } from "@fog-maze-race/shared/domain/grid-position";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { HostControls } from "../features/rooms/HostControls.js";
import { PlayerSidebar } from "../features/rooms/PlayerSidebar.js";
import { ResultOverlay } from "../features/rooms/ResultOverlay.js";
import { ResultsHistoryPanel } from "../features/rooms/ResultsHistoryPanel.js";
import type { GameResultLogEntry } from "../features/rooms/result-log.js";
import { RoomChatPanel } from "../features/rooms/RoomChatPanel.js";
import { GameCanvas } from "../game/GameCanvas.js";
import { resolvePlayerOverlayAnchor } from "../game/player-overlay-layout.js";
import { getSocketClient } from "../services/socket-client.js";

type GameScreenProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
  gameResultLogs?: ReadonlyArray<GameResultLogEntry>;
  countdownValue: number | null;
  onStartGame: () => void;
  onRenameRoom: (name: string) => void;
  onSetVisibilitySize: (visibilitySize: 3 | 5 | 7) => void;
  onAddBots?: (input: { kind: RoomBotKind; bots: RoomBotRequest[] }) => void;
  onRemoveBots?: (playerIds?: string[]) => void;
  onForceEndRoom: () => void;
  onResetToWaiting: () => void;
  onLeaveRoom: () => void;
  onMove: (direction: Direction) => void;
  onSendChatMessage: (content: string) => void;
};

const SERVER_HEALTH_POLL_INTERVAL_MS = 2_000;
const SERVER_METRIC_HISTORY_LIMIT = 16;
const FAKE_GOAL_ALERT_DURATION_MS = 2_000;
const FAKE_GOAL_ALERT_TILE_SIZE_PX = 22;
const FAKE_GOAL_ALERT_TILE_GAP_PX = 4;
const FAKE_GOAL_ALERT_CENTER_OFFSET_X_PX = 24;
const FAKE_GOAL_ALERT_CENTER_OFFSET_Y_PX = 32;
const FAKE_GOAL_ALERT_CAPTION_GAP_PX = 16;
const FAKE_GOAL_ALERT_WORD_PATTERN = [
  "01111100010",
  "00000100010",
  "01111100010",
  "00000100010",
  "00000000010",
  "11111110010",
  "00010000000",
  "00010000010"
] as const;
const FAKE_GOAL_ALERT_WORD_COLUMNS = Math.max(...FAKE_GOAL_ALERT_WORD_PATTERN.map((line) => line.length));
const FAKE_GOAL_ALERT_WORD_ROWS = FAKE_GOAL_ALERT_WORD_PATTERN.length;
const FAKE_GOAL_ALERT_WORD_WIDTH_PX =
  FAKE_GOAL_ALERT_WORD_COLUMNS * FAKE_GOAL_ALERT_TILE_SIZE_PX +
  (FAKE_GOAL_ALERT_WORD_COLUMNS - 1) * FAKE_GOAL_ALERT_TILE_GAP_PX;
const FAKE_GOAL_ALERT_WORD_HEIGHT_PX =
  FAKE_GOAL_ALERT_WORD_ROWS * FAKE_GOAL_ALERT_TILE_SIZE_PX +
  (FAKE_GOAL_ALERT_WORD_ROWS - 1) * FAKE_GOAL_ALERT_TILE_GAP_PX;
const SHELL_RAIL_WIDTH = "clamp(156px, 10.5vw, 178px)";
const SHELL_COLUMN_GAP = "clamp(6px, 0.8vw, 10px)";
const SHELL_EDGE_OFFSET = "clamp(8px, 1vw, 12px)";

type PingMetricState = {
  avgMs10s: number | null;
  currentMs: number | null;
};

type TrendMetricKey = "cpu" | "fanout" | "heap" | "loop" | "ping" | "rss";

type MetricHistory = Record<TrendMetricKey, number[]>;

type CanvasMetrics = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  frameWidth: number;
  frameHeight: number;
};

type QuickChatPlacement = {
  anchorX: number;
  anchorY: number;
  direction: "above" | "below";
};

const EMPTY_CANVAS_METRICS: CanvasMetrics = {
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
  frameWidth: 0,
  frameHeight: 0
};

function createEmptyMetricHistory(): MetricHistory {
  return {
    ping: [],
    cpu: [],
    loop: [],
    heap: [],
    rss: [],
    fanout: []
  };
}

export function GameScreen({
  snapshot,
  selfPlayerId,
  gameResultLogs = [],
  countdownValue,
  onStartGame,
  onRenameRoom,
  onSetVisibilitySize,
  onAddBots,
  onRemoveBots,
  onForceEndRoom,
  onResetToWaiting,
  onLeaveRoom,
  onMove,
  onSendChatMessage
}: GameScreenProps) {
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const quickChatInputRef = useRef<HTMLInputElement | null>(null);
  const fakeGoalAlertTimeoutRef = useRef<number | null>(null);
  const previousSelfTileKeyRef = useRef<string | null>(null);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false);
  const [isFakeGoalAlertVisible, setIsFakeGoalAlertVisible] = useState(false);
  const [quickChatDraft, setQuickChatDraft] = useState("");
  const [isQuickChatComposing, setIsQuickChatComposing] = useState(false);
  const [canvasMetrics, setCanvasMetrics] = useState<CanvasMetrics>(EMPTY_CANVAS_METRICS);
  const [isServerPanelOpen, setIsServerPanelOpen] = useState(false);
  const [isResultsHistoryOpen, setIsResultsHistoryOpen] = useState(false);
  const [serverHealth, setServerHealth] = useState<ServerHealthSnapshot | null>(null);
  const [serverHealthError, setServerHealthError] = useState<string | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistory>(createEmptyMetricHistory);
  const [pingMetric, setPingMetric] = useState<PingMetricState>({
    avgMs10s: null,
    currentMs: null
  });
  const pingSamplesRef = useRef<Array<{ latencyMs: number; measuredAtMs: number }>>([]);
  const isHost = snapshot.room.hostPlayerId === selfPlayerId;
  const canStart = snapshot.room.status === "waiting" && isHost;
  const canMove = snapshot.room.status === "waiting" || snapshot.room.status === "countdown" || snapshot.room.status === "playing";
  const displayStatus = snapshot.room.status === "countdown" ? "playing" : snapshot.room.status;
  const currentRacerCount = snapshot.members.filter((member) => member.role === "racer").length;
  const availableBotSlots = Math.max(
    snapshot.room.maxPlayers - (snapshot.room.mode === "bot_race" ? currentRacerCount : snapshot.members.length),
    0
  );
  const currentBots = snapshot.members
    .filter((member) => member.kind === "bot")
    .map((member) => ({
      playerId: member.playerId,
      nickname: member.nickname,
      strategy: member.exploreStrategy ?? null
    }));
  const activeMap = snapshot.match?.map ?? snapshot.previewMap;
  const serverMetrics = serverHealth ? buildServerMetrics(serverHealth, snapshot.members.length, pingMetric, metricHistory) : [];
  const quickChatAnchor = canvasMetrics.width > 0 && canvasMetrics.height > 0
    ? resolvePlayerOverlayAnchor({
        snapshot,
        playerId: selfPlayerId,
        viewportWidth: canvasMetrics.width,
        viewportHeight: canvasMetrics.height
      })
    : null;
  const quickChatPlacement = resolveQuickChatPlacement(quickChatAnchor, canvasMetrics);

  useEffect(() => {
    if (!canMove) {
      return;
    }

    canvasFrameRef.current?.focus({ preventScroll: true });
  }, [canMove, snapshot.room.status]);

  useEffect(() => {
    return () => {
      if (fakeGoalAlertTimeoutRef.current !== null) {
        window.clearTimeout(fakeGoalAlertTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const selfMember = selfPlayerId
      ? snapshot.members.find((member) => member.playerId === selfPlayerId)
      : null;
    const selfPosition = selfMember?.position ?? null;
    const currentTileKey = selfPosition ? toPositionKey(selfPosition) : null;
    const steppedOntoFakeGoal =
      currentTileKey !== previousSelfTileKeyRef.current &&
      Boolean(
        selfPosition &&
        (activeMap?.fakeGoalTiles ?? []).some(
          (tile) => tile.x === selfPosition.x && tile.y === selfPosition.y
        )
      );

    previousSelfTileKeyRef.current = currentTileKey;
    if (!steppedOntoFakeGoal) {
      return;
    }

    if (fakeGoalAlertTimeoutRef.current !== null) {
      window.clearTimeout(fakeGoalAlertTimeoutRef.current);
    }

    setIsFakeGoalAlertVisible(true);
    fakeGoalAlertTimeoutRef.current = window.setTimeout(() => {
      setIsFakeGoalAlertVisible(false);
      fakeGoalAlertTimeoutRef.current = null;
    }, FAKE_GOAL_ALERT_DURATION_MS);
  }, [activeMap, selfPlayerId, snapshot.members, snapshot.revision]);

  useEffect(() => {
    if (!isQuickChatOpen) {
      return;
    }

    requestAnimationFrame(() => {
      quickChatInputRef.current?.focus({ preventScroll: true });
    });
  }, [isQuickChatOpen]);

  useEffect(() => {
    const frame = canvasFrameRef.current;
    if (!frame) {
      return;
    }

    const findCanvas = () => frame.querySelector<HTMLElement>('[data-testid="game-canvas"]');
    const updateCanvasMetrics = () => {
      const canvas = findCanvas();
      if (!canvas) {
        setCanvasMetrics({
          width: frame.clientWidth,
          height: frame.clientHeight,
          offsetLeft: 0,
          offsetTop: 0,
          frameWidth: frame.clientWidth,
          frameHeight: frame.clientHeight
        });
        return;
      }

      setCanvasMetrics({
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        offsetLeft: canvas.offsetLeft,
        offsetTop: canvas.offsetTop,
        frameWidth: frame.clientWidth,
        frameHeight: frame.clientHeight
      });
    };

    updateCanvasMetrics();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateCanvasMetrics();
    });
    observer.observe(frame);
    const canvas = findCanvas();
    if (canvas) {
      observer.observe(canvas);
    }

    return () => {
      observer.disconnect();
    };
  }, [snapshot.revision, snapshot.room.status]);

  useEffect(() => {
    const resetViewportScroll = () => {
      if (window.scrollX === 0 && window.scrollY === 0) {
        return;
      }

      window.scrollTo(0, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" || event.key === "Enter") {
        if (isBlockedGlobalKeyTarget(event.target)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        resetViewportScroll();
        setIsQuickChatOpen(true);
        return;
      }

      const direction = toDirection(event.key);
      if (!direction) {
        return;
      }

      if (isBlockedGlobalKeyTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      resetViewportScroll();

      if (!canMove) {
        return;
      }

      onMove(direction);
      requestAnimationFrame(resetViewportScroll);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!toDirection(event.key) || isBlockedGlobalKeyTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      resetViewportScroll();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, [canMove, onMove]);

  useEffect(() => {
    if (!isServerPanelOpen) {
      setMetricHistory(createEmptyMetricHistory());
      pingSamplesRef.current = [];
      setPingMetric({
        avgMs10s: null,
        currentMs: null
      });
      return;
    }

    let cancelled = false;

    const loadServerHealth = async () => {
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(4_000)
        });

        if (response.status === 304) {
          if (cancelled) {
            return;
          }

          setServerHealthError(null);
          return;
        }

        if (!response.ok) {
          throw new Error(`health request failed: ${response.status}`);
        }

        const payload = (await response.json()) as ServerHealthSnapshot;
        if (cancelled) {
          return;
        }

        setServerHealth(payload);
        setMetricHistory((previous) => appendServerMetricHistory(previous, payload));
        setServerHealthError(null);
      } catch {
        if (cancelled) {
          return;
        }

        setServerHealthError("상태 확인 실패");
      }
    };

    void loadServerHealth();

    const intervalId = window.setInterval(() => {
      void loadServerHealth();
    }, SERVER_HEALTH_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isServerPanelOpen]);

  function focusGameShell() {
    requestAnimationFrame(() => {
      canvasFrameRef.current?.focus({ preventScroll: true });
    });
  }

  function closeQuickChat() {
    setIsQuickChatOpen(false);
    setQuickChatDraft("");
    setIsQuickChatComposing(false);
    focusGameShell();
  }

  function submitQuickChat() {
    const content = quickChatDraft.trim();
    if (content) {
      onSendChatMessage(content);
    }

    closeQuickChat();
  }

  useEffect(() => {
    if (!isServerPanelOpen) {
      return;
    }

    const socket = getSocketClient();
    if (!socket.connected) {
      setMetricHistory((previous) => ({
        ...previous,
        ping: []
      }));
      setPingMetric({
        avgMs10s: null,
        currentMs: null
      });
      return;
    }

    let cancelled = false;

    const measurePing = () => {
      const startedAtMs = performance.now();
      socket.timeout(4_000).emit("PING_CHECK", {
        clientSentAt: new Date().toISOString()
      }, (...acknowledgement: unknown[]) => {
        const error = acknowledgement[0] instanceof Error ? acknowledgement[0] : null;
        if (error) {
          return;
        }

        if (cancelled) {
          return;
        }

        const measuredAtMs = Date.now();
        const latencyMs = roundMetricValue(performance.now() - startedAtMs);
        const samples = [
          ...pingSamplesRef.current.filter((sample) => measuredAtMs - sample.measuredAtMs <= 10_000),
          {
            latencyMs,
            measuredAtMs
          }
        ];
        pingSamplesRef.current = samples;
        setMetricHistory((previous) => ({
          ...previous,
          ping: appendTrendValue(previous.ping, latencyMs)
        }));
        setPingMetric({
          currentMs: latencyMs,
          avgMs10s: roundMetricValue(samples.reduce((sum, sample) => sum + sample.latencyMs, 0) / samples.length)
        });
      });
    };

    measurePing();

    const intervalId = window.setInterval(() => {
      measurePing();
    }, SERVER_HEALTH_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isServerPanelOpen]);

  return (
    <section style={shellStyle}>
      <div style={mainColumnStyle}>
        <div
          ref={canvasFrameRef}
          data-testid="game-shell"
          style={canvasFrameStyle}
          onPointerDown={() => {
            if (isQuickChatOpen) {
              setIsQuickChatOpen(false);
              setQuickChatDraft("");
              setIsQuickChatComposing(false);
            }
            canvasFrameRef.current?.focus({ preventScroll: true });
          }}
          tabIndex={0}
        >
          <GameCanvas snapshot={snapshot} selfPlayerId={selfPlayerId} />
          {isQuickChatOpen ? (
            <div
              data-testid="quick-chat-composer"
              style={quickChatComposerWrapStyle(quickChatPlacement)}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              <div style={quickChatComposerStyle}>
                <input
                  ref={quickChatInputRef}
                  data-testid="quick-chat-input"
                  style={quickChatInputStyle}
                  value={quickChatDraft}
                  maxLength={80}
                  placeholder="메시지 입력"
                  onChange={(event) => {
                    setQuickChatDraft(event.target.value);
                  }}
                  onCompositionStart={() => {
                    setIsQuickChatComposing(true);
                  }}
                  onCompositionEnd={() => {
                    setIsQuickChatComposing(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      closeQuickChat();
                      return;
                    }

                    if (event.key === "Enter" && !isQuickChatComposing && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      submitQuickChat();
                    }
                  }}
                />
                <span style={quickChatHintStyle}>Enter 전송 · Esc 취소</span>
                <span style={quickChatTailStyle(quickChatPlacement?.direction ?? "above")} aria-hidden="true" />
              </div>
            </div>
          ) : null}
          <div data-testid="room-chat-dock" style={chatDockStyle}>
            {isChatPanelOpen ? (
              <RoomChatPanel
                snapshot={snapshot}
                selfPlayerId={selfPlayerId}
                onSendMessage={onSendChatMessage}
              />
            ) : null}
            <button
              data-testid="room-chat-toggle"
              type="button"
              aria-expanded={isChatPanelOpen}
              onClick={() => {
                setIsChatPanelOpen((previous) => !previous);
              }}
              style={floatingToggleButtonStyle("chat", isChatPanelOpen, false)}
            >
              <span style={floatingToggleDotStyle("chat")} />
              <span style={floatingToggleContentStyle}>
                <span style={floatingToggleTitleStyle}>Room Chat</span>
                <strong style={floatingToggleValueStyle(false)}>
                  {snapshot.chat.length > 0 ? `${snapshot.chat.length}개` : "열기"}
                </strong>
              </span>
            </button>
          </div>
          {snapshot.room.status === "countdown" && countdownValue !== null ? (
            <div data-testid="countdown-overlay" style={countdownOverlayStyle}>
              <div style={countdownCardStyle}>
                <p style={countdownLabelStyle}>시작까지</p>
                <strong style={countdownValueStyle}>{countdownValue}</strong>
              </div>
            </div>
          ) : null}
          {isFakeGoalAlertVisible ? (
            <div data-testid="fake-goal-alert" style={fakeGoalAlertOverlayStyle(canvasMetrics)}>
              <div data-testid="fake-goal-alert-card" style={fakeGoalAlertCardStyle}>
                <div
                  data-testid="fake-goal-alert-word"
                  role="img"
                  aria-label="쿠!"
                  style={fakeGoalAlertWordStyle}
                >
                  {FAKE_GOAL_ALERT_WORD_PATTERN.flatMap((line, rowIndex) =>
                    [...line].map((cell, columnIndex) =>
                      cell === "1" ? (
                        <span
                          key={`${rowIndex}-${columnIndex}`}
                          data-testid="fake-goal-alert-pixel"
                          style={fakeGoalAlertPixelStyle(columnIndex, rowIndex)}
                        />
                      ) : null
                    )
                  )}
                </div>
                <p data-testid="fake-goal-alert-caption" style={fakeGoalAlertCaptionStyle}>가짜 골</p>
              </div>
            </div>
          ) : null}
          <ResultOverlay
            snapshot={snapshot}
            isHost={isHost}
            gameLogs={gameResultLogs}
            onResetToWaiting={onResetToWaiting}
          />
          <ResultsHistoryPanel
            isOpen={isResultsHistoryOpen}
            roomName={snapshot.room.name}
            logs={gameResultLogs}
            onClose={() => {
              setIsResultsHistoryOpen(false);
            }}
          />
        </div>
      </div>

      <div data-testid="game-rail" style={railStyle}>
        <header style={topBarStyle}>
          <div data-testid="room-header-row" style={roomHeaderRowStyle}>
            <div style={roomHeaderStyle}>
              <p style={labelStyle}>Room</p>
              <h2 style={roomNameStyle}>{snapshot.room.name}</h2>
            </div>
            <div style={roomHeaderActionsStyle}>
              <div style={statusPanelStyle}>
                <p style={labelStyle}>Status</p>
                <strong data-testid="room-status" style={statusValueStyle}>
                  {displayStatus}
                </strong>
              </div>
            </div>
          </div>
          {isHost ? (
            <div style={hostControlsWrapStyle}>
              <HostControls
                roomId={snapshot.room.roomId}
                roomName={snapshot.room.name}
                roomMode={snapshot.room.mode}
                visibilitySize={snapshot.room.visibilitySize}
                canEditVisibility={snapshot.room.status === "waiting"}
                canManageBots={snapshot.room.status === "waiting"}
                availableBotSlots={availableBotSlots}
                memberNicknames={snapshot.members.map((member) => member.nickname)}
                currentBots={currentBots}
                onRenameRoom={onRenameRoom}
                onSetVisibilitySize={onSetVisibilitySize}
                onAddBots={onAddBots ?? (() => undefined)}
                onRemoveBots={onRemoveBots ?? (() => undefined)}
              />
            </div>
          ) : null}
          <div data-testid="room-action-panel" style={actionPanelStyle}>
            <div style={isHost ? hostActionRailStyle : guestActionRailStyle}>
              {isHost ? (
                <button type="button" onClick={onStartGame} disabled={!canStart} style={startButtonStyle}>
                  시작
                </button>
              ) : null}
              <button type="button" onClick={onLeaveRoom} style={ghostButtonStyle}>
                나가기
              </button>
              {isHost ? (
                <button
                  type="button"
                  onClick={onForceEndRoom}
                  disabled={snapshot.room.status === "waiting" || snapshot.room.status === "ended"}
                  style={dangerButtonStyle}
                >
                  강제 종료
                </button>
              ) : null}
            </div>
            <button
              data-testid="results-history-toggle"
              type="button"
              aria-expanded={isResultsHistoryOpen}
              onClick={() => {
                setIsResultsHistoryOpen((previous) => !previous);
              }}
              style={historyToggleButtonStyle(isResultsHistoryOpen, gameResultLogs.length > 0)}
            >
              <span style={historyToggleLabelStyle}>로그</span>
              <strong style={historyToggleValueStyle}>
                {gameResultLogs.length > 0 ? `${gameResultLogs.length}경기` : "기록 없음"}
              </strong>
            </button>
          </div>

        </header>

        <PlayerSidebar snapshot={snapshot} selfPlayerId={selfPlayerId} />
      </div>

      {isHost ? (
        <div data-testid="server-floating-dock" style={serverFloatingDockStyle}>
          {isServerPanelOpen ? (
            <section data-testid="server-health-panel" style={serverPanelStyle}>
              <div style={serverHeaderStyle}>
                <p style={labelStyle}>Server</p>
                <strong data-testid="server-health-status" style={serverStatusValueStyle(serverHealthError)}>
                  {serverHealthError ? serverHealthError : serverHealth ? "온라인" : "확인 중"}
                </strong>
              </div>
              <div data-testid="server-health-scroll" style={serverPanelBodyStyle}>
                {serverHealth ? (
                  <>
                    <p style={serverSubLabelStyle}>현재 / 10초 평균 또는 최대</p>
                    <div style={serverMetricListStyle}>
                      {serverMetrics.map((metric) => (
                        <div key={metric.key} style={serverMetricRowStyle}>
                          <div style={serverMetricLabelGroupStyle}>
                            <span style={serverMetricLabelStyle}>{metric.label}</span>
                            {metric.tooltip ? <MetricInfoButton metric={metric} /> : null}
                          </div>
                          <div style={serverMetricDataStyle}>
                            <span style={serverMetricValueStyle}>
                              {metric.value}
                            </span>
                            {metric.trend ? <MetricSparkline metric={metric} /> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={serverPendingTextStyle}>
                    {serverHealthError ? "서버 상태를 다시 확인해주세요." : "서버 상태를 불러오는 중입니다."}
                  </p>
                )}
              </div>
            </section>
          ) : null}

          <button
            data-testid="server-health-toggle"
            type="button"
            aria-expanded={isServerPanelOpen}
            onClick={() => {
              setIsServerPanelOpen((previous) => !previous);
            }}
            style={floatingToggleButtonStyle("server", isServerPanelOpen, Boolean(serverHealthError))}
          >
            <span style={floatingToggleDotStyle(serverHealthError ? "error" : "server")} />
            <span style={floatingToggleContentStyle}>
              <span style={floatingToggleTitleStyle}>서버 부하</span>
              <strong style={floatingToggleValueStyle(Boolean(serverHealthError))}>
                {serverHealthError ? "오류" : serverHealth ? "온라인" : "열기"}
              </strong>
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

type FloatingToggleTone = "chat" | "error" | "server";

type ServerMetric = {
  key: string;
  label: string;
  trend: number[] | null;
  tooltip: string | null;
  value: string;
};

function MetricInfoButton({ metric }: { metric: ServerMetric }) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) {
        return;
      }

      setAnchorRect(buttonRef.current.getBoundingClientRect());
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <span style={metricInfoWrapStyle}>
      <button
        ref={buttonRef}
        data-testid={`server-metric-info-${metric.key}`}
        type="button"
        aria-label={`${metric.label} 설명`}
        onMouseEnter={(event) => {
          setAnchorRect(event.currentTarget.getBoundingClientRect());
          setIsOpen(true);
        }}
        onMouseLeave={() => {
          setIsOpen(false);
        }}
        onFocus={(event) => {
          setAnchorRect(event.currentTarget.getBoundingClientRect());
          setIsOpen(true);
        }}
        onBlur={() => {
          setIsOpen(false);
        }}
        style={metricInfoButtonStyle}
      >
        i
      </button>
      {isOpen && anchorRect
        ? createPortal(
            <span
              data-testid={`server-metric-tooltip-${metric.key}`}
              role="tooltip"
              style={metricTooltipStyle(anchorRect)}
            >
              {metric.tooltip}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

function MetricSparkline({ metric }: { metric: ServerMetric }) {
  if (!metric.trend) {
    return null;
  }

  const geometry = buildSparklineGeometry(metric.trend, 104, 34);

  return (
    <svg
      data-testid={`server-metric-graph-${metric.key}`}
      viewBox="0 0 104 34"
      preserveAspectRatio="none"
      style={serverMetricSparklineStyle}
      aria-hidden="true"
    >
      <line x1="0" y1="26" x2="104" y2="26" style={serverMetricSparklineGridStyle} />
      <path d={geometry.areaPath} style={serverMetricSparklineAreaStyle} />
      <path d={geometry.linePath} style={serverMetricSparklineLineStyle} />
    </svg>
  );
}

function toDirection(key: string): Direction | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function isBlockedGlobalKeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (isEditableTarget(target)) {
    return true;
  }

  return Boolean(target.closest("button, a, summary, [role='button'], [role='link']"));
}

function resolveQuickChatPlacement(anchor: ReturnType<typeof resolvePlayerOverlayAnchor>, metrics: CanvasMetrics): QuickChatPlacement | null {
  if (!anchor || metrics.frameWidth <= 0 || metrics.frameHeight <= 0) {
    return null;
  }

  const targetX = metrics.offsetLeft + anchor.centerX;
  const targetY = metrics.offsetTop + anchor.centerY;
  const minAnchorX = Math.min(170, Math.floor(metrics.frameWidth / 2));
  const maxAnchorX = Math.max(minAnchorX, metrics.frameWidth - 170);
  const direction = targetY >= 180 ? "above" : "below";

  return {
    anchorX: Math.min(maxAnchorX, Math.max(minAnchorX, targetX)),
    anchorY: direction === "above"
      ? Math.max(112, targetY - anchor.markerRadius - 18)
      : Math.min(metrics.frameHeight - 92, targetY + anchor.markerRadius + 18),
    direction
  };
}

const shellStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: `minmax(0, 1fr) ${SHELL_RAIL_WIDTH}`,
  gap: SHELL_COLUMN_GAP,
  width: "100%",
  maxWidth: "1500px",
  margin: "0 auto",
  alignItems: "start",
  overflowX: "hidden"
};

const mainColumnStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  overflowX: "hidden"
};

const railStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  width: "100%",
  minWidth: 0,
  alignSelf: "start"
};

const topBarStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "7px",
  borderRadius: "12px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.16)"
};

const roomHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "8px"
};

const roomHeaderStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto"
};

const roomHeaderActionsStyle: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  flexShrink: 0
};

const hostControlsWrapStyle: CSSProperties = {
  minWidth: 0
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase"
};

const roomNameStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: "0.92rem",
  lineHeight: 1.05
};

const statusPanelStyle: CSSProperties = {
  flexShrink: 0,
  minWidth: "54px",
  textAlign: "right"
};

const statusValueStyle: CSSProperties = {
  display: "block",
  marginTop: "2px",
  fontSize: "0.76rem",
  color: "#f8fafc"
};

function historyToggleButtonStyle(isOpen: boolean, hasLogs: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    minHeight: "40px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: `1px solid ${hasLogs ? "rgba(250, 204, 21, 0.22)" : "rgba(148, 163, 184, 0.16)"}`,
    background: isOpen
      ? "linear-gradient(180deg, rgba(32, 23, 7, 0.96), rgba(22, 16, 6, 0.94))"
      : "rgba(15, 23, 42, 0.62)",
    color: "#f8fafc",
    cursor: "pointer",
    textAlign: "left"
  };
}

const historyToggleLabelStyle: CSSProperties = {
  fontSize: "0.68rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#94a3b8"
};

const historyToggleValueStyle: CSSProperties = {
  color: "#fde68a",
  fontSize: "0.8rem",
  whiteSpace: "nowrap"
};

const actionPanelStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "10px",
  borderRadius: "12px",
  background: "rgba(15, 23, 42, 0.46)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const serverPanelStyle: CSSProperties = {
  display: "grid",
  gap: "5px",
  width: "min(332px, calc(100vw - 20px))",
  padding: "10px",
  borderRadius: "16px",
  background: "linear-gradient(180deg, rgba(10, 18, 33, 0.96), rgba(8, 15, 30, 0.94))",
  border: "1px solid rgba(125, 211, 252, 0.12)",
  boxShadow: "0 20px 44px rgba(2, 6, 23, 0.32)",
  boxSizing: "border-box",
  backdropFilter: "blur(10px)",
  overflow: "visible"
};

const serverHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "8px"
};

const serverMetricListStyle: CSSProperties = {
  display: "grid",
  gap: "3px"
};

const serverSubLabelStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: "0.62rem",
  letterSpacing: "0.04em"
};

const serverPanelBodyStyle: CSSProperties = {
  display: "grid",
  gap: "5px",
  overflowY: "visible",
  overflowX: "visible",
  paddingRight: 0
};

const serverMetricRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "88px minmax(0, 1fr)",
  gap: "8px",
  alignItems: "center"
};

const serverMetricLabelGroupStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  minWidth: 0,
  width: "100%"
};

const serverMetricLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.66rem",
  letterSpacing: "0.04em"
};

const serverMetricValueStyle: CSSProperties = {
  color: "#e2e8f0",
  fontSize: "0.7rem",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums"
};

const serverMetricDataStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  width: "100%"
};

const serverMetricSparklineStyle: CSSProperties = {
  width: "100%",
  height: "34px",
  borderRadius: "10px",
  background: "rgba(15, 23, 42, 0.72)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const serverMetricSparklineGridStyle: CSSProperties = {
  stroke: "rgba(148, 163, 184, 0.08)",
  strokeWidth: 1
};

const serverMetricSparklineAreaStyle: CSSProperties = {
  fill: "rgba(56, 189, 248, 0.12)"
};

const serverMetricSparklineLineStyle: CSSProperties = {
  fill: "none",
  stroke: "#38bdf8",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

const serverPendingTextStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.7rem",
  lineHeight: 1.4
};

const serverFloatingDockStyle: CSSProperties = {
  position: "absolute",
  right: `calc(${SHELL_RAIL_WIDTH} + ${SHELL_COLUMN_GAP} + ${SHELL_EDGE_OFFSET})`,
  bottom: "clamp(10px, 1vw, 14px)",
  zIndex: 4,
  display: "grid",
  justifyItems: "end",
  gap: "10px"
};

const floatingToggleContentStyle: CSSProperties = {
  display: "grid",
  gap: "1px",
  minWidth: 0,
  textAlign: "left"
};

function serverStatusValueStyle(hasError: string | null): CSSProperties {
  return {
    fontSize: "0.74rem",
    color: hasError ? "#fca5a5" : "#7dd3fc"
  };
}

const floatingToggleTitleStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.62rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase"
};

const metricInfoWrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center"
};

const metricInfoButtonStyle: CSSProperties = {
  width: "14px",
  height: "14px",
  display: "inline-grid",
  placeItems: "center",
  padding: 0,
  borderRadius: "999px",
  border: "1px solid rgba(125, 211, 252, 0.24)",
  background: "rgba(15, 23, 42, 0.92)",
  color: "#7dd3fc",
  fontSize: "0.58rem",
  fontWeight: 700,
  lineHeight: 1,
  cursor: "help"
};

function floatingToggleButtonStyle(tone: Exclude<FloatingToggleTone, "error">, isOpen: boolean, hasError: boolean): CSSProperties {
  const borderColor = hasError
    ? "rgba(248, 113, 113, 0.28)"
    : tone === "chat"
      ? "rgba(56, 189, 248, 0.24)"
      : "rgba(125, 211, 252, 0.22)";

  return {
    display: "grid",
    gridTemplateColumns: "8px auto",
    alignItems: "center",
    gap: "10px",
    minWidth: tone === "chat" ? "112px" : "118px",
    padding: "9px 12px",
    borderRadius: "18px",
    border: `1px solid ${borderColor}`,
    background: isOpen
      ? "linear-gradient(180deg, rgba(12, 22, 39, 0.98), rgba(8, 15, 30, 0.96))"
      : "linear-gradient(180deg, rgba(9, 19, 34, 0.94), rgba(7, 14, 28, 0.92))",
    color: "#f8fafc",
    textAlign: "left",
    pointerEvents: "auto",
    cursor: "pointer",
    boxShadow: isOpen ? "0 16px 34px rgba(2, 6, 23, 0.3)" : "0 12px 28px rgba(2, 6, 23, 0.22)",
    backdropFilter: "blur(10px)"
  };
}

function floatingToggleDotStyle(tone: FloatingToggleTone): CSSProperties {
  const background = tone === "chat"
    ? "linear-gradient(180deg, #38bdf8, #0ea5e9)"
    : tone === "error"
      ? "linear-gradient(180deg, #fda4af, #ef4444)"
      : "linear-gradient(180deg, #67e8f9, #22d3ee)";

  return {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background,
    boxShadow: tone === "error" ? "0 0 16px rgba(239, 68, 68, 0.45)" : "0 0 16px rgba(34, 211, 238, 0.34)"
  };
}

function floatingToggleValueStyle(hasError: boolean): CSSProperties {
  return {
    fontSize: "0.76rem",
    color: hasError ? "#fca5a5" : "#e2e8f0"
  };
}

const hostActionRailStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "4px"
};

const guestActionRailStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "4px"
};

const dangerButtonStyle: CSSProperties = {
  minHeight: "32px",
  padding: "6px 8px",
  borderRadius: "10px",
  border: "1px solid rgba(248, 113, 113, 0.2)",
  background: "rgba(239, 68, 68, 0.12)",
  color: "#fecaca",
  cursor: "pointer",
  fontSize: "0.72rem",
  gridColumn: "1 / -1"
};

const startButtonStyle: CSSProperties = {
  minHeight: "32px",
  padding: "6px 8px",
  borderRadius: "10px",
  border: 0,
  background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
  color: "#082032",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.72rem"
};

const ghostButtonStyle: CSSProperties = {
  minHeight: "32px",
  padding: "6px 8px",
  borderRadius: "10px",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: "0.72rem"
};

const canvasFrameStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  boxSizing: "border-box",
  padding: "4px",
  borderRadius: "12px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.82), rgba(6, 14, 26, 0.88))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
  outline: "none"
};

function quickChatComposerWrapStyle(placement: QuickChatPlacement | null): CSSProperties {
  if (!placement) {
    return {
      position: "absolute",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      zIndex: 5,
      pointerEvents: "auto"
    };
  }

  return {
    position: "absolute",
    left: `${placement.anchorX}px`,
    top: `${placement.anchorY}px`,
    transform: placement.direction === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
    zIndex: 5,
    pointerEvents: "auto"
  };
}

const quickChatComposerStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: "6px",
  minWidth: "min(320px, calc(100vw - 56px))",
  padding: "12px 14px",
  borderRadius: "18px",
  background: "linear-gradient(180deg, rgba(8, 20, 36, 0.96), rgba(6, 15, 29, 0.98))",
  border: "1px solid rgba(125, 211, 252, 0.24)",
  boxShadow: "0 20px 44px rgba(2, 6, 23, 0.36)"
};

const quickChatInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: "42px",
  padding: "0 12px",
  borderRadius: "12px",
  border: "1px solid rgba(125, 211, 252, 0.18)",
  background: "rgba(2, 6, 23, 0.76)",
  color: "#f8fafc",
  outline: "none",
  boxSizing: "border-box"
};

const quickChatHintStyle: CSSProperties = {
  fontSize: "0.72rem",
  color: "#94a3b8",
  textAlign: "right"
};

function quickChatTailStyle(direction: "above" | "below"): CSSProperties {
  return direction === "above"
    ? {
        position: "absolute",
        left: "50%",
        bottom: "-7px",
        width: "14px",
        height: "14px",
        transform: "translateX(-50%) rotate(45deg)",
        background: "rgba(6, 15, 29, 0.98)",
        borderRight: "1px solid rgba(125, 211, 252, 0.24)",
        borderBottom: "1px solid rgba(125, 211, 252, 0.24)"
      }
    : {
        position: "absolute",
        left: "50%",
        top: "-7px",
        width: "14px",
        height: "14px",
        transform: "translateX(-50%) rotate(45deg)",
        background: "rgba(6, 15, 29, 0.98)",
        borderLeft: "1px solid rgba(125, 211, 252, 0.24)",
        borderTop: "1px solid rgba(125, 211, 252, 0.24)"
      };
}

const countdownOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none"
};

function fakeGoalAlertOverlayStyle(canvasMetrics: CanvasMetrics): CSSProperties {
  if (canvasMetrics.width > 0 && canvasMetrics.height > 0) {
    return {
      position: "absolute",
      left: `${canvasMetrics.offsetLeft}px`,
      top: `${canvasMetrics.offsetTop}px`,
      width: `${canvasMetrics.width}px`,
      height: `${canvasMetrics.height}px`,
      zIndex: 6,
      display: "grid",
      placeItems: "center",
      pointerEvents: "none"
    };
  }

  return {
    position: "absolute",
    inset: 0,
    zIndex: 6,
    display: "grid",
    placeItems: "center",
    pointerEvents: "none"
  };
}

const chatDockStyle: CSSProperties = {
  position: "absolute",
  left: "0px",
  bottom: "18px",
  zIndex: 4,
  display: "grid",
  justifyItems: "start",
  gap: "10px",
  pointerEvents: "auto"
};

const countdownCardStyle: CSSProperties = {
  minWidth: "min(320px, calc(100% - 48px))",
  padding: "28px 40px",
  borderRadius: "28px",
  background: "rgba(2, 6, 23, 0.76)",
  border: "1px solid rgba(56, 189, 248, 0.28)",
  boxShadow: "0 24px 80px rgba(2, 6, 23, 0.42)",
  textAlign: "center",
  backdropFilter: "blur(8px)"
};

const countdownLabelStyle: CSSProperties = {
  margin: 0,
  color: "#7dd3fc",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontSize: "0.9rem"
};

const countdownValueStyle: CSSProperties = {
  display: "block",
  marginTop: "10px",
  fontSize: "clamp(4rem, 10vw, 7rem)",
  lineHeight: 1,
  color: "#f8fafc"
};

const fakeGoalAlertCardStyle: CSSProperties = {
  position: "absolute",
  left: `calc(50% + ${FAKE_GOAL_ALERT_CENTER_OFFSET_X_PX}px)`,
  top: `calc(50% - ${FAKE_GOAL_ALERT_CENTER_OFFSET_Y_PX}px)`,
  display: "grid",
  justifyItems: "center",
  width: 0,
  height: 0
};

const fakeGoalAlertWordStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  transform: "translate(-50%, -50%)",
  display: "grid",
  width: `${FAKE_GOAL_ALERT_WORD_WIDTH_PX}px`,
  height: `${FAKE_GOAL_ALERT_WORD_HEIGHT_PX}px`,
  gridTemplateColumns: `repeat(${FAKE_GOAL_ALERT_WORD_COLUMNS}, ${FAKE_GOAL_ALERT_TILE_SIZE_PX}px)`,
  gridTemplateRows: `repeat(${FAKE_GOAL_ALERT_WORD_ROWS}, ${FAKE_GOAL_ALERT_TILE_SIZE_PX}px)`,
  gap: `${FAKE_GOAL_ALERT_TILE_GAP_PX}px`,
  filter: "drop-shadow(0 18px 40px rgba(2, 6, 23, 0.28))"
};

const fakeGoalAlertCaptionStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: `${Math.floor(FAKE_GOAL_ALERT_WORD_HEIGHT_PX / 2) + FAKE_GOAL_ALERT_CAPTION_GAP_PX}px`,
  transform: "translateX(-50%)",
  margin: 0,
  whiteSpace: "nowrap",
  padding: "6px 12px",
  borderRadius: "999px",
  background: "rgba(2, 6, 23, 0.78)",
  color: "#fde68a",
  fontSize: "0.82rem",
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase"
};

function fakeGoalAlertPixelStyle(columnIndex: number, rowIndex: number): CSSProperties {
  return {
    gridColumn: `${columnIndex + 1}`,
    gridRow: `${rowIndex + 1}`,
    width: `${FAKE_GOAL_ALERT_TILE_SIZE_PX}px`,
    height: `${FAKE_GOAL_ALERT_TILE_SIZE_PX}px`,
    borderRadius: "2px",
    background: "#facc15",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.18), inset 0 0 0 2px rgba(2, 6, 23, 0.36)"
  };
}

function toPositionKey(position: { x: number; y: number }) {
  return `${position.x},${position.y}`;
}

function formatBytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatRate(value: number) {
  return value.toFixed(1);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMilliseconds(value: number) {
  return `${value.toFixed(1)}ms`;
}

function formatOptionalMilliseconds(value: number | null) {
  if (value === null) {
    return "-";
  }

  return formatMilliseconds(value);
}

function formatUptime(uptimeSeconds: number) {
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildServerMetrics(
  serverHealth: ServerHealthSnapshot,
  roomMemberCount: number,
  pingMetric: PingMetricState,
  metricHistory: MetricHistory
): ServerMetric[] {
  return [
    {
      key: "ping",
      label: "Ping",
      value: `${formatOptionalMilliseconds(pingMetric.currentMs)} / ${formatOptionalMilliseconds(pingMetric.avgMs10s)}`,
      tooltip: "왼쪽은 현재, 오른쪽은 최근 10초 평균 왕복 시간입니다.",
      trend: metricHistory.ping
    },
    {
      key: "cpu",
      label: "CPU",
      value: `${formatPercent(serverHealth.load.cpuPercent)} / ${formatPercent(serverHealth.recent.avgCpuPercent10s)}`,
      tooltip: "왼쪽은 현재, 오른쪽은 최근 10초 평균 CPU 사용률입니다.",
      trend: metricHistory.cpu
    },
    {
      key: "loop",
      label: "루프",
      value: `${formatMilliseconds(serverHealth.load.eventLoopLagMs)} / ${formatMilliseconds(serverHealth.recent.peakEventLoopLagMs10s)}`,
      tooltip: "핑이 아니라 서버 처리 지연 시간입니다. 높을수록 서버 반응이 밀립니다.",
      trend: metricHistory.loop
    },
    {
      key: "heap",
      label: "Heap",
      value: `${formatBytes(serverHealth.process.heapUsedBytes)} / ${formatBytes(serverHealth.process.heapTotalBytes)}`,
      tooltip: "왼쪽은 현재 사용 중, 오른쪽은 확보된 전체 메모리입니다.",
      trend: metricHistory.heap
    },
    {
      key: "rss",
      label: "RSS",
      value: formatBytes(serverHealth.process.rssBytes),
      tooltip: "서버 프로세스가 실제로 점유 중인 메모리입니다. 계속 높아지면 메모리 압박이 커집니다.",
      trend: metricHistory.rss
    },
    {
      key: "fanout",
      label: "Fanout/s",
      value: `${formatRate(serverHealth.load.fanoutPerSecond)} / ${formatRate(serverHealth.recent.avgFanoutPerSecond10s)}`,
      tooltip: "이벤트를 실제 몇 명에게 전달했는지 합친 값입니다.",
      trend: metricHistory.fanout
    },
    {
      key: "sockets",
      label: "전체 소켓",
      value: String(serverHealth.load.connectedSockets),
      tooltip: "현재 서버 전체 실시간 연결 수입니다. 다른 방 연결도 포함됩니다.",
      trend: null
    },
    {
      key: "memory",
      label: "여유 메모리",
      value: `${formatBytes(serverHealth.system.freeMemoryBytes)} / ${formatBytes(serverHealth.system.totalMemoryBytes)}`,
      tooltip: "왼쪽은 지금 사용 가능한 메모리, 오른쪽은 전체 메모리입니다.",
      trend: null
    },
    {
      key: "state",
      label: "State/s",
      value: `${formatRate(serverHealth.load.roomStateUpdatesPerSecond)} / ${formatRate(serverHealth.recent.avgRoomStateUpdatesPerSecond10s)}`,
      tooltip: "방 전체 상태 스냅샷을 보내는 횟수입니다.",
      trend: null
    },
    {
      key: "rooms",
      label: "방/경기",
      value: `${serverHealth.load.activeRooms} / ${serverHealth.load.activeMatches}`,
      tooltip: null,
      trend: null
    },
    {
      key: "uptime",
      label: "업타임",
      value: formatUptime(serverHealth.uptimeSeconds),
      tooltip: null,
      trend: null
    },
    {
      key: "room-members",
      label: "방 인원",
      value: String(roomMemberCount),
      tooltip: null,
      trend: null
    },
    {
      key: "players",
      label: "전체 플레이어",
      value: String(serverHealth.load.activePlayers),
      tooltip: null,
      trend: null
    },
    {
      key: "moves",
      label: "Move/s",
      value: `${formatRate(serverHealth.load.movesPerSecond)} / ${formatRate(serverHealth.recent.avgMovesPerSecond10s)}`,
      tooltip: null,
      trend: null
    },
    {
      key: "chat",
      label: "Chat/s",
      value: `${formatRate(serverHealth.load.chatMessagesPerSecond)} / ${formatRate(serverHealth.recent.avgChatMessagesPerSecond10s)}`,
      tooltip: null,
      trend: null
    },
    {
      key: "runtime",
      label: "런타임",
      value: `${serverHealth.runtime.platform} ${serverHealth.runtime.arch}`,
      tooltip: null,
      trend: null
    },
    {
      key: "node",
      label: "Node",
      value: serverHealth.runtime.nodeVersion,
      tooltip: null,
      trend: null
    }
  ];
}

function metricTooltipStyle(anchorRect: DOMRect): CSSProperties {
  return {
    position: "fixed",
    left: `${Math.max(12, anchorRect.right - 168)}px`,
    top: `${Math.max(12, anchorRect.top - 12)}px`,
    transform: "translateY(-100%)",
    width: "168px",
    padding: "8px 9px",
    borderRadius: "10px",
    background: "rgba(8, 15, 30, 0.98)",
    border: "1px solid rgba(125, 211, 252, 0.18)",
    boxShadow: "0 18px 36px rgba(2, 6, 23, 0.32)",
    color: "#dbeafe",
    fontSize: "0.68rem",
    lineHeight: 1.45,
    textAlign: "left",
    pointerEvents: "none",
    zIndex: 999
  };
}

function roundMetricValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function appendTrendValue(values: number[], nextValue: number) {
  return [...values, nextValue].slice(-SERVER_METRIC_HISTORY_LIMIT);
}

function appendServerMetricHistory(history: MetricHistory, serverHealth: ServerHealthSnapshot): MetricHistory {
  return {
    ...history,
    cpu: appendTrendValue(history.cpu, serverHealth.load.cpuPercent),
    loop: appendTrendValue(history.loop, serverHealth.load.eventLoopLagMs),
    heap: appendTrendValue(history.heap, serverHealth.process.heapUsedBytes),
    rss: appendTrendValue(history.rss, serverHealth.process.rssBytes),
    fanout: appendTrendValue(history.fanout, serverHealth.load.fanoutPerSecond)
  };
}

function buildSparklineGeometry(values: number[], width: number, height: number) {
  if (values.length === 0) {
    const baselineY = height - 8;
    return {
      areaPath: `M0 ${baselineY} L${width} ${baselineY} L${width} ${height} L0 ${height} Z`,
      linePath: `M0 ${baselineY} L${width} ${baselineY}`
    };
  }

  const baselineY = height - 8;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
    const y = baselineY - ((value - minValue) / range) * (height - 12);
    return {
      x: roundMetricValue(x),
      y: roundMetricValue(y)
    };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L${roundMetricValue(points[points.length - 1]?.x ?? width)} ${height} L0 ${height} Z`;

  return {
    areaPath,
    linePath
  };
}
