import { randomUUID } from "node:crypto";

import type {
  RoomJoinedPayload,
  RoomListItem
} from "../../../../packages/shared/src/contracts/realtime.js";
import type { RoomSnapshot } from "../../../../packages/shared/src/contracts/snapshots.js";
import type { MatchStatus, RoomMemberState } from "../../../../packages/shared/src/domain/status.js";

import { MatchAggregate } from "../core/match.js";
import { PlayerSession } from "../core/player-session.js";
import { RoomAggregate } from "../core/room.js";
import { RevisionSync } from "../ws/revision-sync.js";

const PLAYER_COLORS = [
  "#fb7185",
  "#38bdf8",
  "#f59e0b",
  "#34d399",
  "#a78bfa",
  "#f97316",
  "#22c55e",
  "#facc15"
] as const;

export type RoomRuntime = {
  room: RoomAggregate;
  match: MatchAggregate | null;
};

export class RoomService {
  private readonly rooms = new Map<string, RoomRuntime>();

  constructor(private readonly revisionSync: RevisionSync) {}

  createRoom(input: { session: PlayerSession; name: string }): RoomJoinedPayload {
    const roomId = randomUUID();
    const name = normalizeRoomName(input.name);
    const room = new RoomAggregate({
      roomId,
      name,
      hostPlayerId: input.session.playerId
    });

    room.join({
      playerId: input.session.playerId,
      nickname: input.session.nickname,
      color: PLAYER_COLORS[0],
      state: "waiting",
      position: null
    });

    this.rooms.set(roomId, { room, match: null });
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

    runtime.room.join({
      playerId: input.session.playerId,
      nickname: input.session.nickname,
      color: nextColor,
      state: "waiting",
      position: null
    });

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

    return {
      revision,
      room: {
        roomId: runtime.room.roomId,
        name: runtime.room.name,
        status: runtime.room.status,
        hostPlayerId: runtime.room.hostPlayerId,
        maxPlayers: runtime.room.maxPlayers
      },
      members: runtime.room.listMembers().map((member) => ({
        playerId: member.playerId,
        nickname: member.nickname,
        color: member.color,
        state: member.state,
        position: member.position,
        finishRank: member.finishRank,
        isHost: member.playerId === runtime.room.hostPlayerId
      })),
      match: runtime.match
        ? {
            matchId: runtime.match.matchId,
            mapId: runtime.match.map.mapId,
            status: runtime.match.status,
            countdownValue: runtime.match.countdownValue,
            startedAt: toIso(runtime.match.startedAt),
            endedAt: toIso(runtime.match.endedAt),
            finishOrder: [...runtime.match.finishOrder],
            results: [...runtime.match.results],
            map: {
              width: runtime.match.map.width,
              height: runtime.match.map.height,
              tiles: [...runtime.match.map.tiles],
              startZone: runtime.match.map.startZone,
              goalZone: runtime.match.map.goalZone,
              visibilityRadius: runtime.match.map.visibilityRadius
            }
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

export function isPlayableMemberState(state: RoomMemberState) {
  return state === "playing";
}

export function isEndedMatchStatus(status: MatchStatus) {
  return status === "ended";
}
