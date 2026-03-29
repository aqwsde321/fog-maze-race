import type { Server, Socket } from "socket.io";
import type { ConnectedPayload } from "@fog-maze-race/shared/contracts/realtime";

import type { ServerLoadMonitor } from "../../app/server-load-monitor.js";
import type { MatchEventSink } from "../../matches/match-service.js";
import { RoomService } from "../../rooms/room-service.js";
import { RecoveryService } from "../../rooms/recovery-service.js";
import { PlayerSession } from "../../core/player-session.js";
import { emitRoomEvent, emitRoomListAsync, emitRoomState } from "./handler-support.js";

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

export function createRoomEventSink(
  io: Server,
  roomService: RoomService,
  roomId: string,
  loadMonitor?: ServerLoadMonitor
): MatchEventSink {
  return {
    emitGameStarting: (payload) => emitRoomEvent(io, roomId, "GAME_STARTING", payload, loadMonitor),
    emitCountdown: (payload) => emitRoomEvent(io, roomId, "COUNTDOWN", payload, loadMonitor),
    emitPlayerMoved: (payload) => emitRoomEvent(io, roomId, "PLAYER_MOVED", payload, loadMonitor),
    emitPlayerFinished: (payload) => emitRoomEvent(io, roomId, "PLAYER_FINISHED", payload, loadMonitor),
    emitGameEnded: (payload) => emitRoomEvent(io, roomId, "GAME_ENDED", payload, loadMonitor),
    emitRoomState: (payload) => emitRoomState(io, roomId, payload, loadMonitor),
    emitRoomListUpdate: () => emitRoomListAsync(io, roomService, loadMonitor)
  };
}
