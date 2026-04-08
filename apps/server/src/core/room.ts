import type { GridPosition } from "@fog-maze-race/shared/domain/grid-position";
import type { MatchItemType } from "@fog-maze-race/shared/domain/item";
import type { PlayerMarkerShape } from "@fog-maze-race/shared/domain/player-marker-shape";
import type { RoomExploreStrategy } from "@fog-maze-race/shared/domain/room-bot-strategy";
import type {
  RoomMemberKind,
  RoomMemberRole,
  RoomMode,
  RoomMemberState,
  RoomStatus
} from "@fog-maze-race/shared/domain/status";

export type RoomMemberRecord = {
  playerId: string;
  nickname: string;
  kind: RoomMemberKind;
  exploreStrategy?: RoomExploreStrategy | null;
  color: string;
  shape: PlayerMarkerShape;
  role: RoomMemberRole;
  joinOrder: number;
  state: RoomMemberState;
  position: GridPosition | null;
  finishedAt: number | null;
  finishRank: number | null;
  heldItemType: MatchItemType | null;
  frozenUntil: number | null;
};

export type RoomChatMessageRecord = {
  messageId: string;
  playerId: string;
  nickname: string;
  color: string;
  content: string;
  sentAt: string;
};

const MAX_CHAT_MESSAGES = 30;
const MAX_CHAT_MESSAGE_LENGTH = 80;

export class RoomAggregate {
  readonly roomId: string;
  name: string;
  hostPlayerId: string;
  readonly mode: RoomMode;
  readonly maxPlayers: number;
  status: RoomStatus;
  revision: number;

  private readonly members = new Map<string, RoomMemberRecord>();
  private readonly chatMessages: RoomChatMessageRecord[] = [];
  private nextJoinOrder = 1;

  constructor(input: { roomId: string; name: string; hostPlayerId: string; mode?: RoomMode; maxPlayers?: number }) {
    this.roomId = input.roomId;
    this.name = input.name;
    this.hostPlayerId = input.hostPlayerId;
    this.mode = input.mode ?? "normal";
    this.maxPlayers = input.maxPlayers ?? 15;
    this.status = "waiting";
    this.revision = 0;
  }

  join(
    input: Omit<RoomMemberRecord, "joinOrder" | "finishedAt" | "finishRank" | "heldItemType" | "frozenUntil"> &
      Partial<Pick<RoomMemberRecord, "heldItemType" | "frozenUntil">>
  ) {
    if (this.status !== "waiting") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    const currentRacerCount = this.listMembers().filter((member) => member.role === "racer").length;
    const reachedCapacity =
      this.mode === "bot_race"
        ? input.role === "racer" && currentRacerCount >= this.maxPlayers
        : this.members.size >= this.maxPlayers;
    if (reachedCapacity) {
      throw new Error("ROOM_FULL");
    }

    const member: RoomMemberRecord = {
      ...input,
      joinOrder: this.nextJoinOrder,
      finishedAt: null,
      finishRank: null,
      heldItemType: input.heldItemType ?? null,
      frozenUntil: input.frozenUntil ?? null
    };

    this.members.set(member.playerId, member);
    this.nextJoinOrder += 1;
    this.bumpRevision();
    return member;
  }

  leave(playerId: string) {
    const member = this.members.get(playerId);
    if (!member) {
      return null;
    }

    const removedMember: RoomMemberRecord = { ...member };
    member.state = "left";
    this.members.delete(playerId);

    if (this.hostPlayerId === playerId) {
      const nextHost = this.listMembers().find((candidate) => candidate.kind === "human") ?? this.listMembers()[0];
      this.hostPlayerId = nextHost?.playerId ?? this.hostPlayerId;
    }

    this.bumpRevision();
    return removedMember;
  }

  markMemberDisconnected(playerId: string) {
    const member = this.members.get(playerId);
    if (!member) {
      throw new Error("NOT_IN_ROOM");
    }

    if (member.state === "playing" || member.state === "waiting") {
      member.state = "disconnected";
      this.bumpRevision();
    }

    return member;
  }

  recoverMember(playerId: string) {
    const member = this.members.get(playerId);
    if (!member) {
      throw new Error("RECOVERY_FAILED");
    }

    if (member.finishRank !== null) {
      member.state = "finished";
    } else if (this.status === "playing") {
      member.state = "playing";
    } else {
      member.state = "waiting";
    }

    this.bumpRevision();
    return member;
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
    const sharedStartSlot = startSlots[0] ?? null;

    members.forEach((member) => {
      if (member.role === "racer") {
        member.position = sharedStartSlot;
      } else {
        member.position = null;
      }
      member.state = "waiting";
      member.finishRank = null;
      member.finishedAt = null;
      member.heldItemType = null;
      member.frozenUntil = null;
    });

    this.bumpRevision();
  }

  markMembersPlaying() {
    for (const member of this.members.values()) {
      if (member.role === "racer" && member.state !== "left") {
        member.state = "playing";
        member.frozenUntil = null;
        continue;
      }

      if (member.role === "spectator" && member.state !== "left" && member.state !== "disconnected") {
        member.state = "waiting";
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

  setHeldItem(playerId: string, heldItemType: MatchItemType | null) {
    const member = this.members.get(playerId);
    if (!member) {
      throw new Error("NOT_IN_ROOM");
    }

    member.heldItemType = heldItemType;
    this.bumpRevision();
    return member;
  }

  setFrozenUntil(playerId: string, frozenUntil: number | null) {
    const member = this.members.get(playerId);
    if (!member) {
      throw new Error("NOT_IN_ROOM");
    }

    member.frozenUntil = frozenUntil;
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
    const racers = this.listMembers().filter((member) => member.role === "racer");
    return racers.length > 0 && racers.every((member) => member.state === "finished");
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
      member.heldItemType = null;
      member.frozenUntil = null;
    }
    this.bumpRevision();
  }

  listMembers() {
    return [...this.members.values()].sort((left, right) => left.joinOrder - right.joinOrder);
  }

  getMember(playerId: string) {
    return this.members.get(playerId);
  }

  hasMembers() {
    return this.members.size > 0;
  }

  hasHumanMembers() {
    return this.listMembers().some((member) => member.kind === "human");
  }

  listBotMembers() {
    return this.listMembers().filter((member) => member.kind === "bot");
  }

  addChatMessage(input: {
    playerId: string;
    messageId: string;
    content: string;
    sentAt: string;
  }) {
    const member = this.members.get(input.playerId);
    if (!member) {
      throw new Error("NOT_IN_ROOM");
    }

    const content = input.content.trim();
    if (!content || content.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new Error("INVALID_CHAT_MESSAGE");
    }

    const message: RoomChatMessageRecord = {
      messageId: input.messageId,
      playerId: member.playerId,
      nickname: member.nickname,
      color: member.color,
      content,
      sentAt: input.sentAt
    };

    this.chatMessages.push(message);
    if (this.chatMessages.length > MAX_CHAT_MESSAGES) {
      this.chatMessages.splice(0, this.chatMessages.length - MAX_CHAT_MESSAGES);
    }

    this.bumpRevision();
    return message;
  }

  listChatMessages() {
    return [...this.chatMessages];
  }

  private bumpRevision() {
    this.revision += 1;
  }
}
