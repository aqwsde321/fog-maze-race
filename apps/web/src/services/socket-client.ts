import type {
  AddRoomBotsPayload,
  ConnectPayload,
  ConnectedPayload,
  CountdownPayload,
  CreateRoomPayload,
  ErrorPayload,
  ForceEndRoomPayload,
  GameStartingPayload,
  LeaveRoomPayload,
  PingCheckAckPayload,
  PingCheckPayload,
  SetBotSpeedPayload,
  PlayerFinishedPayload,
  GameEndedPayload,
  JoinRoomPayload,
  MovePayload,
  RemoveRoomBotsPayload,
  PlayerMovedPayload,
  ResetRoomPayload,
  RenameRoomPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomListUpdatePayload,
  RoomStateUpdatePayload,
  SendChatMessagePayload,
  SetRoomGameModePayload,
  SetVisibilitySizePayload,
  StartGamePayload,
  UseItemPayload
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
  ADD_ROOM_BOTS: (payload: AddRoomBotsPayload) => void;
  REMOVE_ROOM_BOTS: (payload: RemoveRoomBotsPayload) => void;
  LEAVE_ROOM: (payload: LeaveRoomPayload) => void;
  RENAME_ROOM: (payload: RenameRoomPayload) => void;
  SET_VISIBILITY_SIZE: (payload: SetVisibilitySizePayload) => void;
  SET_ROOM_GAME_MODE: (payload: SetRoomGameModePayload) => void;
  SET_BOT_SPEED: (payload: SetBotSpeedPayload) => void;
  START_GAME: (payload: StartGamePayload) => void;
  FORCE_END_ROOM: (payload: ForceEndRoomPayload) => void;
  RESET_ROOM: (payload: ResetRoomPayload) => void;
  MOVE: (payload: MovePayload) => void;
  USE_ITEM: (payload: UseItemPayload) => void;
  SEND_CHAT_MESSAGE: (payload: SendChatMessagePayload) => void;
  PING_CHECK: (payload: PingCheckPayload, acknowledge: (payload: PingCheckAckPayload) => void) => void;
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
