import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { Server as SocketIOServer } from "socket.io";

import { registerAdminMapRoutes } from "../http/admin-map-routes.js";
import { buildRaceGateway } from "../ws/race-gateway.js";

export type BuildServerOptions = {
  countdownStepMs?: number;
  resultsDurationMs?: number;
  forcedMapId?: string | null;
  recoveryGraceMs?: number;
  mapStorePath?: string | null;
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

  const gateway = await buildRaceGateway(io, {
    countdownStepMs: options.countdownStepMs ?? Number(process.env.COUNTDOWN_STEP_MS ?? 1_000),
    resultsDurationMs: options.resultsDurationMs ?? Number(process.env.RESULTS_DURATION_MS ?? 6_000),
    forcedMapId: options.forcedMapId ?? process.env.FORCED_MAP_ID ?? null,
    recoveryGraceMs,
    mapStorePath:
      options.mapStorePath ??
      process.env.MAP_STORE_PATH ??
      resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/maps.json")
  });

  app.get("/health", async () => ({
    ok: true,
    service: "fog-maze-race",
    version: process.env.APP_VERSION ?? "dev",
    uptimeSeconds: Math.floor(process.uptime())
  }));

  await registerAdminMapRoutes(app, gateway.mapRegistry);

  const webDistRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../web/dist");
  const webDistReady = await pathExists(webDistRoot);
  if (webDistReady) {
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
