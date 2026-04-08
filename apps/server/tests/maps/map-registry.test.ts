import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMazeRows, getMapById } from "@fog-maze-race/shared/maps/map-definitions";

import { MapRegistry } from "../../src/maps/map-registry.js";

describe("MapRegistry", () => {
  let tempDir: string;
  let mapStorePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fog-maze-race-map-registry-"));
    mapStorePath = join(tempDir, "maps.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("preserves default map feature flags when loading an overridden default map from the store", async () => {
    const kappaTrap = getMapById("kappa-trap");
    if (!kappaTrap) {
      throw new Error("kappa-trap map is required");
    }

    await writeFile(
      mapStorePath,
      JSON.stringify({
        maps: [
          {
            mapId: "kappa-trap",
            name: "Kappa Trap Override",
            mazeRows: getMazeRows(kappaTrap),
            updatedAt: new Date().toISOString()
          }
        ]
      }, null, 2),
      "utf8"
    );

    const registry = new MapRegistry({ storePath: mapStorePath });
    await registry.load();

    expect(registry.get("kappa-trap")?.featureFlags).toEqual({
      itemBoxes: true,
      itemBoxSpawn: {
        mode: "per_racer",
        value: 2
      }
    });
  });
});
