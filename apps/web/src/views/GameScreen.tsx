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
  onForceEndRoom,
  onLeaveRoom,
  onMove
}: GameScreenProps) {
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const isHost = snapshot.room.hostPlayerId === selfPlayerId;
  const canStart = snapshot.room.status === "waiting" && isHost;

  useEffect(() => {
    if (snapshot.room.status !== "playing") {
      return;
    }

    canvasFrameRef.current?.focus();
  }, [snapshot.room.status]);

  return (
    <section style={shellStyle}>
      <div style={mainColumnStyle}>
        <header style={topBarStyle}>
          <div>
            <p style={labelStyle}>Room</p>
            <h2 style={roomNameStyle}>{snapshot.room.name}</h2>
          </div>
          {isHost ? (
            <HostControls
              roomName={snapshot.room.name}
              roomStatus={snapshot.room.status}
              onRenameRoom={onRenameRoom}
              onForceEndRoom={onForceEndRoom}
            />
          ) : null}
          <div style={statusPanelStyle}>
            <p style={labelStyle}>Status</p>
            <strong data-testid="room-status" style={statusValueStyle}>
              {snapshot.room.status}
              {snapshot.room.status === "countdown" && countdownValue !== null ? ` · ${countdownValue}` : ""}
            </strong>
          </div>
          <div style={buttonRowStyle}>
            <button type="button" onClick={onStartGame} disabled={!canStart} style={startButtonStyle}>
              시작
            </button>
            <button type="button" onClick={onLeaveRoom} style={ghostButtonStyle}>
              나가기
            </button>
          </div>
        </header>

        <div
          ref={canvasFrameRef}
          data-testid="game-shell"
          style={canvasFrameStyle}
          onPointerDown={() => {
            canvasFrameRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (snapshot.room.status !== "playing") {
              return;
            }

            const direction = toDirection(event.key);
            if (!direction) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            onMove(direction);
          }}
          tabIndex={0}
        >
          <GameCanvas snapshot={snapshot} selfPlayerId={selfPlayerId} />
          <ResultOverlay snapshot={snapshot} />
        </div>
      </div>

      <PlayerSidebar snapshot={snapshot} selfPlayerId={selfPlayerId} />
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

const shellStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 300px",
  gap: "20px",
  width: "min(1240px, 100%)",
  alignItems: "start"
};

const mainColumnStyle: CSSProperties = {
  display: "grid",
  gap: "18px"
};

const topBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(260px, auto) auto auto",
  gap: "16px",
  alignItems: "center",
  padding: "20px 24px",
  borderRadius: "26px",
  background: "rgba(8, 15, 30, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.18)"
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.82rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase"
};

const roomNameStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.8rem"
};

const statusPanelStyle: CSSProperties = {
  padding: "0 6px"
};

const statusValueStyle: CSSProperties = {
  display: "block",
  marginTop: "8px",
  fontSize: "1.02rem",
  color: "#f8fafc"
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px"
};

const startButtonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: "999px",
  border: 0,
  background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
  color: "#082032",
  fontWeight: 700,
  cursor: "pointer"
};

const ghostButtonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer"
};

const canvasFrameStyle: CSSProperties = {
  position: "relative",
  padding: "18px",
  borderRadius: "28px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.94), rgba(7, 17, 31, 0.98))",
  border: "1px solid rgba(148, 163, 184, 0.12)",
  outline: "none"
};
