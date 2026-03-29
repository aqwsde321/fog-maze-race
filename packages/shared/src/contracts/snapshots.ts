import type { GridPosition } from "../domain/grid-position.js";
import type { PlayerMarkerShape } from "../domain/player-marker-shape.js";
import type { ResultEntry } from "../domain/result-entry.js";
import type { MatchStatus, RoomMemberKind, RoomMemberRole, RoomMode, RoomMemberState, RoomStatus } from "../domain/status.js";
import type { ZoneBounds } from "../maps/map-definitions.js";

export type RoomMemberView = {
  playerId: string;
  nickname: string;
  kind: RoomMemberKind;
  color: string;
  shape: PlayerMarkerShape;
  role: RoomMemberRole;
  state: RoomMemberState;
  position: GridPosition | null;
  finishRank: number | null;
  isHost: boolean;
};

export type RoomChatMessageView = {
  messageId: string;
  playerId: string;
  nickname: string;
  color: string;
  content: string;
  sentAt: string;
};

export type MapView = {
  mapId: string;
  width: number;
  height: number;
  tiles: string[];
  startZone: ZoneBounds;
  mazeZone: ZoneBounds;
  goalZone: ZoneBounds;
  startSlots: GridPosition[];
  connectorTiles: GridPosition[];
  visibilityRadius: number;
};

export type MatchView = {
  matchId: string;
  mapId: string;
  status: MatchStatus;
  countdownValue: 3 | 2 | 1 | 0 | null;
  startedAt: string | null;
  endedAt: string | null;
  resultsDurationMs: number | null;
  finishOrder: string[];
  results: ResultEntry[];
  map: MapView;
};

export type RoomSnapshot = {
  revision: number;
  room: {
    roomId: string;
    name: string;
    mode: RoomMode;
    status: RoomStatus;
    hostPlayerId: string;
    maxPlayers: number;
    visibilitySize: 3 | 5 | 7;
  };
  members: RoomMemberView[];
  chat: RoomChatMessageView[];
  previewMap: MapView | null;
  match: MatchView | null;
};
