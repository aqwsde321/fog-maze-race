import Fastify from "fastify";
import { pathToFileURL } from "node:url";
import { Server as SocketIOServer } from "socket.io";

import { buildRaceGateway } from "../ws/race-gateway.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const io = new SocketIOServer(app.server, {
    connectionStateRecovery: {
      maxDisconnectionDuration: 30_000,
      skipMiddlewares: true
    }
  });

  buildRaceGateway(io);

  app.get("/health", async () => ({
    ok: true,
    service: "fog-maze-race",
    version: process.env.APP_VERSION ?? "dev",
    uptimeSeconds: Math.floor(process.uptime())
  }));

  app.addHook("onClose", async () => {
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
