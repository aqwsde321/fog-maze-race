import type { Direction, GridPosition } from "../domain/grid-position.js";
import type { ResultEntry } from "../domain/result-entry.js";
import type { RoomMemberRole, RoomMode, RoomMemberState, RoomStatus } from "../domain/status.js";
import type { RoomSnapshot } from "./snapshots.js";

export type ConnectPayload = {
  playerId?: string;
  nickname: string;
  requestedRoomId?: string | null;
};

export type CreateRoomPayload = {
  name: string;
  mode?: RoomMode;
};

export type JoinRoomPayload = {
  roomId: string;
  role?: RoomMemberRole;
};

export const ROOM_BOT_KINDS = ["join", "explore"] as const;
export type RoomBotKind = (typeof ROOM_BOT_KINDS)[number];

export type AddRoomBotsPayload = {
  roomId: string;
  kind?: RoomBotKind;
  nicknames: string[];
};

export type RemoveRoomBotsPayload = {
  roomId: string;
  playerIds?: string[];
};

export type LeaveRoomPayload = {
  roomId: string;
};

export type RenameRoomPayload = {
  roomId: string;
  name: string;
};

export type SetVisibilitySizePayload = {
  roomId: string;
  visibilitySize: 3 | 5 | 7;
};

export type StartGamePayload = {
  roomId: string;
};

export type ForceEndRoomPayload = {
  roomId: string;
};

export type ResetRoomPayload = {
  roomId: string;
};

export type MovePayload = {
  roomId: string;
  direction: Direction;
  inputSeq: number;
};

export type SendChatMessagePayload = {
  roomId: string;
  content: string;
};

export type PingCheckPayload = {
  clientSentAt: string;
};

export type PingCheckAckPayload = {
  serverReceivedAt: string;
};

export type ConnectedPayload = {
  playerId: string;
  nickname: string;
  recovered: boolean;
  currentRoomId: string | null;
};

export type RoomListItem = {
  roomId: string;
  name: string;
  hostNickname: string;
  playerCount: number;
  status: RoomStatus;
  mode: RoomMode;
};

export type RoomListUpdatePayload = {
  rooms: RoomListItem[];
};

export type RoomJoinedPayload = {
  roomId: string;
  snapshot: RoomSnapshot;
  selfPlayerId: string;
};

export type RoomLeftPayload = {
  roomId: string;
  playerId: string;
  reason: "manual" | "timeout" | "removed";
};

export type RoomStateUpdatePayload = {
  roomId: string;
  snapshot: RoomSnapshot;
};

export type GameStartingPayload = {
  roomId: string;
  matchId: string;
  mapId: string;
  startsAt: string;
};

export type CountdownPayload = {
  roomId: string;
  value: 3 | 2 | 1 | 0;
  endsAt: string;
  revision: number;
};

export type PlayerMovedPayload = {
  roomId: string;
  playerId: string;
  position: GridPosition;
  inputSeq: number;
  revision: number;
};

export type PlayerFinishedPayload = {
  roomId: string;
  playerId: string;
  rank: number;
  revision: number;
};

export type GameEndedPayload = {
  roomId: string;
  results: ResultEntry[];
  returnToWaitingAt: string | null;
  revision: number;
};

export type ErrorCode =
  | "INVALID_NICKNAME"
  | "INVALID_CHAT_MESSAGE"
  | "ROOM_FULL"
  | "ROOM_NOT_JOINABLE"
  | "HOST_ONLY"
  | "INVALID_MOVE"
  | "RECOVERY_FAILED"
  | "NOT_IN_ROOM"
  | "UNKNOWN";

export type ErrorPayload = {
  code: ErrorCode;
  message: string;
};

export type MemberStateChangedPayload = {
  roomId: string;
  playerId: string;
  state: RoomMemberState;
  revision: number;
};
