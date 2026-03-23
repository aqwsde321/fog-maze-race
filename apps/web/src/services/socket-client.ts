import type {
  ConnectPayload,
  ConnectedPayload,
  CountdownPayload,
  CreateRoomPayload,
  ErrorPayload,
  ForceEndRoomPayload,
  GameStartingPayload,
  LeaveRoomPayload,
  PlayerFinishedPayload,
  GameEndedPayload,
  JoinRoomPayload,
  MovePayload,
  PlayerMovedPayload,
  RenameRoomPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomListUpdatePayload,
  RoomStateUpdatePayload,
  SetVisibilitySizePayload,
  StartGamePayload
} from "@fog-maze-race/shared/contracts/realtime";
import { io, type Socket } from "socket.io-client";

export type RaceSocketEvents = {
  CONNECTED: (payload: ConnectedPayload) => void;
  ROOM_LIST_UPDATE: (payload: RoomListUpdatePayload) => void;
  ROOM_JOINED: (payload: RoomJoinedPayload) => void;
  ROOM_LEFT: (payload: RoomLeftPayload) => void;
  ROOM_STATE_UPDATE: (payload: RoomStateUpdatePayload) => void;
  GAME_STARTING: (payload: GameStartingPayload) => void;
  COUNTDOWN: (payload: CountdownPayload) => void;
  PLAYER_MOVED: (payload: PlayerMovedPayload) => void;
  PLAYER_FINISHED: (payload: PlayerFinishedPayload) => void;
  GAME_ENDED: (payload: GameEndedPayload) => void;
  ERROR: (payload: ErrorPayload) => void;
};

export type RaceSocketCommands = {
  CONNECT: (payload: ConnectPayload) => void;
  CREATE_ROOM: (payload: CreateRoomPayload) => void;
  JOIN_ROOM: (payload: JoinRoomPayload) => void;
  LEAVE_ROOM: (payload: LeaveRoomPayload) => void;
  RENAME_ROOM: (payload: RenameRoomPayload) => void;
  SET_VISIBILITY_SIZE: (payload: SetVisibilitySizePayload) => void;
  START_GAME: (payload: StartGamePayload) => void;
  FORCE_END_ROOM: (payload: ForceEndRoomPayload) => void;
  MOVE: (payload: MovePayload) => void;
};

let socket: Socket<RaceSocketEvents, RaceSocketCommands> | null = null;

export function getSocketClient() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ["websocket"]
    });
  }

  return socket;
}
