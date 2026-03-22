import type { Server, Socket } from "socket.io";
import type { ConnectedPayload } from "@fog-maze-race/shared/contracts/realtime";

import type { MatchEventSink } from "../../matches/match-service.js";
import { RoomService } from "../../rooms/room-service.js";
import { RecoveryService } from "../../rooms/recovery-service.js";
import { PlayerSession } from "../../core/player-session.js";

type RecoveryConnectInput = {
  session: PlayerSession;
  recoveryService: RecoveryService;
};

type RecoveryDisconnectInput = {
  playerId: string;
  recoveryService: RecoveryService;
  sink: MatchEventSink;
};

export function recoverPlayerConnection({
  session,
  recoveryService
}: RecoveryConnectInput): {
  connected: ConnectedPayload;
  recoveredRoom: { roomId: string; snapshot: ReturnType<RoomService["getSnapshot"]> } | null;
} {
  const recovered = recoveryService.recover(session.playerId);

  return {
    connected: {
      playerId: session.playerId,
      nickname: session.nickname,
      recovered: Boolean(recovered),
      currentRoomId: recovered?.roomId ?? session.currentRoomId
    },
    recoveredRoom: recovered
  };
}

export function handlePlayerDisconnect({ playerId, recoveryService, sink }: RecoveryDisconnectInput) {
  recoveryService.disconnect(playerId, sink);
}

export function createRoomEventSink(io: Server, roomService: RoomService, roomId: string): MatchEventSink {
  return {
    emitGameStarting: (payload) => io.to(roomId).emit("GAME_STARTING", payload),
    emitCountdown: (payload) => io.to(roomId).emit("COUNTDOWN", payload),
    emitPlayerMoved: (payload) => io.to(roomId).emit("PLAYER_MOVED", payload),
    emitPlayerFinished: (payload) => io.to(roomId).emit("PLAYER_FINISHED", payload),
    emitGameEnded: (payload) => io.to(roomId).emit("GAME_ENDED", payload),
    emitRoomState: (payload) => io.to(roomId).emit("ROOM_STATE_UPDATE", payload),
    emitRoomListUpdate: () =>
      io.emit("ROOM_LIST_UPDATE", {
        rooms: roomService.listRooms()
      })
  };
}
