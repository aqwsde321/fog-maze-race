import { Application, Graphics } from "pixi.js";

import type { MapView, RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { createVisibilityProjection, toTileKey } from "@fog-maze-race/shared/visibility/apply-visibility";
import { isInsideZone, type MapDefinition } from "@fog-maze-race/shared/maps/map-definitions";

import { renderFogOverlay } from "./renderers/fog-renderer.js";

const TILE_SIZE = 36;

export type SceneController = {
  render: (snapshot: RoomSnapshot | null, selfPlayerId: string | null) => void;
  destroy: () => void;
};

export async function createSceneController(container: HTMLDivElement): Promise<SceneController> {
  const app = new Application();
  await app.init({
    width: 640,
    height: 420,
    antialias: true,
    backgroundColor: 0x07111f
  });

  const tileLayer = new Graphics();
  const playerLayer = new Graphics();
  const fogLayer = new Graphics();

  app.stage.addChild(tileLayer);
  app.stage.addChild(playerLayer);
  app.stage.addChild(fogLayer);
  container.replaceChildren(app.canvas);

  return {
    render(snapshot, selfPlayerId) {
      tileLayer.clear();
      playerLayer.clear();
      fogLayer.clear();

      const match = snapshot?.match;
      const map = match?.map ?? snapshot?.previewMap;
      if (!snapshot || !map) {
        drawPlaceholder(tileLayer);
        return;
      }

      app.renderer.resize(map.width * TILE_SIZE, map.height * TILE_SIZE);

      const renderMembers =
        !match && snapshot.previewMap
          ? snapshot.members.map((member, index) => ({
              ...member,
              position: snapshot.previewMap?.startSlots[index] ?? null
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

      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const tile = map.tiles[y]?.[x] ?? "#";
          const position = { x, y };
          const isVisible = projection.showFullMap || visibleTileSet.has(toTileKey(position));

          tileLayer
            .rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 2, TILE_SIZE - 2)
            .fill({
              color: pickTileColor(tile, map, position, isVisible),
              alpha: isVisible ? 1 : 0.4
            });
        }
      }

      for (const member of renderMembers) {
        if (!member.position || (!projection.showFullMap && !visiblePlayerSet.has(member.playerId))) {
          continue;
        }

        const centerX = member.position.x * TILE_SIZE + TILE_SIZE / 2;
        const centerY = member.position.y * TILE_SIZE + TILE_SIZE / 2;
        playerLayer.circle(centerX, centerY, TILE_SIZE * 0.24).fill({ color: toPixiColor(member.color) });

        if (member.playerId === selfPlayerId) {
          playerLayer
            .circle(centerX, centerY, TILE_SIZE * 0.3)
            .stroke({ color: 0xf8fafc, width: 3, alpha: 0.95 });
        }
      }

      if (match) {
        renderFogOverlay(fogLayer, {
          match,
          tileSize: TILE_SIZE,
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

function pickTileColor(tile: string, map: MapView, position: { x: number; y: number }, isVisible: boolean) {
  if (isInsideZone(map.startZone, position)) {
    return isVisible ? 0x0ea5e9 : 0x164e63;
  }

  if (isInsideZone(map.goalZone, position)) {
    return isVisible ? 0xfacc15 : 0x713f12;
  }

  if (tile === "#") {
    return isVisible ? 0x334155 : 0x172033;
  }

  return isVisible ? 0x122033 : 0x0b1220;
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
    goalZone: map.goalZone,
    startSlots: map.startSlots,
    mazeEntrance: [],
    visibilityRadius: map.visibilityRadius
  };
}
