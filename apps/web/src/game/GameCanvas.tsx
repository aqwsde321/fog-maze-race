import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { isInsideZone } from "@fog-maze-race/shared/maps/map-definitions";

import { createSceneController, type SceneController } from "./pixi/scene-controller.js";
import { createBoardLayout } from "./pixi/renderers/board-render.js";
import {
  PLAYER_MARKER_DIAMETER_RATIO,
  getPlayerMarkerStyle
} from "./player-marker.js";
import { getPlayerRenderOrder } from "./player-render-order.js";
import { Fragment } from "react";

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
        borderRadius: "20px",
        overflow: "hidden",
        background: "transparent"
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 960, height: 540 });
  const map = snapshot.match?.map ?? snapshot.previewMap;

  useEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      setViewport({
        width: element.clientWidth || 960,
        height: element.clientHeight || 540
      });
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!map) {
    return <div data-testid="game-canvas" style={canvasShellStyle} />;
  }

  const members = snapshot.members.filter((member) => member.position && isInsideZone(map.startZone, member.position));
  const layout = createBoardLayout(map, {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height
  });
  const startZoneWidth = map.startZone.maxX - map.startZone.minX + 1;
  const startZoneHeight = map.startZone.maxY - map.startZone.minY + 1;
  const panelPadding = Math.max(6, Math.floor(layout.tileSize * 0.26));
  const dotSize = Math.max(15, Math.floor(layout.tileSize * PLAYER_MARKER_DIAMETER_RATIO));
  const startPanel = toPanelBox(layout, map.startZone, panelPadding);
  const mazePanel = toPanelBox(layout, map.mazeZone, panelPadding);

  return (
    <div data-testid="game-canvas" style={canvasShellStyle}>
      <div ref={stageRef} data-testid="preview-stage" style={previewStageStyle}>
        <div
          data-testid="preview-maze-panel"
          style={{
            ...previewPanelStyle,
            ...mazePanel,
            background: "linear-gradient(180deg, rgba(6, 12, 24, 0.98), rgba(2, 6, 23, 0.98))",
            borderColor: "rgba(54, 86, 127, 0.5)",
            boxShadow: "none"
          }}
        >
          <div style={previewHintStyle}>
            <strong style={previewHintTitleStyle}>미로는 시작 후 공개</strong>
            <p style={previewHintBodyStyle}>카운트다운 동안 시작 구역에서 위치를 정리하세요.</p>
          </div>
        </div>
        <div
          data-testid="preview-start-panel"
          style={{
            ...previewPanelStyle,
            ...startPanel,
            background: "rgba(8, 27, 44, 0.88)",
            borderColor: "rgba(46, 127, 149, 0.52)",
            boxShadow: "none"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${layout.offsetX + map.startZone.minX * layout.tileSize}px`,
            top: `${layout.offsetY + map.startZone.minY * layout.tileSize}px`,
            width: `${startZoneWidth * layout.tileSize}px`,
            height: `${startZoneHeight * layout.tileSize}px`,
            display: "grid",
            gridTemplateColumns: `repeat(${startZoneWidth}, ${layout.tileSize}px)`,
            gridTemplateRows: `repeat(${startZoneHeight}, ${layout.tileSize}px)`
          }}
        >
          {Array.from({ length: startZoneWidth * startZoneHeight }, (_, index) => (
            <div key={index} data-testid="preview-start-tile" style={previewTileStyle(layout.tileSize)} />
          ))}
        </div>
        {getPlayerRenderOrder(members, selfPlayerId).map((member) => {
          const position = member.position!;
          const x = layout.offsetX + position.x * layout.tileSize + layout.tileSize / 2 - dotSize / 2;
          const y = layout.offsetY + position.y * layout.tileSize + layout.tileSize / 2 - dotSize / 2;
          const shape = member.shape;
          const ringSize = dotSize + 8;

          return (
            <Fragment key={member.playerId}>
              <div
                style={{
                  ...playerMarkerWrapStyle(ringSize),
                  left: `${x - (ringSize - dotSize) / 2}px`,
                  top: `${y - (ringSize - dotSize) / 2}px`
                }}
              >
                {member.playerId === selfPlayerId ? (
                  <span
                    data-marker-self-ring="true"
                    style={{
                      ...playerMarkerPieceStyle(ringSize),
                      ...getPlayerMarkerStyle(shape, ringSize),
                      color: "#f8fafc"
                    }}
                  />
                ) : null}
                <span
                  data-marker-shape={shape}
                  style={{
                    ...playerMarkerPieceStyle(dotSize),
                    ...getPlayerMarkerStyle(shape, dotSize),
                    color: member.color
                  }}
                />
              </div>
            </Fragment>
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
  position: "relative",
  borderRadius: "18px",
  overflow: "hidden",
  background: "transparent"
};

const previewStageStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%"
};

const previewPanelStyle: CSSProperties = {
  position: "absolute",
  borderRadius: 0,
  border: "1px solid transparent"
};

const previewHintStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: "10px",
  textAlign: "center",
  padding: "24px",
  color: "#8fa8c7"
};

const previewHintTitleStyle: CSSProperties = {
  fontSize: "1rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#d8e4f5"
};

const previewHintBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.88rem",
  lineHeight: 1.5,
  maxWidth: "22ch"
};

function previewTileStyle(tileSize: number): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    border: `1px solid rgba(4, 52, 78, ${tileSize >= 22 ? 0.7 : 0.58})`,
    background: "#34c3df"
  };
}

function playerMarkerWrapStyle(size: number): CSSProperties {
  return {
    position: "absolute",
    width: `${size}px`,
    height: `${size}px`
  };
}

function playerMarkerPieceStyle(size: number): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: `${size}px`,
    height: `${size}px`
  };
}

function toPanelBox(
  layout: ReturnType<typeof createBoardLayout>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  padding: number
): CSSProperties {
  return {
    left: `${layout.offsetX + bounds.minX * layout.tileSize - padding}px`,
    top: `${layout.offsetY + bounds.minY * layout.tileSize - padding}px`,
    width: `${(bounds.maxX - bounds.minX + 1) * layout.tileSize + padding * 2 - 2}px`,
    height: `${(bounds.maxY - bounds.minY + 1) * layout.tileSize + padding * 2 - 2}px`
  };
}
