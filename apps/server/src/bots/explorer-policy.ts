import { movePosition, type Direction, type GridPosition } from "@fog-maze-race/shared/domain/grid-position";
import type { MapView, RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import {
  isConnectorTile,
  isInsideZone,
  type MapDefinition
} from "@fog-maze-race/shared/maps/map-definitions";
import { createVisibilityProjection, toTileKey } from "@fog-maze-race/shared/visibility/apply-visibility";

type ExplorerDirectionStep = {
  direction: Direction;
  x: number;
  y: number;
};

type ExplorerMemory = {
  matchKey: string | null;
  knownTiles: Map<string, string>;
  visitCounts: Map<string, number>;
  recentTileKeys: string[];
};

type FrontierCandidate = {
  isEntryApproach: boolean;
  path: Direction[];
  pathKey: string;
  score: number;
};

type GoalCandidate = {
  path: Direction[];
  pathKey: string;
  recentPenalty: number;
};

const DIRECTION_STEPS: ExplorerDirectionStep[] = [
  { direction: "right", x: 1, y: 0 },
  { direction: "left", x: -1, y: 0 },
  { direction: "down", x: 0, y: 1 },
  { direction: "up", x: 0, y: -1 }
];
const MAX_RECENT_TILE_KEYS = 8;
const RECENT_PATH_TILE_PENALTY = 700;
const IMMEDIATE_BACKTRACK_PENALTY = 12_000;

export type ExplorerMoveDecision = {
  direction: Direction;
  reason: "frontier" | "goal" | "probe" | "staging";
};

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

export function createExplorerMemory(): ExplorerMemory {
  return {
    matchKey: null,
    knownTiles: new Map(),
    visitCounts: new Map(),
    recentTileKeys: []
  };
}

export function updateExplorerMemory(input: {
  previous: ExplorerMemory;
  snapshot: RoomSnapshot;
  selfPlayerId: string;
}): ExplorerMemory {
  const nextMatchKey = getExplorerMatchKey(input.snapshot, input.selfPlayerId);
  if (!nextMatchKey) {
    return createExplorerMemory();
  }

  const knownTiles =
    input.previous.matchKey === nextMatchKey
      ? new Map(input.previous.knownTiles)
      : new Map<string, string>();
  const visitCounts =
    input.previous.matchKey === nextMatchKey
      ? new Map(input.previous.visitCounts)
      : new Map<string, number>();
  const recentTileKeys =
    input.previous.matchKey === nextMatchKey
      ? [...input.previous.recentTileKeys]
      : [];

  const selfMember = input.snapshot.members.find((member) => member.playerId === input.selfPlayerId);
  if (!input.snapshot.match || !selfMember?.position) {
    return {
        matchKey: nextMatchKey,
        knownTiles,
        visitCounts,
        recentTileKeys
      };
  }

  const projection = createVisibilityProjection({
    map: toMapDefinition(input.snapshot.match.map),
    selfPlayerId: input.selfPlayerId,
    members: input.snapshot.members.map((member) => ({
      playerId: member.playerId,
      position: member.position,
      state: member.state
    })),
    revealGoalZone: false
  });

  for (const tileKey of projection.visibleTileKeys) {
    const position = parseTileKey(tileKey);
    if (!position) {
      continue;
    }

    knownTiles.set(tileKey, tileAt(input.snapshot.match.map, position.x, position.y));
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

export function decideExplorerMove(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed?: number;
}): ExplorerMoveDecision | null {
  if (!input.map || !input.position) {
    return null;
  }

  const directionSteps = getDirectionSteps(input.seed ?? 0);
  const stagedMove = planStartZoneMove({
    map: input.map,
    memory: input.memory,
    position: input.position,
    seed: input.seed ?? 0
  });
  if (stagedMove) {
    return {
      direction: stagedMove,
      reason: "staging"
    };
  }

  const goalMove = decideSeededGoalMove({
    map: input.map,
    knownTiles: input.memory.knownTiles,
    recentTileKeys: input.memory.recentTileKeys,
    position: input.position,
    seed: input.seed ?? 0,
    directionSteps
  });
  if (goalMove) {
    return {
      direction: goalMove,
      reason: "goal"
    };
  }

  const immediateProbe = findUnknownNeighborDirection({
    map: input.map,
    knownTiles: input.memory.knownTiles,
    position: input.position,
    directionSteps
  });
  if (immediateProbe) {
    return {
      direction: immediateProbe,
      reason: "probe"
    };
  }

  const candidates: FrontierCandidate[] = [];
  for (const [tileKey, tile] of input.memory.knownTiles) {
    if (!isWalkableKnownTile(tile)) {
      continue;
    }

    const candidate = parseTileKey(tileKey);
    if (!candidate) {
      continue;
    }

    if (!hasUnknownNeighbor({
      map: input.map,
      knownTiles: input.memory.knownTiles,
      position: candidate,
      directionSteps
    })) {
      continue;
    }

    const path = findPath({
      map: input.map,
      knownTiles: input.memory.knownTiles,
      start: input.position,
      isTarget: (current) => current.x === candidate.x && current.y === candidate.y,
      directionSteps
    });
    if (!path || path.length === 0) {
      continue;
    }

    const score =
      path.length * 1_000 +
      (input.memory.visitCounts.get(tileKey) ?? 0) * 10 +
      calculateRecentPathPenalty({
        start: input.position,
        path,
        recentTileKeys: input.memory.recentTileKeys
      }) +
      calculateFrontierBias({
        map: input.map,
        candidate,
        seed: input.seed ?? 0
      });
    const pathKey = path.join(",");
    candidates.push({
      isEntryApproach: isEntryApproachPosition(input.map, candidate),
      path,
      pathKey,
      score
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidates =
    !isEntryApproachPosition(input.map, input.position) && candidates.some((candidate) => !candidate.isEntryApproach)
      ? candidates.filter((candidate) => !candidate.isEntryApproach)
      : candidates;
  const bestCandidate = preferredCandidates.reduce<FrontierCandidate | null>((best, candidate) => {
    if (!best || candidate.score < best.score) {
      return candidate;
    }

    return best;
  }, null);

  if (!bestCandidate) {
    return null;
  }

  const candidateSlack = getSeedCandidateSlack(input.map);
  const closeCandidates = preferredCandidates
    .filter((candidate) => candidate.score <= bestCandidate.score + candidateSlack)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.pathKey.localeCompare(right.pathKey);
    });
  const diversityPool = closeCandidates.slice(0, getSeedCandidatePoolSize(input.map, closeCandidates.length));
  const selectedCandidate =
    pickSeededCandidate(diversityPool, input.seed ?? 0, input.position, input.map.visibilityRadius > 1) ??
    bestCandidate;

  return {
    direction: selectedCandidate.path[0]!,
    reason: "frontier"
  };
}

export function rememberBlockedMove(input: {
  memory: ExplorerMemory;
  map: MapView;
  position: GridPosition;
  direction: Direction;
}): ExplorerMemory {
  if (!input.map || !input.position || !input.direction) {
    return input.memory;
  }

  const target = movePosition(input.position, input.direction);
  if (!isInsideMap(input.map, target)) {
    return input.memory;
  }

  const tileKey = toTileKey(target);
  if (input.memory.knownTiles.has(tileKey)) {
    return input.memory;
  }

  return {
    ...input.memory,
    knownTiles: new Map(input.memory.knownTiles).set(tileKey, "#")
  };
}

function decideSeededGoalMove(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  recentTileKeys: string[];
  position: GridPosition;
  seed: number;
  directionSteps: ExplorerDirectionStep[];
}) {
  const candidates: GoalCandidate[] = [];

  for (const step of input.directionSteps) {
    const next = {
      x: input.position.x + step.x,
      y: input.position.y + step.y
    };
    if (!isInsideMap(input.map, next) || !isKnownWalkable(input.knownTiles, next)) {
      continue;
    }

    const pathTail = findPath({
      map: input.map,
      knownTiles: input.knownTiles,
      start: next,
      isTarget: (candidate) => isKnownGoalTile(input.map, input.knownTiles, candidate.x, candidate.y),
      directionSteps: input.directionSteps
    });
    if (!pathTail) {
      continue;
    }

    const path = [step.direction, ...pathTail];
    candidates.push({
      path,
      pathKey: path.join(","),
      recentPenalty: calculateRecentPathPenalty({
        start: input.position,
        path,
        recentTileKeys: input.recentTileKeys
      })
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const shortestLength = Math.min(...candidates.map((candidate) => candidate.path.length));
  const shortestCandidates = candidates.filter((candidate) => candidate.path.length === shortestLength);
  const bestPenalty = Math.min(...shortestCandidates.map((candidate) => candidate.recentPenalty));
  const rankedCandidates = shortestCandidates
    .filter((candidate) => candidate.recentPenalty === bestPenalty)
    .sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const selectedCandidate =
    pickSeededCandidate(rankedCandidates, input.seed, input.position, input.map.visibilityRadius > 1) ??
    rankedCandidates[0];

  return selectedCandidate?.path[0] ?? null;
}

function findPath(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  start: GridPosition;
  isTarget: (position: GridPosition) => boolean;
  directionSteps: ExplorerDirectionStep[];
}) {
  if (!isInsideMap(input.map, input.start) || !isKnownWalkable(input.knownTiles, input.start)) {
    return null;
  }

  const queue: Array<{ position: GridPosition; path: Direction[] }> = [{
    position: input.start,
    path: []
  }];
  const seen = new Set([toTileKey(input.start)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (input.isTarget(current.position)) {
      return current.path;
    }

    for (const step of input.directionSteps) {
      const next = {
        x: current.position.x + step.x,
        y: current.position.y + step.y
      };
      const nextKey = toTileKey(next);
      if (!isInsideMap(input.map, next) || seen.has(nextKey) || !isKnownWalkable(input.knownTiles, next)) {
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

function hasUnknownNeighbor(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  position: GridPosition;
  directionSteps: ExplorerDirectionStep[];
}) {
  return Boolean(findUnknownNeighborDirection(input));
}

function findUnknownNeighborDirection(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  position: GridPosition;
  directionSteps: ExplorerDirectionStep[];
}): Direction | null {
  if (!isKnownWalkable(input.knownTiles, input.position)) {
    return null;
  }

  for (const step of input.directionSteps) {
    const next = {
      x: input.position.x + step.x,
      y: input.position.y + step.y
    };
    if (!isInsideMap(input.map, next)) {
      continue;
    }

    if (!input.knownTiles.has(toTileKey(next))) {
      return step.direction;
    }
  }

  return null;
}

function isKnownGoalTile(map: MapView, knownTiles: Map<string, string>, x: number, y: number) {
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

function planStartZoneMove(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed: number;
}): Direction | null {
  const currentTile = tileAt(input.map, input.position.x, input.position.y);
  if (currentTile !== "S" && currentTile !== "C") {
    return null;
  }

  const connectorX = input.map.startZone.maxX + 1;
  const preferredRows = getPreferredEntryRows(input.map, input.seed);
  const knownOpenRow = preferredRows.find((row) =>
    isWalkableKnownTile(input.memory.knownTiles.get(`${connectorX + 1},${row}`))
  );
  const targetRow =
    knownOpenRow ??
    preferredRows.find((row) => {
      const entranceTile = input.memory.knownTiles.get(`${connectorX + 1},${row}`);
      return entranceTile !== "#" && entranceTile !== " ";
    }) ??
    preferredRows[0];

  if (typeof targetRow !== "number") {
    return null;
  }

  if (input.position.y < targetRow) {
    return "down";
  }
  if (input.position.y > targetRow) {
    return "up";
  }
  if (input.position.x <= connectorX) {
    return "right";
  }

  return null;
}

function isKnownWalkable(knownTiles: Map<string, string>, position: GridPosition) {
  return isWalkableKnownTile(knownTiles.get(toTileKey(position)));
}

function isWalkableKnownTile(tile: string | undefined) {
  return Boolean(tile && tile !== "#" && tile !== " ");
}

function getDirectionSteps(seed: number) {
  const rotation = normalizeSeed(seed) % DIRECTION_STEPS.length;
  return DIRECTION_STEPS.slice(rotation).concat(DIRECTION_STEPS.slice(0, rotation));
}

function calculateRecentPathPenalty(input: {
  start: GridPosition;
  path: Direction[];
  recentTileKeys: string[];
}) {
  if (input.path.length === 0 || input.recentTileKeys.length === 0) {
    return 0;
  }

  let penalty = 0;
  let position = input.start;
  const previousTileKey =
    input.recentTileKeys.length >= 2
      ? input.recentTileKeys[input.recentTileKeys.length - 2] ?? null
      : null;

  for (let index = 0; index < input.path.length; index += 1) {
    position = movePosition(position, input.path[index]!);
    const tileKey = toTileKey(position);
    const recentHits = input.recentTileKeys.reduce((count, recentTileKey) => {
      return recentTileKey === tileKey ? count + 1 : count;
    }, 0);

    penalty += recentHits * RECENT_PATH_TILE_PENALTY;

    if (index === 0 && previousTileKey === tileKey) {
      penalty += IMMEDIATE_BACKTRACK_PENALTY;
    }
  }

  return penalty;
}

function calculateFrontierBias(input: {
  map: MapView;
  candidate: GridPosition;
  seed: number;
}) {
  if (!isEntryApproachPosition(input.map, input.candidate)) {
    return 0;
  }

  const normalizedSeed = normalizeSeed(input.seed);
  const preferredEntryRow = normalizedSeed % Math.min(5, input.map.height);
  return Math.abs(input.candidate.y - preferredEntryRow) * 5;
}

function getSeedCandidateSlack(map: MapView) {
  return map.visibilityRadius > 1 ? 1_050 : 0;
}

function getSeedCandidatePoolSize(map: MapView, candidateCount: number) {
  if (candidateCount <= 1) {
    return candidateCount;
  }

  return map.visibilityRadius > 1 ? Math.min(3, candidateCount) : Math.min(2, candidateCount);
}

function pickSeededCandidate<T extends { pathKey: string }>(
  candidates: T[],
  seed: number,
  position: GridPosition,
  strongDiversity = false
) {
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0]!;
  }

  if (!strongDiversity) {
    const mixedSeed = mixSeedLegacy(seed, position);
    return candidates[mixedSeed % candidates.length]!;
  }

  return candidates.reduce<T | null>((best, candidate) => {
    if (!best) {
      return candidate;
    }

    const bestRank = rankSeededCandidate(best, seed, position);
    const candidateRank = rankSeededCandidate(candidate, seed, position);
    if (candidateRank !== bestRank) {
      return candidateRank < bestRank ? candidate : best;
    }

    return candidate.pathKey.localeCompare(best.pathKey) < 0 ? candidate : best;
  }, null);
}

function isEntryApproachPosition(map: MapView, position: GridPosition) {
  return (
    isInsideZone(map.startZone, position) ||
    isConnectorTile(map, position) ||
    (
      position.x <= map.startZone.maxX + 3 &&
      position.y >= map.startZone.minY &&
      position.y <= map.startZone.maxY
    )
  );
}

function getPreferredEntryRows(map: MapView, seed: number) {
  const baseRows = [1, 2, 0, 3, 4]
    .map((offset) => map.startZone.minY + offset)
    .filter((row) => row >= map.startZone.minY && row <= map.startZone.maxY);
  if (baseRows.length === 0) {
    return [];
  }

  const rotation = normalizeSeed(seed) % baseRows.length;
  return baseRows.slice(rotation).concat(baseRows.slice(0, rotation));
}

function getExplorerMatchKey(snapshot: RoomSnapshot, selfPlayerId: string) {
  if (!snapshot.match || !selfPlayerId) {
    return null;
  }

  return `${snapshot.room.roomId}:${snapshot.match.matchId}:${selfPlayerId}`;
}

function parseTileKey(tileKey: string) {
  const [xText, yText] = tileKey.split(",");
  const x = Number.parseInt(xText ?? "", 10);
  const y = Number.parseInt(yText ?? "", 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function tileAt(map: MapView | null, x: number, y: number) {
  const row = map?.tiles?.[y];
  if (!row || x < 0 || x >= row.length) {
    return "#";
  }

  return row[x] ?? "#";
}

function toMapDefinition(map: MapView): MapDefinition {
  return {
    ...map,
    name: map.mapId
  };
}

function isInsideMap(map: MapView, position: GridPosition) {
  return (
    Boolean(map) &&
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < map.width &&
    position.y < map.height
  );
}

function normalizeSeed(seed: number) {
  return Math.abs(Number(seed) || 0);
}

function rankSeededCandidate(candidate: { pathKey: string }, seed: number, position: GridPosition) {
  return hashText(`${normalizeSeed(seed)}:${position.x},${position.y}:${candidate.pathKey}`);
}

function hashText(text: string) {
  let hash = 2_166_136_261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash >>> 0;
}

function mixSeedLegacy(seed: number, position: GridPosition) {
  const normalizedSeed = normalizeSeed(seed);
  return (
    normalizedSeed * 2_654_435_761 +
    (position.x + 1) * 97 +
    (position.y + 1) * 193
  ) >>> 0;
}
