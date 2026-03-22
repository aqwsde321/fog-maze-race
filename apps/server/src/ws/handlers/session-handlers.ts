import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type {
  ConnectPayload,
  CreateRoomPayload,
  ErrorPayload,
  JoinRoomPayload
} from "../../../../../packages/shared/src/contracts/realtime.js";

import { PlayerSession } from "../../core/player-session.js";
import { RecoveryService } from "../../rooms/recovery-service.js";
import { RoomService } from "../../rooms/room-service.js";
import { DisconnectGraceRegistry } from "../disconnect-grace.js";
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

function requireSession(socket: Socket, sessions: Map<string, PlayerSession>) {
  const playerId = socket.data.playerId as string | undefined;
  if (!playerId) {
    throw new Error("UNKNOWN");
  }

  const session = sessions.get(playerId);
  if (!session) {
    throw new Error("UNKNOWN");
  }

  return session;
}

function emitRoomListAsync(target: Server | Socket, roomService: RoomService) {
  [0, 40].forEach((delayMs) => {
    setTimeout(() => {
      target.emit("ROOM_LIST_UPDATE", {
        rooms: roomService.listRooms()
      });
    }, delayMs);
  });
}

function emitError(socket: Socket, error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const payload: ErrorPayload = {
    code: toErrorCode(code),
    message: toMessage(code)
  };

  socket.emit("ERROR", payload);
}

function toErrorCode(code: string): ErrorPayload["code"] {
  switch (code) {
    case "INVALID_NICKNAME":
    case "ROOM_FULL":
    case "ROOM_NOT_JOINABLE":
    case "HOST_ONLY":
    case "INVALID_MOVE":
    case "NOT_IN_ROOM":
      return code;
    default:
      return "UNKNOWN";
  }
}

function toMessage(code: string) {
  switch (code) {
    case "INVALID_NICKNAME":
      return "닉네임은 1자 이상 5자 이하로 입력해야 합니다.";
    case "ROOM_FULL":
      return "방 인원이 가득 찼습니다.";
    case "ROOM_NOT_JOINABLE":
      return "현재 입장할 수 없는 방입니다.";
    case "HOST_ONLY":
      return "방장만 시작할 수 있습니다.";
    case "NOT_IN_ROOM":
      return "방에 입장한 플레이어만 이동할 수 있습니다.";
    default:
      return "알 수 없는 오류가 발생했습니다.";
  }
}
