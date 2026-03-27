import type { Server, Socket } from "socket.io";
import type { SendChatMessagePayload } from "@fog-maze-race/shared/contracts/realtime";

import { PlayerSession } from "../../core/player-session.js";
import { RoomService } from "../../rooms/room-service.js";
import { emitError, requireSession } from "./handler-support.js";

type ChatHandlerDeps = {
  io: Server;
  socket: Socket;
  sessions: Map<string, PlayerSession>;
  roomService: RoomService;
};

export function registerChatHandlers({
  io,
  socket,
  sessions,
  roomService
}: ChatHandlerDeps) {
  socket.on("SEND_CHAT_MESSAGE", (payload: SendChatMessagePayload) => {
    try {
      const session = requireSession(socket, sessions);
      const snapshot = roomService.sendChatMessage(payload.roomId, session.playerId, payload.content);

      io.to(payload.roomId).emit("ROOM_STATE_UPDATE", {
        roomId: payload.roomId,
        snapshot
      });
    } catch (error) {
      emitError(socket, error);
    }
  });
}
