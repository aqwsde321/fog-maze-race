import type { Server, Socket } from "socket.io";
import type {
  ForceEndRoomPayload,
  LeaveRoomPayload,
  ResetRoomPayload,
  RenameRoomPayload,
  SetVisibilitySizePayload
} from "@fog-maze-race/shared/contracts/realtime";

import type { ServerLoadMonitor } from "../../app/server-load-monitor.js";
import { PlayerSession } from "../../core/player-session.js";
import { MatchService } from "../../matches/match-service.js";
import { RoomService } from "../../rooms/room-service.js";
import { emitError, emitRoomListAsync, emitRoomState, requireSession } from "./handler-support.js";
import { createRoomEventSink } from "./recovery-handlers.js";

type AdminHandlerDeps = {
  io: Server;
  socket: Socket;
  sessions: Map<string, PlayerSession>;
  roomService: RoomService;
  matchService: MatchService;
  loadMonitor?: ServerLoadMonitor;
};

export function registerAdminHandlers({
  io,
  socket,
  sessions,
  roomService,
  matchService,
  loadMonitor
}: AdminHandlerDeps) {
  socket.on("LEAVE_ROOM", (payload: LeaveRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      const sink = createRoomEventSink(io, roomService, payload.roomId, loadMonitor);
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

      emitRoomState(io, payload.roomId, {
        roomId: payload.roomId,
        snapshot
      }, loadMonitor);
      emitRoomListAsync(io, roomService, loadMonitor);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("SET_VISIBILITY_SIZE", (payload: SetVisibilitySizePayload) => {
    try {
      const session = requireSession(socket, sessions);
      const snapshot = roomService.setVisibilitySize(payload.roomId, session.playerId, payload.visibilitySize);

      emitRoomState(io, payload.roomId, {
        roomId: payload.roomId,
        snapshot
      }, loadMonitor);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("FORCE_END_ROOM", (payload: ForceEndRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      matchService.forceEnd(
        payload.roomId,
        session.playerId,
        createRoomEventSink(io, roomService, payload.roomId, loadMonitor)
      );
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("RESET_ROOM", (payload: ResetRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      matchService.resetRoomToWaiting(
        payload.roomId,
        session.playerId,
        createRoomEventSink(io, roomService, payload.roomId, loadMonitor)
      );
    } catch (error) {
      emitError(socket, error);
    }
  });
}
