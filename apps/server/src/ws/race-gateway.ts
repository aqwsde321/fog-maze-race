import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import type { ConnectedPayload } from "../../../../packages/shared/src/contracts/realtime.js";

import { PlayerSession } from "../core/player-session.js";
import { DisconnectGraceRegistry } from "./disconnect-grace.js";
import { RevisionSync } from "./revision-sync.js";

export function buildRaceGateway(io: Server) {
  const revisionSync = new RevisionSync();
  const disconnectGrace = new DisconnectGraceRegistry();
  const sessions = new Map<string, PlayerSession>();

  io.on("connection", (socket) => {
    socket.on("CONNECT", (payload: { playerId?: string; nickname: string }) => {
      const playerId = payload.playerId ?? randomUUID();
      const existingSession = sessions.get(playerId);

      const session = existingSession ?? new PlayerSession({ playerId, nickname: payload.nickname });
      session.nickname = payload.nickname;
      session.reconnect();
      sessions.set(playerId, session);

      const recovered = Boolean(disconnectGrace.recover(playerId));
      revisionSync.peek(session.currentRoomId ?? "lobby");

      const response: ConnectedPayload = {
        playerId,
        nickname: session.nickname,
        recovered,
        currentRoomId: session.currentRoomId
      };

      socket.data.playerId = playerId;
      socket.emit("CONNECTED", response);
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
    sessions
  };
}
