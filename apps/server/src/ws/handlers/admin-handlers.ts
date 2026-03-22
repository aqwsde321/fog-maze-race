import type { Server, Socket } from "socket.io";
import type {
  ForceEndRoomPayload,
  LeaveRoomPayload,
  RenameRoomPayload
} from "@fog-maze-race/shared/contracts/realtime";

import { PlayerSession } from "../../core/player-session.js";
import { MatchService } from "../../matches/match-service.js";
import { RoomService } from "../../rooms/room-service.js";
import { emitError, emitRoomListAsync, requireSession } from "./handler-support.js";
import { createRoomEventSink } from "./recovery-handlers.js";

type AdminHandlerDeps = {
  io: Server;
  socket: Socket;
  sessions: Map<string, PlayerSession>;
  roomService: RoomService;
  matchService: MatchService;
};

export function registerAdminHandlers({
  io,
  socket,
  sessions,
  roomService,
  matchService
}: AdminHandlerDeps) {
  socket.on("LEAVE_ROOM", (payload: LeaveRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      const sink = createRoomEventSink(io, roomService, payload.roomId);
      const removal = roomService.removePlayer(payload.roomId, session.playerId);

      session.leave();
      socket.leave(payload.roomId);
      socket.emit("ROOM_LEFT", {
        roomId: payload.roomId,
        playerId: session.playerId,
        reason: "manual"
      });

      matchService.handlePlayerLeft(payload.roomId, removal.removedMember, sink);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("RENAME_ROOM", (payload: RenameRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      const snapshot = roomService.renameRoom(payload.roomId, session.playerId, payload.name);

      io.to(payload.roomId).emit("ROOM_STATE_UPDATE", {
        roomId: payload.roomId,
        snapshot
      });
      emitRoomListAsync(io, roomService);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("FORCE_END_ROOM", (payload: ForceEndRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      matchService.forceEnd(payload.roomId, session.playerId, createRoomEventSink(io, roomService, payload.roomId));
    } catch (error) {
      emitError(socket, error);
    }
  });
}
