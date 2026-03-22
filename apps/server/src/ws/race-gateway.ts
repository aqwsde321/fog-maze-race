import type { Server } from "socket.io";
import { getMapById, getRandomMap } from "@fog-maze-race/shared/maps/map-definitions";

import { PlayerSession } from "../core/player-session.js";
import { MatchService, type MatchServiceOptions } from "../matches/match-service.js";
import { RecoveryService } from "../rooms/recovery-service.js";
import { RoomService } from "../rooms/room-service.js";
import { DisconnectGraceRegistry } from "./disconnect-grace.js";
import { RevisionSync } from "./revision-sync.js";
import { createRoomEventSink, handlePlayerDisconnect } from "./handlers/recovery-handlers.js";
import { registerAdminHandlers } from "./handlers/admin-handlers.js";
import { registerMatchHandlers } from "./handlers/match-handlers.js";
import { registerSessionHandlers } from "./handlers/session-handlers.js";

export function buildRaceGateway(io: Server, options: MatchServiceOptions) {
  const revisionSync = new RevisionSync();
  const disconnectGrace = new DisconnectGraceRegistry();
  const sessions = new Map<string, PlayerSession>();
  const roomService = new RoomService(revisionSync, {
    resultsDurationMs: options.resultsDurationMs,
    pickPreviewMap: () =>
      options.forcedMapId ? (getMapById(options.forcedMapId) ?? getRandomMap()) : getRandomMap()
  });
  const matchService = new MatchService(roomService, options);
  const recoveryService = new RecoveryService(roomService, matchService, disconnectGrace, sessions, {
    graceWindowMs: options.recoveryGraceMs ?? 30_000
  });

  io.on("connection", (socket) => {
    registerSessionHandlers({
      io,
      socket,
      sessions,
      roomService,
      disconnectGrace,
      recoveryService
    });
    registerMatchHandlers({
      io,
      socket,
      sessions,
      roomService,
      matchService
    });
    registerAdminHandlers({
      io,
      socket,
      sessions,
      roomService,
      matchService
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
        sink: createRoomEventSink(io, roomService, session.currentRoomId)
      });
    });
  });

  return {
    revisionSync,
    disconnectGrace,
    sessions,
    roomService,
    matchService,
    recoveryService,
    dispose() {
      recoveryService.dispose();
      matchService.dispose();
      roomService.dispose();
    }
  };
}
