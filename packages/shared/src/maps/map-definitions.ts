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

const MAP_ALPHA_ROWS = [
  "SSSSS##########",
  "SSSSS#........#",
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
  "#......##....G#",
  "##########GGGG#"
];

const MAP_BETA_ROWS = [
  "SSSS###########",
  "SSSS#.........#",
  "SSSS#.#######.#",
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
  "#.########..#G#",
  "#..........GGG#"
];

const TRAINING_LAP_ROWS = [
  "SSS######",
  "SSS....GG",
  "SSS######"
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
    { minX: 0, minY: 0, maxX: 2, maxY: 2 },
    { minX: 7, minY: 0, maxX: 8, maxY: 2 },
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 }
    ],
    [{ x: 3, y: 1 }]
  ),
  createMap(
    "alpha-run",
    "Alpha Run",
    MAP_ALPHA_ROWS,
    { minX: 0, minY: 0, maxX: 4, maxY: 3 },
    { minX: 10, minY: 13, maxX: 14, maxY: 14 },
    [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 }
    ],
    [{ x: 5, y: 1 }]
  ),
  createMap(
    "beta-dash",
    "Beta Dash",
    MAP_BETA_ROWS,
    { minX: 0, minY: 0, maxX: 3, maxY: 2 },
    { minX: 11, minY: 13, maxX: 14, maxY: 14 },
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    [{ x: 4, y: 1 }]
  )
];

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
