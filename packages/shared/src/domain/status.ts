export const ROOM_STATUSES = ["waiting", "countdown", "playing", "ended"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_MODES = ["normal", "bot_race"] as const;
export type RoomMode = (typeof ROOM_MODES)[number];

export const ROOM_GAME_MODES = ["normal", "item"] as const;
export type RoomGameMode = (typeof ROOM_GAME_MODES)[number];

export const MATCH_STATUSES = ["countdown", "playing", "ended"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const ROOM_MEMBER_ROLES = ["racer", "spectator"] as const;
export type RoomMemberRole = (typeof ROOM_MEMBER_ROLES)[number];

export const ROOM_MEMBER_KINDS = ["human", "bot"] as const;
export type RoomMemberKind = (typeof ROOM_MEMBER_KINDS)[number];

export const ROOM_MEMBER_STATES = [
  "waiting",
  "playing",
  "finished",
  "disconnected",
  "left"
] as const;
export type RoomMemberState = (typeof ROOM_MEMBER_STATES)[number];

export const PLAYER_CONNECTION_STATES = ["connected", "disconnected", "left"] as const;
export type PlayerConnectionState = (typeof PLAYER_CONNECTION_STATES)[number];
