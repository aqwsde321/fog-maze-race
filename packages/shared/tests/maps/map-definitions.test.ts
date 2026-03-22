import { describe, expect, it } from "vitest";

import type { GridPosition } from "../../src/domain/grid-position.js";
import type { ZoneBounds } from "../../src/maps/map-definitions.js";
import { MAP_DEFINITIONS, isWalkableTile } from "../../src/maps/map-definitions.js";

describe("MAP_DEFINITIONS", () => {
  it("uses a fixed 3x5 start zone, a 5-tile connector, and a single goal tile", () => {
    for (const map of MAP_DEFINITIONS) {
      expect(map.startSlots).toHaveLength(15);
      expect(zoneWidth(map.startZone)).toBe(3);
      expect(zoneHeight(map.startZone)).toBe(5);
      expect(map.goalZone.minX).toBe(map.goalZone.maxX);
      expect(map.goalZone.minY).toBe(map.goalZone.maxY);
      expect(zoneWidth(map.mazeZone)).toBeGreaterThanOrEqual(5);
      expect(zoneHeight(map.mazeZone)).toBeGreaterThanOrEqual(5);
      expect(map.connectorTiles).toHaveLength(5);
      expect(overlaps(map.startZone, map.goalZone)).toBe(false);
      expect(overlaps(map.startZone, map.mazeZone)).toBe(false);

      for (let y = map.startZone.minY; y <= map.startZone.maxY; y += 1) {
        for (let x = map.startZone.minX; x <= map.startZone.maxX; x += 1) {
          expect(isWalkableTile(map, { x, y })).toBe(true);
        }
      }

      const slotKeys = new Set(map.startSlots.map(toKey));
      expect(slotKeys.size).toBe(map.startSlots.length);
      for (const startSlot of map.startSlots) {
        expect(isWalkableTile(map, startSlot)).toBe(true);
        expect(isInside(startSlot, map.startZone)).toBe(true);
      }

      const connectorKeys = new Set(map.connectorTiles.map(toKey));
      for (let y = map.startZone.minY; y <= map.startZone.maxY; y += 1) {
        const connectorTile = { x: map.startZone.maxX + 1, y };
        expect(connectorKeys.has(toKey(connectorTile))).toBe(true);
        expect(isWalkableTile(map, connectorTile)).toBe(true);
        expect(adjacentToZone(connectorTile, map.startZone)).toBe(true);
        expect(adjacentToZone(connectorTile, map.mazeZone)).toBe(true);
      }

      for (let y = map.startZone.maxY + 1; y < map.height; y += 1) {
        expect(isWalkableTile(map, { x: 0, y })).toBe(false);
        expect(isWalkableTile(map, { x: map.startZone.maxX + 1, y })).toBe(false);
      }

      if (map.mapId !== "training-lap") {
        expect(zoneWidth(map.mazeZone)).toBeGreaterThanOrEqual(17);
        expect(zoneHeight(map.mazeZone)).toBeGreaterThanOrEqual(17);
        expect(outerEdgeWalkableRatio(map)).toBeGreaterThan(0.7);
      }
    }
  });

  it("allows every start slot to reach the goal tile through walkable cells", () => {
    for (const map of MAP_DEFINITIONS) {
      const goal = { x: map.goalZone.minX, y: map.goalZone.minY };
      for (const start of map.startSlots) {
        expect(canReachGoal(map, start, goal)).toBe(true);
      }
    }
  });
});

function overlaps(left: ZoneBounds, right: ZoneBounds) {
  return !(
    left.maxX < right.minX ||
    right.maxX < left.minX ||
    left.maxY < right.minY ||
    right.maxY < left.minY
  );
}

function zoneWidth(zone: ZoneBounds) {
  return zone.maxX - zone.minX + 1;
}

function zoneHeight(zone: ZoneBounds) {
  return zone.maxY - zone.minY + 1;
}

function adjacentToZone(position: GridPosition, zone: ZoneBounds) {
  if (position.x === zone.maxX + 1 && position.y >= zone.minY && position.y <= zone.maxY) {
    return true;
  }

  if (position.x === zone.minX - 1 && position.y >= zone.minY && position.y <= zone.maxY) {
    return true;
  }

  if (position.y === zone.maxY + 1 && position.x >= zone.minX && position.x <= zone.maxX) {
    return true;
  }

  if (position.y === zone.minY - 1 && position.x >= zone.minX && position.x <= zone.maxX) {
    return true;
  }

  return false;
}

function outerEdgeWalkableRatio(map: (typeof MAP_DEFINITIONS)[number]) {
  const perimeter: GridPosition[] = [];

  for (let x = map.mazeZone.minX; x <= map.mazeZone.maxX; x += 1) {
    perimeter.push({ x, y: map.mazeZone.minY });
    perimeter.push({ x, y: map.mazeZone.maxY });
  }

  for (let y = map.mazeZone.minY + 1; y < map.mazeZone.maxY; y += 1) {
    perimeter.push({ x: map.mazeZone.minX, y });
    perimeter.push({ x: map.mazeZone.maxX, y });
  }

  const walkableCount = perimeter.filter((position) => isWalkableTile(map, position)).length;
  return walkableCount / perimeter.length;
}

function canReachGoal(
  map: (typeof MAP_DEFINITIONS)[number],
  start: GridPosition,
  goal: GridPosition
) {
  const queue: GridPosition[] = [start];
  const visited = new Set<string>([toKey(start)]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === goal.x && current.y === goal.y) {
      return true;
    }

    for (const next of neighbors(current)) {
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= map.width ||
        next.y >= map.height ||
        !isWalkableTile(map, next)
      ) {
        continue;
      }

      const key = toKey(next);
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(next);
    }
  }

  return false;
}

function neighbors(position: GridPosition): GridPosition[] {
  return [
    { x: position.x + 1, y: position.y },
    { x: position.x - 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x, y: position.y - 1 }
  ];
}

function isInside(position: GridPosition, zone: ZoneBounds) {
  return (
    position.x >= zone.minX &&
    position.x <= zone.maxX &&
    position.y >= zone.minY &&
    position.y <= zone.maxY
  );
}

function toKey(position: GridPosition) {
  return `${position.x},${position.y}`;
}
