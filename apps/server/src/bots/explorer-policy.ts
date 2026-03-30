import { movePosition, type Direction, type GridPosition } from "@fog-maze-race/shared/domain/grid-position";
import type { RoomExploreStrategy } from "@fog-maze-race/shared/contracts/realtime";
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
  edgeVisitCounts: Map<string, number>;
  recentTileKeys: string[];
};

type FrontierCandidate = {
  isEntryApproach: boolean;
  entersEntryApproach: boolean;
  path: Direction[];
  pathKey: string;
  score: number;
};

type GoalCandidate = {
  entersEntryApproach: boolean;
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
const ENTRY_APPROACH_FIRST_STEP_PENALTY = 100_000;
const ENTRY_APPROACH_REENTRY_PENALTY = 18_000;
const START_BAND_TILE_PENALTY = 1_200;
const FRONTIER_EDGE_VISIT_PENALTY = 600;
const TREMAUX_EDGE_VISIT_PENALTY = 2_600;
const TREMAUX_FIRST_DIRECTION_ORDER: Direction[] = ["down", "left", "up", "right"];

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
    edgeVisitCounts: new Map(),
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
  const edgeVisitCounts =
    input.previous.matchKey === nextMatchKey
      ? new Map(input.previous.edgeVisitCounts)
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
        edgeVisitCounts,
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
  const previousTileKey = recentTileKeys[recentTileKeys.length - 1] ?? null;
  if (previousTileKey && previousTileKey !== selfTileKey) {
    const edgeKey = toEdgeKey(previousTileKey, selfTileKey);
    edgeVisitCounts.set(edgeKey, (edgeVisitCounts.get(edgeKey) ?? 0) + 1);
  }
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
    edgeVisitCounts,
    recentTileKeys
  };
}

export function decideExplorerMove(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed?: number;
  strategy?: RoomExploreStrategy;
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

  const strategy = input.strategy ?? "frontier";
  const hasExploredBeyondEntryApproach = hasVisitedOutsideEntryApproach(input.map, input.memory);
  const hasExploredBeyondStrictEntry = hasVisitedOutsideStrictEntry(input.map, input.memory);
  const goalMove =
    strategy === "tremaux"
      ? decideTremauxGoalMove({
          map: input.map,
          memory: input.memory,
          position: input.position,
          seed: input.seed ?? 0,
          directionSteps,
          hasExploredBeyondEntryApproach,
          hasExploredBeyondStrictEntry
        })
      : strategy === "wall"
        ? decideWallGoalMove({
            map: input.map,
            knownTiles: input.memory.knownTiles,
            recentTileKeys: input.memory.recentTileKeys,
            position: input.position,
            seed: input.seed ?? 0,
            hasExploredBeyondEntryApproach,
            hasExploredBeyondStrictEntry
          })
      : decideSeededGoalMove({
          map: input.map,
          knownTiles: input.memory.knownTiles,
          recentTileKeys: input.memory.recentTileKeys,
          position: input.position,
          seed: input.seed ?? 0,
          directionSteps,
          hasExploredBeyondEntryApproach,
          hasExploredBeyondStrictEntry
        });
  if (goalMove) {
    return {
      direction: goalMove,
      reason: "goal"
    };
  }

  if (strategy === "wall") {
    const wallMove = decideWallFollowMove({
      map: input.map,
      memory: input.memory,
      position: input.position,
      seed: input.seed ?? 0,
      hasExploredBeyondEntryApproach,
      hasExploredBeyondStrictEntry
    });
    if (wallMove) {
      return wallMove;
    }
  }

  const immediateProbe = findUnknownNeighborDirection({
    map: input.map,
    knownTiles: input.memory.knownTiles,
    position: input.position,
    directionSteps,
    avoidEntryApproachReentry: input.map.visibilityRadius <= 1 && hasExploredBeyondEntryApproach,
    avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && hasExploredBeyondStrictEntry
  });
  if (immediateProbe) {
    return {
      direction: immediateProbe,
      reason: "probe"
    };
  }

  if (strategy === "tremaux") {
    const tremauxMove = decideTremauxFrontierMove({
      map: input.map,
      memory: input.memory,
      position: input.position,
      seed: input.seed ?? 0
    });
    if (tremauxMove) {
      return {
        direction: tremauxMove,
        reason: "frontier"
      };
    }
  }

  return decideFrontierMove({
    map: input.map,
    memory: input.memory,
    position: input.position,
    seed: input.seed ?? 0,
    directionSteps
  });
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

function decideWallGoalMove(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  recentTileKeys: string[];
  position: GridPosition;
  seed: number;
  hasExploredBeyondEntryApproach: boolean;
  hasExploredBeyondStrictEntry: boolean;
}) {
  const directionSteps = getWallDirectionSteps(input.seed, input.recentTileKeys, input.position);
  const candidates: GoalCandidate[] = [];

  for (const step of directionSteps) {
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
      directionSteps,
      avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && input.hasExploredBeyondStrictEntry
    });
    if (!pathTail) {
      continue;
    }

    const path = [step.direction, ...pathTail];
    candidates.push({
      entersEntryApproach: pathTouchesEntryApproach(input.map, input.position, path),
      path,
      pathKey: path.join(","),
      recentPenalty:
        calculateRecentPathPenalty({
          start: input.position,
          path,
          recentTileKeys: input.recentTileKeys
        }) +
        calculateEntryApproachPenalty({
          map: input.map,
          path,
          start: input.position,
          hasExploredBeyondEntryApproach: input.hasExploredBeyondEntryApproach
        }) +
        calculateStartBandPenalty({
          map: input.map,
          path,
          start: input.position,
          hasExploredBeyondEntryApproach: input.hasExploredBeyondEntryApproach
        })
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const shortestLength = Math.min(...candidates.map((candidate) => candidate.path.length));
  const shortestCandidates = candidates.filter((candidate) => candidate.path.length === shortestLength);
  const preferredShortestCandidates =
    input.hasExploredBeyondEntryApproach &&
    input.map.visibilityRadius <= 1 &&
    shortestCandidates.some((candidate) => !candidate.entersEntryApproach)
      ? shortestCandidates.filter((candidate) => !candidate.entersEntryApproach)
      : shortestCandidates;
  const bestPenalty = Math.min(...preferredShortestCandidates.map((candidate) => candidate.recentPenalty));
  const rankedCandidates = preferredShortestCandidates
    .filter((candidate) => candidate.recentPenalty === bestPenalty)
    .sort((left, right) => {
      const leftRank = rankDirectionBySteps(directionSteps, left.path[0]);
      const rightRank = rankDirectionBySteps(directionSteps, right.path[0]);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.pathKey.localeCompare(right.pathKey);
    });

  return rankedCandidates[0]?.path[0] ?? null;
}

function decideWallFollowMove(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed: number;
  hasExploredBeyondEntryApproach: boolean;
  hasExploredBeyondStrictEntry: boolean;
}): ExplorerMoveDecision | null {
  const directionSteps = getWallDirectionSteps(input.seed, input.memory.recentTileKeys, input.position);
  const probeDirection = findUnknownNeighborDirection({
    map: input.map,
    knownTiles: input.memory.knownTiles,
    position: input.position,
    directionSteps,
    avoidEntryApproachReentry: input.map.visibilityRadius <= 1 && input.hasExploredBeyondEntryApproach,
    avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && input.hasExploredBeyondStrictEntry
  });
  if (probeDirection) {
    return {
      direction: probeDirection,
      reason: "probe"
    };
  }

  const walkableDirection = findKnownWalkableDirection({
    map: input.map,
    knownTiles: input.memory.knownTiles,
    recentTileKeys: input.memory.recentTileKeys,
    position: input.position,
    directionSteps,
    avoidEntryApproachReentry: input.map.visibilityRadius <= 1 && input.hasExploredBeyondEntryApproach,
    avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && input.hasExploredBeyondStrictEntry
  });
  if (!walkableDirection) {
    return null;
  }

  return {
    direction: walkableDirection,
    reason: "frontier"
  };
}

function decideSeededGoalMove(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  recentTileKeys: string[];
  position: GridPosition;
  seed: number;
  directionSteps: ExplorerDirectionStep[];
  hasExploredBeyondEntryApproach: boolean;
  hasExploredBeyondStrictEntry: boolean;
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
      directionSteps: input.directionSteps,
      avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && input.hasExploredBeyondStrictEntry
    });
    if (!pathTail) {
      continue;
    }

    const path = [step.direction, ...pathTail];
    candidates.push({
      entersEntryApproach: pathTouchesEntryApproach(input.map, input.position, path),
      path,
      pathKey: path.join(","),
      recentPenalty:
        calculateRecentPathPenalty({
          start: input.position,
          path,
          recentTileKeys: input.recentTileKeys
        }) +
        calculateEntryApproachPenalty({
          map: input.map,
          path,
          start: input.position,
          hasExploredBeyondEntryApproach: input.hasExploredBeyondEntryApproach
        }) +
        calculateStartBandPenalty({
          map: input.map,
          path,
          start: input.position,
          hasExploredBeyondEntryApproach: input.hasExploredBeyondEntryApproach
        })
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const shortestLength = Math.min(...candidates.map((candidate) => candidate.path.length));
  const shortestCandidates = candidates.filter((candidate) => candidate.path.length === shortestLength);
  const preferredShortestCandidates =
    input.hasExploredBeyondEntryApproach &&
    input.map.visibilityRadius <= 1 &&
    shortestCandidates.some((candidate) => !candidate.entersEntryApproach)
      ? shortestCandidates.filter((candidate) => !candidate.entersEntryApproach)
      : shortestCandidates;
  const bestPenalty = Math.min(...preferredShortestCandidates.map((candidate) => candidate.recentPenalty));
  const rankedCandidates = preferredShortestCandidates
    .filter((candidate) => candidate.recentPenalty === bestPenalty)
    .sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const selectedCandidate =
    pickSeededGoalCandidate(rankedCandidates, input.seed, input.position, input.map.visibilityRadius > 1) ??
    rankedCandidates[0];

  return selectedCandidate?.path[0] ?? null;
}

function decideTremauxGoalMove(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed: number;
  directionSteps: ExplorerDirectionStep[];
  hasExploredBeyondEntryApproach: boolean;
  hasExploredBeyondStrictEntry: boolean;
}) {
  const candidates: GoalCandidate[] = [];

  for (const step of input.directionSteps) {
    const next = {
      x: input.position.x + step.x,
      y: input.position.y + step.y
    };
    if (!isInsideMap(input.map, next) || !isKnownWalkable(input.memory.knownTiles, next)) {
      continue;
    }

    const pathTail = findPath({
      map: input.map,
      knownTiles: input.memory.knownTiles,
      start: next,
      isTarget: (candidate) => isKnownGoalTile(input.map, input.memory.knownTiles, candidate.x, candidate.y),
      directionSteps: input.directionSteps,
      avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && input.hasExploredBeyondStrictEntry
    });
    if (!pathTail) {
      continue;
    }

    const path = [step.direction, ...pathTail];
    candidates.push({
      entersEntryApproach: pathTouchesEntryApproach(input.map, input.position, path),
      path,
      pathKey: path.join(","),
      recentPenalty:
        calculateRecentPathPenalty({
          start: input.position,
          path,
          recentTileKeys: input.memory.recentTileKeys
        }) +
        calculateEntryApproachPenalty({
          map: input.map,
          path,
          start: input.position,
          hasExploredBeyondEntryApproach: input.hasExploredBeyondEntryApproach
        }) +
        calculateStartBandPenalty({
          map: input.map,
          path,
          start: input.position,
          hasExploredBeyondEntryApproach: input.hasExploredBeyondEntryApproach
        }) +
        calculateEdgeVisitPenalty({
          edgeVisitCounts: input.memory.edgeVisitCounts,
          start: input.position,
          path,
          strong: true
        })
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const shortestLength = Math.min(...candidates.map((candidate) => candidate.path.length));
  const shortestCandidates = candidates.filter((candidate) => candidate.path.length === shortestLength);
  const preferredShortestCandidates =
    input.hasExploredBeyondEntryApproach &&
    input.map.visibilityRadius <= 1 &&
    shortestCandidates.some((candidate) => !candidate.entersEntryApproach)
      ? shortestCandidates.filter((candidate) => !candidate.entersEntryApproach)
      : shortestCandidates;
  const bestPenalty = Math.min(...preferredShortestCandidates.map((candidate) => candidate.recentPenalty));
  const rankedCandidates = preferredShortestCandidates
    .filter((candidate) => candidate.recentPenalty === bestPenalty)
    .sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const selectedCandidate =
    pickSeededGoalCandidate(rankedCandidates, input.seed, input.position, input.map.visibilityRadius > 1) ??
    rankedCandidates[0];

  return selectedCandidate?.path[0] ?? null;
}

function decideFrontierMove(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed: number;
  directionSteps: ExplorerDirectionStep[];
}): ExplorerMoveDecision | null {
  const candidates = collectFrontierCandidates({
    map: input.map,
    memory: input.memory,
    position: input.position,
    seed: input.seed,
    directionSteps: input.directionSteps,
    avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && hasVisitedOutsideStrictEntry(input.map, input.memory),
    scorePath: ({ tileKey, candidate, path }) =>
      path.length * 1_000 +
      (input.memory.visitCounts.get(tileKey) ?? 0) * 10 +
      calculateRecentPathPenalty({
        start: input.position,
        path,
        recentTileKeys: input.memory.recentTileKeys
      }) +
      calculateEntryApproachPenalty({
        map: input.map,
        path,
        start: input.position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(input.map, input.memory)
      }) +
      calculateStartBandPenalty({
        map: input.map,
        path,
        start: input.position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(input.map, input.memory)
      }) +
      calculateFrontierBias({
        map: input.map,
        candidate,
        seed: input.seed
      })
  });

  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidates = preferOutsideEntryApproachPaths(input.map, input.position, candidates);
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
    pickSeededCandidate(diversityPool, input.seed, input.position, input.map.visibilityRadius > 1) ??
    bestCandidate;

  return {
    direction: selectedCandidate.path[0]!,
    reason: "frontier"
  };
}

function decideTremauxFrontierMove(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed: number;
}) {
  const directionSteps = getDirectionSteps(input.seed);
  const candidates = collectFrontierCandidates({
    map: input.map,
    memory: input.memory,
    position: input.position,
    seed: input.seed,
    directionSteps,
    avoidStrictEntryReentry: input.map.visibilityRadius <= 1 && hasVisitedOutsideStrictEntry(input.map, input.memory),
    scorePath: ({ tileKey, candidate, path }) =>
      path.length * 900 +
      (input.memory.visitCounts.get(tileKey) ?? 0) * 25 +
      calculateRecentPathPenalty({
        start: input.position,
        path,
        recentTileKeys: input.memory.recentTileKeys
      }) +
      calculateEntryApproachPenalty({
        map: input.map,
        path,
        start: input.position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(input.map, input.memory)
      }) +
      calculateStartBandPenalty({
        map: input.map,
        path,
        start: input.position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(input.map, input.memory)
      }) +
      calculateEdgeVisitPenalty({
        edgeVisitCounts: input.memory.edgeVisitCounts,
        start: input.position,
        path,
        strong: true
      }) +
      calculateFrontierBias({
        map: input.map,
        candidate,
        seed: input.seed
      })
  });

  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidates = preferOutsideEntryApproachPaths(input.map, input.position, candidates);
  const rankedCandidates = [...preferredCandidates].sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.pathKey.localeCompare(right.pathKey);
  });
  const bestScore = rankedCandidates[0]?.score;
  if (typeof bestScore !== "number") {
    return null;
  }

  const closeCandidates = rankedCandidates.filter((candidate) => candidate.score <= bestScore + getTremauxCandidateSlack(input.map));
  const selectedCandidate = pickTremauxCandidate(closeCandidates) ?? rankedCandidates[0];

  return selectedCandidate?.path[0] ?? null;
}

function collectFrontierCandidates(input: {
  map: MapView;
  memory: ExplorerMemory;
  position: GridPosition;
  seed: number;
  directionSteps: ExplorerDirectionStep[];
  avoidStrictEntryReentry: boolean;
  scorePath: (input: { tileKey: string; candidate: GridPosition; path: Direction[] }) => number;
}) {
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
      directionSteps: input.directionSteps
    })) {
      continue;
    }

    const path = findPath({
      map: input.map,
      knownTiles: input.memory.knownTiles,
      start: input.position,
      isTarget: (current) => current.x === candidate.x && current.y === candidate.y,
      directionSteps: input.directionSteps,
      avoidStrictEntryReentry: input.avoidStrictEntryReentry
    });
    if (!path || path.length === 0) {
      continue;
    }

    candidates.push({
      isEntryApproach: isEntryApproachPosition(input.map, candidate),
      entersEntryApproach: pathTouchesEntryApproach(input.map, input.position, path),
      path,
      pathKey: path.join(","),
      score: input.scorePath({
        tileKey,
        candidate,
        path
      })
    });
  }

  return candidates;
}

function findPath(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  start: GridPosition;
  isTarget: (position: GridPosition) => boolean;
  directionSteps: ExplorerDirectionStep[];
  avoidStrictEntryReentry?: boolean;
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
      if (
        !isInsideMap(input.map, next) ||
        seen.has(nextKey) ||
        !isKnownWalkable(input.knownTiles, next) ||
        (input.avoidStrictEntryReentry && isStrictEntryPosition(input.map, next))
      ) {
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
  avoidEntryApproachReentry?: boolean;
  avoidStrictEntryReentry?: boolean;
}): Direction | null {
  if (!isKnownWalkable(input.knownTiles, input.position)) {
    return null;
  }

  const unknownDirections: Array<{ direction: Direction; position: GridPosition }> = [];
  for (const step of input.directionSteps) {
    const next = {
      x: input.position.x + step.x,
      y: input.position.y + step.y
    };
    if (!isInsideMap(input.map, next)) {
      continue;
    }

    if (!input.knownTiles.has(toTileKey(next))) {
      unknownDirections.push({
        direction: step.direction,
        position: next
      });
    }
  }

  if (unknownDirections.length === 0) {
    return null;
  }

  if (input.avoidEntryApproachReentry) {
    const outsideApproach = unknownDirections.find((candidate) => !isEntryApproachPosition(input.map, candidate.position));
    if (outsideApproach) {
      return outsideApproach.direction;
    }
  }

  if (input.avoidStrictEntryReentry) {
    const outsideStrictEntry = unknownDirections.find((candidate) => !isStrictEntryPosition(input.map, candidate.position));
    if (outsideStrictEntry) {
      return outsideStrictEntry.direction;
    }
  }

  return unknownDirections[0]!.direction;
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

function getWallDirectionSteps(seed: number, recentTileKeys: string[], position: GridPosition) {
  const heading = getRecentHeading(recentTileKeys, position) ?? getDirectionSteps(seed)[0]!.direction;
  const orderedDirections = normalizeSeed(seed) % 2 === 0
    ? [turnLeft(heading), heading, turnRight(heading), oppositeDirection(heading)]
    : [turnRight(heading), heading, turnLeft(heading), oppositeDirection(heading)];

  return orderedDirections
    .map((direction) => DIRECTION_STEPS.find((step) => step.direction === direction))
    .filter((step): step is ExplorerDirectionStep => Boolean(step));
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

function calculateEdgeVisitPenalty(input: {
  edgeVisitCounts: Map<string, number>;
  start: GridPosition;
  path: Direction[];
  strong: boolean;
}) {
  let penalty = 0;
  let position = input.start;

  for (const direction of input.path) {
    const next = movePosition(position, direction);
    const edgeKey = toEdgeKey(toTileKey(position), toTileKey(next));
    const visits = input.edgeVisitCounts.get(edgeKey) ?? 0;
    if (visits > 0) {
      penalty += visits * (input.strong ? TREMAUX_EDGE_VISIT_PENALTY : FRONTIER_EDGE_VISIT_PENALTY);
    }
    position = next;
  }

  return penalty;
}

function calculateEntryApproachPenalty(input: {
  map: MapView;
  start: GridPosition;
  path: Direction[];
  hasExploredBeyondEntryApproach: boolean;
}) {
  if (!input.hasExploredBeyondEntryApproach || input.map.visibilityRadius > 1 || input.path.length === 0) {
    return 0;
  }

  let penalty = 0;
  let position = input.start;

  for (const direction of input.path) {
    position = movePosition(position, direction);
    if (isEntryApproachPosition(input.map, position)) {
      penalty += ENTRY_APPROACH_REENTRY_PENALTY;
    }
  }

  const firstStepPosition = movePosition(input.start, input.path[0]!);
  if (
    !isEntryApproachPosition(input.map, input.start) &&
    isEntryApproachPosition(input.map, firstStepPosition)
  ) {
    penalty += ENTRY_APPROACH_FIRST_STEP_PENALTY;
  }

  return penalty;
}

function calculateStartBandPenalty(input: {
  map: MapView;
  start: GridPosition;
  path: Direction[];
  hasExploredBeyondEntryApproach: boolean;
}) {
  if (!input.hasExploredBeyondEntryApproach || input.map.visibilityRadius > 1 || input.path.length === 0) {
    return 0;
  }

  let penalty = 0;
  let position = input.start;

  for (const direction of input.path) {
    position = movePosition(position, direction);
    if (
      position.y >= input.map.startZone.minY &&
      position.y <= input.map.startZone.maxY &&
      !isEntryApproachPosition(input.map, position)
    ) {
      penalty += START_BAND_TILE_PENALTY;
    }
  }

  return penalty;
}

function preferOutsideEntryApproachPaths<T extends { isEntryApproach: boolean; entersEntryApproach: boolean }>(
  map: MapView,
  position: GridPosition,
  candidates: T[]
) {
  if (isEntryApproachPosition(map, position)) {
    return candidates;
  }

  const outsideApproachPathCandidates = candidates.some((candidate) => !candidate.entersEntryApproach)
    ? candidates.filter((candidate) => !candidate.entersEntryApproach)
    : candidates;

  return outsideApproachPathCandidates.some((candidate) => !candidate.isEntryApproach)
    ? outsideApproachPathCandidates.filter((candidate) => !candidate.isEntryApproach)
    : outsideApproachPathCandidates;
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

function getTremauxCandidateSlack(map: MapView) {
  return map.visibilityRadius > 1 ? 700 : 0;
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

  const sortedCandidates = [...candidates].sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const mixedSeed = hashText(`${normalizeSeed(seed)}:${position.x},${position.y}:${sortedCandidates.length}`);
  const index = (((mixedSeed >>> 2) ^ mixedSeed) >>> 0) % sortedCandidates.length;
  return sortedCandidates[index] ?? null;
}

function pickSeededGoalCandidate<T extends { pathKey: string }>(
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
    return pickSeededCandidate(candidates, seed, position, false);
  }

  const sortedCandidates = [...candidates].sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const normalizedSeed = normalizeSeed(seed);
  const mixedSeed = hashText(`${normalizedSeed}:${position.x},${position.y}:goal:${sortedCandidates.length}`);
  const index =
    ((((normalizedSeed >>> 2) + normalizedSeed + position.x * 3 + position.y * 5 + (mixedSeed >>> 5)) >>> 0) %
      sortedCandidates.length);
  return sortedCandidates[index] ?? null;
}

function pickTremauxCandidate<T extends { path: Direction[]; pathKey: string }>(candidates: T[]) {
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce<T | null>((best, candidate) => {
    if (!best) {
      return candidate;
    }

    const bestTurnCount = countPathTurns(best.path);
    const candidateTurnCount = countPathTurns(candidate.path);
    if (candidateTurnCount !== bestTurnCount) {
      return candidateTurnCount < bestTurnCount ? candidate : best;
    }

    const bestFirstDirectionRank = rankTremauxFirstDirection(best.path[0]);
    const candidateFirstDirectionRank = rankTremauxFirstDirection(candidate.path[0]);
    if (candidateFirstDirectionRank !== bestFirstDirectionRank) {
      return candidateFirstDirectionRank < bestFirstDirectionRank ? candidate : best;
    }

    if (candidate.path.length !== best.path.length) {
      return candidate.path.length < best.path.length ? candidate : best;
    }

    return candidate.pathKey.localeCompare(best.pathKey) < 0 ? candidate : best;
  }, null);
}

function findKnownWalkableDirection(input: {
  map: MapView;
  knownTiles: Map<string, string>;
  recentTileKeys: string[];
  position: GridPosition;
  directionSteps: ExplorerDirectionStep[];
  avoidEntryApproachReentry?: boolean;
  avoidStrictEntryReentry?: boolean;
}) {
  if (!isKnownWalkable(input.knownTiles, input.position)) {
    return null;
  }

  const previousTileKey =
    input.recentTileKeys.length >= 2
      ? input.recentTileKeys[input.recentTileKeys.length - 2] ?? null
      : null;
  let candidates = input.directionSteps
    .map((step) => ({
      direction: step.direction,
      position: {
        x: input.position.x + step.x,
        y: input.position.y + step.y
      }
    }))
    .filter((candidate) => isInsideMap(input.map, candidate.position))
    .filter((candidate) => isKnownWalkable(input.knownTiles, candidate.position));

  if (candidates.length === 0) {
    return null;
  }

  if (input.avoidEntryApproachReentry) {
    const outsideApproach = candidates.filter((candidate) => !isEntryApproachPosition(input.map, candidate.position));
    if (outsideApproach.length > 0) {
      candidates = outsideApproach;
    }
  }

  if (input.avoidStrictEntryReentry) {
    const outsideStrictEntry = candidates.filter((candidate) => !isStrictEntryPosition(input.map, candidate.position));
    if (outsideStrictEntry.length > 0) {
      candidates = outsideStrictEntry;
    }
  }

  if (previousTileKey) {
    const nonBacktrack = candidates.filter((candidate) => toTileKey(candidate.position) !== previousTileKey);
    if (nonBacktrack.length > 0) {
      candidates = nonBacktrack;
    }
  }

  return candidates[0]?.direction ?? null;
}

function rankDirectionBySteps(directionSteps: ExplorerDirectionStep[], direction: Direction | undefined) {
  if (!direction) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = directionSteps.findIndex((step) => step.direction === direction);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function getRecentHeading(recentTileKeys: string[], position: GridPosition): Direction | null {
  const currentTileKey = toTileKey(position);
  if (recentTileKeys[recentTileKeys.length - 1] !== currentTileKey || recentTileKeys.length < 2) {
    return null;
  }

  const previousPosition = parseTileKey(recentTileKeys[recentTileKeys.length - 2] ?? "");
  if (!previousPosition) {
    return null;
  }

  if (previousPosition.x === position.x - 1 && previousPosition.y === position.y) {
    return "right";
  }
  if (previousPosition.x === position.x + 1 && previousPosition.y === position.y) {
    return "left";
  }
  if (previousPosition.x === position.x && previousPosition.y === position.y - 1) {
    return "down";
  }
  if (previousPosition.x === position.x && previousPosition.y === position.y + 1) {
    return "up";
  }

  return null;
}

function turnLeft(direction: Direction): Direction {
  if (direction === "up") {
    return "left";
  }
  if (direction === "left") {
    return "down";
  }
  if (direction === "down") {
    return "right";
  }
  return "up";
}

function turnRight(direction: Direction): Direction {
  if (direction === "up") {
    return "right";
  }
  if (direction === "right") {
    return "down";
  }
  if (direction === "down") {
    return "left";
  }
  return "up";
}

function oppositeDirection(direction: Direction): Direction {
  if (direction === "up") {
    return "down";
  }
  if (direction === "down") {
    return "up";
  }
  if (direction === "left") {
    return "right";
  }
  return "left";
}

function isEntryApproachPosition(map: MapView, position: GridPosition) {
  return (
    isStrictEntryPosition(map, position) ||
    (
      position.x <= map.startZone.maxX + 3 &&
      position.y >= map.startZone.minY &&
      position.y <= map.startZone.maxY
    )
  );
}

function isStrictEntryPosition(map: MapView, position: GridPosition) {
  return isInsideZone(map.startZone, position) || isConnectorTile(map, position);
}

function hasVisitedOutsideEntryApproach(map: MapView, memory: ExplorerMemory) {
  for (const tileKey of memory.visitCounts.keys()) {
    const position = parseTileKey(tileKey);
    if (position && !isEntryApproachPosition(map, position)) {
      return true;
    }
  }

  return false;
}

function hasVisitedOutsideStrictEntry(map: MapView, memory: ExplorerMemory) {
  for (const tileKey of memory.visitCounts.keys()) {
    const position = parseTileKey(tileKey);
    if (position && !isStrictEntryPosition(map, position)) {
      return true;
    }
  }

  return false;
}

function pathTouchesEntryApproach(map: MapView, start: GridPosition, path: Direction[]) {
  let position = start;

  for (const direction of path) {
    position = movePosition(position, direction);
    if (isEntryApproachPosition(map, position)) {
      return true;
    }
  }

  return false;
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

function toEdgeKey(leftTileKey: string, rightTileKey: string) {
  return leftTileKey < rightTileKey ? `${leftTileKey}|${rightTileKey}` : `${rightTileKey}|${leftTileKey}`;
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

function countPathTurns(path: Direction[]) {
  let turns = 0;

  for (let index = 1; index < path.length; index += 1) {
    if (path[index] !== path[index - 1]) {
      turns += 1;
    }
  }

  return turns;
}

function rankTremauxFirstDirection(direction: Direction | undefined) {
  const rank = direction ? TREMAUX_FIRST_DIRECTION_ORDER.indexOf(direction) : -1;
  return rank >= 0 ? rank : TREMAUX_FIRST_DIRECTION_ORDER.length;
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
