import type { GridPosition } from "../domain/grid-position.js";
import type { RoomMemberState } from "../domain/status.js";
import { isInsideZone, type MapDefinition } from "../maps/map-definitions.js";

export type VisibilityMember = {
  playerId: string;
  position: GridPosition | null;
  state: RoomMemberState;
};

export type VisibilityProjection = {
  showFullMap: boolean;
  visibleTileKeys: string[];
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
      visiblePlayerIds: []
    };
  }

  const showFullMap = self.state === "finished";
  const visibleTiles = new Set<string>();
  const visiblePlayerIds = new Set<string>();

  if (showFullMap) {
    for (let y = 0; y < input.map.height; y += 1) {
      for (let x = 0; x < input.map.width; x += 1) {
        visibleTiles.add(toTileKey({ x, y }));
      }
    }

    for (const member of input.members) {
      visiblePlayerIds.add(member.playerId);
    }

    return {
      showFullMap,
      visibleTileKeys: [...visibleTiles],
      visiblePlayerIds: [...visiblePlayerIds]
    };
  }

  for (let y = 0; y < input.map.height; y += 1) {
    for (let x = 0; x < input.map.width; x += 1) {
      const position = { x, y };
      if (
        isInsideZone(input.map.startZone, position) ||
        isInsideZone(input.map.goalZone, position) ||
        withinVision(self.position, position, input.map.visibilityRadius)
      ) {
        visibleTiles.add(toTileKey(position));
      }
    }
  }

  for (const member of input.members) {
    if (!member.position) {
      continue;
    }

    if (
      isInsideZone(input.map.startZone, member.position) ||
      isInsideZone(input.map.goalZone, member.position) ||
      withinVision(self.position, member.position, input.map.visibilityRadius)
    ) {
      visiblePlayerIds.add(member.playerId);
    }
  }

  return {
    showFullMap,
    visibleTileKeys: [...visibleTiles],
    visiblePlayerIds: [...visiblePlayerIds]
  };
}

function withinVision(origin: GridPosition, target: GridPosition, radius: number): boolean {
  return (
    Math.abs(origin.x - target.x) <= radius &&
    Math.abs(origin.y - target.y) <= radius
  );
}
