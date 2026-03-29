import type { Server } from "socket.io";

import type { ServerLoadMonitor } from "../app/server-load-monitor.js";
import { BotManager } from "../bots/bot-manager.js";
import { PlayerSession } from "../core/player-session.js";
import { MapRegistry } from "../maps/map-registry.js";
import { MatchService, type MatchServiceOptions } from "../matches/match-service.js";
import { RecoveryService } from "../rooms/recovery-service.js";
import { RoomService } from "../rooms/room-service.js";
import { DisconnectGraceRegistry } from "./disconnect-grace.js";
import { RevisionSync } from "./revision-sync.js";
import { createRoomEventSink, handlePlayerDisconnect } from "./handlers/recovery-handlers.js";
import { registerAdminHandlers } from "./handlers/admin-handlers.js";
import { registerChatHandlers } from "./handlers/chat-handlers.js";
import { registerMatchHandlers } from "./handlers/match-handlers.js";
import { registerSessionHandlers } from "./handlers/session-handlers.js";

export async function buildRaceGateway(
  io: Server,
  options: MatchServiceOptions & { loadMonitor?: ServerLoadMonitor; mapStorePath?: string | null }
) {
  const revisionSync = new RevisionSync();
  const disconnectGrace = new DisconnectGraceRegistry();
  const sessions = new Map<string, PlayerSession>();
  const mapRegistry = new MapRegistry({ storePath: options.mapStorePath });
  await mapRegistry.load();
  const roomService = new RoomService(revisionSync, mapRegistry, {
    resultsDurationMs: options.resultsDurationMs,
    forcedPreviewMapId: options.forcedMapId && mapRegistry.get(options.forcedMapId) ? options.forcedMapId : null
  });
  const matchService = new MatchService(roomService, options);
  const botManager = new BotManager(io, roomService, matchService, sessions, options.loadMonitor);
  const recoveryService = new RecoveryService(roomService, matchService, disconnectGrace, sessions, {
    graceWindowMs: options.recoveryGraceMs ?? 30_000,
    cleanupBotsIfNoHumansRemain: (roomId) => {
      botManager.removeBotsIfNoHumansRemain(roomId);
    }
  });

  io.on("connection", (socket) => {
    registerSessionHandlers({
      io,
      socket,
      sessions,
      roomService,
      disconnectGrace,
      recoveryService,
      loadMonitor: options.loadMonitor
    });
    registerMatchHandlers({
      io,
      socket,
      sessions,
      roomService,
      matchService,
      loadMonitor: options.loadMonitor
    });
    registerAdminHandlers({
      io,
      socket,
      sessions,
      roomService,
      matchService,
      botManager,
      loadMonitor: options.loadMonitor
    });
    registerChatHandlers({
      io,
      socket,
      sessions,
      roomService,
      loadMonitor: options.loadMonitor
    });

    socket.on("disconnect", () => {
      const playerId = socket.data.playerId as string | undefined;
      if (!playerId) {
        return;
      }

      const session = sessions.get(playerId);
      if (!session || !session.currentRoomId) {
        return;
      }
      handlePlayerDisconnect({
        playerId,
        recoveryService,
        sink: createRoomEventSink(io, roomService, session.currentRoomId, options.loadMonitor)
      });
    });
  });

  return {
    revisionSync,
    disconnectGrace,
    sessions,
    mapRegistry,
    roomService,
    matchService,
    recoveryService,
    dispose() {
      recoveryService.dispose();
      botManager.dispose();
      matchService.dispose();
      roomService.dispose();
    }
  };
}
