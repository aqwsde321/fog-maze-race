import type { Server, Socket } from "socket.io";
import type { ErrorPayload, RoomStateUpdatePayload } from "@fog-maze-race/shared/contracts/realtime";

import type { ServerLoadMonitor } from "../../app/server-load-monitor.js";
import { PlayerSession } from "../../core/player-session.js";
import { RoomService } from "../../rooms/room-service.js";

export function requireSession(socket: Socket, sessions: Map<string, PlayerSession>) {
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

export function emitRoomListAsync(
  target: Server | Socket,
  roomService: RoomService,
  loadMonitor?: ServerLoadMonitor
) {
  [0, 40].forEach((delayMs) => {
    setTimeout(() => {
      if (isServerTarget(target)) {
        loadMonitor?.recordBroadcast(target.of("/").sockets.size);
      }
      target.emit("ROOM_LIST_UPDATE", {
        rooms: roomService.listRooms()
      });
    }, delayMs);
  });
}

export function emitRoomState(
  io: Server,
  roomId: string,
  payload: RoomStateUpdatePayload,
  loadMonitor?: ServerLoadMonitor
) {
  loadMonitor?.recordRoomStateUpdate(getRoomRecipientCount(io, roomId));
  io.to(roomId).emit("ROOM_STATE_UPDATE", payload);
}

export function emitRoomEvent(
  io: Server,
  roomId: string,
  eventName: string,
  payload: unknown,
  loadMonitor?: ServerLoadMonitor
) {
  loadMonitor?.recordBroadcast(getRoomRecipientCount(io, roomId));
  io.to(roomId).emit(eventName, payload);
}

export function emitError(socket: Socket, error: unknown) {
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
    case "INVALID_CHAT_MESSAGE":
    case "ROOM_FULL":
    case "ROOM_NOT_JOINABLE":
    case "HOST_ONLY":
    case "BOT_LIMIT_REACHED":
    case "BOT_OWNER_ONLY":
    case "INVALID_MOVE":
    case "RECOVERY_FAILED":
    case "NOT_IN_ROOM":
      return code;
    default:
      return "UNKNOWN";
  }
}

function getRoomRecipientCount(io: Server, roomId: string) {
  return io.of("/").adapter.rooms.get(roomId)?.size ?? 0;
}

function isServerTarget(target: Server | Socket): target is Server {
  return typeof (target as Server).of === "function";
}

function toMessage(code: string) {
  switch (code) {
    case "INVALID_NICKNAME":
      return "닉네임은 1자 이상 5자 이하로 입력해야 합니다.";
    case "INVALID_CHAT_MESSAGE":
      return "채팅은 1자 이상 80자 이하로 입력해야 합니다.";
    case "ROOM_FULL":
      return "방 인원이 가득 찼습니다.";
    case "ROOM_NOT_JOINABLE":
      return "현재 입장할 수 없는 방입니다.";
    case "HOST_ONLY":
      return "방장만 해당 작업을 수행할 수 있습니다.";
    case "BOT_LIMIT_REACHED":
      return "봇 전용 방에서는 관전자당 봇을 1개만 만들 수 있습니다.";
    case "BOT_OWNER_ONLY":
      return "자신이 만든 봇만 제거할 수 있습니다.";
    case "NOT_IN_ROOM":
      return "방에 입장한 플레이어만 이동할 수 있습니다.";
    case "RECOVERY_FAILED":
      return "재접속 복구에 실패했습니다.";
    default:
      return "알 수 없는 오류가 발생했습니다.";
  }
}
