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

  seedMatchPositions(startSlots: GridPosition[]) {
    const members = this.listMembers();

    members.forEach((member, index) => {
      member.position = startSlots[index] ?? startSlots[startSlots.length - 1] ?? null;
      member.state = "waiting";
      member.finishRank = null;
      member.finishedAt = null;
    });

    this.bumpRevision();
  }

  markMembersPlaying() {
    for (const member of this.members.values()) {
      if (member.state !== "left") {
        member.state = "playing";
      }
    }

    this.bumpRevision();
  }

  updateMemberPosition(playerId: string, position: GridPosition) {
    const member = this.members.get(playerId);
    if (!member) {
      throw new Error("NOT_IN_ROOM");
    }

    member.position = position;
    this.bumpRevision();
    return member;
  }

  markMemberFinished(playerId: string, rank: number, now = Date.now()) {
    const member = this.members.get(playerId);
    if (!member) {
      throw new Error("NOT_IN_ROOM");
    }

    member.state = "finished";
    member.finishRank = rank;
    member.finishedAt = now;
    this.bumpRevision();
    return member;
  }

  allMembersFinished() {
    const members = this.listMembers();
    return members.length > 0 && members.every((member) => member.state === "finished");
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
