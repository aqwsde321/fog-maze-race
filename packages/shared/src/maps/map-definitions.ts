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
  fakeGoalTiles?: GridPosition[];
  visibilityRadius: number;
};

export type EditableMapSource = {
  mapId: string;
  name: string;
  mazeRows: string[];
};

export const PLAYABLE_MAZE_SIZE = 25;

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

const ALPHA_RUN_CORE_ROWS = [
  "#########################",
  "#.#...#...............#.#",
  "....###.#.########.##.#.#",
  "#.#.....#...#.......#...#",
  "#.#####.###.#####.#.###.#",
  "#.#.......#...#...#...#.#",
  "#.#.#####.###.#.#.#.#.#.#",
  "#...#...#.#...#.#.#.#...#",
  "#.#.#.###.#.###.###.#.###",
  "#.....#.....#...#...#...#",
  "#####.#.#.#.#.###.###.#.#",
  "#.....#.#...#.......#.#.#",
  "#.###.#.#.###.#.###.#.#.#",
  "#...#.......#.#.......#.#",
  "###.#.#####.#.#.#.#####.#",
  "#...#...#.....#.#.#.#...#",
  "#.#.#.#.#.#####.#.#.#.###",
  "#.#...#.#.#.....#...#...#",
  "#.#####.#.#.#.###.#.#.#.#",
  "#.....#...#.#.........#.#",
  "#.#########.#.###.#.###.#",
  "#.#.......#.#...#.#.#...#",
  "#.#.#.#####.###.###.###.#",
  "#...#.........#........G#",
  "#########################"
];

const BETA_DASH_CORE_ROWS = [
  "#########################",
  "#...#...........#.......#",
  "....#.#.#.###.#.###.#.#.#",
  "#.#.#...#...........#...#",
  "#.#.###.###.####.####.###",
  "#.#.#...#...........#.#.#",
  "#.#.#.#########.#.#.#.#.#",
  "#...#.#.........#.#...#.#",
  "#.###.#.###...###.#.###.#",
  "#.#.#...#...#.#...#.....#",
  "#...#.###.###.###.#.###.#",
  "#.#.#.....#.....#...#...#",
  "#.#.#.#.#######.#####.###",
  "#.#...#...#...#.......#.#",
  "#.###.###.#.#.#.#######.#",
  "#.......#.....#.......#.#",
  "#.#####.#.###.####.##.#.#",
  "#.....#.#...#.#.....#...#",
  "#.###.#.###.#.#.#.#####.#",
  "#.#...#...#.#.#.#.#.....#",
  "#.#######.###.#.###.#####",
  "#.#.....#...#.#.........#",
  "#.#.#.#####.#.#.#.#####.#",
  "#.............#.#......G#",
  "#########################"
];

const GAMMA_KNOT_CORE_ROWS = [
  "#########################",
  "#.....#.........#.......#",
  "..###.#####.###.#######.#",
  "#...#.......#.#.........#",
  "#.#.#########.#.#######.#",
  "#.#.#.............#.....#",
  "#.#.#.#########.#...#####",
  "#.#...#.#.......#.#...#.#",
  "#.#####...#######...#.#.#",
  "#.#.....#...#...#...#.#.#",
  "#.#.#.#####.#.#.#####.#.#",
  "#.#.#...#...#.#.......#.#",
  "#.#####.#.#.#.#######.#.#",
  "#.#.....#.#.#.....#.....#",
  "#.#.###.#.#.#####.##.##.#",
  "#.#...#.#.#.....#.....#.#",
  "#.#.#.#.#.###.#######...#",
  "#.....#.#...#.#.....#...#",
  "###.###.###.###.###.###.#",
  "#.....#.#.#.......#...#.#",
  "#.#.###.#.###########.#.#",
  "#.#...#...#...#......G#.#",
  "#.###.###.###.#.#######.#",
  "#...#.........#.........#",
  "#########################"
];

const DELTA_SNARE_CORE_ROWS = [
  "#########################",
  "#.#.....................#",
  "..###.#####.#.#.#.###.#.#",
  "#...#...#.#.....#.#...#.#",
  "###.###.#.#.###.#.#.###.#",
  "#.#.#.....#.....#...#...#",
  "#.#.#######.#######.##.##",
  "#...#.....#...#...#.#...#",
  "#.###.###.#.#.#.#.###.#.#",
  "#.#...#...#.#...#.....#.#",
  "#.#.#.###.#.###########.#",
  "#...#...#.#...#.....#...#",
  "###.###.#.#####.###.#.#.#",
  "#...#...#.....#...#...#.#",
  "#.###.#######.###.#####.#",
  "#.....#.....#...#.....#.#",
  "#######.#######.#####.#.#",
  "#.#...........#.......#.#",
  "#.#.#########.#########.#",
  "#...#.......#.........#.#",
  "#.#########.#.#.###.###.#",
  "#...#.....#.#...#G#.#...#",
  "###.#.###.#.###.#.#.#.#.#",
  "#.....#...........#.....#",
  "#########################"
];

const EPSILON_VAULT_CORE_ROWS = [
  "#########################",
  "#...#.#.....#.....#...#.#",
  "..#.#.#.#.#.###.#.#.#.#.#",
  "#...#.#.#.#.....#...#...#",
  "#.###.#.#.#############.#",
  "#.......#.......#.......#",
  "#.#######.#.###.###.#.###",
  "#.#.......#...#.....#...#",
  "#.#.#.###.#######.#.###.#",
  "#.#...#...#.........#...#",
  "#.###.#.###.#########.###",
  "#.....#.....#...#...#...#",
  "#############.#.###.###.#",
  "#...#.#.......#...#...#.#",
  "#.#.#.#.#####.###.#.#.#.#",
  "#.#...#...#.#.#...#.#...#",
  "#.##.##.#.#.#.#.###.###.#",
  "#G#.....#.#.#.#.#...#...#",
  "#.#.###...#.#.#.###.#.###",
  "#...#.#.#.#.#.#.....#...#",
  "#.###.#...#...#########.#",
  "#.....#.#...#.....#.....#",
  "#.###...###.#####.#.#####",
  "#.....#.........#.......#",
  "#########################"
];

const ZETA_RIFT_CORE_ROWS = [
  "#########################",
  "#.#.......#.............#",
  "..###.#.#.#.#####.#####.#",
  "#...#.#.......#...#...#.#",
  "###.#.#########.###.#.#.#",
  "#...#.#...#.......#.#.#.#",
  "#.###.#.###.#.###.#.#.#.#",
  "#.#...#...#.#.......#...#",
  "#.#.#####.#.#.#.###.#.###",
  "#.#.#.....#.....#.......#",
  "#.#.###.###.#.###.#.#.#.#",
  "#.#...#...#.#.#...#.#.#.#",
  "#.###.###.#.#.#.###.#.#.#",
  "#.#.....#.#.#.#...#...#.#",
  "#.#####.#.#.###.#.#####.#",
  "#...#.....#.....#...#.#.#",
  "###.#.#######.#.###.#.#.#",
  "#.#.#.......#.#......G#.#",
  "#.#.#.#.#.#.###########.#",
  "#.....#...#...#.....#...#",
  "#.###.###.###.#.###.#.###",
  "#...#...#...#.#...#.#...#",
  "#.#####.###.#.#.#.#.#.#.#",
  "#...........#.....#.....#",
  "#########################"
];

const ETA_GAUNTLET_CORE_ROWS = [
  "#########################",
  "#.....#.........#.......#",
  "..#.#.#########.#.#####.#",
  "#.....#.......#.#.#.....#",
  "#.#.#.#.#####...#.#.###.#",
  "#.#...#.#.#...#.#.#...#.#",
  "#.#####.#.#.###.#.###.#.#",
  "#.......#...#.......#.#.#",
  "######.##.###.#######.#.#",
  "#...#...#.#.....#.......#",
  "#.#...#.#.#.#####.#######",
  "#...#.#...#.#...#...#...#",
  "#.###.#######.#.###.#.#.#",
  "#.....#.....#.#...#...#.#",
  "#.#######.#.#.###.#.###.#",
  "#.#.......#...#...#.#...#",
  "#.#.###########.#####.#.#",
  "#.#.#...#.....#.#.....#.#",
  "#.#.#.#.#.#.###.#.#.###.#",
  "#...#.#...#.#...#...#.#.#",
  "#####.#####.#.#####.#.#.#",
  "#.....#G....#.#.....#.#.#",
  "#.#.#########.###.###.#.#",
  "#.#...............#.....#",
  "#########################"
];

const THETA_BASTION_CORE_ROWS = [
  "#########################",
  "#.#...#...........#.....#",
  "..###.#.####.##.#.#.##.##",
  "#.#...#.#.......#.#.....#",
  "#.#.###.#.#######.##.##.#",
  "#.#.....#.#.....#.....#.#",
  "#.###.###.#.#########.#.#",
  "#...#.#...#.........#...#",
  "###.#.#.###.#.#####.###.#",
  "#.#...#...#...#...#.#...#",
  "#.###.#.#.###.###.#.#.###",
  "#.....#.#...#.....#...#.#",
  "#.#####.###.#####.#.###.#",
  "#...#.....#.#...#.#.....#",
  "###.#.#####.#.#.#.#.#.###",
  "#...#...#...#.#...#.#...#",
  "#.###.#.#.###.###.#.###.#",
  "#.#...#...#...#.......#.#",
  "#.#####.###.###.#######.#",
  "#.......#.#...#...#...#.#",
  "#########.###.###.#.#.#.#",
  "#G#.........#...#.#.#...#",
  "#.#.###.#.#.###.###.#.#.#",
  "#.....#...#.........#...#",
  "#########################"
];

const IOTA_WEAVE_CORE_ROWS = [
  "#########################",
  "#.........#.....#.......#",
  "..##.####.###.#.#.#####.#",
  "#.......#.....#.#...#G#.#",
  "#####.#########.#.#.#.#.#",
  "#.....#.........#.#.#...#",
  "#.#####.#########.#.#####",
  "#.#.....#.........#.#...#",
  "#.#.#.#.#.#########.#.#.#",
  "#.#.#.#.#...#.....#...#.#",
  "#.#.#.#.#####.###.#####.#",
  "#...#.#.....#...#.....#.#",
  "#.###.#####.###.#####.#.#",
  "#...#.......#...#.....#.#",
  "###.#########.###.#####.#",
  "#...#.....#...#.........#",
  "#.#####.#.###.#########.#",
  "#.#.....#...#.....#...#.#",
  "#.###.#####.#####.#.#.#.#",
  "#.#...#.........#.....#.#",
  "#.#.###.###.###.###.#.###",
  "#.#.......#...#...#.#...#",
  "#.#######.#.#.###.#.###.#",
  "#.........#.#...........#",
  "#########################"
];

const KAPPA_TRAP_CORE_ROWS = [
  "#########################",
  "#.#.......#.....#...#...#",
  "..###.###.#.###.#.#.#.###",
  "#...#...#.#...#...#.#...#",
  "###.###.#.#.#.##.##.#.#.#",
  "#.#.#...#.#.#.#...#.#.#.#",
  "#.#.#.###.#.#.###.#.###.#",
  "#.#.#.#...#.#.......#...#",
  "#.#.#.#.#####.#.#.###.###",
  "#...#.#...........#.....#",
  "#.#.#.###########.#####.#",
  "#.#...#...#.......#...#.#",
  "#.###.#.#.#####.###.#.#.#",
  "#...#...#.....#.....#.#.#",
  "###.#########.###.#.#.#.#",
  "#.#.........#...#...#...#",
  "#.#########.#.#.#######.#",
  "#.....#...#.#...#.#.....#",
  "#.###.#.###.#.#.#...#####",
  "#...#.....#.#.#.#.#...#.#",
  "###.#.#.#.#.###.#.###.#.#",
  "#...#....G#.....#...#.#.#",
  "#.#.#############.#.#.#.#",
  "#.................#.....#",
  "#########################"
];

const LAMBDA_SPINE_CORE_ROWS = [
  "#########################",
  "#.#.....#...........#...#",
  "..#.###.#####.#.###.#.#.#",
  "#...#.#.....#.#.#.#...#.#",
  "#####.#####.#.#...###.#.#",
  "#.........#.#.#.#.......#",
  "#####.#####.###.#.#####.#",
  "#...#.#.....#...#...#...#",
  "#.#.#.#.#####.#####.###.#",
  "#.....#.#...#.....#.....#",
  "#.#.###.#.#.#.###.#####.#",
  "#.#.#...#.#.......#G....#",
  "#.#.#.###########.#######",
  "#.#.#.....#.....#.......#",
  "#.#.###.#.#.###.#.#.###.#",
  "#.#...#.#.......#.....#.#",
  "#.###.#.#####.#######.#.#",
  "#.#.........#.#...#...#.#",
  "#.###.###.#.#.#.#.#####.#",
  "#.....#...#.#...#.#.....#",
  "###.###.#.#.###.#.#.#.#.#",
  "#...#...#.#.....#...#...#",
  "#.###.###.#############.#",
  "#.......#...............#",
  "#########################"
];

const MU_LABYRINTH_CORE_ROWS = [
  "#########################",
  "#.#...#.........#...#...#",
  "..#.#.#####.#.#.#.#.#.#.#",
  "#.#.#...#.....#...#G..#.#",
  "#.#.###.#.#####.#.#####.#",
  "#...#...#.#...#...#...#.#",
  "#####.###.#.#.#####.#.#.#",
  "#...#.#.....#.....#.#...#",
  "#.###.#.#.#.#####.#.#####",
  "#.....#.#.#...#...#...#.#",
  "#.#.###.#####.#.#####.#.#",
  "#.#.#.#.........#...#.#.#",
  "#.#.#.#.####.##.#.#.#.#.#",
  "#...#.#.#.....#...#.#...#",
  "#.###.#.###.###.#.#####.#",
  "#...#.#.....#...#.......#",
  "###.#.###.###.###.#######",
  "#.#.#.....#...#.....#...#",
  "#.#.#.#####.#######.#.#.#",
  "#.#.#.....#.......#.#.#.#",
  "#.#.#####.#######.#.#.#.#",
  "#...#...#.....#.......#.#",
  "#.###.#.#######.#######.#",
  "#.....#.........#.......#",
  "#########################"
];

const NU_FORTRESS_CORE_ROWS = [
  "#########################",
  "#.#.......#.....#.......#",
  "..###.###.#.###.#.#####.#",
  "#...#.#...#.#...#.#.#...#",
  "###.#.#.###.#.#.#.#.#.###",
  "#.#...#.#...........#...#",
  "#.#####.#####.#########.#",
  "#...#...#...#...#.#.....#",
  "###.#.###.#.###.#.#.#.#.#",
  "#...#.....#.#.....#.#...#",
  "#.#########.#.#####.###.#",
  "#.........#.#.#.....#...#",
  "#.###.###.#.###.#####.###",
  "#...#.#.#.#.....#...#...#",
  "#####...#.#######.#.###.#",
  "#.....#.........#.#...#.#",
  "#.######.######.#.#####.#",
  "#.........#...#.#G....#.#",
  "#.###.#.#.#.#.#.#####.#.#",
  "#.#.#.#.#...#.#.......#.#",
  "#.#.#.#.#####.#######.#.#",
  "#...#.#...#...#.....#.#.#",
  "###.#.###.#.###.###.###.#",
  "#...#.....#.......#.....#",
  "#########################"
];

export const DEFAULT_MAP_SOURCES: EditableMapSource[] = [
  {
    mapId: "training-lap",
    name: "Training Lap",
    mazeRows: TRAINING_LAP_MAZE_ROWS
  },
  {
    mapId: "alpha-run",
    name: "Alpha Run",
    mazeRows: ALPHA_RUN_CORE_ROWS
  },
  {
    mapId: "beta-dash",
    name: "Beta Dash",
    mazeRows: BETA_DASH_CORE_ROWS
  },
  {
    mapId: "gamma-knot",
    name: "Gamma Knot",
    mazeRows: GAMMA_KNOT_CORE_ROWS
  },
  {
    mapId: "delta-snare",
    name: "Delta Snare",
    mazeRows: DELTA_SNARE_CORE_ROWS
  },
  {
    mapId: "epsilon-vault",
    name: "Epsilon Vault",
    mazeRows: EPSILON_VAULT_CORE_ROWS
  },
  {
    mapId: "zeta-rift",
    name: "Zeta Rift",
    mazeRows: ZETA_RIFT_CORE_ROWS
  },
  {
    mapId: "eta-gauntlet",
    name: "Eta Gauntlet",
    mazeRows: ETA_GAUNTLET_CORE_ROWS
  },
  {
    mapId: "theta-bastion",
    name: "Theta Bastion",
    mazeRows: THETA_BASTION_CORE_ROWS
  },
  {
    mapId: "iota-weave",
    name: "Iota Weave",
    mazeRows: IOTA_WEAVE_CORE_ROWS
  },
  {
    mapId: "kappa-trap",
    name: "Kappa Trap",
    mazeRows: KAPPA_TRAP_CORE_ROWS
  },
  {
    mapId: "lambda-spine",
    name: "Lambda Spine",
    mazeRows: LAMBDA_SPINE_CORE_ROWS
  },
  {
    mapId: "mu-labyrinth",
    name: "Mu Labyrinth",
    mazeRows: MU_LABYRINTH_CORE_ROWS
  },
  {
    mapId: "nu-fortress",
    name: "Nu Fortress",
    mazeRows: NU_FORTRESS_CORE_ROWS
  }
];

export const MAP_DEFINITIONS: MapDefinition[] = DEFAULT_MAP_SOURCES.map(buildMapDefinition);

export function buildMapDefinition(source: EditableMapSource): MapDefinition {
  validateMapSource(source);

  const mazeRows = source.mazeRows.map((row) => row.trimEnd());
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
  const fakeGoalTiles = findTiles(rows, "F");

  return {
    mapId: source.mapId.trim(),
    name: source.name.trim(),
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
    fakeGoalTiles,
    visibilityRadius: 3
  };
}

export function createBlankMazeRows(size = PLAYABLE_MAZE_SIZE) {
  const rows = Array.from({ length: size }, () => "#".repeat(size).split(""));
  const goalRow = Math.max(size - 2, 1);
  const goalColumn = Math.max(size - 2, 1);
  const entryRow = Math.min(2, size - 1);

  for (let x = 0; x <= goalColumn; x += 1) {
    rows[entryRow]![x] = ".";
  }
  for (let y = entryRow; y <= goalRow; y += 1) {
    rows[y]![goalColumn] = ".";
  }

  rows[goalRow]![goalColumn] = "G";

  return rows.map((row) => row.join(""));
}

export function getMazeRows(map: Pick<MapDefinition, "tiles" | "mazeZone">) {
  return map.tiles.map((row) => row.slice(map.mazeZone.minX, map.mazeZone.maxX + 1));
}

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

function validateMapSource(source: EditableMapSource) {
  const mapId = source.mapId.trim();
  const name = source.name.trim();
  if (!mapId) {
    throw new Error("MAP_ID_REQUIRED");
  }

  if (!name) {
    throw new Error("MAP_NAME_REQUIRED");
  }

  if (source.mazeRows.length === 0) {
    throw new Error("MAP_ROWS_REQUIRED");
  }

  const expectedWidth = source.mazeRows[0]?.length ?? 0;
  if (expectedWidth < 5) {
    throw new Error("MAP_TOO_SMALL");
  }

  let goalCount = 0;
  for (const row of source.mazeRows) {
    if (row.length !== expectedWidth) {
      throw new Error("MAP_ROWS_INCONSISTENT");
    }

    for (const tile of row) {
      if (tile !== "." && tile !== "#" && tile !== "G" && tile !== "F") {
        throw new Error("MAP_TILE_INVALID");
      }

      if (tile === "G") {
        goalCount += 1;
      }
    }
  }

  if (goalCount !== 1) {
    throw new Error("MAP_GOAL_INVALID");
  }

  const connectorReachableRows = source.mazeRows
    .slice(0, Math.min(START_ZONE.maxY + 1, source.mazeRows.length))
    .filter((row) => row[0] === "." || row[0] === "G" || row[0] === "F");

  if (connectorReachableRows.length === 0) {
    throw new Error("MAP_ENTRY_BLOCKED");
  }

  if (!hasGoalPath(source.mazeRows)) {
    throw new Error("MAP_UNREACHABLE");
  }
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

function findTiles(rows: string[], target: string) {
  const positions: GridPosition[] = [];

  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y]!.length; x += 1) {
      if (rows[y]![x] === target) {
        positions.push({ x, y });
      }
    }
  }

  return positions;
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

export function isFakeGoalTile(map: Pick<MapDefinition, "fakeGoalTiles">, position: GridPosition): boolean {
  return (map.fakeGoalTiles ?? []).some((tile) => tile.x === position.x && tile.y === position.y);
}

function hasGoalPath(mazeRows: string[]) {
  const startEntries = mazeRows
    .slice(0, Math.min(START_ZONE.maxY + 1, mazeRows.length))
    .flatMap((row, rowIndex) => (row[0] === "." || row[0] === "G" || row[0] === "F" ? [{ x: 0, y: rowIndex }] : []));
  const goal = findMazeGoal(mazeRows);

  const queue = [...startEntries];
  const visited = new Set(queue.map((position) => `${position.x},${position.y}`));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === goal.x && current.y === goal.y) {
      return true;
    }

    for (const next of [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ]) {
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.y >= mazeRows.length ||
        next.x >= mazeRows[0]!.length
      ) {
        continue;
      }

      const tile = mazeRows[next.y]![next.x];
      if (tile === "#") {
        continue;
      }

      const key = `${next.x},${next.y}`;
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(next);
    }
  }

  return false;
}

function findMazeGoal(mazeRows: string[]) {
  for (let y = 0; y < mazeRows.length; y += 1) {
    for (let x = 0; x < mazeRows[y]!.length; x += 1) {
      if (mazeRows[y]![x] === "G") {
        return { x, y };
      }
    }
  }

  throw new Error("MAP_GOAL_INVALID");
}
