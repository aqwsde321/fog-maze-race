import type { GridPosition } from "../domain/grid-position.js";
import type { ResultEntry } from "../domain/result-entry.js";
import type { MatchStatus, RoomMemberState, RoomStatus } from "../domain/status.js";
import type { ZoneBounds } from "../maps/map-definitions.js";

export type RoomMemberView = {
  playerId: string;
  nickname: string;
  color: string;
  state: RoomMemberState;
  position: GridPosition | null;
  finishRank: number | null;
  isHost: boolean;
};

export type MatchView = {
  matchId: string;
  mapId: string;
  status: MatchStatus;
  countdownValue: 3 | 2 | 1 | 0 | null;
  startedAt: string | null;
  endedAt: string | null;
  finishOrder: string[];
  results: ResultEntry[];
  map: {
    width: number;
    height: number;
    tiles: string[];
    startZone: ZoneBounds;
    goalZone: ZoneBounds;
    visibilityRadius: number;
  };
};

export type RoomSnapshot = {
  revision: number;
  room: {
    roomId: string;
    name: string;
    status: RoomStatus;
    hostPlayerId: string;
    maxPlayers: number;
  };
  members: RoomMemberView[];
  match: MatchView | null;
};
