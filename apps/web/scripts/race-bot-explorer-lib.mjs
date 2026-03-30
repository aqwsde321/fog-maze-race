import { movePosition } from "@fog-maze-race/shared/domain/grid-position";
import { isConnectorTile, isInsideZone } from "@fog-maze-race/shared/maps/map-definitions";
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
    edgeVisitCounts: new Map(),
    recentTileKeys: []
  };
}

const MAX_RECENT_TILE_KEYS = 8;
const RECENT_PATH_TILE_PENALTY = 700;
const IMMEDIATE_BACKTRACK_PENALTY = 12_000;
const ENTRY_APPROACH_FIRST_STEP_PENALTY = 100_000;
const ENTRY_APPROACH_REENTRY_PENALTY = 18_000;
const START_BAND_TILE_PENALTY = 1_200;
const FRONTIER_EDGE_VISIT_PENALTY = 600;
const TREMAUX_EDGE_VISIT_PENALTY = 2600;
const TREMAUX_FIRST_DIRECTION_ORDER = ["down", "left", "up", "right"];

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
  const edgeVisitCounts =
    previous.matchKey === nextMatchKey
      ? new Map(previous.edgeVisitCounts)
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
        edgeVisitCounts,
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
    })),
    revealGoalZone: false
  });

  for (const tileKey of projection.visibleTileKeys) {
    const position = parseTileKey(tileKey);
    if (!position) {
      continue;
    }
    knownTiles.set(tileKey, tileAt(snapshot.match.map, position.x, position.y));
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

export function decideExplorerMove({
  map,
  memory,
  position,
  seed = 0,
  strategy = "frontier"
}) {
  if (!map || !position) {
    return null;
  }

  const directionSteps = getDirectionSteps(seed);
  const hasExploredBeyondEntryApproach = hasVisitedOutsideEntryApproach(map, memory);
  const hasExploredBeyondStrictEntry = hasVisitedOutsideStrictEntry(map, memory);
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

  const goalMove =
    strategy === "tremaux"
      ? decideTremauxGoalMove({
          map,
          memory,
          position,
          seed,
          directionSteps,
          hasExploredBeyondEntryApproach,
          hasExploredBeyondStrictEntry
        })
      : strategy === "wall"
        ? decideWallGoalMove({
            map,
            knownTiles: memory.knownTiles,
            recentTileKeys: memory.recentTileKeys,
            position,
            seed,
            hasExploredBeyondEntryApproach,
            hasExploredBeyondStrictEntry
          })
      : decideSeededGoalMove({
          map,
          knownTiles: memory.knownTiles,
          recentTileKeys: memory.recentTileKeys,
          position,
          seed,
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
      map,
      memory,
      position,
      seed,
      hasExploredBeyondEntryApproach,
      hasExploredBeyondStrictEntry
    });
    if (wallMove) {
      return wallMove;
    }
  }

  const immediateProbe = findUnknownNeighborDirection({
    map,
    knownTiles: memory.knownTiles,
    position,
    directionSteps,
    avoidEntryApproachReentry: map.visibilityRadius <= 1 && hasExploredBeyondEntryApproach,
    avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasExploredBeyondStrictEntry
  });
  if (immediateProbe) {
    return {
      direction: immediateProbe,
      reason: "probe"
    };
  }

  if (strategy === "tremaux") {
    const tremauxMove = decideTremauxFrontierMove({
      map,
      memory,
      position,
      seed
    });
    if (tremauxMove) {
      return {
        direction: tremauxMove,
        reason: "frontier"
      };
    }
  }

  return decideFrontierMove({
    map,
    memory,
    position,
    seed,
    directionSteps
  });
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

function decideWallGoalMove({
  map,
  knownTiles,
  recentTileKeys,
  position,
  seed,
  hasExploredBeyondEntryApproach,
  hasExploredBeyondStrictEntry
}) {
  const directionSteps = getWallDirectionSteps(seed, recentTileKeys, position);
  const candidates = [];

  for (const step of directionSteps) {
    const next = {
      x: position.x + step.x,
      y: position.y + step.y
    };
    if (!isInsideMap(map, next) || !isKnownWalkable(knownTiles, next)) {
      continue;
    }

    const pathTail = findPath({
      map,
      knownTiles,
      start: next,
      isTarget: (candidate) => isKnownGoalTile(map, knownTiles, candidate.x, candidate.y),
      directionSteps,
      avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasExploredBeyondStrictEntry
    });
    if (!pathTail) {
      continue;
    }

    const path = [step.direction, ...pathTail];
    candidates.push({
      entersEntryApproach: pathTouchesEntryApproach(map, position, path),
      path,
      pathKey: path.join(","),
      recentPenalty:
        calculateRecentPathPenalty({
          start: position,
          path,
          recentTileKeys
        }) +
        calculateEntryApproachPenalty({
          map,
          path,
          start: position,
          hasExploredBeyondEntryApproach
        }) +
        calculateStartBandPenalty({
          map,
          path,
          start: position,
          hasExploredBeyondEntryApproach
        })
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const shortestLength = Math.min(...candidates.map((candidate) => candidate.path.length));
  const shortestCandidates = candidates.filter((candidate) => candidate.path.length === shortestLength);
  const preferredShortestCandidates =
    hasExploredBeyondEntryApproach &&
    map.visibilityRadius <= 1 &&
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

function decideWallFollowMove({
  map,
  memory,
  position,
  seed,
  hasExploredBeyondEntryApproach,
  hasExploredBeyondStrictEntry
}) {
  const directionSteps = getWallDirectionSteps(seed, memory.recentTileKeys, position);
  const probeDirection = findUnknownNeighborDirection({
    map,
    knownTiles: memory.knownTiles,
    position,
    directionSteps,
    avoidEntryApproachReentry: map.visibilityRadius <= 1 && hasExploredBeyondEntryApproach,
    avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasExploredBeyondStrictEntry
  });
  if (probeDirection) {
    return {
      direction: probeDirection,
      reason: "probe"
    };
  }

  const walkableDirection = findKnownWalkableDirection({
    map,
    knownTiles: memory.knownTiles,
    recentTileKeys: memory.recentTileKeys,
    position,
    directionSteps,
    avoidEntryApproachReentry: map.visibilityRadius <= 1 && hasExploredBeyondEntryApproach,
    avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasExploredBeyondStrictEntry
  });
  if (!walkableDirection) {
    return null;
  }

  return {
    direction: walkableDirection,
    reason: "frontier"
  };
}

function decideSeededGoalMove({
  map,
  knownTiles,
  recentTileKeys,
  position,
  seed,
  directionSteps,
  hasExploredBeyondEntryApproach,
  hasExploredBeyondStrictEntry
}) {
  const candidates = [];

  for (const step of directionSteps) {
    const next = {
      x: position.x + step.x,
      y: position.y + step.y
    };
    if (!isInsideMap(map, next) || !isKnownWalkable(knownTiles, next)) {
      continue;
    }

    const pathTail = findPath({
      map,
      knownTiles,
      start: next,
      isTarget: (candidate) => isKnownGoalTile(map, knownTiles, candidate.x, candidate.y),
      directionSteps,
      avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasExploredBeyondStrictEntry
    });
    if (!pathTail) {
      continue;
    }

    const path = [step.direction, ...pathTail];
    candidates.push({
      entersEntryApproach: pathTouchesEntryApproach(map, position, path),
      path,
      pathKey: path.join(","),
      recentPenalty:
        calculateRecentPathPenalty({
          start: position,
          path,
          recentTileKeys
        }) +
        calculateEntryApproachPenalty({
          map,
          path,
          start: position,
          hasExploredBeyondEntryApproach
        }) +
        calculateStartBandPenalty({
          map,
          path,
          start: position,
          hasExploredBeyondEntryApproach
        })
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const shortestLength = Math.min(...candidates.map((candidate) => candidate.path.length));
  const shortestCandidates = candidates.filter((candidate) => candidate.path.length === shortestLength);
  const preferredShortestCandidates =
    hasExploredBeyondEntryApproach &&
    map.visibilityRadius <= 1 &&
    shortestCandidates.some((candidate) => !candidate.entersEntryApproach)
      ? shortestCandidates.filter((candidate) => !candidate.entersEntryApproach)
      : shortestCandidates;
  const bestPenalty = Math.min(...preferredShortestCandidates.map((candidate) => candidate.recentPenalty));
  const rankedCandidates = preferredShortestCandidates
    .filter((candidate) => candidate.recentPenalty === bestPenalty)
    .sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const selectedCandidate =
    pickSeededGoalCandidate(rankedCandidates, seed, position, map.visibilityRadius > 1) ??
    rankedCandidates[0];

  return selectedCandidate?.path[0] ?? null;
}

function decideTremauxGoalMove({
  map,
  memory,
  position,
  seed,
  directionSteps,
  hasExploredBeyondEntryApproach,
  hasExploredBeyondStrictEntry
}) {
  const candidates = [];

  for (const step of directionSteps) {
    const next = {
      x: position.x + step.x,
      y: position.y + step.y
    };
    if (!isInsideMap(map, next) || !isKnownWalkable(memory.knownTiles, next)) {
      continue;
    }

    const pathTail = findPath({
      map,
      knownTiles: memory.knownTiles,
      start: next,
      isTarget: (candidate) => isKnownGoalTile(map, memory.knownTiles, candidate.x, candidate.y),
      directionSteps,
      avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasExploredBeyondStrictEntry
    });
    if (!pathTail) {
      continue;
    }

    const path = [step.direction, ...pathTail];
    candidates.push({
      entersEntryApproach: pathTouchesEntryApproach(map, position, path),
      path,
      pathKey: path.join(","),
      recentPenalty:
        calculateRecentPathPenalty({
          start: position,
          path,
          recentTileKeys: memory.recentTileKeys
        }) +
        calculateEntryApproachPenalty({
          map,
          path,
          start: position,
          hasExploredBeyondEntryApproach
        }) +
        calculateStartBandPenalty({
          map,
          path,
          start: position,
          hasExploredBeyondEntryApproach
        }) +
        calculateEdgeVisitPenalty({
          edgeVisitCounts: memory.edgeVisitCounts,
          start: position,
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
    hasExploredBeyondEntryApproach &&
    map.visibilityRadius <= 1 &&
    shortestCandidates.some((candidate) => !candidate.entersEntryApproach)
      ? shortestCandidates.filter((candidate) => !candidate.entersEntryApproach)
      : shortestCandidates;
  const bestPenalty = Math.min(...preferredShortestCandidates.map((candidate) => candidate.recentPenalty));
  const rankedCandidates = preferredShortestCandidates
    .filter((candidate) => candidate.recentPenalty === bestPenalty)
    .sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const selectedCandidate =
    pickSeededGoalCandidate(rankedCandidates, seed, position, map.visibilityRadius > 1) ??
    rankedCandidates[0];

  return selectedCandidate?.path[0] ?? null;
}

function decideFrontierMove({
  map,
  memory,
  position,
  seed,
  directionSteps
}) {
  const candidates = collectFrontierCandidates({
    map,
    memory,
    position,
    directionSteps,
    avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasVisitedOutsideStrictEntry(map, memory),
    scorePath: ({ tileKey, candidate, path }) =>
      path.length * 1_000 +
      (memory.visitCounts.get(tileKey) ?? 0) * 10 +
      calculateRecentPathPenalty({
        start: position,
        path,
        recentTileKeys: memory.recentTileKeys
      }) +
      calculateEntryApproachPenalty({
        map,
        path,
        start: position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(map, memory)
      }) +
      calculateStartBandPenalty({
        map,
        path,
        start: position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(map, memory)
      }) +
      calculateFrontierBias({
        map,
        candidate,
        seed
      })
  });

  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidates = preferOutsideEntryApproachPaths(map, position, candidates);
  const bestCandidate = preferredCandidates.reduce((best, candidate) => {
    if (!best || candidate.score < best.score) {
      return candidate;
    }

    return best;
  }, null);

  if (!bestCandidate) {
    return null;
  }

  const candidateSlack = getSeedCandidateSlack(map);
  const closeCandidates = preferredCandidates
    .filter((candidate) => candidate.score <= bestCandidate.score + candidateSlack)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.pathKey.localeCompare(right.pathKey);
    });
  const diversityPool = closeCandidates.slice(0, getSeedCandidatePoolSize(map, closeCandidates.length));
  const selectedCandidate =
    pickSeededCandidate(diversityPool, seed, position, map.visibilityRadius > 1) ??
    bestCandidate;

  return {
    direction: selectedCandidate.path[0],
    reason: "frontier"
  };
}

function decideTremauxFrontierMove({
  map,
  memory,
  position,
  seed
}) {
  const directionSteps = getDirectionSteps(seed);
  const candidates = collectFrontierCandidates({
    map,
    memory,
    position,
    directionSteps,
    avoidStrictEntryReentry: map.visibilityRadius <= 1 && hasVisitedOutsideStrictEntry(map, memory),
    scorePath: ({ tileKey, candidate, path }) =>
      path.length * 900 +
      (memory.visitCounts.get(tileKey) ?? 0) * 25 +
      calculateRecentPathPenalty({
        start: position,
        path,
        recentTileKeys: memory.recentTileKeys
      }) +
      calculateEntryApproachPenalty({
        map,
        path,
        start: position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(map, memory)
      }) +
      calculateStartBandPenalty({
        map,
        path,
        start: position,
        hasExploredBeyondEntryApproach: hasVisitedOutsideEntryApproach(map, memory)
      }) +
      calculateEdgeVisitPenalty({
        edgeVisitCounts: memory.edgeVisitCounts,
        start: position,
        path,
        strong: true
      }) +
      calculateFrontierBias({
        map,
        candidate,
        seed
      })
  });

  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidates = preferOutsideEntryApproachPaths(map, position, candidates);
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

  const closeCandidates = rankedCandidates.filter((candidate) => candidate.score <= bestScore + getTremauxCandidateSlack(map));
  const selectedCandidate = pickTremauxCandidate(closeCandidates) ?? rankedCandidates[0];

  return selectedCandidate?.path[0] ?? null;
}

function collectFrontierCandidates({
  map,
  memory,
  position,
  directionSteps,
  avoidStrictEntryReentry,
  scorePath
}) {
  const candidates = [];

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
      directionSteps,
      avoidStrictEntryReentry
    });
    if (!path || path.length === 0) {
      continue;
    }

    candidates.push({
      isEntryApproach: isEntryApproachPosition(map, candidate),
      entersEntryApproach: pathTouchesEntryApproach(map, position, path),
      path,
      pathKey: path.join(","),
      score: scorePath({
        tileKey,
        candidate,
        path
      })
    });
  }

  return candidates;
}

function findPath({
  map,
  knownTiles,
  start,
  isTarget,
  directionSteps = DIRECTION_STEPS,
  avoidStrictEntryReentry = false
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
      if (
        !isInsideMap(map, next) ||
        seen.has(nextKey) ||
        !isKnownWalkable(knownTiles, next) ||
        (avoidStrictEntryReentry && isStrictEntryPosition(map, next))
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
  directionSteps = DIRECTION_STEPS,
  avoidEntryApproachReentry = false,
  avoidStrictEntryReentry = false
}) {
  if (!isKnownWalkable(knownTiles, position)) {
    return null;
  }

  const unknownDirections = [];
  for (const step of directionSteps) {
    const next = {
      x: position.x + step.x,
      y: position.y + step.y
    };
    if (!isInsideMap(map, next)) {
      continue;
    }

    if (!knownTiles.has(toTileKey(next))) {
      unknownDirections.push({
        direction: step.direction,
        position: next
      });
    }
  }

  if (unknownDirections.length === 0) {
    return null;
  }

  if (avoidEntryApproachReentry) {
    const outsideApproach = unknownDirections.find((candidate) => !isEntryApproachPosition(map, candidate.position));
    if (outsideApproach) {
      return outsideApproach.direction;
    }
  }

  if (avoidStrictEntryReentry) {
    const outsideStrictEntry = unknownDirections.find((candidate) => !isStrictEntryPosition(map, candidate.position));
    if (outsideStrictEntry) {
      return outsideStrictEntry.direction;
    }
  }

  return unknownDirections[0].direction;
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
  const knownOpenRow = preferredRows.find((row) =>
    isWalkableKnownTile(memory.knownTiles.get(`${connectorX + 1},${row}`))
  );
  const targetRow =
    knownOpenRow ??
    preferredRows.find((row) => {
      const entranceTile = memory.knownTiles.get(`${connectorX + 1},${row}`);
      return entranceTile !== "#" && entranceTile !== " ";
    }) ??
    preferredRows[0];

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

function getWallDirectionSteps(seed, recentTileKeys, position) {
  const heading = getRecentHeading(recentTileKeys, position) ?? getDirectionSteps(seed)[0].direction;
  const orderedDirections = normalizeSeed(seed) % 2 === 0
    ? [turnLeft(heading), heading, turnRight(heading), oppositeDirection(heading)]
    : [turnRight(heading), heading, turnLeft(heading), oppositeDirection(heading)];

  return orderedDirections
    .map((direction) => DIRECTION_STEPS.find((step) => step.direction === direction))
    .filter(Boolean);
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

function calculateEdgeVisitPenalty({
  edgeVisitCounts,
  start,
  path,
  strong
}) {
  let penalty = 0;
  let position = start;

  for (const direction of path) {
    const next = movePosition(position, direction);
    const edgeKey = toEdgeKey(toTileKey(position), toTileKey(next));
    const visits = edgeVisitCounts.get(edgeKey) ?? 0;
    if (visits > 0) {
      penalty += visits * (strong ? TREMAUX_EDGE_VISIT_PENALTY : FRONTIER_EDGE_VISIT_PENALTY);
    }
    position = next;
  }

  return penalty;
}

function calculateEntryApproachPenalty({
  map,
  start,
  path,
  hasExploredBeyondEntryApproach
}) {
  if (!hasExploredBeyondEntryApproach || map.visibilityRadius > 1 || path.length === 0) {
    return 0;
  }

  let penalty = 0;
  let position = start;

  for (const direction of path) {
    position = movePosition(position, direction);
    if (isEntryApproachPosition(map, position)) {
      penalty += ENTRY_APPROACH_REENTRY_PENALTY;
    }
  }

  const firstStepPosition = movePosition(start, path[0]);
  if (
    !isEntryApproachPosition(map, start) &&
    isEntryApproachPosition(map, firstStepPosition)
  ) {
    penalty += ENTRY_APPROACH_FIRST_STEP_PENALTY;
  }

  return penalty;
}

function calculateStartBandPenalty({
  map,
  start,
  path,
  hasExploredBeyondEntryApproach
}) {
  if (!hasExploredBeyondEntryApproach || map.visibilityRadius > 1 || path.length === 0) {
    return 0;
  }

  let penalty = 0;
  let position = start;

  for (const direction of path) {
    position = movePosition(position, direction);
    if (
      position.y >= map.startZone.minY &&
      position.y <= map.startZone.maxY &&
      !isEntryApproachPosition(map, position)
    ) {
      penalty += START_BAND_TILE_PENALTY;
    }
  }

  return penalty;
}

function preferOutsideEntryApproachPaths(map, position, candidates) {
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

function calculateFrontierBias({
  map,
  candidate,
  seed
}) {
  if (!isEntryApproachPosition(map, candidate)) {
    return 0;
  }

  const normalizedSeed = normalizeSeed(seed);
  const preferredEntryRow = normalizedSeed % Math.min(5, map.height);
  return Math.abs(candidate.y - preferredEntryRow) * 5;
}

function getSeedCandidateSlack(map) {
  return map.visibilityRadius > 1 ? 1_050 : 0;
}

function getSeedCandidatePoolSize(map, candidateCount) {
  if (candidateCount <= 1) {
    return candidateCount;
  }

  return map.visibilityRadius > 1 ? Math.min(3, candidateCount) : Math.min(2, candidateCount);
}

function getTremauxCandidateSlack(map) {
  return map.visibilityRadius > 1 ? 700 : 0;
}

function pickSeededCandidate(candidates, seed, position, strongDiversity = false) {
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (!strongDiversity) {
    const mixedSeed = mixSeedLegacy(seed, position);
    return candidates[mixedSeed % candidates.length];
  }

  const sortedCandidates = [...candidates].sort((left, right) => left.pathKey.localeCompare(right.pathKey));
  const mixedSeed = hashText(`${normalizeSeed(seed)}:${position.x},${position.y}:${sortedCandidates.length}`);
  const index = (((mixedSeed >>> 2) ^ mixedSeed) >>> 0) % sortedCandidates.length;
  return sortedCandidates[index] ?? null;
}

function pickSeededGoalCandidate(candidates, seed, position, strongDiversity = false) {
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
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

function pickTremauxCandidate(candidates) {
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, candidate) => {
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

function findKnownWalkableDirection({
  map,
  knownTiles,
  recentTileKeys,
  position,
  directionSteps,
  avoidEntryApproachReentry = false,
  avoidStrictEntryReentry = false
}) {
  if (!isKnownWalkable(knownTiles, position)) {
    return null;
  }

  const previousTileKey =
    recentTileKeys.length >= 2
      ? recentTileKeys[recentTileKeys.length - 2] ?? null
      : null;
  let candidates = directionSteps
    .map((step) => ({
      direction: step.direction,
      position: {
        x: position.x + step.x,
        y: position.y + step.y
      }
    }))
    .filter((candidate) => isInsideMap(map, candidate.position))
    .filter((candidate) => isKnownWalkable(knownTiles, candidate.position));

  if (candidates.length === 0) {
    return null;
  }

  if (avoidEntryApproachReentry) {
    const outsideApproach = candidates.filter((candidate) => !isEntryApproachPosition(map, candidate.position));
    if (outsideApproach.length > 0) {
      candidates = outsideApproach;
    }
  }

  if (avoidStrictEntryReentry) {
    const outsideStrictEntry = candidates.filter((candidate) => !isStrictEntryPosition(map, candidate.position));
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

function rankDirectionBySteps(directionSteps, direction) {
  if (!direction) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = directionSteps.findIndex((step) => step.direction === direction);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function getRecentHeading(recentTileKeys, position) {
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

function turnLeft(direction) {
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

function turnRight(direction) {
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

function oppositeDirection(direction) {
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

function isEntryApproachPosition(map, position) {
  return (
    isStrictEntryPosition(map, position) ||
    (
      position.x <= map.startZone.maxX + 3 &&
      position.y >= map.startZone.minY &&
      position.y <= map.startZone.maxY
    )
  );
}

function isStrictEntryPosition(map, position) {
  return isInsideZone(map.startZone, position) || isConnectorTile(map, position);
}

function hasVisitedOutsideEntryApproach(map, memory) {
  for (const tileKey of memory.visitCounts.keys()) {
    const position = parseTileKey(tileKey);
    if (position && !isEntryApproachPosition(map, position)) {
      return true;
    }
  }

  return false;
}

function hasVisitedOutsideStrictEntry(map, memory) {
  for (const tileKey of memory.visitCounts.keys()) {
    const position = parseTileKey(tileKey);
    if (position && !isStrictEntryPosition(map, position)) {
      return true;
    }
  }

  return false;
}

function pathTouchesEntryApproach(map, start, path) {
  let position = start;

  for (const direction of path) {
    position = movePosition(position, direction);
    if (isEntryApproachPosition(map, position)) {
      return true;
    }
  }

  return false;
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

function toEdgeKey(leftTileKey, rightTileKey) {
  return leftTileKey < rightTileKey ? `${leftTileKey}|${rightTileKey}` : `${rightTileKey}|${leftTileKey}`;
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

function countPathTurns(path) {
  let turns = 0;

  for (let index = 1; index < path.length; index += 1) {
    if (path[index] !== path[index - 1]) {
      turns += 1;
    }
  }

  return turns;
}

function rankTremauxFirstDirection(direction) {
  const rank = direction ? TREMAUX_FIRST_DIRECTION_ORDER.indexOf(direction) : -1;
  return rank >= 0 ? rank : TREMAUX_FIRST_DIRECTION_ORDER.length;
}

function hashText(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash >>> 0;
}

function mixSeedLegacy(seed, position) {
  const normalizedSeed = normalizeSeed(seed);
  return (
    normalizedSeed * 2654435761 +
    (position.x + 1) * 97 +
    (position.y + 1) * 193
  ) >>> 0;
}
