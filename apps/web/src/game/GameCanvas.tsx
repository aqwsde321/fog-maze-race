import { useEffect, useRef, type CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { isInsideZone } from "@fog-maze-race/shared/maps/map-definitions";

import { createSceneController, type SceneController } from "./pixi/scene-controller.js";

type GameCanvasProps = {
  snapshot: RoomSnapshot | null;
  selfPlayerId: string | null;
};

export function GameCanvas({ snapshot, selfPlayerId }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const shouldUsePixi = Boolean(
    snapshot?.match && (snapshot.room.status === "playing" || snapshot.room.status === "ended")
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!shouldUsePixi || !containerRef.current || controllerRef.current) {
        return;
      }

      const controller = await createSceneController(containerRef.current);
      if (cancelled) {
        controller.destroy();
        return;
      }

      controllerRef.current = controller;
      controller.render(snapshot, selfPlayerId);
    }

    init().catch((error) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [shouldUsePixi]);

  useEffect(() => {
    if (!shouldUsePixi) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      return;
    }

    controllerRef.current?.render(snapshot, selfPlayerId);
  }, [selfPlayerId, shouldUsePixi, snapshot]);

  const previewMap = snapshot?.match?.map ?? snapshot?.previewMap ?? null;
  if (!shouldUsePixi && snapshot && previewMap) {
    return <StartZonePreview snapshot={snapshot} selfPlayerId={selfPlayerId} />;
  }

  return (
    <div
      ref={containerRef}
      data-testid="game-canvas"
      style={{
        width: "100%",
        minHeight: "420px",
        height: "clamp(420px, 62vh, 760px)",
        display: "grid",
        placeItems: "center",
        borderRadius: "26px",
        overflow: "hidden",
        background: "rgba(7, 17, 31, 0.94)",
        border: "1px solid rgba(56, 189, 248, 0.18)"
      }}
    />
  );
}

function StartZonePreview({
  snapshot,
  selfPlayerId
}: {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
}) {
  const map = snapshot.match?.map ?? snapshot.previewMap;
  if (!map) {
    return <div data-testid="game-canvas" style={canvasShellStyle} />;
  }

  const zoneWidth = map.startZone.maxX - map.startZone.minX + 1;
  const zoneHeight = map.startZone.maxY - map.startZone.minY + 1;
  const tileSize = 82;
  const members = snapshot.members.filter((member) => member.position && isInsideZone(map.startZone, member.position));

  return (
    <div data-testid="game-canvas" style={canvasShellStyle}>
      <div
        style={{
          ...previewBoardStyle,
          width: zoneWidth * tileSize,
          height: zoneHeight * tileSize,
          gridTemplateColumns: `repeat(${zoneWidth}, ${tileSize}px)`,
          gridTemplateRows: `repeat(${zoneHeight}, ${tileSize}px)`
        }}
      >
        {Array.from({ length: zoneWidth * zoneHeight }, (_, index) => (
          <div key={index} style={previewTileStyle} />
        ))}
        {members.map((member) => {
          const position = member.position!;
          const x = (position.x - map.startZone.minX) * tileSize + tileSize / 2;
          const y = (position.y - map.startZone.minY) * tileSize + tileSize / 2;

          return (
            <div
              key={member.playerId}
              style={{
                ...playerDotStyle,
                left: x,
                top: y,
                background: member.color,
                boxShadow:
                  member.playerId === selfPlayerId
                    ? "0 0 0 4px rgba(248,250,252,0.92)"
                    : "0 0 0 3px rgba(255,255,255,0.08)"
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const canvasShellStyle: CSSProperties = {
  width: "100%",
  minHeight: "420px",
  height: "clamp(420px, 62vh, 760px)",
  display: "grid",
  placeItems: "center",
  borderRadius: "26px",
  overflow: "hidden",
  background: "rgba(7, 17, 31, 0.94)",
  border: "1px solid rgba(56, 189, 248, 0.18)"
};

const previewBoardStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  padding: "20px",
  borderRadius: "28px",
  background: "rgba(8, 27, 44, 0.92)",
  border: "1px solid rgba(34, 211, 238, 0.34)",
  boxShadow: "0 18px 54px rgba(2, 6, 23, 0.3)"
};

const previewTileStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  border: "1px solid rgba(4, 52, 78, 0.9)",
  background: "#34c3df"
};

const playerDotStyle: CSSProperties = {
  position: "absolute",
  width: "34px",
  height: "34px",
  marginLeft: "-17px",
  marginTop: "-17px",
  borderRadius: "999px"
};
