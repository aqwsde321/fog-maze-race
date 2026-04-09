import { describe, expect, it } from "vitest";

import {
  createTileMemoryState,
  resolveTileVisibilityState,
  updateTileMemory
} from "../../src/game/tile-memory.js";

describe("tile memory", () => {
  it("remembers previously visible tiles during the same match", () => {
    const initial = createTileMemoryState();
    const first = updateTileMemory({
      previous: initial,
      snapshot: buildSnapshot("match-1"),
      selfPlayerId: "player-1",
      visibleTileKeys: ["1,1", "1,2"]
    });
    const second = updateTileMemory({
      previous: first,
      snapshot: buildSnapshot("match-1"),
      selfPlayerId: "player-1",
      visibleTileKeys: ["2,2"]
    });

    expect([...second.rememberedTileKeys]).toEqual(["1,1", "1,2", "2,2"]);
    expect(
      resolveTileVisibilityState({
        showFullMap: false,
        tileKey: "1,1",
        visibleTileKeys: new Set(["2,2"]),
        rememberedTileKeys: second.rememberedTileKeys
      })
    ).toBe("remembered");
  });

  it("clears remembered tiles when the match changes or disappears", () => {
    const remembered = updateTileMemory({
      previous: createTileMemoryState(),
      snapshot: buildSnapshot("match-1"),
      selfPlayerId: "player-1",
      visibleTileKeys: ["3,3"]
    });

    const nextMatch = updateTileMemory({
      previous: remembered,
      snapshot: buildSnapshot("match-2"),
      selfPlayerId: "player-1",
      visibleTileKeys: ["4,4"]
    });
    const cleared = updateTileMemory({
      previous: nextMatch,
      snapshot: null,
      selfPlayerId: "player-1",
      visibleTileKeys: []
    });

    expect([...nextMatch.rememberedTileKeys]).toEqual(["4,4"]);
    expect(nextMatch.matchKey).toContain("match-2");
    expect(cleared.matchKey).toBeNull();
    expect(cleared.rememberedTileKeys.size).toBe(0);
  });
});

function buildSnapshot(matchId: string) {
  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      mode: "normal" as const,
      gameMode: "normal" as const,
      status: "playing" as const,
      hostPlayerId: "player-1",
      maxPlayers: 15,
      visibilitySize: 7 as const,
      botSpeedMultiplier: 1 as const
    },
    members: [],
    chat: [],
    previewMap: null,
    match: {
      matchId,
      mapId: "alpha-run",
      status: "playing" as const,
      countdownValue: null,
      startedAt: null,
      endedAt: null,
      resultsDurationMs: null,
      finishOrder: [],
      results: [],
      map: {
        mapId: "alpha-run",
        width: 25,
        height: 25,
        tiles: [],
        startZone: { minX: 0, minY: 0, maxX: 2, maxY: 4 },
        mazeZone: { minX: 4, minY: 0, maxX: 24, maxY: 24 },
        goalZone: { minX: 24, minY: 24, maxX: 24, maxY: 24 },
        startSlots: [],
        connectorTiles: [],
        visibilityRadius: 3
      }
    }
  };
}
