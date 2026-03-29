import type { PlayerConnectionState, RoomMemberKind } from "@fog-maze-race/shared/domain/status";

export class PlayerSession {
  readonly playerId: string;
  nickname: string;
  kind: RoomMemberKind;
  currentRoomId: string | null;
  connectionState: PlayerConnectionState;
  reconnectDeadlineAt: number | null;
  lastSeenAt: number;

  constructor(input: { playerId: string; nickname: string; kind?: RoomMemberKind; currentRoomId?: string | null }) {
    this.playerId = input.playerId;
    this.nickname = input.nickname;
    this.kind = input.kind ?? "human";
    this.currentRoomId = input.currentRoomId ?? null;
    this.connectionState = "connected";
    this.reconnectDeadlineAt = null;
    this.lastSeenAt = Date.now();
  }

  touch(now = Date.now()) {
    this.lastSeenAt = now;
  }

  disconnect(now = Date.now(), graceWindowMs = 30_000) {
    this.connectionState = "disconnected";
    this.lastSeenAt = now;
    this.reconnectDeadlineAt = now + graceWindowMs;
  }

  reconnect(now = Date.now()) {
    this.connectionState = "connected";
    this.lastSeenAt = now;
    this.reconnectDeadlineAt = null;
  }

  leave(now = Date.now()) {
    this.connectionState = "left";
    this.lastSeenAt = now;
    this.reconnectDeadlineAt = null;
    this.currentRoomId = null;
  }
}
