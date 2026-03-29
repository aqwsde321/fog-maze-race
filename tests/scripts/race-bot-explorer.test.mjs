import test from "node:test";
import assert from "node:assert/strict";

import { MAP_DEFINITIONS, isInsideZone, isWalkableTile } from "../../packages/shared/src/maps/map-definitions.ts";

import {
  createExplorerLoopState,
  createExplorerSeed,
  createExplorerMemory,
  decideExplorerMove,
  finishExplorerLoopState,
  rememberBlockedMove,
  resetExplorerLoopState,
  startExplorerLoopState,
  updateExplorerMemory
} from "../../apps/web/scripts/race-bot-explorer-lib.mjs";

test("updateExplorerMemory keeps only visible tiles from the current snapshot and remembers prior discoveries", () => {
  const firstSnapshot = createSnapshot({
    selfPosition: { x: 1, y: 1 },
    map: createMap({
      tiles: [
        "....",
        ".##.",
        "....",
        "...G"
      ],
      visibilityRadius: 1,
      startZone: bounds(1, 1, 1, 1),
      goalZone: bounds(1, 1, 1, 1)
    })
  });

  const firstMemory = updateExplorerMemory({
    previous: createExplorerMemory(),
    snapshot: firstSnapshot,
    selfPlayerId: "self"
  });

  assert.equal(firstMemory.knownTiles.get("0,0"), ".");
  assert.equal(firstMemory.knownTiles.get("2,2"), ".");
  assert.equal(firstMemory.knownTiles.has("3,3"), false);
  assert.equal(firstMemory.visitCounts.get("1,1"), 1);

  const secondSnapshot = createSnapshot({
    selfPosition: { x: 2, y: 1 },
    revision: 2,
    map: firstSnapshot.match.map
  });

  const secondMemory = updateExplorerMemory({
    previous: firstMemory,
    snapshot: secondSnapshot,
    selfPlayerId: "self"
  });

  assert.equal(secondMemory.knownTiles.get("0,0"), ".");
  assert.equal(secondMemory.knownTiles.get("3,2"), ".");
  assert.equal(secondMemory.visitCounts.get("1,1"), 1);
  assert.equal(secondMemory.visitCounts.get("2,1"), 1);
});

test("updateExplorerMemory does not reveal the goal zone before it enters vision", () => {
  const map = createMap({
    tiles: ["....G"],
    visibilityRadius: 1,
    startZone: bounds(0, 0, 0, 0),
    goalZone: bounds(4, 0, 4, 0)
  });

  const hiddenGoalMemory = updateExplorerMemory({
    previous: createExplorerMemory(),
    snapshot: createSnapshot({
      selfPosition: { x: 0, y: 0 },
      map
    }),
    selfPlayerId: "self"
  });

  assert.equal(hiddenGoalMemory.knownTiles.has("4,0"), false);

  const revealedGoalMemory = updateExplorerMemory({
    previous: hiddenGoalMemory,
    snapshot: createSnapshot({
      selfPosition: { x: 3, y: 0 },
      revision: 2,
      map
    }),
    selfPlayerId: "self"
  });

  assert.equal(revealedGoalMemory.knownTiles.get("4,0"), "G");
});

test("decideExplorerMove heads to a known goal path when one is available", () => {
  const map = createMap({
    tiles: [
      "..G",
      "###",
      "..."
    ],
    goalZone: bounds(2, 0, 2, 0)
  });
  const memory = createMemoryFromRows([
    "..G",
    "###",
    "???"
  ]);

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 0 }
  });

  assert.deepEqual(decision, {
    direction: "right",
    reason: "goal"
  });
});

test("decideExplorerMove walks toward the nearest reachable frontier before probing unknown tiles", () => {
  const map = createMap({
    tiles: ["...."],
    goalZone: bounds(3, 0, 3, 0)
  });
  const memory = createMemoryFromRows(["...?"], [["0,0", 1]]);

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 0 }
  });

  assert.deepEqual(decision, {
    direction: "right",
    reason: "frontier"
  });
});

test("decideExplorerMove avoids immediately backtracking to a recent frontier when another frontier is available", () => {
  const map = createMap({
    tiles: ["....."],
    goalZone: bounds(4, 0, 4, 0)
  });
  const memory = createMemoryFromRows(["?...?"], [], ["1,0", "2,0"]);

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 2, y: 0 }
  });

  assert.deepEqual(decision, {
    direction: "right",
    reason: "frontier"
  });
});

test("rememberBlockedMove learns an unknown target as a wall and replans away from it", () => {
  const map = createMap({
    tiles: ["...#"],
    goalZone: bounds(3, 0, 3, 0)
  });
  const memory = createMemoryFromRows(["...?"], [["2,0", 1]]);

  const beforeDecision = decideExplorerMove({
    map,
    memory,
    position: { x: 2, y: 0 }
  });

  assert.deepEqual(beforeDecision, {
    direction: "right",
    reason: "probe"
  });

  const updatedMemory = rememberBlockedMove({
    memory,
    map,
    position: { x: 2, y: 0 },
    direction: "right"
  });

  assert.equal(updatedMemory.knownTiles.get("3,0"), "#");
  assert.equal(
    decideExplorerMove({
      map,
      memory: updatedMemory,
      position: { x: 2, y: 0 }
    }),
    null
  );
});

test("decideExplorerMove does not treat blank padding tiles as walkable frontiers", () => {
  const map = createMap({
    tiles: [
      "SSSC..",
      "SSSC..",
      "    ##"
    ],
    startZone: bounds(0, 0, 2, 1),
    goalZone: bounds(5, 0, 5, 0)
  });
  const memory = createMemoryFromRows([
    "SSSC..",
    "SSSC..",
    "  ?###"
  ]);

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 }
  });

  assert.notDeepEqual(decision, {
    direction: "down",
    reason: "frontier"
  });
});

test("different explorer seeds split symmetric frontier choices", () => {
  const map = createMap({
    tiles: [
      "..",
      ".#",
      ".."
    ],
    startZone: bounds(0, 0, 0, 2),
    goalZone: bounds(1, 0, 1, 2)
  });
  const memory = createMemoryFromRows([
    ".?",
    ".#",
    ".?"
  ]);

  const topDecision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 },
    seed: 0
  });
  const bottomDecision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 },
    seed: 2
  });

  assert.deepEqual(topDecision, {
    direction: "up",
    reason: "frontier"
  });
  assert.deepEqual(bottomDecision, {
    direction: "down",
    reason: "frontier"
  });
});

test("decideExplorerMove prefers a known open entry row over seeded unknown rows in 3x3 staging", () => {
  const map = createMap({
    tiles: [
      "SSSC....",
      "SSSC####",
      "SSSC....",
      "SSSC####",
      "SSSC####"
    ],
    startZone: bounds(0, 0, 2, 4),
    goalZone: bounds(7, 2, 7, 2)
  });
  const memory = createMemoryFromRows([
    "SSSC????",
    "SSSC####",
    "SSSC....",
    "SSSC####",
    "SSSC####"
  ]);

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 1, y: 1 },
    seed: 2
  });

  assert.deepEqual(decision, {
    direction: "down",
    reason: "staging"
  });
});

test("decideExplorerMove prefers maze frontier tiles over the entry approach after leaving the start area", () => {
  const map = createMap({
    tiles: [
      "SSSC######",
      "SSSC.....#",
      "SSSC......",
      "SSSC######",
      "SSSC######"
    ],
    startZone: bounds(0, 0, 2, 4),
    goalZone: bounds(9, 2, 9, 2)
  });
  const memory = createMemoryFromRows([
    "SSSC######",
    "SSSC?...##",
    "SSSC.....?",
    "SSSC######",
    "SSSC######"
  ]);

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 6, y: 2 },
    seed: 0
  });

  assert.deepEqual(decision, {
    direction: "right",
    reason: "frontier"
  });
});

test("createExplorerSeed uses bot suffixes to keep multi-bot behavior stable", () => {
  assert.equal(createExplorerSeed("bot1"), 0);
  assert.equal(createExplorerSeed("bot2"), 1);
  assert.notEqual(createExplorerSeed("bot1"), createExplorerSeed("bot3"));
});

test("explorer loop state can start again after a round reset", () => {
  const firstStart = startExplorerLoopState(createExplorerLoopState());
  assert.equal(firstStart.shouldStart, true);
  assert.equal(firstStart.token, 1);

  const reset = resetExplorerLoopState(firstStart.state);
  assert.equal(reset.runningToken, null);

  const staleFinish = finishExplorerLoopState(reset, firstStart.token);
  assert.deepEqual(staleFinish, reset);

  const secondStart = startExplorerLoopState(staleFinish);
  assert.equal(secondStart.shouldStart, true);
  assert.equal(secondStart.token, 3);
});

test("different explorer seeds diverge on the real alpha-run opening", () => {
  const map = MAP_DEFINITIONS.find((entry) => entry.mapId === "alpha-run");
  assert.ok(map);

  const bot1Trace = collectTrace({
    map,
    seed: createExplorerSeed("bot1"),
    steps: 4
  });
  const bot3Trace = collectTrace({
    map,
    seed: createExplorerSeed("bot3"),
    steps: 4
  });

  assert.notDeepEqual(bot1Trace, bot3Trace);
});

test("shared-start explorer seeds still diverge beyond repeated rotation buckets", () => {
  const map = MAP_DEFINITIONS.find((entry) => entry.mapId === "alpha-run");
  assert.ok(map);

  const bot1Trace = collectTrace({
    map: {
      ...map,
      visibilityRadius: 2
    },
    seed: createExplorerSeed("bot1"),
    steps: 12
  });
  const bot6Trace = collectTrace({
    map: {
      ...map,
      visibilityRadius: 2
    },
    seed: createExplorerSeed("bot6"),
    steps: 12
  });

  assert.notDeepEqual(bot1Trace, bot6Trace);
});

test("explorer seeds split symmetric frontier choices even when they share the same rotation bucket", () => {
  const map = createMap({
    tiles: [
      "..",
      ".#",
      ".."
    ],
    visibilityRadius: 2,
    startZone: bounds(0, 0, 0, 2),
    goalZone: bounds(1, 0, 1, 2)
  });
  const memory = createMemoryFromRows([
    ".?",
    ".#",
    ".?"
  ]);

  const bot1Decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 },
    seed: createExplorerSeed("bot1")
  });
  const bot5Decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 },
    seed: createExplorerSeed("bot5")
  });

  assert.equal(bot1Decision?.reason, "frontier");
  assert.equal(bot5Decision?.reason, "frontier");
  assert.notEqual(bot1Decision?.direction, bot5Decision?.direction);
});

test("explorer seeds split equal-length goal paths even when they share the same rotation bucket", () => {
  const map = createMap({
    tiles: [
      "...",
      ".#G",
      "..."
    ],
    visibilityRadius: 2,
    startZone: bounds(0, 1, 0, 1),
    goalZone: bounds(2, 1, 2, 1)
  });
  const memory = createMemoryFromRows([
    "...",
    ".#G",
    "..."
  ]);

  const bot1Decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 },
    seed: createExplorerSeed("bot1")
  });
  const bot5Decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 },
    seed: createExplorerSeed("bot5")
  });

  assert.equal(bot1Decision?.reason, "goal");
  assert.equal(bot5Decision?.reason, "goal");
  assert.notEqual(bot1Decision?.direction, bot5Decision?.direction);
});

test("tremaux prefers the frontier reached through less-marked passages", () => {
  const map = createMap({
    tiles: ["....."],
    visibilityRadius: 2,
    startZone: bounds(2, 0, 2, 0),
    goalZone: bounds(4, 0, 4, 0)
  });
  const memory = createMemoryFromRows(
    ["?...?"],
    [],
    [],
    [["1,0|2,0", 2]]
  );

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 2, y: 0 },
    seed: 0,
    strategy: "tremaux"
  });

  assert.deepEqual(decision, {
    direction: "right",
    reason: "frontier"
  });
});

test("tremaux prefers the less-marked shortest goal route", () => {
  const map = createMap({
    tiles: [
      "...",
      ".#G",
      "..."
    ],
    visibilityRadius: 2,
    startZone: bounds(0, 1, 0, 1),
    goalZone: bounds(2, 1, 2, 1)
  });
  const memory = createMemoryFromRows(
    [
      "...",
      ".#G",
      "..."
    ],
    [],
    [],
    [["0,0|0,1", 2]]
  );

  const decision = decideExplorerMove({
    map,
    memory,
    position: { x: 0, y: 1 },
    seed: 0,
    strategy: "tremaux"
  });

  assert.deepEqual(decision, {
    direction: "down",
    reason: "goal"
  });
});

test("explorer bot reaches the goal on every shipped map", () => {
  const failures = [];

  for (const map of MAP_DEFINITIONS) {
    const result = simulateExplorer(map);
    if (!result.ok) {
      failures.push({
        mapId: map.mapId,
        ...result
      });
    }
  }

  assert.deepEqual(failures, []);
});

test("explorer bot clears the eta-gauntlet 3x3 regression for the problematic seed group", () => {
  const map = MAP_DEFINITIONS.find((entry) => entry.mapId === "eta-gauntlet");
  assert.ok(map);

  const regressions = [
    { slotIndex: 2, nickname: "bot5" },
    { slotIndex: 2, nickname: "bot10" },
    { slotIndex: 5, nickname: "bot5" },
    { slotIndex: 5, nickname: "bot10" }
  ];

  for (const regression of regressions) {
    const result = simulateExplorer(map, 1_200, {
      slotIndex: regression.slotIndex,
      seed: createExplorerSeed(regression.nickname),
      visibilityRadius: 1
    });

    assert.equal(result.ok, true, `${regression.nickname} slot ${regression.slotIndex}`);
    assert.ok(result.steps < 1_200, `${regression.nickname} slot ${regression.slotIndex}`);
  }
});

function createMemoryFromRows(rows, visitEntries = [], recentTileKeys = [], edgeEntries = []) {
  const memory = createExplorerMemory();

  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const tile = rows[y][x];
      if (tile === "?") {
        continue;
      }
      memory.knownTiles.set(`${x},${y}`, tile);
    }
  }

  for (const [tileKey, count] of visitEntries) {
    memory.visitCounts.set(tileKey, count);
  }

  memory.recentTileKeys = [...recentTileKeys];

  for (const [edgeKey, count] of edgeEntries) {
    memory.edgeVisitCounts.set(edgeKey, count);
  }

  return memory;
}

function createSnapshot({
  map,
  selfPosition,
  revision = 1
}) {
  return {
    revision,
    room: {
      roomId: "room-1",
      name: "Alpha",
      status: "playing",
      hostPlayerId: "self",
      maxPlayers: 4,
      visibilitySize: 3
    },
    members: [
      {
        playerId: "self",
        nickname: "bot1",
        color: "#ffffff",
        shape: "circle",
        state: "playing",
        position: selfPosition,
        finishRank: null,
        isHost: true
      }
    ],
    chat: [],
    previewMap: null,
    match: {
      matchId: "match-1",
      mapId: map.mapId,
      status: "playing",
      countdownValue: null,
      startedAt: "2026-03-29T00:00:00.000Z",
      endedAt: null,
      resultsDurationMs: null,
      finishOrder: [],
      results: [],
      map
    }
  };
}

function createMap({
  tiles,
  visibilityRadius = 1,
  startZone = bounds(0, 0, 0, 0),
  goalZone = bounds(0, 0, 0, 0)
}) {
  return {
    mapId: "map-1",
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    startZone,
    mazeZone: bounds(0, 0, tiles[0].length - 1, tiles.length - 1),
    goalZone,
    startSlots: [{ x: 0, y: 0 }],
    connectorTiles: [],
    visibilityRadius
  };
}

function bounds(minX, minY, maxX, maxY) {
  return {
    minX,
    minY,
    maxX,
    maxY
  };
}

function simulateExplorer(map, stepLimit = 8_000, options = {}) {
  map = {
    ...map,
    visibilityRadius: options.visibilityRadius ?? map.visibilityRadius
  };
  const slotIndex = options.slotIndex ?? 0;
  const seed = options.seed ?? 0;
  let position = { ...map.startSlots[slotIndex] };
  let memory = createExplorerMemory();

  for (let steps = 0; steps < stepLimit; steps += 1) {
    memory = updateExplorerMemory({
      previous: memory,
      snapshot: createSnapshot({
        map,
        selfPosition: position,
        revision: steps + 1
      }),
      selfPlayerId: "self"
    });

    if (isInsideZone(map.goalZone, position)) {
      return {
        ok: true,
        steps
      };
    }

    const decision = decideExplorerMove({
      map,
      memory,
      position,
      seed
    });
    if (!decision) {
      return {
        ok: false,
        reason: "no-decision",
        steps,
        position,
        knownTiles: memory.knownTiles.size
      };
    }

    const next = move(position, decision.direction);
    if (!isWalkableTile(map, next)) {
      memory = rememberBlockedMove({
        memory,
        map,
        position,
        direction: decision.direction
      });
      continue;
    }

    position = next;
  }

  return {
    ok: false,
    reason: "step-limit",
    steps: stepLimit,
    position
  };
}

function move(position, direction) {
  if (direction === "up") {
    return { x: position.x, y: position.y - 1 };
  }
  if (direction === "down") {
    return { x: position.x, y: position.y + 1 };
  }
  if (direction === "left") {
    return { x: position.x - 1, y: position.y };
  }
  return { x: position.x + 1, y: position.y };
}

function collectTrace({
  map,
  seed,
  steps
}) {
  let position = { ...map.startSlots[0] };
  let memory = createExplorerMemory();
  const trace = [];

  for (let step = 0; step < steps; step += 1) {
    memory = updateExplorerMemory({
      previous: memory,
      snapshot: createSnapshot({
        map,
        selfPosition: position,
        revision: step + 1
      }),
      selfPlayerId: "self"
    });

    const decision = decideExplorerMove({
      map,
      memory,
      position,
      seed
    });
    trace.push(decision?.direction ?? "stop");
    if (!decision) {
      break;
    }

    const next = move(position, decision.direction);
    if (!isWalkableTile(map, next)) {
      memory = rememberBlockedMove({
        memory,
        map,
        position,
        direction: decision.direction
      });
      continue;
    }

    position = next;
  }

  return trace;
}
