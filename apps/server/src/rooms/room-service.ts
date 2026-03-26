import { randomUUID } from "node:crypto";

import type {
  RoomJoinedPayload,
  RoomListItem
} from "@fog-maze-race/shared/contracts/realtime";
import type { MapView, RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import {
  PLAYER_MARKER_SHAPES,
  type PlayerMarkerShape
} from "@fog-maze-race/shared/domain/player-marker-shape";
import type { MatchStatus, RoomMemberState } from "@fog-maze-race/shared/domain/status";
import type { MapDefinition } from "@fog-maze-race/shared/maps/map-definitions";

import { MatchAggregate } from "../core/match.js";
import { PlayerSession } from "../core/player-session.js";
import { RoomAggregate } from "../core/room.js";
import { MapRegistry } from "../maps/map-registry.js";
import { RevisionSync } from "../ws/revision-sync.js";

const PLAYER_COLORS = [
  "#ff355e",
  "#ff8a00",
  "#ff2bd6",
  "#b00020",
  "#9b5de5",
  "#6a00f4",
  "#3a0ca3",
  "#2f6bff",
  "#0050d8",
  "#00a63e",
  "#7fff00",
  "#ff5c8a",
  "#c2185b",
  "#ff4d00",
  "#8f2dff"
] as const;

const VISIBILITY_SIZES = [3, 5, 7] as const;

export type RoomRuntime = {
  room: RoomAggregate;
  match: MatchAggregate | null;
  previewMapId: string;
  visibilitySize: 3 | 5 | 7;
  shapeDeck: PlayerMarkerShape[];
  shapeCursor: number;
};

export class RoomService {
  private readonly rooms = new Map<string, RoomRuntime>();
  private readonly resultsDurationMs: number;
  private readonly forcedPreviewMapId: string | null;
  private readonly random: () => number;

  constructor(
    private readonly revisionSync: RevisionSync,
    private readonly mapRegistry: MapRegistry,
    options?: {
      resultsDurationMs?: number;
      forcedPreviewMapId?: string | null;
      random?: () => number;
    }
  ) {
    this.resultsDurationMs = options?.resultsDurationMs ?? 6_000;
    this.forcedPreviewMapId = options?.forcedPreviewMapId ?? null;
    this.random = options?.random ?? Math.random;
  }

  createRoom(input: { session: PlayerSession; name: string }): RoomJoinedPayload {
    const roomId = randomUUID();
    const name = normalizeRoomName(input.name);
    const previewMapId = this.forcedPreviewMapId ?? this.mapRegistry.getRandomPlayable()?.mapId ?? "training-lap";
    const previewMap = this.mapRegistry.get(previewMapId);
    const room = new RoomAggregate({
      roomId,
      name,
      hostPlayerId: input.session.playerId
    });
    const shapeDeck = createShapeDeck(room.maxPlayers, this.random);

    room.join({
      playerId: input.session.playerId,
      nickname: input.session.nickname,
      color: PLAYER_COLORS[0],
      shape: shapeDeck[0] ?? nextShape(0),
      state: "waiting",
      position: previewMap?.startSlots[0] ?? null
    });

    this.rooms.set(roomId, {
      room,
      match: null,
      previewMapId,
      visibilitySize: 7,
      shapeDeck,
      shapeCursor: 1
    });
    input.session.currentRoomId = roomId;
    this.syncRoomRevision(roomId);

    return {
      roomId,
      selfPlayerId: input.session.playerId,
      snapshot: this.getSnapshot(roomId)
    };
  }

  joinRoom(input: { roomId: string; session: PlayerSession }): RoomJoinedPayload {
    const runtime = this.requireRuntime(input.roomId);
    const nextColor = PLAYER_COLORS[runtime.room.listMembers().length % PLAYER_COLORS.length]!;
    const previewMap = this.mapRegistry.get(runtime.previewMapId);
    const nextAssignedShape =
      runtime.shapeDeck[runtime.shapeCursor] ?? nextShape(runtime.shapeCursor);

    runtime.room.join({
      playerId: input.session.playerId,
      nickname: input.session.nickname,
      color: nextColor,
      shape: nextAssignedShape,
      state: "waiting",
      position: previewMap?.startSlots[runtime.room.listMembers().length] ?? previewMap?.startSlots.at(-1) ?? null
    });
    runtime.shapeCursor += 1;

    input.session.currentRoomId = input.roomId;
    this.syncRoomRevision(input.roomId);

    return {
      roomId: input.roomId,
      selfPlayerId: input.session.playerId,
      snapshot: this.getSnapshot(input.roomId)
    };
  }

  setMatch(roomId: string, match: MatchAggregate | null) {
    const runtime = this.requireRuntime(roomId);
    runtime.match = match;
  }

  getMatch(roomId: string) {
    return this.requireRuntime(roomId).match;
  }

  getPreviewMap(roomId: string) {
    const runtime = this.requireRuntime(roomId);
    return this.mapRegistry.get(runtime.previewMapId);
  }

  setPreviewMap(roomId: string, mapId?: string) {
    const runtime = this.requireRuntime(roomId);
    const nextMap = mapId ? this.mapRegistry.get(mapId) : this.mapRegistry.getRandomPlayable();
    if (!nextMap) {
      throw new Error("MAP_NOT_FOUND");
    }

    runtime.previewMapId = nextMap.mapId;
    this.bumpStreamRevision(roomId);
  }

  setVisibilitySize(roomId: string, requestedBy: string, visibilitySize: 3 | 5 | 7) {
    const runtime = this.requireRuntime(roomId);
    if (runtime.room.hostPlayerId !== requestedBy) {
      throw new Error("HOST_ONLY");
    }

    if (!VISIBILITY_SIZES.includes(visibilitySize)) {
      throw new Error("UNKNOWN");
    }

    if (runtime.room.status !== "waiting") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    runtime.visibilitySize = visibilitySize;
    this.syncRoomRevision(roomId);
    return this.getSnapshot(roomId);
  }

  getVisibilityRadius(roomId: string) {
    return toVisibilityRadius(this.requireRuntime(roomId).visibilitySize);
  }

  renameRoom(roomId: string, requestedBy: string, name: string) {
    const runtime = this.requireRuntime(roomId);
    if (runtime.room.hostPlayerId !== requestedBy) {
      throw new Error("HOST_ONLY");
    }

    runtime.room.rename(normalizeRoomName(name));
    this.syncRoomRevision(roomId);
    return this.getSnapshot(roomId);
  }

  findRuntime(roomId: string) {
    return this.rooms.get(roomId) ?? null;
  }

  disconnectPlayer(roomId: string, playerId: string) {
    const runtime = this.requireRuntime(roomId);
    runtime.room.markMemberDisconnected(playerId);
    this.syncRoomRevision(roomId);
    return this.getSnapshot(roomId);
  }

  recoverPlayer(roomId: string, playerId: string) {
    const runtime = this.requireRuntime(roomId);
    runtime.room.recoverMember(playerId);
    this.syncRoomRevision(roomId);
    return this.getSnapshot(roomId);
  }

  removePlayer(roomId: string, playerId: string) {
    const runtime = this.requireRuntime(roomId);
    const removedMember = runtime.room.leave(playerId);
    if (!removedMember) {
      return {
        removedMember: null,
        snapshot: this.getSnapshot(roomId),
        deleted: false
      };
    }

    const deleted = !runtime.room.hasMembers();
    if (deleted) {
      this.rooms.delete(roomId);
      this.revisionSync.reset(roomId, 0);
      return {
        removedMember,
        snapshot: null,
        deleted
      };
    }

    this.syncRoomRevision(roomId);
    return {
      removedMember,
      snapshot: this.getSnapshot(roomId),
      deleted
    };
  }

  listRooms(): RoomListItem[] {
    return [...this.rooms.values()]
      .map(({ room }) => ({
        roomId: room.roomId,
        name: room.name,
        hostNickname: room.getMember(room.hostPlayerId)?.nickname ?? "Unknown",
        playerCount: room.listMembers().length,
        status: room.status
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "ko-KR"));
  }

  getSnapshot(roomId: string): RoomSnapshot {
    const runtime = this.requireRuntime(roomId);
    const revision = Math.max(runtime.room.revision, this.revisionSync.peek(roomId));
    const previewMap = this.mapRegistry.get(runtime.previewMapId);

    return {
      revision,
      room: {
        roomId: runtime.room.roomId,
        name: runtime.room.name,
        status: runtime.room.status,
        hostPlayerId: runtime.room.hostPlayerId,
        maxPlayers: runtime.room.maxPlayers,
        visibilitySize: runtime.visibilitySize
      },
      members: runtime.room.listMembers().map((member) => ({
        playerId: member.playerId,
        nickname: member.nickname,
        color: member.color,
        shape: member.shape,
        state: member.state,
        position: member.position,
        finishRank: member.finishRank,
        isHost: member.playerId === runtime.room.hostPlayerId
      })),
      previewMap: previewMap ? serializeMap(previewMap, this.getVisibilityRadius(roomId)) : null,
      match: runtime.match
        ? {
            matchId: runtime.match.matchId,
            mapId: runtime.match.map.mapId,
            status: runtime.match.status,
            countdownValue: runtime.match.countdownValue,
            startedAt: toIso(runtime.match.startedAt),
            endedAt: toIso(runtime.match.endedAt),
            resultsDurationMs: runtime.match.endedAt ? this.resultsDurationMs : null,
            finishOrder: [...runtime.match.finishOrder],
            results: [...runtime.match.results],
            map: serializeMap(runtime.match.map, this.getVisibilityRadius(roomId))
          }
        : null
    };
  }

  requireRuntime(roomId: string): RoomRuntime {
    const runtime = this.rooms.get(roomId);
    if (!runtime) {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    return runtime;
  }

  syncRoomRevision(roomId: string) {
    const runtime = this.requireRuntime(roomId);
    this.revisionSync.reset(roomId, Math.max(runtime.room.revision, this.revisionSync.peek(roomId)));
    return this.revisionSync.peek(roomId);
  }

  bumpStreamRevision(roomId: string) {
    return this.revisionSync.next(roomId);
  }

  dispose() {
    this.rooms.clear();
  }
}

function toIso(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function normalizeRoomName(name: string) {
  return name.trim().slice(0, 24) || "새 방";
}

function nextShape(index: number): PlayerMarkerShape {
  return PLAYER_MARKER_SHAPES[index % PLAYER_MARKER_SHAPES.length]!;
}

function createShapeDeck(maxPlayers: number, random: () => number) {
  const deck = Array.from({ length: maxPlayers }, (_, index) => nextShape(index));

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = deck[index]!;
    deck[index] = deck[swapIndex]!;
    deck[swapIndex] = current;
  }

  return deck;
}

function serializeMap(map: MapDefinition, visibilityRadius = map.visibilityRadius): MapView {
  return {
    mapId: map.mapId,
    width: map.width,
    height: map.height,
    tiles: [...map.tiles],
    startZone: map.startZone,
    mazeZone: map.mazeZone,
    goalZone: map.goalZone,
    startSlots: [...map.startSlots],
    connectorTiles: [...map.connectorTiles],
    visibilityRadius
  };
}

function toVisibilityRadius(visibilitySize: 3 | 5 | 7) {
  return Math.floor(visibilitySize / 2);
}

export function isPlayableMemberState(state: RoomMemberState) {
  return state === "playing";
}

export function isEndedMatchStatus(status: MatchStatus) {
  return status === "ended";
}
