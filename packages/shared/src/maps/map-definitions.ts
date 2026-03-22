import type { GridPosition } from "../domain/grid-position.js";

export type ZoneBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type MapDefinition = {
  mapId: string;
  name: string;
  width: number;
  height: number;
  tiles: string[];
  startZone: ZoneBounds;
  goalZone: ZoneBounds;
  startSlots: GridPosition[];
  mazeEntrance: GridPosition[];
  visibilityRadius: number;
};

const MAX_ROOM_PLAYERS = 15;

const MAP_ALPHA_ROWS = [
  "SSSSS##########",
  "SSSSS.........#",
  "SSSSS#.######.#",
  "SSSSS#.#....#.#",
  "#####.#.##.#..#",
  "#.....#.##.##.#",
  "#.#####....##.#",
  "#.#....######.#",
  "#.#.##......#.#",
  "#...######..#.#",
  "###.#....##.#.#",
  "#...#.##.##...#",
  "#.###.##.####.#",
  "#......##.....#",
  "##########...G#"
];

const MAP_BETA_ROWS = [
  "SSSSS##########",
  "SSSSS.........#",
  "SSSSS#.######.#",
  "####.#.....##.#",
  "#....#.###.##.#",
  "#.####.#.#....#",
  "#.#....#.#.####",
  "#.#.####.#....#",
  "#...#....####.#",
  "###.#.##......#",
  "#...#.##.####.#",
  "#.###....#..#.#",
  "#.....####..#.#",
  "#.########...G#",
  "#.............#"
];

const TRAINING_LAP_ROWS = [
  "SSSSS#####",
  "SSSSS...G#",
  "SSSSS#####"
];

function createMap(
  mapId: string,
  name: string,
  rows: string[],
  startZone: ZoneBounds,
  goalZone: ZoneBounds,
  startSlots: GridPosition[],
  mazeEntrance: GridPosition[]
): MapDefinition {
  return {
    mapId,
    name,
    width: rows[0]?.length ?? 0,
    height: rows.length,
    tiles: rows,
    startZone,
    goalZone,
    startSlots,
    mazeEntrance,
    visibilityRadius: 3
  };
}

export const MAP_DEFINITIONS: MapDefinition[] = [
  createMap(
    "training-lap",
    "Training Lap",
    TRAINING_LAP_ROWS,
    { minX: 0, minY: 0, maxX: 4, maxY: 2 },
    { minX: 8, minY: 1, maxX: 8, maxY: 1 },
    createZoneSlots({ minX: 0, minY: 0, maxX: 4, maxY: 2 }, [1, 0, 2]),
    [{ x: 5, y: 1 }]
  ),
  createMap(
    "alpha-run",
    "Alpha Run",
    MAP_ALPHA_ROWS,
    { minX: 0, minY: 0, maxX: 4, maxY: 3 },
    { minX: 13, minY: 14, maxX: 13, maxY: 14 },
    createZoneSlots({ minX: 0, minY: 0, maxX: 4, maxY: 3 }, [1, 2, 0, 3]).slice(0, MAX_ROOM_PLAYERS),
    [{ x: 5, y: 1 }]
  ),
  createMap(
    "beta-dash",
    "Beta Dash",
    MAP_BETA_ROWS,
    { minX: 0, minY: 0, maxX: 4, maxY: 2 },
    { minX: 13, minY: 13, maxX: 13, maxY: 13 },
    createZoneSlots({ minX: 0, minY: 0, maxX: 4, maxY: 2 }, [1, 0, 2]),
    [{ x: 5, y: 1 }]
  )
];

function createZoneSlots(zone: ZoneBounds, preferredRowOrder?: number[]) {
  const slots: GridPosition[] = [];
  const remainingRows = [];

  for (let y = zone.minY; y <= zone.maxY; y += 1) {
    if (!preferredRowOrder?.includes(y)) {
      remainingRows.push(y);
    }
  }

  const rowOrder = [...(preferredRowOrder ?? []), ...remainingRows].filter(
    (y) => y >= zone.minY && y <= zone.maxY
  );

  for (const y of rowOrder) {
    for (let x = zone.minX; x <= zone.maxX; x += 1) {
      slots.push({ x, y });
    }
  }

  return slots;
}

export function getMapById(mapId: string): MapDefinition | undefined {
  return MAP_DEFINITIONS.find((definition) => definition.mapId === mapId);
}

export function getRandomMap(seedIndex = Date.now()): MapDefinition {
  return MAP_DEFINITIONS[seedIndex % MAP_DEFINITIONS.length]!;
}

export function isInsideZone(zone: ZoneBounds, position: GridPosition): boolean {
  return (
    position.x >= zone.minX &&
    position.x <= zone.maxX &&
    position.y >= zone.minY &&
    position.y <= zone.maxY
  );
}

export function isWalkableTile(map: MapDefinition, position: GridPosition): boolean {
  const row = map.tiles[position.y];
  const tile = row?.[position.x];
  return tile !== undefined && tile !== "#";
}
