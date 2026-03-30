import { describe, expect, it } from "vitest";

import type { GridPosition } from "../../src/domain/grid-position.js";
import type { ZoneBounds } from "../../src/maps/map-definitions.js";
import {
  MAP_DEFINITIONS,
  buildMapDefinition,
  createBlankMazeRows,
  getMapById,
  getMazeRows,
  isWalkableTile
} from "../../src/maps/map-definitions.js";

const HARD_MAP_IDS = [
  "delta-snare",
  "epsilon-vault",
  "zeta-rift",
  "eta-gauntlet",
  "theta-bastion",
  "iota-weave",
  "kappa-trap",
  "lambda-spine",
  "mu-labyrinth",
  "nu-fortress"
] as const;

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
        expect(zoneWidth(map.mazeZone)).toBe(25);
        expect(zoneHeight(map.mazeZone)).toBe(25);
        expect(wallRatio(map)).toBeGreaterThan(0.45);
        expect(connectorEntryCount(map)).toBeGreaterThanOrEqual(1);
        expect(connectorEntryCount(map)).toBeLessThanOrEqual(2);
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

  it("rejects maze sources when the goal cannot be reached from the entry", () => {
    const blockedRows = createBlankMazeRows();
    blockedRows[2] = `${".".repeat(8)}${"#".repeat(17)}`;

    expect(() =>
      buildMapDefinition({
        mapId: "blocked-test",
        name: "Blocked Test",
        mazeRows: blockedRows
      })
    ).toThrowError("MAP_UNREACHABLE");
  });

  it("parses fake goal tiles as walkable decoys without affecting the real goal count", () => {
    const rows = createBlankMazeRows();
    rows[2] = `F${rows[2]!.slice(1)}`;

    const map = buildMapDefinition({
      mapId: "fake-goal-test",
      name: "Fake Goal Test",
      mazeRows: rows
    });

    expect(map.fakeGoalTiles).toContainEqual({ x: map.mazeZone.minX, y: 2 });
    expect(isWalkableTile(map, { x: map.mazeZone.minX, y: 2 })).toBe(true);
    expect(map.goalZone).not.toEqual({
      minX: map.mazeZone.minX,
      minY: 2,
      maxX: map.mazeZone.minX,
      maxY: 2
    });
  });

  it("includes ten hard-tier mazes with dense walls and long optimal routes", () => {
    for (const mapId of HARD_MAP_IDS) {
      const map = getMapById(mapId);

      expect(map, `${mapId} should be registered`).toBeDefined();
      expect(zoneWidth(map!.mazeZone)).toBe(25);
      expect(zoneHeight(map!.mazeZone)).toBe(25);
      expect(wallRatio(map!)).toBeGreaterThan(0.5);
      expect(connectorEntryCount(map!)).toBe(1);
      expect(shortestMazePathLength(map!)).toBeGreaterThanOrEqual(95);
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

function wallRatio(map: (typeof MAP_DEFINITIONS)[number]) {
  const rows = getMazeRows(map);
  const wallCount = rows.join("").split("").filter((tile) => tile === "#").length;
  return wallCount / (rows.length * rows[0]!.length);
}

function connectorEntryCount(map: (typeof MAP_DEFINITIONS)[number]) {
  let count = 0;
  for (let y = map.startZone.minY; y <= map.startZone.maxY; y += 1) {
    if (isWalkableTile(map, { x: map.mazeZone.minX, y })) {
      count += 1;
    }
  }
  return count;
}

function shortestMazePathLength(map: (typeof MAP_DEFINITIONS)[number]) {
  const rows = getMazeRows(map);
  const queue = rows
    .slice(0, Math.min(5, rows.length))
    .flatMap((row, y) => (row[0] === "." || row[0] === "G" ? [{ x: 0, y, distance: 0 }] : []));
  const visited = new Set(queue.map((position) => toKey(position)));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (rows[current.y]![current.x] === "G") {
      return current.distance;
    }

    for (const next of neighbors(current)) {
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.y >= rows.length ||
        next.x >= rows[0]!.length ||
        rows[next.y]![next.x] === "#"
      ) {
        continue;
      }

      const key = toKey(next);
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({
        x: next.x,
        y: next.y,
        distance: current.distance + 1
      });
    }
  }

  throw new Error(`Expected ${map.mapId} to have a reachable goal`);
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
