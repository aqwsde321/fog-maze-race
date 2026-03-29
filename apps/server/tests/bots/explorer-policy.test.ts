import { describe, expect, it } from "vitest";
import { isInsideZone, isWalkableTile, MAP_DEFINITIONS } from "@fog-maze-race/shared/maps/map-definitions";

import {
  createExplorerMemory,
  createExplorerSeed,
  decideExplorerMove,
  rememberBlockedMove,
  updateExplorerMemory
} from "../../src/bots/explorer-policy.js";

describe("explorer-policy", () => {
  it("prefers a known open entry row over seeded unknown rows in 3x3 staging", () => {
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

    expect(decision).toEqual({
      direction: "down",
      reason: "staging"
    });
  });

  it("does not reveal the goal zone to explorer memory before it enters vision", () => {
    const map = createMap({
      tiles: ["....G"],
      startZone: bounds(0, 0, 0, 0),
      goalZone: bounds(4, 0, 4, 0)
    });

    const hiddenGoalMemory = updateExplorerMemory({
      previous: createExplorerMemory(),
      snapshot: createSnapshot({
        map,
        selfPosition: { x: 0, y: 0 },
        revision: 1
      }),
      selfPlayerId: "self"
    });

    expect(hiddenGoalMemory.knownTiles.has("4,0")).toBe(false);

    const revealedGoalMemory = updateExplorerMemory({
      previous: hiddenGoalMemory,
      snapshot: createSnapshot({
        map,
        selfPosition: { x: 3, y: 0 },
        revision: 2
      }),
      selfPlayerId: "self"
    });

    expect(revealedGoalMemory.knownTiles.get("4,0")).toBe("G");
  });

  it("prefers maze frontier tiles over the entry approach after leaving the start area", () => {
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

    expect(decision).toEqual({
      direction: "right",
      reason: "frontier"
    });
  });

  it("clears the eta-gauntlet 3x3 regression for the problematic seed group", () => {
    const map = MAP_DEFINITIONS.find((entry) => entry.mapId === "eta-gauntlet");
    expect(map).toBeDefined();

    const regressions = [
      { slotIndex: 2, nickname: "bot5" },
      { slotIndex: 2, nickname: "bot10" },
      { slotIndex: 5, nickname: "bot5" },
      { slotIndex: 5, nickname: "bot10" }
    ];

    for (const regression of regressions) {
      const result = simulateExplorer({
        map: map!,
        slotIndex: regression.slotIndex,
        seed: createExplorerSeed(regression.nickname),
        stepLimit: 1_200
      });

      expect(result.ok, `${regression.nickname} slot ${regression.slotIndex}`).toBe(true);
      expect(result.steps, `${regression.nickname} slot ${regression.slotIndex}`).toBeLessThan(1_200);
    }
  });

  it("keeps shared-start explorer seeds divergent beyond repeated rotation buckets", () => {
    const map = MAP_DEFINITIONS.find((entry) => entry.mapId === "alpha-run");
    expect(map).toBeDefined();

    const bot1Trace = collectTrace({
      map: {
        ...map!,
        visibilityRadius: 2
      },
      seed: createExplorerSeed("bot1"),
      steps: 12
    });
    const bot6Trace = collectTrace({
      map: {
        ...map!,
        visibilityRadius: 2
      },
      seed: createExplorerSeed("bot6"),
      steps: 12
    });

    expect(bot1Trace).not.toEqual(bot6Trace);
  });

  it("diverges frontier and tremaux traces on eta-gauntlet before the midgame", () => {
    const map = MAP_DEFINITIONS.find((entry) => entry.mapId === "eta-gauntlet");
    expect(map).toBeDefined();

    const runtimeMap = {
      ...map!,
      visibilityRadius: 2
    };
    const frontierTrace = collectTrace({
      map: runtimeMap,
      seed: createExplorerSeed("bot2"),
      strategy: "frontier",
      steps: 20
    });
    const tremauxTrace = collectTrace({
      map: runtimeMap,
      seed: createExplorerSeed("bot2"),
      strategy: "tremaux",
      steps: 20
    });

    expect(frontierTrace).not.toEqual(tremauxTrace);
  });

  it("splits symmetric frontier choices even when explorer seeds share the same rotation bucket", () => {
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

    expect(bot1Decision).toEqual({
      direction: expect.any(String),
      reason: "frontier"
    });
    expect(bot5Decision).toEqual({
      direction: expect.any(String),
      reason: "frontier"
    });
    expect(bot1Decision?.direction).not.toBe(bot5Decision?.direction);
  });

  it("splits equal-length goal paths even when explorer seeds share the same rotation bucket", () => {
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

    expect(bot1Decision).toEqual({
      direction: expect.any(String),
      reason: "goal"
    });
    expect(bot5Decision).toEqual({
      direction: expect.any(String),
      reason: "goal"
    });
    expect(bot1Decision?.direction).not.toBe(bot5Decision?.direction);
  });

  it("tremaux prefers the frontier reached through less-marked passages", () => {
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

    expect(decision).toEqual({
      direction: "right",
      reason: "frontier"
    });
  });

  it("makes tremaux diverge from frontier when a short branch is already overused", () => {
    const map = createMap({
      tiles: [
        ".#####",
        "......",
        "######"
      ],
      visibilityRadius: 2,
      startZone: bounds(1, 1, 1, 1),
      goalZone: bounds(5, 1, 5, 1)
    });
    const memory = createMemoryFromRows(
      [
        "?#####",
        ".....?",
        "######"
      ],
      [],
      [],
      [["0,1|1,1", 1]]
    );

    const frontierDecision = decideExplorerMove({
      map,
      memory,
      position: { x: 1, y: 1 },
      seed: 0,
      strategy: "frontier"
    });
    const tremauxDecision = decideExplorerMove({
      map,
      memory,
      position: { x: 1, y: 1 },
      seed: 0,
      strategy: "tremaux"
    });

    expect(frontierDecision).toEqual({
      direction: "left",
      reason: "frontier"
    });
    expect(tremauxDecision).toEqual({
      direction: "right",
      reason: "frontier"
    });
  });

  it("tremaux prefers the less-marked shortest goal route", () => {
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

    expect(decision).toEqual({
      direction: "down",
      reason: "goal"
    });
  });
});

function createMemoryFromRows(
  rows: string[],
  visitEntries: Array<[string, number]> = [],
  recentTileKeys: string[] = [],
  edgeEntries: Array<[string, number]> = []
) {
  const memory = createExplorerMemory();

  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y]!.length; x += 1) {
      const tile = rows[y]![x];
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

function createMap(input: {
  tiles: string[];
  visibilityRadius?: number;
  startZone: { minX: number; minY: number; maxX: number; maxY: number };
  goalZone: { minX: number; minY: number; maxX: number; maxY: number };
}) {
  return {
    mapId: "map-1",
    name: "Map 1",
    width: input.tiles[0]!.length,
    height: input.tiles.length,
    tiles: input.tiles,
    startZone: input.startZone,
    mazeZone: bounds(0, 0, input.tiles[0]!.length - 1, input.tiles.length - 1),
    goalZone: input.goalZone,
    startSlots: [{ x: 0, y: 1 }],
    connectorTiles: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 }
    ],
    visibilityRadius: input.visibilityRadius ?? 1
  };
}

function bounds(minX: number, minY: number, maxX: number, maxY: number) {
  return {
    minX,
    minY,
    maxX,
    maxY
  };
}

function simulateExplorer(input: {
  map: (typeof MAP_DEFINITIONS)[number];
  slotIndex: number;
  seed: number;
  stepLimit: number;
}) {
  const map = {
    ...input.map,
    visibilityRadius: 1
  };
  let position = { ...map.startSlots[input.slotIndex]! };
  let memory = createExplorerMemory();

  for (let steps = 0; steps < input.stepLimit; steps += 1) {
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
      return { ok: true as const, steps };
    }

    const decision = decideExplorerMove({
      map,
      memory,
      position,
      seed: input.seed
    });

    if (!decision) {
      return { ok: false as const, steps };
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

  return { ok: false as const, steps: input.stepLimit };
}

function collectTrace(input: {
  map: (typeof MAP_DEFINITIONS)[number];
  seed: number;
  strategy?: "frontier" | "tremaux";
  steps: number;
}) {
  let position = { ...input.map.startSlots[0]! };
  let memory = createExplorerMemory();
  const trace: string[] = [];

  for (let step = 0; step < input.steps; step += 1) {
    memory = updateExplorerMemory({
      previous: memory,
      snapshot: createSnapshot({
        map: input.map,
        selfPosition: position,
        revision: step + 1
      }),
      selfPlayerId: "self"
    });

    const decision = decideExplorerMove({
      map: input.map,
      memory,
      position,
      seed: input.seed,
      strategy: input.strategy
    });
    trace.push(decision?.direction ?? "stop");

    if (!decision) {
      break;
    }

    const next = move(position, decision.direction);
    if (!isWalkableTile(input.map, next)) {
      memory = rememberBlockedMove({
        memory,
        map: input.map,
        position,
        direction: decision.direction
      });
      continue;
    }

    position = next;
  }

  return trace;
}

function createSnapshot(input: {
  map: (typeof MAP_DEFINITIONS)[number];
  selfPosition: { x: number; y: number };
  revision: number;
}) {
  return {
    revision: input.revision,
    room: {
      roomId: "room-1",
      name: "Alpha",
      mode: "normal" as const,
      status: "playing" as const,
      hostPlayerId: "self",
      maxPlayers: 15,
      visibilitySize: 3 as const
    },
    members: [
      {
        playerId: "self",
        nickname: "bot1",
        kind: "bot" as const,
        color: "#ffffff",
        shape: "circle" as const,
        role: "racer" as const,
        state: "playing" as const,
        position: input.selfPosition,
        finishRank: null,
        isHost: true
      }
    ],
    chat: [],
    previewMap: null,
    match: {
      matchId: "match-1",
      mapId: input.map.mapId,
      status: "playing" as const,
      countdownValue: null,
      startedAt: "2026-03-29T00:00:00.000Z",
      endedAt: null,
      resultsDurationMs: null,
      finishOrder: [],
      results: [],
      map: input.map
    }
  };
}

function move(position: { x: number; y: number }, direction: "up" | "down" | "left" | "right") {
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
