import { Application, Container, Graphics, Text } from "pixi.js";

import type { MapView, RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { createVisibilityProjection, toTileKey } from "@fog-maze-race/shared/visibility/apply-visibility";
import type { MapDefinition } from "@fog-maze-race/shared/maps/map-definitions";

import { createBoardLayout, getTileVisual } from "./renderers/board-render.js";
import { renderFogOverlay } from "./renderers/fog-renderer.js";
import { buildPlayerMarkerMetaMap, type PlayerPattern } from "../player-marker.js";
import { getPlayerRenderOrder } from "../player-render-order.js";

export type SceneController = {
  render: (snapshot: RoomSnapshot | null, selfPlayerId: string | null) => void;
  destroy: () => void;
};

export async function createSceneController(container: HTMLDivElement): Promise<SceneController> {
  const app = new Application();
  await app.init({
    width: 640,
    height: 520,
    antialias: true,
    backgroundColor: 0x07111f
  });

  const panelLayer = new Graphics();
  const tileLayer = new Graphics();
  const playerLayer = new Graphics();
  const playerLabelLayer = new Container();
  const fogLayer = new Graphics();

  app.stage.addChild(panelLayer);
  app.stage.addChild(tileLayer);
  app.stage.addChild(playerLayer);
  app.stage.addChild(playerLabelLayer);
  app.stage.addChild(fogLayer);
  container.replaceChildren(app.canvas);

  return {
    render(snapshot, selfPlayerId) {
      panelLayer.clear();
      tileLayer.clear();
      playerLayer.clear();
      for (const child of playerLabelLayer.removeChildren()) {
        child.destroy();
      }
      fogLayer.clear();

      const match = snapshot?.match;
      const map = match?.map ?? snapshot?.previewMap;
      const mode = match ? "live" : "preview";
      if (!snapshot || !map) {
        drawPlaceholder(tileLayer);
        return;
      }

      const layout = createBoardLayout(map, {
        viewportWidth: container.clientWidth || 640,
        viewportHeight: container.clientHeight || 360
      }, mode === "preview" ? map.startZone : undefined);
      app.renderer.resize(layout.viewportWidth, layout.viewportHeight);
      drawZonePanels(panelLayer, layout, map, mode);

      const renderMembers =
        !match && snapshot.previewMap
          ? snapshot.members.map((member, index) => ({
              ...member,
              position: member.position ?? snapshot.previewMap?.startSlots[index] ?? null
            }))
          : snapshot.members;

      const projection = match && selfPlayerId
        ? createVisibilityProjection({
            map: toVisibilityMap(map),
            selfPlayerId,
            members: renderMembers.map((member) => ({
              playerId: member.playerId,
              position: member.position,
              state: member.state
            }))
          })
        : {
            showFullMap: true,
            visibleTileKeys: [],
            visiblePlayerIds: renderMembers
              .filter((member) => Boolean(member.position))
              .map((member) => member.playerId)
          };

      const visibleTileSet = new Set(projection.visibleTileKeys);
      const visiblePlayerSet = new Set(projection.visiblePlayerIds);
      const markerMetaMap = buildPlayerMarkerMetaMap(renderMembers);

      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const tile = map.tiles[y]?.[x] ?? " ";
          const position = { x, y };
          const isVisible = projection.showFullMap || visibleTileSet.has(toTileKey(position));
          const visual = getTileVisual({
            tile,
            map,
            position,
            isVisible,
            mode
          });
          if (!visual) {
            continue;
          }

          tileLayer
            .rect(
              layout.offsetX + x * layout.tileSize,
              layout.offsetY + y * layout.tileSize,
              layout.tileSize - 2,
              layout.tileSize - 2
            )
            .fill({ color: visual.fillColor, alpha: visual.alpha });
        }
      }

      for (const member of getPlayerRenderOrder(renderMembers, selfPlayerId)) {
        if (!member.position || (!projection.showFullMap && !visiblePlayerSet.has(member.playerId))) {
          continue;
        }
        const markerMeta = markerMetaMap.get(member.playerId);
        if (!markerMeta) {
          continue;
        }

        const centerX = layout.offsetX + member.position.x * layout.tileSize + layout.tileSize / 2;
        const centerY = layout.offsetY + member.position.y * layout.tileSize + layout.tileSize / 2;
        const markerRadius = layout.tileSize * 0.27;
        playerLayer
          .circle(centerX, centerY, markerRadius)
          .fill({ color: toPixiColor(member.color) })
          .stroke({ color: 0x08111f, width: 3, alpha: 0.96 });
        drawMarkerPattern(playerLayer, centerX, centerY, markerRadius * 0.92, markerMeta.pattern, markerMeta.contrastColor);
        renderMarkerLabel(playerLabelLayer, centerX, centerY, markerMeta.label, markerMeta.contrastColor, layout.tileSize);

        if (member.playerId === selfPlayerId) {
          playerLayer
            .circle(centerX, centerY, layout.tileSize * 0.35)
            .stroke({ color: 0xf8fafc, width: 3, alpha: 0.95 });
        }
      }

      if (match) {
        renderFogOverlay(fogLayer, {
          match,
          tileSize: layout.tileSize,
          offsetX: layout.offsetX,
          offsetY: layout.offsetY,
          visibleTileKeys: projection.visibleTileKeys,
          showFullMap: projection.showFullMap
        });
      }
    },
    destroy() {
      app.destroy({ removeView: true }, true);
    }
  };
}

function drawPlaceholder(graphics: Graphics) {
  graphics
    .rect(0, 0, 640, 420)
    .fill({ color: 0x07111f })
    .rect(48, 120, 544, 180)
    .fill({ color: 0x0f172a, alpha: 0.82 })
    .stroke({ color: 0x38bdf8, width: 2, alpha: 0.3 });
}

function toPixiColor(color: string) {
  return Number.parseInt(color.replace("#", ""), 16);
}

function drawMarkerPattern(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  pattern: PlayerPattern,
  color: string
) {
  const stroke = {
    color: toPixiColor(color),
    width: Math.max(1.5, radius * 0.18),
    alpha: 0.3
  };

  if (pattern === "horizontal" || pattern === "cross") {
    graphics.moveTo(centerX - radius * 0.72, centerY);
    graphics.lineTo(centerX + radius * 0.72, centerY);
    graphics.stroke(stroke);
  }

  if (pattern === "vertical" || pattern === "cross") {
    graphics.moveTo(centerX, centerY - radius * 0.72);
    graphics.lineTo(centerX, centerY + radius * 0.72);
    graphics.stroke(stroke);
  }

  if (pattern === "diagonal-up") {
    graphics.moveTo(centerX - radius * 0.64, centerY + radius * 0.64);
    graphics.lineTo(centerX + radius * 0.64, centerY - radius * 0.64);
    graphics.stroke(stroke);
  }

  if (pattern === "diagonal-down") {
    graphics.moveTo(centerX - radius * 0.64, centerY - radius * 0.64);
    graphics.lineTo(centerX + radius * 0.64, centerY + radius * 0.64);
    graphics.stroke(stroke);
  }
}

function renderMarkerLabel(
  layer: Container,
  centerX: number,
  centerY: number,
  label: string,
  color: string,
  tileSize: number
) {
  const text = new Text({
    text: label,
    style: {
      fill: color,
      fontFamily: "monospace",
      fontWeight: "700",
      fontSize: Math.max(10, Math.floor(tileSize * 0.24))
    }
  });
  text.anchor.set(0.5);
  text.position.set(centerX, centerY);
  layer.addChild(text);
}

function toVisibilityMap(map: MapView): MapDefinition {
  return {
    mapId: map.mapId,
    name: map.mapId,
    width: map.width,
    height: map.height,
    tiles: map.tiles,
    startZone: map.startZone,
    mazeZone: map.mazeZone,
    goalZone: map.goalZone,
    startSlots: map.startSlots,
    connectorTiles: map.connectorTiles,
    visibilityRadius: map.visibilityRadius
  };
}

function drawZonePanels(
  graphics: Graphics,
  layout: ReturnType<typeof createBoardLayout>,
  map: Pick<MapView, "startZone" | "mazeZone" | "connectorTiles">,
  mode: "live" | "preview"
) {
  drawPanel(graphics, layout, map.startZone, {
    fillColor: 0x0a1b2c,
    fillAlpha: 0.84,
    strokeColor: 0x22d3ee,
    strokeAlpha: 0.18
  });
  if (mode === "preview") {
    return;
  }

  drawPanel(graphics, layout, map.mazeZone, {
    fillColor: 0x07111f,
    fillAlpha: 0.16,
    strokeColor: 0x1d4f91,
    strokeAlpha: 0
  });
  drawPanel(graphics, layout, toBounds(map.connectorTiles), {
    fillColor: 0x0b1c26,
    fillAlpha: 0.28,
    strokeColor: 0x14b8a6,
    strokeAlpha: 0
  });
}

function drawPanel(
  graphics: Graphics,
  layout: ReturnType<typeof createBoardLayout>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  style: {
    fillColor: number;
    fillAlpha: number;
    strokeColor: number;
    strokeAlpha: number;
  }
) {
  const padding = Math.max(4, Math.floor(layout.tileSize * 0.18));
  const x = layout.offsetX + bounds.minX * layout.tileSize - padding;
  const y = layout.offsetY + bounds.minY * layout.tileSize - padding;
  const width = (bounds.maxX - bounds.minX + 1) * layout.tileSize + padding * 2 - 2;
  const height = (bounds.maxY - bounds.minY + 1) * layout.tileSize + padding * 2 - 2;

  const shape = graphics.roundRect(x, y, width, height, Math.max(12, Math.floor(layout.tileSize * 0.28)));
  shape.fill({ color: style.fillColor, alpha: style.fillAlpha });

  if (style.strokeAlpha > 0) {
    shape.stroke({ color: style.strokeColor, width: 1.5, alpha: style.strokeAlpha });
  }
}

function toBounds(positions: Array<{ x: number; y: number }>) {
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x));
  const maxY = Math.max(...positions.map((position) => position.y));

  return { minX, minY, maxX, maxY };
}
