import { describe, expect, it } from "vitest";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";
import { samePosition } from "@fog-maze-race/shared/domain/grid-position";

import { MatchAggregate } from "../../src/core/match.js";

describe("MatchAggregate", () => {
  it("records each finisher's elapsed race time from the match start", () => {
    const trainingLap = getMapById("training-lap");
    if (!trainingLap) {
      throw new Error("training-lap map is required");
    }

    const match = new MatchAggregate({
      matchId: "match-1",
      roomId: "room-1",
      map: trainingLap
    });

    match.setCountdownValue(0, 10_000);

    const rank = match.markFinished(
      {
        playerId: "player-1",
        nickname: "호1",
        color: "#38bdf8",
        position: { x: 8, y: 1 }
      },
      12_345
    );

    expect(rank).toBe(1);
    expect(match.results).toEqual([
      expect.objectContaining({
        playerId: "player-1",
        outcome: "finished",
        rank: 1,
        elapsedMs: 2_345
      })
    ]);
  });

  it("spawns item boxes only on valid item-map walkable maze tiles", () => {
    const itemMap = getMapById("kappa-trap");
    if (!itemMap) {
      throw new Error("kappa-trap map is required");
    }

    const match = new MatchAggregate({
      matchId: "match-items-1",
      roomId: "room-1",
      map: itemMap
    });

    const spawned = match.spawnItemBoxes(5, () => 0);

    expect(spawned).toHaveLength(5);
    expect(match.itemBoxes).toHaveLength(5);

    for (const box of spawned) {
      expect(box.itemType).toBe("ice_trap");
      expect(box.position.x).toBeGreaterThanOrEqual(itemMap.mazeZone.minX);
      expect(box.position.x).toBeLessThanOrEqual(itemMap.mazeZone.maxX);
      expect(box.position.y).toBeGreaterThanOrEqual(itemMap.mazeZone.minY);
      expect(box.position.y).toBeLessThanOrEqual(itemMap.mazeZone.maxY);
      expect(itemMap.tiles[box.position.y]?.[box.position.x]).not.toBe("#");
      expect(samePosition(box.position, { x: itemMap.goalZone.minX, y: itemMap.goalZone.minY })).toBe(false);
      expect((itemMap.fakeGoalTiles ?? []).some((tile) => samePosition(tile, box.position))).toBe(false);
    }
  });

  it("arms an ice trap after the owner leaves and triggers it only for another racer", () => {
    const itemMap = getMapById("kappa-trap");
    if (!itemMap) {
      throw new Error("kappa-trap map is required");
    }

    const match = new MatchAggregate({
      matchId: "match-items-2",
      roomId: "room-1",
      map: itemMap
    });

    const trapPosition = { x: itemMap.mazeZone.minX + 2, y: 2 };
    const trap = match.placeIceTrap("player-1", trapPosition);

    expect(trap).toMatchObject({
      ownerPlayerId: "player-1",
      position: trapPosition,
      state: "arming"
    });

    match.armTrapForOwner("player-1", trapPosition, { x: trapPosition.x + 1, y: trapPosition.y }, 5_000);

    expect(match.traps[0]).toMatchObject({
      ownerPlayerId: "player-1",
      position: trapPosition,
      state: "armed"
    });

    expect(match.triggerTrapAt("player-1", trapPosition, 6_000)).toBeNull();

    const triggered = match.triggerTrapAt("player-2", trapPosition, 6_500);

    expect(triggered).toMatchObject({
      ownerPlayerId: "player-1",
      position: trapPosition,
      state: "triggered"
    });
    expect(match.traps).toHaveLength(0);
  });
});
