import { describe, expect, it } from "vitest";

import { createExplorerMemory, decideExplorerMove } from "../../src/bots/explorer-policy.js";

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
});

function createMemoryFromRows(rows: string[]) {
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

  return memory;
}

function createMap(input: {
  tiles: string[];
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
    visibilityRadius: 1
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
