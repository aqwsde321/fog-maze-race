import type { Server } from "socket.io";

import { PlayerSession } from "../core/player-session.js";
import { MatchService, type MatchServiceOptions } from "../matches/match-service.js";
import { RoomService } from "../rooms/room-service.js";
import { DisconnectGraceRegistry } from "./disconnect-grace.js";
import { RevisionSync } from "./revision-sync.js";
import { registerMatchHandlers } from "./handlers/match-handlers.js";
import { registerSessionHandlers } from "./handlers/session-handlers.js";

export function buildRaceGateway(io: Server, options: MatchServiceOptions) {
  const revisionSync = new RevisionSync();
  const disconnectGrace = new DisconnectGraceRegistry();
  const sessions = new Map<string, PlayerSession>();
  const roomService = new RoomService(revisionSync);
  const matchService = new MatchService(roomService, options);

  io.on("connection", (socket) => {
    registerSessionHandlers({
      io,
      socket,
      sessions,
      roomService,
      disconnectGrace
    });
    registerMatchHandlers({
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

      session.disconnect();
      disconnectGrace.markDisconnected(playerId, session.currentRoomId);
    });
  });

  return {
    revisionSync,
    disconnectGrace,
    sessions,
    roomService,
    matchService,
    dispose() {
      matchService.dispose();
      roomService.dispose();
    }
  };
}
