import type { GridPosition } from "../../../../packages/shared/src/domain/grid-position.js";
import type {
  RoomMemberState,
  RoomStatus
} from "../../../../packages/shared/src/domain/status.js";

export type RoomMemberRecord = {
  playerId: string;
  nickname: string;
  color: string;
  joinOrder: number;
  state: RoomMemberState;
  position: GridPosition | null;
  finishedAt: number | null;
  finishRank: number | null;
};

export class RoomAggregate {
  readonly roomId: string;
  name: string;
  hostPlayerId: string;
  readonly maxPlayers: number;
  status: RoomStatus;
  revision: number;

  private readonly members = new Map<string, RoomMemberRecord>();
  private nextJoinOrder = 1;

  constructor(input: { roomId: string; name: string; hostPlayerId: string; maxPlayers?: number }) {
    this.roomId = input.roomId;
    this.name = input.name;
    this.hostPlayerId = input.hostPlayerId;
    this.maxPlayers = input.maxPlayers ?? 15;
    this.status = "waiting";
    this.revision = 0;
  }

  join(input: Omit<RoomMemberRecord, "joinOrder" | "finishedAt" | "finishRank">) {
    if (this.status !== "waiting") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    if (this.members.size >= this.maxPlayers) {
      throw new Error("ROOM_FULL");
    }

    const member: RoomMemberRecord = {
      ...input,
      joinOrder: this.nextJoinOrder,
      finishedAt: null,
      finishRank: null
    };

    this.members.set(member.playerId, member);
    this.nextJoinOrder += 1;
    this.bumpRevision();
    return member;
  }

  leave(playerId: string) {
    const member = this.members.get(playerId);
    if (!member) {
      return;
    }

    member.state = "left";
    this.members.delete(playerId);

    if (this.hostPlayerId === playerId) {
      const nextHost = [...this.members.values()].sort((left, right) => left.joinOrder - right.joinOrder)[0];
      this.hostPlayerId = nextHost?.playerId ?? this.hostPlayerId;
    }

    this.bumpRevision();
  }

  rename(nextName: string) {
    this.name = nextName;
    this.bumpRevision();
  }

  startCountdown(requestedBy: string) {
    if (requestedBy !== this.hostPlayerId) {
      throw new Error("HOST_ONLY");
    }

    if (this.status !== "waiting") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    this.status = "countdown";
    this.bumpRevision();
  }

  beginPlaying() {
    this.status = "playing";
    this.bumpRevision();
  }

  endRound() {
    this.status = "ended";
    this.bumpRevision();
  }

  resetToWaiting() {
    this.status = "waiting";
    for (const member of this.members.values()) {
      member.state = "waiting";
      member.finishRank = null;
      member.finishedAt = null;
      member.position = null;
    }
    this.bumpRevision();
  }

  listMembers() {
    return [...this.members.values()].sort((left, right) => left.joinOrder - right.joinOrder);
  }

  getMember(playerId: string) {
    return this.members.get(playerId);
  }

  private bumpRevision() {
    this.revision += 1;
  }
}
