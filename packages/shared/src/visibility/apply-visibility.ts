import type { GridPosition } from "../domain/grid-position.js";
import type { RoomMemberState } from "../domain/status.js";
import {
  isConnectorTile,
  isInsideZone,
  type MapDefinition
} from "../maps/map-definitions.js";

export type VisibilityMember = {
  playerId: string;
  position: GridPosition | null;
  state: RoomMemberState;
};

export type VisibilityProjection = {
  showFullMap: boolean;
  visibleTileKeys: string[];
  tileVisibilityByKey: Record<string, number>;
  visiblePlayerIds: string[];
};

export function toTileKey(position: GridPosition): string {
  return `${position.x},${position.y}`;
}

export function createVisibilityProjection(input: {
  map: MapDefinition;
  selfPlayerId: string;
  members: VisibilityMember[];
}): VisibilityProjection {
  const self = input.members.find((member) => member.playerId === input.selfPlayerId);

  if (!self || !self.position) {
    return {
      showFullMap: false,
      visibleTileKeys: [],
      tileVisibilityByKey: {},
      visiblePlayerIds: []
    };
  }

  const showFullMap = self.state === "finished";
  const visibleTiles = new Set<string>();
  const tileVisibilityByKey: Record<string, number> = {};
  const visiblePlayerIds = new Set<string>();

  if (showFullMap) {
    for (let y = 0; y < input.map.height; y += 1) {
      for (let x = 0; x < input.map.width; x += 1) {
        visibleTiles.add(toTileKey({ x, y }));
        tileVisibilityByKey[toTileKey({ x, y })] = 1;
      }
    }

    for (const member of input.members) {
      visiblePlayerIds.add(member.playerId);
    }

    return {
      showFullMap,
      visibleTileKeys: [...visibleTiles],
      tileVisibilityByKey,
      visiblePlayerIds: [...visiblePlayerIds]
    };
  }

  for (let y = 0; y < input.map.height; y += 1) {
    for (let x = 0; x < input.map.width; x += 1) {
      const position = { x, y };
      const tileKey = toTileKey(position);
      const clarity = getTileVisibilityClarity(self.position, position, input.map.visibilityRadius);
      if (
        isInsideZone(input.map.startZone, position) ||
        isConnectorTile(input.map, position) ||
        isInsideZone(input.map.goalZone, position) ||
        clarity > 0
      ) {
        visibleTiles.add(tileKey);
        tileVisibilityByKey[tileKey] =
          isInsideZone(input.map.startZone, position) ||
          isConnectorTile(input.map, position) ||
          isInsideZone(input.map.goalZone, position)
            ? 1
            : clarity;
      }
    }
  }

  for (const member of input.members) {
    if (!member.position) {
      continue;
    }

    if (
      isInsideZone(input.map.startZone, member.position) ||
      isConnectorTile(input.map, member.position) ||
      isInsideZone(input.map.goalZone, member.position) ||
      getTileVisibilityClarity(self.position, member.position, input.map.visibilityRadius) > 0
    ) {
      visiblePlayerIds.add(member.playerId);
    }
  }

  return {
    showFullMap,
    visibleTileKeys: [...visibleTiles],
    tileVisibilityByKey,
    visiblePlayerIds: [...visiblePlayerIds]
  };
}

function getTileVisibilityClarity(origin: GridPosition, target: GridPosition, radius: number): number {
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  if (distance > radius) {
    return 0;
  }

  const normalizedDistance = distance / Math.max(radius, 1);
  return clamp(1 - normalizedDistance * 0.72, 0.28, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
