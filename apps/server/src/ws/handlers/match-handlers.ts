import type { Server, Socket } from "socket.io";
import type {
  MovePayload,
  StartGamePayload
} from "@fog-maze-race/shared/contracts/realtime";

import { PlayerSession } from "../../core/player-session.js";
import { MatchService } from "../../matches/match-service.js";
import { RoomService } from "../../rooms/room-service.js";
import { emitError, requireSession } from "./handler-support.js";
import { createRoomEventSink } from "./recovery-handlers.js";

type MatchHandlerDeps = {
  io: Server;
  socket: Socket;
  sessions: Map<string, PlayerSession>;
  roomService: RoomService;
  matchService: MatchService;
};

export function registerMatchHandlers({
  io,
  socket,
  sessions,
  roomService,
  matchService
}: MatchHandlerDeps) {
  socket.on("START_GAME", (payload: StartGamePayload) => {
    try {
      const session = requireSession(socket, sessions);
      matchService.startGame(
        payload.roomId,
        session.playerId,
        createRoomEventSink(io, roomService, payload.roomId)
      );
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("MOVE", (payload: MovePayload) => {
    try {
      const session = requireSession(socket, sessions);

      matchService.move(
        payload.roomId,
        session.playerId,
        {
          direction: payload.direction,
          inputSeq: payload.inputSeq
        },
        createRoomEventSink(io, roomService, payload.roomId)
      );
    } catch (error) {
      emitError(socket, error);
    }
  });
}
