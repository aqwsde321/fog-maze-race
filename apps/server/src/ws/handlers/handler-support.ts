import type { Server, Socket } from "socket.io";
import type { ErrorPayload } from "@fog-maze-race/shared/contracts/realtime";

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

export function emitRoomListAsync(target: Server | Socket, roomService: RoomService) {
  [0, 40].forEach((delayMs) => {
    setTimeout(() => {
      target.emit("ROOM_LIST_UPDATE", {
        rooms: roomService.listRooms()
      });
    }, delayMs);
  });
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
    case "INVALID_MOVE":
    case "RECOVERY_FAILED":
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
    case "INVALID_CHAT_MESSAGE":
      return "채팅은 1자 이상 80자 이하로 입력해야 합니다.";
    case "ROOM_FULL":
      return "방 인원이 가득 찼습니다.";
    case "ROOM_NOT_JOINABLE":
      return "현재 입장할 수 없는 방입니다.";
    case "HOST_ONLY":
      return "방장만 해당 작업을 수행할 수 있습니다.";
    case "NOT_IN_ROOM":
      return "방에 입장한 플레이어만 이동할 수 있습니다.";
    case "RECOVERY_FAILED":
      return "재접속 복구에 실패했습니다.";
    default:
      return "알 수 없는 오류가 발생했습니다.";
  }
}
