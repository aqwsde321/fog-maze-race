import { describe, expect, it } from "vitest";

import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";

import { createBoardLayout, getTileVisual } from "../../src/game/pixi/renderers/board-render.js";

describe("board render helpers", () => {
  it("scales small maps up to use the canvas area better", () => {
    const trainingLap = getMapById("training-lap")!;
    const layout = createBoardLayout(trainingLap, {
      viewportWidth: 720,
      viewportHeight: 420
    });

    expect(layout.tileSize).toBeGreaterThan(40);
    expect(layout.offsetX).toBeGreaterThan(0);
    expect(layout.offsetY).toBeGreaterThan(0);
  });

  it("uses distinct palette values for connectors, walls, paths, start, and goal tiles", () => {
    const trainingLap = getMapById("training-lap")!;

    const startTile = getTileVisual({
      tile: "S",
      map: trainingLap,
      position: { x: 0, y: 0 },
      isVisible: true
    });
    const connectorTile = getTileVisual({
      tile: "C",
      map: trainingLap,
      position: trainingLap.connectorTiles[0]!,
      isVisible: true
    });
    const goalTile = getTileVisual({
      tile: "G",
      map: trainingLap,
      position: { x: trainingLap.goalZone.minX, y: trainingLap.goalZone.minY },
      isVisible: true
    });
    const wallTile = getTileVisual({
      tile: "#",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX + 1, y: trainingLap.mazeZone.minY + 2 },
      isVisible: true
    });
    const pathTile = getTileVisual({
      tile: ".",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX, y: trainingLap.mazeZone.minY },
      isVisible: true
    });
    const voidTile = getTileVisual({
      tile: " ",
      map: getMapById("alpha-run")!,
      position: { x: 0, y: 6 },
      isVisible: true
    });

    if (!startTile || !connectorTile || !goalTile || !wallTile || !pathTile) {
      throw new Error("Expected non-void tile visuals for start, connector, goal, wall, and path");
    }
    expect(startTile.fillColor).not.toBe(connectorTile.fillColor);
    expect(startTile.fillColor).not.toBe(goalTile.fillColor);
    expect(startTile.fillColor).not.toBe(pathTile.fillColor);
    expect(connectorTile.fillColor).not.toBe(pathTile.fillColor);
    expect(goalTile.fillColor).not.toBe(pathTile.fillColor);
    expect(wallTile.fillColor).not.toBe(pathTile.fillColor);
    expect(wallTile.alpha).toBe(1);
    expect(pathTile.alpha).toBe(1);
    expect(voidTile).toBeNull();
  });
});
