import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMazeRows, getMapById } from "@fog-maze-race/shared/maps/map-definitions";

import { buildServer } from "../../src/app/server.js";

describe("admin map routes", () => {
  let tempDir: string;
  let mapStorePath: string;
  let app: Awaited<ReturnType<typeof buildServer>>["app"];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fog-maze-race-maps-"));
    mapStorePath = join(tempDir, "maps.json");
    const server = await buildServer({ mapStorePath });
    app = server.app;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates, updates, deletes, and reloads editable maps", async () => {
    const baseRows = getMazeRows(getMapById("alpha-run")!);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/maps",
      payload: {
        mapId: "gamma-lock",
        name: "Gamma Lock",
        mazeRows: baseRows,
        featureFlags: {
          itemBoxes: true,
          itemBoxSpawn: {
            mode: "fixed",
            value: 9
          }
        }
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().map.origin).toBe("custom");
    expect(createResponse.json().map.featureFlags).toEqual({
      itemBoxes: true,
      itemBoxSpawn: {
        mode: "fixed",
        value: 9
      }
    });

    const updateRows = [...baseRows];
    updateRows[2] = `${".".repeat(4)}${baseRows[2]!.slice(4)}`;

    const updateResponse = await app.inject({
      method: "PUT",
      url: "/api/admin/maps/alpha-run",
      payload: {
        name: "Alpha Override",
        mazeRows: updateRows,
        featureFlags: {
          itemBoxes: true,
          itemBoxSpawn: {
            mode: "per_racer",
            value: 3
          }
        }
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().map.origin).toBe("override");
    expect(updateResponse.json().map.name).toBe("Alpha Override");
    expect(updateResponse.json().map.featureFlags).toEqual({
      itemBoxes: true,
      itemBoxSpawn: {
        mode: "per_racer",
        value: 3
      }
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/admin/maps"
    });
    const listPayload = listResponse.json();
    expect(listResponse.statusCode).toBe(200);
    expect(listPayload.maps.some((map: { mapId: string }) => map.mapId === "gamma-lock")).toBe(true);
    expect(listPayload.maps.some((map: { mapId: string }) => map.mapId === "training-lap")).toBe(false);

    const deleteCustomResponse = await app.inject({
      method: "DELETE",
      url: "/api/admin/maps/gamma-lock"
    });

    expect(deleteCustomResponse.statusCode).toBe(204);

    const deleteOverrideResponse = await app.inject({
      method: "DELETE",
      url: "/api/admin/maps/alpha-run"
    });

    expect(deleteOverrideResponse.statusCode).toBe(204);

    const deletedCustomResponse = await app.inject({
      method: "GET",
      url: "/api/admin/maps/gamma-lock"
    });

    expect(deletedCustomResponse.statusCode).toBe(404);

    const restoredDefaultResponse = await app.inject({
      method: "GET",
      url: "/api/admin/maps/alpha-run"
    });

    expect(restoredDefaultResponse.statusCode).toBe(200);
    expect(restoredDefaultResponse.json().map.origin).toBe("default");
    expect(restoredDefaultResponse.json().map.name).toBe("Alpha Run");

    await app.close();

    const reloaded = await buildServer({ mapStorePath });
    app = reloaded.app;
    await app.ready();

    const reloadResponse = await app.inject({
      method: "GET",
      url: "/api/admin/maps/alpha-run"
    });

    expect(reloadResponse.statusCode).toBe(200);
    expect(reloadResponse.json().map.origin).toBe("default");
    expect(reloadResponse.json().map.name).toBe("Alpha Run");

    const customReloadResponse = await app.inject({
      method: "GET",
      url: "/api/admin/maps/gamma-lock"
    });

    expect(customReloadResponse.statusCode).toBe(404);
  });
});
