import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { Server as SocketIOServer } from "socket.io";

import type { ServerHealthSnapshot } from "@fog-maze-race/shared/contracts/server-health";

import { ServerLoadMonitor } from "./server-load-monitor.js";
import { registerAdminMapRoutes } from "../http/admin-map-routes.js";
import { buildRaceGateway } from "../ws/race-gateway.js";

export type BuildServerOptions = {
  countdownStepMs?: number;
  resultsDurationMs?: number;
  forcedMapId?: string | null;
  recoveryGraceMs?: number;
  mapStorePath?: string | null;
  webDistPath?: string | null;
};

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: true });
  const recoveryGraceMs = options.recoveryGraceMs ?? Number(process.env.RECOVERY_GRACE_MS ?? 30_000);
  const io = new SocketIOServer(app.server, {
    connectionStateRecovery: {
      maxDisconnectionDuration: recoveryGraceMs,
      skipMiddlewares: true
    }
  });
  const loadMonitor = new ServerLoadMonitor();

  const gateway = await buildRaceGateway(io, {
    countdownStepMs: options.countdownStepMs ?? Number(process.env.COUNTDOWN_STEP_MS ?? 1_000),
    resultsDurationMs: options.resultsDurationMs ?? Number(process.env.RESULTS_DURATION_MS ?? 6_000),
    forcedMapId: options.forcedMapId ?? process.env.FORCED_MAP_ID ?? null,
    recoveryGraceMs,
    loadMonitor,
    mapStorePath:
      options.mapStorePath ??
      process.env.MAP_STORE_PATH ??
      resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/maps.json")
  });

  loadMonitor.start(() => {
    const roomStats = gateway.roomService.getLoadStats();
    return {
      ...roomStats,
      connectedSockets: io.of("/").sockets.size
    };
  });

  const handleHealthRequest = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ServerHealthSnapshot> => {
    reply.header("Cache-Control", "no-store, max-age=0");

    return {
      ok: true,
      service: "fog-maze-race",
      version: process.env.APP_VERSION ?? "dev",
      ...loadMonitor.getSnapshot()
    };
  };

  app.get("/health", handleHealthRequest);
  app.get("/api/health", handleHealthRequest);

  await registerAdminMapRoutes(app, gateway.mapRegistry);

  const defaultWebDistRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../web/dist");
  const configuredWebDistPath =
    "webDistPath" in options ? options.webDistPath : process.env.WEB_DIST_PATH ?? defaultWebDistRoot;
  const webDistRoot = configuredWebDistPath ? resolve(configuredWebDistPath) : null;
  const webDistReady = webDistRoot ? await pathExists(webDistRoot) : false;
  if (webDistRoot && webDistReady) {
    await app.register(fastifyStatic, {
      root: webDistRoot,
      prefix: "/"
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/") || request.url === "/health") {
        return reply.code(404).send({ message: "Route not found" });
      }

      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    loadMonitor.stop();
    gateway.dispose();
    await io.close();
  });

  return { app, io };
}

async function start() {
  const { app } = await buildServer();

  await app.listen({
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 3000)
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
