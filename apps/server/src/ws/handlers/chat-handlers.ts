import type { Server, Socket } from "socket.io";
import type { SendChatMessagePayload } from "@fog-maze-race/shared/contracts/realtime";

import type { ServerLoadMonitor } from "../../app/server-load-monitor.js";
import { PlayerSession } from "../../core/player-session.js";
import { RoomService } from "../../rooms/room-service.js";
import { emitError, emitRoomState, requireSession } from "./handler-support.js";

type ChatHandlerDeps = {
  io: Server;
  socket: Socket;
  sessions: Map<string, PlayerSession>;
  roomService: RoomService;
  loadMonitor?: ServerLoadMonitor;
};

export function registerChatHandlers({
  io,
  socket,
  sessions,
  roomService,
  loadMonitor
}: ChatHandlerDeps) {
  socket.on("SEND_CHAT_MESSAGE", (payload: SendChatMessagePayload) => {
    try {
      const session = requireSession(socket, sessions);
      const snapshot = roomService.sendChatMessage(payload.roomId, session.playerId, payload.content);
      loadMonitor?.recordChatMessage();

      emitRoomState(io, payload.roomId, {
        roomId: payload.roomId,
        snapshot
      }, loadMonitor);
    } catch (error) {
      emitError(socket, error);
    }
  });
}
