import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";

import type { MapView, RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { createVisibilityProjection, toTileKey } from "@fog-maze-race/shared/visibility/apply-visibility";
import type { MapDefinition } from "@fog-maze-race/shared/maps/map-definitions";

import { createBoardLayout, getTileVisual } from "./renderers/board-render.js";
import { renderFogOverlay } from "./renderers/fog-renderer.js";
import {
  PLAYER_MARKER_DIAMETER_RATIO,
  PLAYER_MARKER_SELF_RING_RATIO,
  drawPlayerMarkerEyes,
  drawPlayerMarkerShape
} from "../player-marker.js";
import { getPlayerRenderOrder } from "../player-render-order.js";
import {
  createTileMemoryState,
  resolveTileVisibilityState,
  updateTileMemory
} from "../tile-memory.js";
import { clampOverlayCenterX, collectActivePlayerChats } from "./player-overlays.js";
import { resolveRenderMembers } from "../player-overlay-layout.js";

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
  const fogLayer = new Graphics();
  const overlayLayer = new Container();

  app.stage.addChild(panelLayer);
  app.stage.addChild(tileLayer);
  app.stage.addChild(playerLayer);
  app.stage.addChild(fogLayer);
  app.stage.addChild(overlayLayer);
  container.replaceChildren(app.canvas);
  let tileMemory = createTileMemoryState();
  let latestSnapshot: RoomSnapshot | null = null;
  let latestSelfPlayerId: string | null = null;
  let overlayRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearOverlayRefreshTimeout = () => {
    if (overlayRefreshTimeout) {
      clearTimeout(overlayRefreshTimeout);
      overlayRefreshTimeout = null;
    }
  };

  const controller: SceneController = {
    render(snapshot, selfPlayerId) {
      latestSnapshot = snapshot;
      latestSelfPlayerId = selfPlayerId;
      panelLayer.clear();
      tileLayer.clear();
      playerLayer.clear();
      fogLayer.clear();
      for (const child of overlayLayer.removeChildren()) {
        child.destroy();
      }
      clearOverlayRefreshTimeout();

      const match = snapshot?.match;
      const map = match?.map ?? snapshot?.previewMap;
      const mode = match ? "live" : "preview";
      if (!snapshot || !map) {
        tileMemory = createTileMemoryState();
        drawPlaceholder(tileLayer);
        return;
      }

      const layout = createBoardLayout(map, {
        viewportWidth: container.clientWidth || 640,
        viewportHeight: container.clientHeight || 360
      }, mode === "preview" ? map.startZone : undefined);
      app.renderer.resize(layout.viewportWidth, layout.viewportHeight);
      drawZonePanels(panelLayer, layout, map, mode);

      const renderMembers = resolveRenderMembers(snapshot);
      const selfMember = renderMembers.find((member) => member.playerId === selfPlayerId) ?? null;

      const projection = match && selfPlayerId && selfMember?.role !== "spectator"
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
      const activeChatByPlayer = collectActivePlayerChats({
        chat: snapshot.chat
      });
      tileMemory = updateTileMemory({
        previous: tileMemory,
        snapshot,
        selfPlayerId,
        visibleTileKeys: projection.visibleTileKeys
      });

      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const tile = map.tiles[y]?.[x] ?? " ";
          const position = { x, y };
          const tileKey = toTileKey(position);
          const visibility = resolveTileVisibilityState({
            showFullMap: projection.showFullMap,
            tileKey,
            visibleTileKeys: visibleTileSet,
            rememberedTileKeys: tileMemory.rememberedTileKeys
          });
          const visual = getTileVisual({
            tile,
            map,
            position,
            visibility,
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

      if (match) {
        for (const box of match.itemBoxes ?? []) {
          if (!projection.showFullMap && !visibleTileSet.has(toTileKey(box.position))) {
            continue;
          }

          drawItemBox(tileLayer, layout, box.position);
        }

        for (const trap of match.traps ?? []) {
          if (!projection.showFullMap && !visibleTileSet.has(toTileKey(trap.position))) {
            continue;
          }

          drawIceTrap(tileLayer, layout, trap.position, trap.state);
        }
      }

      for (const member of getPlayerRenderOrder(renderMembers, selfPlayerId)) {
        if (!member.position || (!projection.showFullMap && !visiblePlayerSet.has(member.playerId))) {
          continue;
        }

        const centerX = layout.offsetX + member.position.x * layout.tileSize + layout.tileSize / 2;
        const centerY = layout.offsetY + member.position.y * layout.tileSize + layout.tileSize / 2;
        const markerRadius = (layout.tileSize * PLAYER_MARKER_DIAMETER_RATIO) / 2;
        const markerShape = member.shape;
        drawPlayerMarkerShape(playerLayer, markerShape, centerX, centerY, markerRadius, {
          color: toPixiColor(member.color),
          mode: "fill"
        });

        if (member.playerId === selfPlayerId) {
          drawPlayerMarkerShape(
            playerLayer,
            markerShape,
            centerX,
            centerY,
            layout.tileSize * PLAYER_MARKER_SELF_RING_RATIO,
            {
              color: 0xf8fafc,
              mode: "stroke",
              width: 2.4,
              alpha: 0.95
            }
          );
        }

        drawPlayerMarkerEyes(playerLayer, centerX, centerY, markerRadius, {
          color: 0x081120,
          alpha: 0.92
        });

        const chatBubble = activeChatByPlayer.get(member.playerId);
        if (chatBubble) {
          drawPlayerChatBubble(overlayLayer, {
            centerX,
            centerY,
            markerRadius,
            message: chatBubble.content,
            viewportWidth: layout.viewportWidth
          });
        }

        drawPlayerNicknameLabel(overlayLayer, {
          centerX,
          centerY,
          markerRadius,
          nickname: member.nickname,
          viewportWidth: layout.viewportWidth,
          isSelf: member.playerId === selfPlayerId
        });
      }

      if (match) {
        renderFogOverlay(fogLayer, {
          match,
          tileSize: layout.tileSize,
          offsetX: layout.offsetX,
          offsetY: layout.offsetY,
          visibleTileKeys: projection.visibleTileKeys,
          rememberedTileKeys: [...tileMemory.rememberedTileKeys],
          showFullMap: projection.showFullMap
        });
      }

      if (activeChatByPlayer.size > 0 && latestSnapshot) {
        const nextExpiryAt = Math.min(...[...activeChatByPlayer.values()].map((message) => message.expiresAt));
        overlayRefreshTimeout = setTimeout(() => {
          controller.render(latestSnapshot, latestSelfPlayerId);
        }, Math.max(24, nextExpiryAt - Date.now() + 24));
      }
    },
    destroy() {
      clearOverlayRefreshTimeout();
      for (const child of overlayLayer.removeChildren()) {
        child.destroy();
      }
      app.destroy({ removeView: true }, true);
    }
  };

  return controller;
}

const PLAYER_NICKNAME_STYLE = new TextStyle({
  fill: "#facc15",
  fontSize: 11,
  fontWeight: "700",
  stroke: {
    color: "#07111f",
    width: 3,
    join: "round"
  },
  dropShadow: {
    alpha: 0.4,
    blur: 0,
    color: "#020617",
    distance: 1,
    angle: Math.PI / 2
  }
});

const SELF_PLAYER_NICKNAME_STYLE = new TextStyle({
  ...PLAYER_NICKNAME_STYLE,
  fill: "#fde68a"
});

const PLAYER_CHAT_STYLE = new TextStyle({
  fill: "#f8fafc",
  fontSize: 12,
  fontWeight: "600",
  stroke: {
    color: "#07111f",
    width: 3,
    join: "round"
  }
});

function drawPlayerChatBubble(layer: Container, input: {
  centerX: number;
  centerY: number;
  markerRadius: number;
  message: string;
  viewportWidth: number;
}) {
  const text = new Text({
    text: input.message,
    style: PLAYER_CHAT_STYLE
  });
  const bubbleWidth = text.width + 16;
  const bubbleHeight = text.height + 10;
  const bubbleCenterX = clampOverlayCenterX({
    centerX: input.centerX,
    overlayWidth: bubbleWidth,
    viewportWidth: input.viewportWidth,
    padding: 10
  });
  const bubbleX = bubbleCenterX - bubbleWidth / 2;
  const bubbleY = Math.max(8, input.centerY - input.markerRadius - bubbleHeight - 10);
  const bubble = new Graphics();
  bubble
    .roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 12)
    .fill({ color: 0x0f172a, alpha: 0.76 })
    .stroke({ color: 0x67e8f9, alpha: 0.2, width: 1 });

  text.x = bubbleCenterX - text.width / 2;
  text.y = bubbleY + (bubbleHeight - text.height) / 2 - 1;

  layer.addChild(bubble);
  layer.addChild(text);
}

function drawPlayerNicknameLabel(layer: Container, input: {
  centerX: number;
  centerY: number;
  markerRadius: number;
  nickname: string;
  viewportWidth: number;
  isSelf: boolean;
}) {
  const text = new Text({
    text: input.nickname,
    style: input.isSelf ? SELF_PLAYER_NICKNAME_STYLE : PLAYER_NICKNAME_STYLE
  });
  const clampedCenterX = clampOverlayCenterX({
    centerX: input.centerX,
    overlayWidth: text.width,
    viewportWidth: input.viewportWidth,
    padding: 6
  });

  text.x = clampedCenterX - text.width / 2;
  text.y = input.centerY + input.markerRadius + 6;
  layer.addChild(text);
}

function drawItemBox(
  graphics: Graphics,
  layout: ReturnType<typeof createBoardLayout>,
  position: { x: number; y: number }
) {
  const tileX = layout.offsetX + position.x * layout.tileSize;
  const tileY = layout.offsetY + position.y * layout.tileSize;
  const inset = Math.max(5, Math.floor(layout.tileSize * 0.18));
  const size = layout.tileSize - inset * 2 - 2;
  const x = tileX + inset;
  const y = tileY + inset;

  graphics
    .roundRect(x, y, size, size, Math.max(6, Math.floor(size * 0.22)))
    .fill({ color: 0x0b2540, alpha: 0.96 })
    .stroke({ color: 0x7dd3fc, alpha: 0.9, width: 1.4 });

  graphics
    .circle(x + size * 0.34, y + size * 0.38, Math.max(2, size * 0.07))
    .fill({ color: 0xe0f2fe, alpha: 0.9 })
    .circle(x + size * 0.66, y + size * 0.38, Math.max(2, size * 0.07))
    .fill({ color: 0xe0f2fe, alpha: 0.9 });

  graphics
    .moveTo(x + size * 0.28, y + size * 0.63)
    .lineTo(x + size * 0.5, y + size * 0.82)
    .lineTo(x + size * 0.72, y + size * 0.63)
    .stroke({ color: 0x67e8f9, alpha: 0.9, width: Math.max(2, size * 0.08) });
}

function drawIceTrap(
  graphics: Graphics,
  layout: ReturnType<typeof createBoardLayout>,
  position: { x: number; y: number },
  state: "arming" | "armed" | "triggered"
) {
  const tileX = layout.offsetX + position.x * layout.tileSize;
  const tileY = layout.offsetY + position.y * layout.tileSize;
  const centerX = tileX + layout.tileSize / 2;
  const centerY = tileY + layout.tileSize / 2;
  const radius = Math.max(8, layout.tileSize * 0.22);
  const glowAlpha = state === "armed" ? 0.9 : state === "triggered" ? 0.45 : 0.6;
  const fillColor = state === "armed" ? 0x67e8f9 : state === "triggered" ? 0xbfdbfe : 0x38bdf8;

  graphics
    .circle(centerX, centerY, radius + 3)
    .fill({ color: 0x082f49, alpha: 0.22 })
    .stroke({ color: 0xe0f2fe, alpha: glowAlpha, width: 1.1 });

  for (const angle of [0, Math.PI / 4]) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    graphics
      .moveTo(centerX - cos * radius, centerY - sin * radius)
      .lineTo(centerX + cos * radius, centerY + sin * radius)
      .stroke({ color: fillColor, alpha: glowAlpha, width: Math.max(2, layout.tileSize * 0.08) });
  }
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
    fakeGoalTiles: map.fakeGoalTiles ?? [],
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
    fillAlpha: 0.78,
    strokeColor: 0x2e7f95,
    strokeAlpha: 0.46
  });
  if (mode === "preview") {
    return;
  }

  drawPanel(graphics, layout, map.mazeZone, {
    fillColor: 0x07111f,
    fillAlpha: 0.14,
    strokeColor: 0x36567f,
    strokeAlpha: 0.44
  });
  drawPanel(graphics, layout, toBounds(map.connectorTiles), {
    fillColor: 0x0b1c26,
    fillAlpha: 0.28,
    strokeColor: 0x1f6f76,
    strokeAlpha: 0.26
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

  const shape = graphics.rect(x, y, width, height);
  shape.fill({ color: style.fillColor, alpha: style.fillAlpha });

  if (style.strokeAlpha > 0) {
    shape.stroke({ color: style.strokeColor, width: 1.4, alpha: style.strokeAlpha });
  }
}

function toBounds(positions: Array<{ x: number; y: number }>) {
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x));
  const maxY = Math.max(...positions.map((position) => position.y));

  return { minX, minY, maxX, maxY };
}
