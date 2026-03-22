import type {
  ConnectedPayload,
  CountdownPayload,
  GameEndedPayload,
  PlayerMovedPayload,
  RoomJoinedPayload,
  RoomListUpdatePayload,
  RoomStateUpdatePayload
} from "../../../../packages/shared/src/contracts/realtime.js";
import { io, type Socket } from "socket.io-client";

export type RaceSocketEvents = {
  CONNECTED: (payload: ConnectedPayload) => void;
  ROOM_LIST_UPDATE: (payload: RoomListUpdatePayload) => void;
  ROOM_JOINED: (payload: RoomJoinedPayload) => void;
  ROOM_STATE_UPDATE: (payload: RoomStateUpdatePayload) => void;
  COUNTDOWN: (payload: CountdownPayload) => void;
  PLAYER_MOVED: (payload: PlayerMovedPayload) => void;
  GAME_ENDED: (payload: GameEndedPayload) => void;
};

let socket: Socket<RaceSocketEvents> | null = null;

export function getSocketClient() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ["websocket"]
    });
  }

  return socket;
}
