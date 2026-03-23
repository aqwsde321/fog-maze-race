import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "../../src/app/server.js";

describe("buildServer", () => {
  let tempDir: string;
  let webDistPath: string;
  let app: Awaited<ReturnType<typeof buildServer>>["app"];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fog-maze-race-web-"));
    webDistPath = join(tempDir, "web-dist");
    await mkdir(webDistPath, { recursive: true });
    await writeFile(join(webDistPath, "index.html"), "<!doctype html><html><body>fog-maze-race</body></html>", "utf8");
    await writeFile(join(webDistPath, "asset.txt"), "asset", "utf8");

    const server = await buildServer({
      mapStorePath: null,
      webDistPath
    });
    app = server.app;
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("serves a configured web dist directory with SPA fallback", async () => {
    const indexResponse = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(indexResponse.statusCode).toBe(200);
    expect(indexResponse.body).toContain("fog-maze-race");

    const assetResponse = await app.inject({
      method: "GET",
      url: "/asset.txt"
    });

    expect(assetResponse.statusCode).toBe(200);
    expect(assetResponse.body).toBe("asset");

    const clientRouteResponse = await app.inject({
      method: "GET",
      url: "/rooms/alpha"
    });

    expect(clientRouteResponse.statusCode).toBe(200);
    expect(clientRouteResponse.body).toContain("fog-maze-race");

    const apiNotFoundResponse = await app.inject({
      method: "GET",
      url: "/api/missing"
    });

    expect(apiNotFoundResponse.statusCode).toBe(404);
    expect(apiNotFoundResponse.json()).toEqual({ message: "Route not found" });
  });
});
