import { describe, expect, it } from "vitest";

import { MAP_DEFINITIONS } from "../../src/maps/map-definitions.js";
import { createVisibilityProjection } from "../../src/visibility/apply-visibility.js";

const map = MAP_DEFINITIONS.find((definition) => definition.mapId === "alpha-run")!;

describe("createVisibilityProjection", () => {
  it("keeps start and goal zones visible even when outside the current vision window", () => {
    const projection = createVisibilityProjection({
      map,
      selfPlayerId: "self",
      members: [
        { playerId: "self", position: { x: 10, y: 8 }, state: "playing" },
        {
          playerId: "goal-runner",
          position: { x: map.goalZone.minX, y: map.goalZone.minY },
          state: "playing"
        }
      ]
    });

    expect(projection.visibleTileKeys).toContain("0,0");
    expect(projection.visibleTileKeys).toContain("3,0");
    expect(projection.visibleTileKeys).toContain(`${map.goalZone.minX},${map.goalZone.minY}`);
    expect(projection.visiblePlayerIds).toContain("goal-runner");
  });

  it("hides maze players outside the viewer's 7x7 vision window", () => {
    const projection = createVisibilityProjection({
      map,
      selfPlayerId: "self",
      members: [
        { playerId: "self", position: { x: 10, y: 8 }, state: "playing" },
        { playerId: "nearby", position: { x: 12, y: 8 }, state: "playing" },
        { playerId: "faraway", position: { x: 18, y: 13 }, state: "playing" }
      ]
    });

    expect(projection.visiblePlayerIds).toContain("nearby");
    expect(projection.visiblePlayerIds).not.toContain("faraway");
  });

  it("reveals the entire map and every player to finishers", () => {
    const projection = createVisibilityProjection({
      map,
      selfPlayerId: "self",
      members: [
        {
          playerId: "self",
          position: { x: map.goalZone.minX, y: map.goalZone.minY },
          state: "finished"
        },
        { playerId: "faraway", position: { x: 6, y: 17 }, state: "playing" }
      ]
    });

    expect(projection.showFullMap).toBe(true);
    expect(projection.visibleTileKeys).toContain(`${map.goalZone.minX},${map.goalZone.minY}`);
    expect(projection.visibleTileKeys).toContain("0,0");
    expect(projection.visiblePlayerIds).toEqual(["self", "faraway"]);
  });
});
