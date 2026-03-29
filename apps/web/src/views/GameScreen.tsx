import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { ServerHealthSnapshot } from "@fog-maze-race/shared/contracts/server-health";
import type { RoomBotKind } from "@fog-maze-race/shared/contracts/realtime";
import type { Direction } from "@fog-maze-race/shared/domain/grid-position";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { HostControls } from "../features/rooms/HostControls.js";
import { PlayerSidebar } from "../features/rooms/PlayerSidebar.js";
import { ResultOverlay } from "../features/rooms/ResultOverlay.js";
import { RoomChatPanel } from "../features/rooms/RoomChatPanel.js";
import { GameCanvas } from "../game/GameCanvas.js";
import { getSocketClient } from "../services/socket-client.js";

type GameScreenProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
  countdownValue: number | null;
  onStartGame: () => void;
  onRenameRoom: (name: string) => void;
  onSetVisibilitySize: (visibilitySize: 3 | 5 | 7) => void;
  onAddBots?: (input: { kind: RoomBotKind; nicknames: string[] }) => void;
  onRemoveBots?: (playerIds?: string[]) => void;
  onForceEndRoom: () => void;
  onResetToWaiting: () => void;
  onLeaveRoom: () => void;
  onMove: (direction: Direction) => void;
  onSendChatMessage: (content: string) => void;
};

const SERVER_HEALTH_POLL_INTERVAL_MS = 2_000;
const SERVER_METRIC_HISTORY_LIMIT = 16;
const SHELL_RAIL_WIDTH = "clamp(156px, 10.5vw, 178px)";
const SHELL_COLUMN_GAP = "clamp(6px, 0.8vw, 10px)";
const SHELL_EDGE_OFFSET = "clamp(8px, 1vw, 12px)";

type PingMetricState = {
  avgMs10s: number | null;
  currentMs: number | null;
};

type TrendMetricKey = "cpu" | "fanout" | "heap" | "loop" | "ping" | "rss";

type MetricHistory = Record<TrendMetricKey, number[]>;

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
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isServerPanelOpen, setIsServerPanelOpen] = useState(false);
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
      nickname: member.nickname
    }));
  const serverMetrics = serverHealth ? buildServerMetrics(serverHealth, snapshot.members.length, pingMetric, metricHistory) : [];

  useEffect(() => {
    if (!canMove) {
      return;
    }

    canvasFrameRef.current?.focus({ preventScroll: true });
  }, [canMove, snapshot.room.status]);

  useEffect(() => {
    const resetViewportScroll = () => {
      if (window.scrollX === 0 && window.scrollY === 0) {
        return;
      }

      window.scrollTo(0, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = toDirection(event.key);
      if (!direction) {
        return;
      }

      if (isEditableTarget(event.target)) {
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
      if (!toDirection(event.key) || isEditableTarget(event.target)) {
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
            canvasFrameRef.current?.focus({ preventScroll: true });
          }}
          tabIndex={0}
        >
          <GameCanvas snapshot={snapshot} selfPlayerId={selfPlayerId} />
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
          <ResultOverlay snapshot={snapshot} isHost={isHost} onResetToWaiting={onResetToWaiting} />
        </div>
      </div>

      <div data-testid="game-rail" style={railStyle}>
        <header style={topBarStyle}>
          <div style={roomHeaderRowStyle}>
            <div style={roomHeaderStyle}>
              <p style={labelStyle}>Room</p>
              <h2 style={roomNameStyle}>{snapshot.room.name}</h2>
            </div>
            <div style={statusPanelStyle}>
              <p style={labelStyle}>Status</p>
              <strong data-testid="room-status" style={statusValueStyle}>
                {displayStatus}
              </strong>
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
          <div style={actionPanelStyle}>
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
                <button type="button" onClick={onForceEndRoom} disabled={snapshot.room.status === "waiting"} style={dangerButtonStyle}>
                  강제 종료
                </button>
              ) : null}
            </div>
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

const countdownOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none"
};

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
