import { describe, expect, it } from "vitest";

import type { GridPosition } from "../../src/domain/grid-position.js";
import type { ZoneBounds } from "../../src/maps/map-definitions.js";
import { MAP_DEFINITIONS, isWalkableTile } from "../../src/maps/map-definitions.js";

describe("MAP_DEFINITIONS", () => {
  it("uses a separated start zone with one open entrance and a single goal tile", () => {
    for (const map of MAP_DEFINITIONS) {
      expect(map.startSlots).toHaveLength(15);
      expect(map.goalZone.minX).toBe(map.goalZone.maxX);
      expect(map.goalZone.minY).toBe(map.goalZone.maxY);
      expect(map.mazeEntrance).toHaveLength(1);
      expect(overlaps(map.startZone, map.goalZone)).toBe(false);

      const entrance = map.mazeEntrance[0]!;
      expect(isWalkableTile(map, entrance)).toBe(true);
      expect(adjacentToZone(entrance, map.startZone)).toBe(true);

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

      const borderX = map.startZone.maxX + 1;
      const borderKeys = new Set(map.mazeEntrance.map(toKey));
      for (let y = map.startZone.minY; y <= map.startZone.maxY; y += 1) {
        const borderTile = { x: borderX, y };
        expect(isWalkableTile(map, borderTile)).toBe(borderKeys.has(toKey(borderTile)));
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
