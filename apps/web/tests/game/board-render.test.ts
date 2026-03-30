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

  it("hides maze tiles in preview mode and uses distinct palette values in live mode", () => {
    const trainingLap = getMapById("training-lap")!;
    const previewStartTile = getTileVisual({
      tile: "S",
      map: trainingLap,
      position: { x: 0, y: 0 },
      visibility: "visible",
      mode: "preview"
    });
    const previewMazeTile = getTileVisual({
      tile: ".",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX, y: trainingLap.mazeZone.minY },
      visibility: "visible",
      mode: "preview"
    });

    const startTile = getTileVisual({
      tile: "S",
      map: trainingLap,
      position: { x: 0, y: 0 },
      visibility: "visible",
      mode: "live"
    });
    const connectorTile = getTileVisual({
      tile: "C",
      map: trainingLap,
      position: trainingLap.connectorTiles[0]!,
      visibility: "visible",
      mode: "live"
    });
    const goalTile = getTileVisual({
      tile: "G",
      map: trainingLap,
      position: { x: trainingLap.goalZone.minX, y: trainingLap.goalZone.minY },
      visibility: "visible",
      mode: "live"
    });
    const wallTile = getTileVisual({
      tile: "#",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX + 1, y: trainingLap.mazeZone.minY + 2 },
      visibility: "visible",
      mode: "live"
    });
    const pathTile = getTileVisual({
      tile: ".",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX, y: trainingLap.mazeZone.minY },
      visibility: "visible",
      mode: "live"
    });
    const rememberedWallTile = getTileVisual({
      tile: "#",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX + 1, y: trainingLap.mazeZone.minY + 2 },
      visibility: "remembered",
      mode: "live"
    });
    const rememberedPathTile = getTileVisual({
      tile: ".",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX, y: trainingLap.mazeZone.minY },
      visibility: "remembered",
      mode: "live"
    });
    const hiddenWallTile = getTileVisual({
      tile: "#",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX + 1, y: trainingLap.mazeZone.minY + 2 },
      visibility: "hidden",
      mode: "live"
    });
    const hiddenPathTile = getTileVisual({
      tile: ".",
      map: trainingLap,
      position: { x: trainingLap.mazeZone.minX, y: trainingLap.mazeZone.minY },
      visibility: "hidden",
      mode: "live"
    });
    const voidTile = getTileVisual({
      tile: " ",
      map: getMapById("alpha-run")!,
      position: { x: 0, y: 6 },
      visibility: "visible",
      mode: "live"
    });

    if (
      !previewStartTile ||
      !startTile ||
      !connectorTile ||
      !goalTile ||
      !wallTile ||
      !pathTile ||
      !rememberedWallTile ||
      !rememberedPathTile ||
      !hiddenWallTile ||
      !hiddenPathTile
    ) {
      throw new Error("Expected non-void tile visuals for start, connector, goal, wall, and path");
    }
    expect(previewMazeTile).toBeNull();
    expect(startTile.fillColor).not.toBe(connectorTile.fillColor);
    expect(startTile.fillColor).not.toBe(goalTile.fillColor);
    expect(startTile.fillColor).not.toBe(pathTile.fillColor);
    expect(connectorTile.fillColor).not.toBe(pathTile.fillColor);
    expect(goalTile.fillColor).not.toBe(pathTile.fillColor);
    expect(wallTile.fillColor).not.toBe(pathTile.fillColor);
    expect(rememberedWallTile.fillColor).toBe(rememberedPathTile.fillColor);
    expect(rememberedWallTile.fillColor).not.toBe(pathTile.fillColor);
    expect(rememberedWallTile.fillColor).not.toBe(hiddenWallTile.fillColor);
    expect(hiddenWallTile.fillColor).toBe(hiddenPathTile.fillColor);
    expect(hiddenWallTile.alpha).toBe(hiddenPathTile.alpha);
    expect(wallTile.alpha).toBe(1);
    expect(pathTile.alpha).toBe(1);
    expect(rememberedWallTile.alpha).toBeLessThan(1);
    expect(voidTile).toBeNull();
  });

  it("renders fake goal tiles with the same palette as the real goal", () => {
    const trainingLap = {
      ...getMapById("training-lap")!,
      fakeGoalTiles: [{ x: 4, y: 0 }]
    };
    const fakeGoalTile = getTileVisual({
      tile: ".",
      map: trainingLap,
      position: { x: 4, y: 0 },
      visibility: "visible",
      mode: "live"
    });
    const rememberedFakeGoalTile = getTileVisual({
      tile: ".",
      map: trainingLap,
      position: { x: 4, y: 0 },
      visibility: "remembered",
      mode: "live"
    });
    const realGoalTile = getTileVisual({
      tile: "G",
      map: trainingLap,
      position: { x: trainingLap.goalZone.minX, y: trainingLap.goalZone.minY },
      visibility: "visible",
      mode: "live"
    });

    if (!fakeGoalTile || !rememberedFakeGoalTile || !realGoalTile) {
      throw new Error("Expected non-void tile visuals for fake and real goals");
    }

    expect(fakeGoalTile.fillColor).toBe(realGoalTile.fillColor);
    expect(fakeGoalTile.alpha).toBe(realGoalTile.alpha);
    expect(rememberedFakeGoalTile.fillColor).toBe(0x854d0e);
  });
});
