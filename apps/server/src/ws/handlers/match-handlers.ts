import type { Server, Socket } from "socket.io";
import type {
  MovePayload,
  StartGamePayload
} from "../../../../../packages/shared/src/contracts/realtime.js";

import { PlayerSession } from "../../core/player-session.js";
import { MatchService } from "../../matches/match-service.js";
import { RoomService } from "../../rooms/room-service.js";

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
    const session = requireSession(socket, sessions);

    matchService.startGame(payload.roomId, session.playerId, {
      emitGameStarting: (gameStarting) => io.to(payload.roomId).emit("GAME_STARTING", gameStarting),
      emitCountdown: (countdown) => io.to(payload.roomId).emit("COUNTDOWN", countdown),
      emitPlayerMoved: (playerMoved) => io.to(payload.roomId).emit("PLAYER_MOVED", playerMoved),
      emitPlayerFinished: (playerFinished) =>
        io.to(payload.roomId).emit("PLAYER_FINISHED", playerFinished),
      emitGameEnded: (gameEnded) => io.to(payload.roomId).emit("GAME_ENDED", gameEnded),
      emitRoomState: (roomState) => io.to(payload.roomId).emit("ROOM_STATE_UPDATE", roomState),
      emitRoomListUpdate: () =>
        io.emit("ROOM_LIST_UPDATE", {
          rooms: roomService.listRooms()
        })
    });
  });

  socket.on("MOVE", (payload: MovePayload) => {
    const session = requireSession(socket, sessions);

    matchService.move(
      payload.roomId,
      session.playerId,
      {
        direction: payload.direction,
        inputSeq: payload.inputSeq
      },
      {
        emitGameStarting: () => undefined,
        emitCountdown: () => undefined,
        emitPlayerMoved: (playerMoved) => io.to(payload.roomId).emit("PLAYER_MOVED", playerMoved),
        emitPlayerFinished: (playerFinished) =>
          io.to(payload.roomId).emit("PLAYER_FINISHED", playerFinished),
        emitGameEnded: (gameEnded) => io.to(payload.roomId).emit("GAME_ENDED", gameEnded),
        emitRoomState: (roomState) => io.to(payload.roomId).emit("ROOM_STATE_UPDATE", roomState),
        emitRoomListUpdate: () =>
          io.emit("ROOM_LIST_UPDATE", {
            rooms: roomService.listRooms()
          })
      }
    );
  });
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
