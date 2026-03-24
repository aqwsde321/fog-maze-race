import { useEffect, useRef, type CSSProperties } from "react";

import type { Direction } from "@fog-maze-race/shared/domain/grid-position";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { HostControls } from "../features/rooms/HostControls.js";
import { PlayerSidebar } from "../features/rooms/PlayerSidebar.js";
import { ResultOverlay } from "../features/rooms/ResultOverlay.js";
import { GameCanvas } from "../game/GameCanvas.js";

type GameScreenProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
  countdownValue: number | null;
  onStartGame: () => void;
  onRenameRoom: (name: string) => void;
  onSetVisibilitySize: (visibilitySize: 3 | 5 | 7) => void;
  onForceEndRoom: () => void;
  onLeaveRoom: () => void;
  onMove: (direction: Direction) => void;
};

export function GameScreen({
  snapshot,
  selfPlayerId,
  countdownValue,
  onStartGame,
  onRenameRoom,
  onSetVisibilitySize,
  onForceEndRoom,
  onLeaveRoom,
  onMove
}: GameScreenProps) {
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const isHost = snapshot.room.hostPlayerId === selfPlayerId;
  const canStart = snapshot.room.status === "waiting" && isHost;
  const canMove = snapshot.room.status === "waiting" || snapshot.room.status === "countdown" || snapshot.room.status === "playing";
  const displayStatus = snapshot.room.status === "countdown" ? "playing" : snapshot.room.status;

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
          {snapshot.room.status === "countdown" && countdownValue !== null ? (
            <div data-testid="countdown-overlay" style={countdownOverlayStyle}>
              <div style={countdownCardStyle}>
                <p style={countdownLabelStyle}>시작까지</p>
                <strong style={countdownValueStyle}>{countdownValue}</strong>
              </div>
            </div>
          ) : null}
          <ResultOverlay snapshot={snapshot} />
        </div>
      </div>

      <div style={railStyle}>
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
                roomName={snapshot.room.name}
                visibilitySize={snapshot.room.visibilitySize}
                canEditVisibility={snapshot.room.status === "waiting"}
                onRenameRoom={onRenameRoom}
                onSetVisibilitySize={onSetVisibilitySize}
              />
            </div>
          ) : null}
          <div style={actionRailStyle}>
            {isHost ? (
              <button type="button" onClick={onStartGame} disabled={!canStart} style={startButtonStyle}>
                시작
              </button>
            ) : null}
            <button type="button" onClick={onLeaveRoom} style={ghostButtonStyle}>
              나가기
            </button>
            {isHost ? <span aria-hidden="true" style={actionDividerStyle} /> : null}
            {isHost ? (
              <button type="button" onClick={onForceEndRoom} disabled={snapshot.room.status === "waiting"} style={dangerButtonStyle}>
                강제 종료
              </button>
            ) : null}
          </div>
        </header>

        <PlayerSidebar snapshot={snapshot} selfPlayerId={selfPlayerId} />
      </div>
    </section>
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
  gridTemplateColumns: "minmax(0, 1fr) clamp(184px, 14vw, 212px)",
  gap: "clamp(8px, 1vw, 14px)",
  width: "100%",
  maxWidth: "1460px",
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
  gap: "8px",
  width: "100%",
  minWidth: 0,
  alignSelf: "start"
};

const topBarStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: "16px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.16)"
};

const roomHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px"
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
  fontSize: "0.76rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase"
};

const roomNameStyle: CSSProperties = {
  margin: "3px 0 0",
  fontSize: "1.04rem",
  lineHeight: 1.05
};

const statusPanelStyle: CSSProperties = {
  flexShrink: 0,
  minWidth: "60px",
  textAlign: "right"
};

const statusValueStyle: CSSProperties = {
  display: "block",
  marginTop: "3px",
  fontSize: "0.8rem",
  color: "#f8fafc"
};

const actionRailStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "6px"
};

const actionDividerStyle: CSSProperties = {
  width: "1px",
  height: "18px",
  background: "rgba(148, 163, 184, 0.14)"
};

const dangerButtonStyle: CSSProperties = {
  minHeight: "34px",
  padding: "7px 9px",
  borderRadius: "10px",
  border: "1px solid rgba(248, 113, 113, 0.2)",
  background: "rgba(239, 68, 68, 0.12)",
  color: "#fecaca",
  cursor: "pointer",
  fontSize: "0.8rem"
};

const startButtonStyle: CSSProperties = {
  minHeight: "34px",
  padding: "7px 10px",
  borderRadius: "10px",
  border: 0,
  background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
  color: "#082032",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.8rem"
};

const ghostButtonStyle: CSSProperties = {
  minHeight: "34px",
  padding: "7px 10px",
  borderRadius: "10px",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: "0.8rem"
};

const canvasFrameStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  boxSizing: "border-box",
  padding: "8px",
  borderRadius: "14px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.82), rgba(6, 14, 26, 0.88))",
  border: "1px solid rgba(56, 189, 248, 0.12)",
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
