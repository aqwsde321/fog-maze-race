import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type {
  ConnectPayload,
  CreateRoomPayload,
  ErrorPayload,
  JoinRoomPayload
} from "@fog-maze-race/shared/contracts/realtime";

import { PlayerSession } from "../../core/player-session.js";
import { RecoveryService } from "../../rooms/recovery-service.js";
import { RoomService } from "../../rooms/room-service.js";
import { DisconnectGraceRegistry } from "../disconnect-grace.js";
import { emitError, emitRoomListAsync, requireSession } from "./handler-support.js";
import { recoverPlayerConnection } from "./recovery-handlers.js";

type SessionHandlerDeps = {
  io: Server;
  socket: Socket;
  sessions: Map<string, PlayerSession>;
  roomService: RoomService;
  disconnectGrace: DisconnectGraceRegistry;
  recoveryService: RecoveryService;
};

export function registerSessionHandlers({
  io,
  socket,
  sessions,
  roomService,
  disconnectGrace,
  recoveryService
}: SessionHandlerDeps) {
  socket.on("CONNECT", (payload: ConnectPayload) => {
    try {
      const session = resolveSession(payload, sessions, disconnectGrace);
      socket.data.playerId = session.playerId;

      const recovery = recoverPlayerConnection({
        session,
        recoveryService
      });
      socket.emit("CONNECTED", recovery.connected);

      if (recovery.recoveredRoom) {
        socket.join(recovery.recoveredRoom.roomId);
        socket.emit("ROOM_JOINED", {
          roomId: recovery.recoveredRoom.roomId,
          snapshot: recovery.recoveredRoom.snapshot,
          selfPlayerId: session.playerId
        });
        io.to(recovery.recoveredRoom.roomId).emit("ROOM_STATE_UPDATE", {
          roomId: recovery.recoveredRoom.roomId,
          snapshot: recovery.recoveredRoom.snapshot
        });
      }

      emitRoomListAsync(socket, roomService);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("CREATE_ROOM", (payload: CreateRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      const joined = roomService.createRoom({
        session,
        name: payload.name
      });

      socket.join(joined.roomId);
      socket.emit("ROOM_JOINED", joined);
      emitRoomListAsync(io, roomService);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("JOIN_ROOM", (payload: JoinRoomPayload) => {
    try {
      const session = requireSession(socket, sessions);
      const joined = roomService.joinRoom({
        roomId: payload.roomId,
        session
      });

      socket.join(joined.roomId);
      socket.emit("ROOM_JOINED", joined);
      io.to(joined.roomId).emit("ROOM_STATE_UPDATE", {
        roomId: joined.roomId,
        snapshot: joined.snapshot
      });
      emitRoomListAsync(io, roomService);
    } catch (error) {
      emitError(socket, error);
    }
  });
}

function resolveSession(
  payload: ConnectPayload,
  sessions: Map<string, PlayerSession>,
  disconnectGrace: DisconnectGraceRegistry
) {
  const nickname = payload.nickname.trim().slice(0, 5);
  if (!nickname) {
    throw new Error("INVALID_NICKNAME");
  }

  const playerId = payload.playerId ?? randomUUID();
  const existingSession = sessions.get(playerId);
  const session = existingSession ?? new PlayerSession({ playerId, nickname });

  session.nickname = nickname;
  session.reconnect();
  sessions.set(playerId, session);

  return session;
}
