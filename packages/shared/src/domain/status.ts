export const ROOM_STATUSES = ["waiting", "countdown", "playing", "ended"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const MATCH_STATUSES = ["countdown", "playing", "ended"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

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
