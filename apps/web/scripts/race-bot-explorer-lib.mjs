import { movePosition } from "@fog-maze-race/shared/domain/grid-position";
import { createVisibilityProjection, toTileKey } from "@fog-maze-race/shared/visibility/apply-visibility";

const DIRECTION_STEPS = [
  { direction: "right", x: 1, y: 0 },
  { direction: "left", x: -1, y: 0 },
  { direction: "down", x: 0, y: 1 },
  { direction: "up", x: 0, y: -1 }
];

export function createExplorerLoopState() {
  return {
    version: 0,
    runningToken: null
  };
}

export function startExplorerLoopState(state) {
  if (state.runningToken !== null) {
    return {
      state,
      token: null,
      shouldStart: false
    };
  }

  const token = state.version + 1;
  return {
    state: {
      version: token,
      runningToken: token
    },
    token,
    shouldStart: true
  };
}

export function resetExplorerLoopState(state) {
  return {
    version: state.version + 1,
    runningToken: null
  };
}

export function finishExplorerLoopState(state, token) {
  if (state.runningToken !== token) {
    return state;
  }

  return {
    ...state,
    runningToken: null
  };
}

export function createExplorerSeed(nickname = "") {
  const suffixMatch = nickname.match(/(\d+)$/);
  if (suffixMatch) {
    return Math.max(0, Number.parseInt(suffixMatch[1], 10) - 1);
  }

  let hash = 0;
  for (const character of nickname) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function createExplorerMemory() {
  return {
    matchKey: null,
    knownTiles: new Map(),
    visitCounts: new Map(),
    recentTileKeys: []
  };
}

const MAX_RECENT_TILE_KEYS = 8;
const RECENT_PATH_TILE_PENALTY = 700;
const IMMEDIATE_BACKTRACK_PENALTY = 12_000;

export function updateExplorerMemory({
  previous,
  snapshot,
  selfPlayerId
}) {
  const nextMatchKey = getExplorerMatchKey(snapshot, selfPlayerId);
  if (!nextMatchKey) {
    return createExplorerMemory();
  }

  const knownTiles =
    previous.matchKey === nextMatchKey
      ? new Map(previous.knownTiles)
      : new Map();
  const visitCounts =
    previous.matchKey === nextMatchKey
      ? new Map(previous.visitCounts)
      : new Map();
  const recentTileKeys =
    previous.matchKey === nextMatchKey
      ? [...previous.recentTileKeys]
      : [];

  const selfMember = snapshot.members.find((member) => member.playerId === selfPlayerId);
  if (!snapshot.match || !selfMember?.position) {
      return {
        matchKey: nextMatchKey,
        knownTiles,
        visitCounts,
        recentTileKeys
      };
  }

  const projection = createVisibilityProjection({
    map: snapshot.match.map,
    selfPlayerId,
    members: snapshot.members.map((member) => ({
      playerId: member.playerId,
      position: member.position,
      state: member.state
    }))
  });

  for (const tileKey of projection.visibleTileKeys) {
    const position = parseTileKey(tileKey);
    if (!position) {
      continue;
    }
    knownTiles.set(tileKey, tileAt(snapshot.match.map, position.x, position.y));
  }

  const selfTileKey = toTileKey(selfMember.position);
  visitCounts.set(selfTileKey, (visitCounts.get(selfTileKey) ?? 0) + 1);
  if (recentTileKeys[recentTileKeys.length - 1] !== selfTileKey) {
    recentTileKeys.push(selfTileKey);
    if (recentTileKeys.length > MAX_RECENT_TILE_KEYS) {
      recentTileKeys.splice(0, recentTileKeys.length - MAX_RECENT_TILE_KEYS);
    }
  }

  return {
    matchKey: nextMatchKey,
    knownTiles,
    visitCounts,
    recentTileKeys
  };
}

export function decideExplorerMove({
  map,
  memory,
  position,
  seed = 0
}) {
  if (!map || !position) {
    return null;
  }

  const directionSteps = getDirectionSteps(seed);
  const stagedMove = planStartZoneMove({
    map,
    memory,
    position,
    seed
  });
  if (stagedMove) {
    return {
      direction: stagedMove,
      reason: "staging"
    };
  }

  const goalPath = findPath({
    map,
    knownTiles: memory.knownTiles,
    start: position,
    isTarget: (candidate) => isKnownGoalTile(map, memory.knownTiles, candidate.x, candidate.y),
    directionSteps
  });
  if (goalPath && goalPath.length > 0) {
    return {
      direction: goalPath[0],
      reason: "goal"
    };
  }

  const immediateProbe = findUnknownNeighborDirection({
    map,
    knownTiles: memory.knownTiles,
    position,
    directionSteps
  });
  if (immediateProbe) {
    return {
      direction: immediateProbe,
      reason: "probe"
    };
  }

  let bestCandidate = null;
  for (const [tileKey, tile] of memory.knownTiles) {
    if (!isWalkableKnownTile(tile)) {
      continue;
    }

    const candidate = parseTileKey(tileKey);
    if (!candidate) {
      continue;
    }

    if (!hasUnknownNeighbor({
      map,
      knownTiles: memory.knownTiles,
      position: candidate,
      directionSteps
    })) {
      continue;
    }

    const path = findPath({
      map,
      knownTiles: memory.knownTiles,
      start: position,
      isTarget: (current) => current.x === candidate.x && current.y === candidate.y,
      directionSteps
    });
    if (!path || path.length === 0) {
      continue;
    }

    const score =
      path.length * 1_000 +
      (memory.visitCounts.get(tileKey) ?? 0) * 10 +
      calculateRecentPathPenalty({
        start: position,
        path,
        recentTileKeys: memory.recentTileKeys
      }) +
      calculateFrontierBias({
        map,
        candidate,
        seed
      });
    const pathKey = path.join(",");
    if (
      !bestCandidate ||
      score < bestCandidate.score ||
      (score === bestCandidate.score && pathKey < bestCandidate.pathKey)
    ) {
      bestCandidate = {
        score,
        pathKey,
        path
      };
    }
  }

  if (!bestCandidate) {
    return null;
  }

  return {
    direction: bestCandidate.path[0],
    reason: "frontier"
  };
}

export function rememberBlockedMove({
  memory,
  map,
  position,
  direction
}) {
  if (!map || !position || !direction) {
    return memory;
  }

  const target = movePosition(position, direction);
  if (!isInsideMap(map, target)) {
    return memory;
  }

  const tileKey = toTileKey(target);
  if (memory.knownTiles.has(tileKey)) {
    return memory;
  }

  return {
    ...memory,
    knownTiles: new Map(memory.knownTiles).set(tileKey, "#")
  };
}

function findPath({
  map,
  knownTiles,
  start,
  isTarget,
  directionSteps = DIRECTION_STEPS
}) {
  if (!isInsideMap(map, start) || !isKnownWalkable(knownTiles, start)) {
    return null;
  }

  const queue = [{
    position: start,
    path: []
  }];
  const seen = new Set([toTileKey(start)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (isTarget(current.position)) {
      return current.path;
    }

    for (const step of directionSteps) {
      const next = {
        x: current.position.x + step.x,
        y: current.position.y + step.y
      };
      const nextKey = toTileKey(next);
      if (!isInsideMap(map, next) || seen.has(nextKey) || !isKnownWalkable(knownTiles, next)) {
        continue;
      }

      seen.add(nextKey);
      queue.push({
        position: next,
        path: [...current.path, step.direction]
      });
    }
  }

  return null;
}

function hasUnknownNeighbor({
  map,
  knownTiles,
  position,
  directionSteps = DIRECTION_STEPS
}) {
  return Boolean(findUnknownNeighborDirection({ map, knownTiles, position, directionSteps }));
}

function findUnknownNeighborDirection({
  map,
  knownTiles,
  position,
  directionSteps = DIRECTION_STEPS
}) {
  if (!isKnownWalkable(knownTiles, position)) {
    return null;
  }

  for (const step of directionSteps) {
    const next = {
      x: position.x + step.x,
      y: position.y + step.y
    };
    if (!isInsideMap(map, next)) {
      continue;
    }

    if (!knownTiles.has(toTileKey(next))) {
      return step.direction;
    }
  }

  return null;
}

function isKnownGoalTile(map, knownTiles, x, y) {
  const tile = knownTiles.get(`${x},${y}`);
  if (!isWalkableKnownTile(tile)) {
    return false;
  }

  if (tile === "G") {
    return true;
  }

  return (
    x >= map.goalZone.minX &&
    x <= map.goalZone.maxX &&
    y >= map.goalZone.minY &&
    y <= map.goalZone.maxY
  );
}

function planStartZoneMove({
  map,
  memory,
  position,
  seed
}) {
  const currentTile = tileAt(map, position.x, position.y);
  if (currentTile !== "S" && currentTile !== "C") {
    return null;
  }

  const connectorX = map.startZone.maxX + 1;
  const preferredRows = getPreferredEntryRows(map, seed);
  const targetRow =
    preferredRows.find((row) => {
      const entranceTile = memory.knownTiles.get(`${connectorX + 1},${row}`);
      return entranceTile !== "#" && entranceTile !== " ";
    }) ?? preferredRows[0];

  if (typeof targetRow !== "number") {
    return null;
  }

  if (position.y < targetRow) {
    return "down";
  }
  if (position.y > targetRow) {
    return "up";
  }
  if (position.x < connectorX) {
    return "right";
  }
  if (position.x === connectorX) {
    return "right";
  }

  return null;
}

function isKnownWalkable(knownTiles, position) {
  return isWalkableKnownTile(knownTiles.get(toTileKey(position)));
}

function isWalkableKnownTile(tile) {
  return Boolean(tile && tile !== "#" && tile !== " ");
}

function getDirectionSteps(seed) {
  const rotation = normalizeSeed(seed) % DIRECTION_STEPS.length;
  return DIRECTION_STEPS.slice(rotation).concat(DIRECTION_STEPS.slice(0, rotation));
}

function calculateRecentPathPenalty({
  start,
  path,
  recentTileKeys
}) {
  if (path.length === 0 || recentTileKeys.length === 0) {
    return 0;
  }

  let penalty = 0;
  let position = start;
  const previousTileKey =
    recentTileKeys.length >= 2
      ? recentTileKeys[recentTileKeys.length - 2] ?? null
      : null;

  for (let index = 0; index < path.length; index += 1) {
    position = movePosition(position, path[index]);
    const tileKey = toTileKey(position);
    const recentHits = recentTileKeys.reduce((count, recentTileKey) => {
      return recentTileKey === tileKey ? count + 1 : count;
    }, 0);

    penalty += recentHits * RECENT_PATH_TILE_PENALTY;

    if (index === 0 && previousTileKey === tileKey) {
      penalty += IMMEDIATE_BACKTRACK_PENALTY;
    }
  }

  return penalty;
}

function calculateFrontierBias({
  map,
  candidate,
  seed
}) {
  const normalizedSeed = normalizeSeed(seed);
  const preferredEntryRow = normalizedSeed % Math.min(5, map.height);
  const preferredGlobalRow = normalizedSeed % Math.max(1, map.height);
  const preferredGlobalColumn = Math.floor(normalizedSeed / Math.max(1, map.height)) % Math.max(1, map.width);

  return (
    Math.abs(candidate.y - preferredEntryRow) * 5 +
    Math.abs(candidate.y - preferredGlobalRow) +
    Math.abs(candidate.x - preferredGlobalColumn)
  );
}

function getPreferredEntryRows(map, seed) {
  const baseRows = [1, 2, 0, 3, 4]
    .map((offset) => map.startZone.minY + offset)
    .filter((row) => row >= map.startZone.minY && row <= map.startZone.maxY);
  if (baseRows.length === 0) {
    return [];
  }

  const rotation = normalizeSeed(seed) % baseRows.length;
  return baseRows.slice(rotation).concat(baseRows.slice(0, rotation));
}

function getExplorerMatchKey(snapshot, selfPlayerId) {
  if (!snapshot?.match || !selfPlayerId) {
    return null;
  }

  return `${snapshot.room.roomId}:${snapshot.match.matchId}:${selfPlayerId}`;
}

function parseTileKey(tileKey) {
  const [xText, yText] = tileKey.split(",");
  const x = Number.parseInt(xText ?? "", 10);
  const y = Number.parseInt(yText ?? "", 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function tileAt(map, x, y) {
  const row = map?.tiles?.[y];
  if (!row || x < 0 || x >= row.length) {
    return "#";
  }

  return row[x] ?? "#";
}

function isInsideMap(map, position) {
  return (
    Boolean(map) &&
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < map.width &&
    position.y < map.height
  );
}

function normalizeSeed(seed) {
  return Math.abs(Number(seed) || 0);
}
