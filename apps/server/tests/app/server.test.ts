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
    delete process.env.RENDER_GIT_COMMIT;
    delete process.env.APP_COMMIT_SHA;
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

  it("returns runtime diagnostics from the api health endpoint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store, max-age=0");

    const payload = response.json() as {
      ok: boolean;
      service: string;
      version: string;
      deployment: {
        commitSha: string | null;
      };
      checkedAt: string;
      uptimeSeconds: number;
      runtime: {
        nodeVersion: string;
        platform: string;
        arch: string;
      };
      system: {
        cpuCores: number;
        totalMemoryBytes: number;
        freeMemoryBytes: number;
      };
      process: {
        rssBytes: number;
        heapUsedBytes: number;
        heapTotalBytes: number;
        externalBytes: number;
      };
      load: {
        cpuPercent: number;
        eventLoopLagMs: number;
        eventLoopLagMaxMs: number;
        activeRooms: number;
        activePlayers: number;
        activeMatches: number;
        connectedSockets: number;
        movesPerSecond: number;
        chatMessagesPerSecond: number;
        roomStateUpdatesPerSecond: number;
        broadcastsPerSecond: number;
        fanoutPerSecond: number;
      };
      recent: {
        avgCpuPercent10s: number;
        avgEventLoopLagMs10s: number;
        peakEventLoopLagMs10s: number;
        avgMovesPerSecond10s: number;
        avgChatMessagesPerSecond10s: number;
        avgRoomStateUpdatesPerSecond10s: number;
        avgBroadcastsPerSecond10s: number;
        avgFanoutPerSecond10s: number;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.service).toBe("fog-maze-race");
    expect(payload.version).toBeTypeOf("string");
    expect(payload.deployment.commitSha).toBeNull();
    expect(new Date(payload.checkedAt).toString()).not.toBe("Invalid Date");
    expect(payload.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(payload.runtime.nodeVersion).toMatch(/^v\d+/);
    expect(payload.runtime.platform).toBeTypeOf("string");
    expect(payload.runtime.arch).toBeTypeOf("string");
    expect(payload.system.cpuCores).toBeGreaterThan(0);
    expect(payload.system.totalMemoryBytes).toBeGreaterThan(0);
    expect(payload.system.freeMemoryBytes).toBeGreaterThan(0);
    expect(payload.process.rssBytes).toBeGreaterThan(0);
    expect(payload.process.heapUsedBytes).toBeGreaterThan(0);
    expect(payload.process.heapTotalBytes).toBeGreaterThan(payload.process.heapUsedBytes);
    expect(payload.process.externalBytes).toBeGreaterThanOrEqual(0);
    expect(payload.load.activeRooms).toBeGreaterThanOrEqual(0);
    expect(payload.load.activePlayers).toBeGreaterThanOrEqual(0);
    expect(payload.load.activeMatches).toBeGreaterThanOrEqual(0);
    expect(payload.load.connectedSockets).toBeGreaterThanOrEqual(0);
    expect(payload.load.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(payload.load.eventLoopLagMs).toBeGreaterThanOrEqual(0);
    expect(payload.load.eventLoopLagMaxMs).toBeGreaterThanOrEqual(0);
    expect(payload.recent.avgCpuPercent10s).toBeGreaterThanOrEqual(0);
    expect(payload.recent.peakEventLoopLagMs10s).toBeGreaterThanOrEqual(0);
  });

  it("returns the deployed commit sha when the runtime provides it", async () => {
    process.env.RENDER_GIT_COMMIT = "ee3f00fdadb548f6f2f21eab016372f3b0ea1ff0";

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      deployment: {
        commitSha: "ee3f00fdadb548f6f2f21eab016372f3b0ea1ff0"
      }
    });
  });
});
