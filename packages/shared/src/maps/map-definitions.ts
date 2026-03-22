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
  mazeZone: ZoneBounds;
  goalZone: ZoneBounds;
  startSlots: GridPosition[];
  connectorTiles: GridPosition[];
  visibilityRadius: number;
};

const START_ZONE: ZoneBounds = {
  minX: 0,
  minY: 0,
  maxX: 2,
  maxY: 4
};

const START_SLOT_ROW_ORDER = [1, 2, 0, 3, 4];

const TRAINING_LAP_MAZE_ROWS = [
  ".#...",
  "....G",
  ".#.#.",
  ".#...",
  "....."
];

const ALPHA_RUN_MAZE_ROWS = [
  "...................",
  ".###..#....##...#..",
  ".#....#.##....#.#..",
  ".#.#..#..###..#.#..",
  "...#.....#....#....",
  ".#####.#.#.####.##.",
  ".#.....#.#....#....",
  ".#.#####.####.#.##.",
  ".#.....#....#.#....",
  ".###.#.####.#.####.",
  ".#...#....#.#....#.",
  ".#.#.###..#..##.#..",
  ".#.#...#..##....#..",
  ".#..##.#....###.#..",
  ".##....####....##..",
  ".#...#......#...G..",
  ".#.###.####.#.###..",
  ".#.....#....#......",
  "..................."
];

const BETA_DASH_MAZE_ROWS = [
  "...................",
  "..##...#..###...##.",
  ".#..#..#....#.#....",
  ".#..##.####.#.#.##.",
  ".#......#...#.#....",
  ".####.#.#.###.####.",
  ".....#.#...#......#",
  ".###.#.###.####.#..",
  ".#...#.....#....#..",
  ".#.#####.#.#.##.#..",
  ".#.....#.#.#....#..",
  ".###.#.#.#.####.#..",
  "...#.#...#....#....",
  ".#.#.#######.#.###.",
  ".#.#.....#...#.....",
  ".#.#####.#.#####.#.",
  ".#.....#...#..G..#.",
  ".#####.###.#.###.#.",
  "..................."
];

function createMap(
  mapId: string,
  name: string,
  mazeRows: string[]
): MapDefinition {
  const mazeWidth = mazeRows[0]?.length ?? 0;
  const mazeHeight = mazeRows.length;
  const mazeZone = {
    minX: START_ZONE.maxX + 2,
    minY: 0,
    maxX: START_ZONE.maxX + 1 + mazeWidth,
    maxY: mazeHeight - 1
  };
  const rows = composeRows(mazeRows);
  const goalPosition = findGoal(rows);

  return {
    mapId,
    name,
    width: rows[0]?.length ?? 0,
    height: rows.length,
    tiles: rows,
    startZone: { ...START_ZONE },
    mazeZone,
    goalZone: {
      minX: goalPosition.x,
      minY: goalPosition.y,
      maxX: goalPosition.x,
      maxY: goalPosition.y
    },
    startSlots: createStartSlots(),
    connectorTiles: createConnectorTiles(),
    visibilityRadius: 3
  };
}

export const MAP_DEFINITIONS: MapDefinition[] = [
  createMap(
    "training-lap",
    "Training Lap",
    TRAINING_LAP_MAZE_ROWS
  ),
  createMap(
    "alpha-run",
    "Alpha Run",
    ALPHA_RUN_MAZE_ROWS
  ),
  createMap(
    "beta-dash",
    "Beta Dash",
    BETA_DASH_MAZE_ROWS
  )
];

function composeRows(mazeRows: string[]) {
  return mazeRows.map((mazeRow, y) => `${y <= START_ZONE.maxY ? "SSSC" : "    "}${mazeRow}`);
}

function createStartSlots() {
  const slots: GridPosition[] = [];

  for (const y of START_SLOT_ROW_ORDER) {
    for (let x = START_ZONE.minX; x <= START_ZONE.maxX; x += 1) {
      slots.push({ x, y });
    }
  }

  return slots;
}

function createConnectorTiles() {
  return Array.from({ length: START_ZONE.maxY - START_ZONE.minY + 1 }, (_, index) => ({
    x: START_ZONE.maxX + 1,
    y: START_ZONE.minY + index
  }));
}

function findGoal(rows: string[]) {
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y]!.length; x += 1) {
      if (rows[y]![x] === "G") {
        return { x, y };
      }
    }
  }

  throw new Error("Map must contain a goal tile");
}

export function getMapById(mapId: string): MapDefinition | undefined {
  return MAP_DEFINITIONS.find((definition) => definition.mapId === mapId);
}

export function getRandomMap(seedIndex = Date.now()): MapDefinition {
  const playableMaps = MAP_DEFINITIONS.filter((definition) => definition.mapId !== "training-lap");
  return playableMaps[seedIndex % playableMaps.length]!;
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
  return tile !== undefined && tile !== "#" && tile !== " ";
}

export function isRenderableTile(map: MapDefinition, position: GridPosition): boolean {
  const row = map.tiles[position.y];
  const tile = row?.[position.x];
  return tile !== undefined && tile !== " ";
}

export function isConnectorTile(map: Pick<MapDefinition, "connectorTiles">, position: GridPosition): boolean {
  return map.connectorTiles.some((tile) => tile.x === position.x && tile.y === position.y);
}
