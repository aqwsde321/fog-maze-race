import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { createBoardLayout } from "./pixi/renderers/board-render.js";
import { PLAYER_MARKER_DIAMETER_RATIO } from "./player-marker.js";

export type PreviewLayout = {
  tileSize: number;
  startZoneWidth: number;
  startZoneHeight: number;
  mazeWidth: number;
  mazeHeight: number;
  startX: number;
  startY: number;
  mazeX: number;
  mazeY: number;
};

export type PlayerOverlayAnchor = {
  centerX: number;
  centerY: number;
  markerRadius: number;
  viewportWidth: number;
  viewportHeight: number;
  mode: "live" | "preview";
};

export function createPreviewLayout(
  map: NonNullable<RoomSnapshot["previewMap"]>,
  input: { viewportWidth: number; viewportHeight: number }
): PreviewLayout {
  const viewportWidth = Math.max(320, Math.floor(input.viewportWidth));
  const viewportHeight = Math.max(320, Math.floor(input.viewportHeight));
  const startZoneWidth = map.startZone.maxX - map.startZone.minX + 1;
  const startZoneHeight = map.startZone.maxY - map.startZone.minY + 1;
  const mazeWidth = map.mazeZone.maxX - map.mazeZone.minX + 1;
  const mazeHeight = map.mazeZone.maxY - map.mazeZone.minY + 1;
  const framePadding = 4;
  let tileSize = Math.max(
    18,
    Math.min(
      92,
      Math.floor(
        Math.min(
          (viewportWidth - framePadding * 2) / (startZoneWidth + mazeWidth),
          (viewportHeight - framePadding * 2) / mazeHeight
        )
      )
    )
  );
  let gap = Math.max(4, Math.floor(tileSize * 0.08));

  while (startZoneWidth * tileSize + gap + mazeWidth * tileSize + framePadding * 2 > viewportWidth && tileSize > 18) {
    tileSize -= 1;
    gap = Math.max(4, Math.floor(tileSize * 0.08));
  }

  const totalWidth = startZoneWidth * tileSize + gap + mazeWidth * tileSize;
  const totalHeight = Math.max(startZoneHeight, mazeHeight) * tileSize;
  const startX = Math.max(framePadding, Math.floor((viewportWidth - totalWidth) / 2));
  const startY = Math.max(framePadding, Math.floor((viewportHeight - totalHeight) / 2));

  return {
    tileSize,
    startZoneWidth,
    startZoneHeight,
    mazeWidth,
    mazeHeight,
    startX,
    startY,
    mazeX: startX + startZoneWidth * tileSize + gap,
    mazeY: startY
  };
}

export function resolveRenderMembers(snapshot: RoomSnapshot) {
  if (!snapshot.previewMap || snapshot.match) {
    return snapshot.members;
  }

  return snapshot.members.map((member, index) => ({
    ...member,
    position:
      member.position ??
      (member.role === "racer" ? snapshot.previewMap?.startSlots[index] ?? null : null)
  }));
}

export function resolvePlayerOverlayAnchor(input: {
  snapshot: RoomSnapshot;
  playerId: string | null;
  viewportWidth: number;
  viewportHeight: number;
}): PlayerOverlayAnchor | null {
  const { snapshot, playerId, viewportWidth, viewportHeight } = input;
  if (!playerId) {
    return null;
  }

  const map = snapshot.match?.map ?? snapshot.previewMap;
  if (!map) {
    return null;
  }

  const member = resolveRenderMembers(snapshot).find((candidate) => candidate.playerId === playerId);
  if (!member?.position) {
    return null;
  }

  const isPreviewMode = snapshot.room.status === "waiting" || snapshot.room.status === "countdown";
  if (isPreviewMode) {
    const layout = createPreviewLayout(map, {
      viewportWidth,
      viewportHeight
    });
    const markerRadius = Math.max(15, Math.floor(layout.tileSize * PLAYER_MARKER_DIAMETER_RATIO)) / 2;

    return {
      centerX: layout.startX + (member.position.x - map.startZone.minX) * layout.tileSize + layout.tileSize / 2,
      centerY: layout.startY + (member.position.y - map.startZone.minY) * layout.tileSize + layout.tileSize / 2,
      markerRadius,
      viewportWidth,
      viewportHeight,
      mode: "preview"
    };
  }

  const layout = createBoardLayout(map, {
    viewportWidth,
    viewportHeight
  });

  return {
    centerX: layout.offsetX + member.position.x * layout.tileSize + layout.tileSize / 2,
    centerY: layout.offsetY + member.position.y * layout.tileSize + layout.tileSize / 2,
    markerRadius: (layout.tileSize * PLAYER_MARKER_DIAMETER_RATIO) / 2,
    viewportWidth: layout.viewportWidth,
    viewportHeight: layout.viewportHeight,
    mode: "live"
  };
}
