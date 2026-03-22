import Fastify from "fastify";
import { pathToFileURL } from "node:url";
import { Server as SocketIOServer } from "socket.io";

import { buildRaceGateway } from "../ws/race-gateway.js";

export type BuildServerOptions = {
  countdownStepMs?: number;
  resultsDurationMs?: number;
  forcedMapId?: string | null;
};

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: true });
  const io = new SocketIOServer(app.server, {
    connectionStateRecovery: {
      maxDisconnectionDuration: 30_000,
      skipMiddlewares: true
    }
  });

  const gateway = buildRaceGateway(io, {
    countdownStepMs: options.countdownStepMs ?? Number(process.env.COUNTDOWN_STEP_MS ?? 1_000),
    resultsDurationMs: options.resultsDurationMs ?? Number(process.env.RESULTS_DURATION_MS ?? 6_000),
    forcedMapId: options.forcedMapId ?? process.env.FORCED_MAP_ID ?? null
  });

  app.get("/health", async () => ({
    ok: true,
    service: "fog-maze-race",
    version: process.env.APP_VERSION ?? "dev",
    uptimeSeconds: Math.floor(process.uptime())
  }));

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
