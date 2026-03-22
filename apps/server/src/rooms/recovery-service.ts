import type { MatchEventSink } from "../matches/match-service.js";
import { MatchService } from "../matches/match-service.js";
import { PlayerSession } from "../core/player-session.js";
import { DisconnectGraceRegistry } from "../ws/disconnect-grace.js";
import { RoomService } from "./room-service.js";

export type RecoveryServiceOptions = {
  graceWindowMs: number;
};

export class RecoveryService {
  private readonly timeoutHandles = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly roomService: RoomService,
    private readonly matchService: MatchService,
    private readonly disconnectGrace: DisconnectGraceRegistry,
    private readonly sessions: Map<string, PlayerSession>,
    private readonly options: RecoveryServiceOptions
  ) {}

  disconnect(playerId: string, sink: MatchEventSink) {
    const session = this.sessions.get(playerId);
    const roomId = session?.currentRoomId;
    if (!session || !roomId) {
      return;
    }

    session.disconnect(Date.now(), this.options.graceWindowMs);

    try {
      const snapshot = this.roomService.disconnectPlayer(roomId, playerId);
      sink.emitRoomState({ roomId, snapshot });
    } catch {
      return;
    }

    const record = this.disconnectGrace.markDisconnected(
      playerId,
      roomId,
      this.options.graceWindowMs
    );

    const existingTimer = this.timeoutHandles.get(playerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timeoutHandle = setTimeout(() => {
      this.expirePlayer(playerId, sink);
    }, Math.max(record.deadlineAt - Date.now(), 0) + 1);

    this.timeoutHandles.set(playerId, timeoutHandle);
  }

  recover(playerId: string) {
    const record = this.disconnectGrace.recover(playerId);
    if (!record) {
      return null;
    }

    const timeoutHandle = this.timeoutHandles.get(playerId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeoutHandles.delete(playerId);
    }

    const session = this.sessions.get(playerId);
    if (!session) {
      return null;
    }

    session.reconnect();

    try {
      const snapshot = this.roomService.recoverPlayer(record.roomId, playerId);
      return {
        roomId: record.roomId,
        snapshot
      };
    } catch {
      return null;
    }
  }

  dispose() {
    for (const timeoutHandle of this.timeoutHandles.values()) {
      clearTimeout(timeoutHandle);
    }

    this.timeoutHandles.clear();
  }

  private expirePlayer(playerId: string, sink: MatchEventSink) {
    const record = this.disconnectGrace.get(playerId);
    if (!record || record.deadlineAt > Date.now()) {
      return;
    }

    this.disconnectGrace.delete(playerId);
    this.timeoutHandles.delete(playerId);

    const session = this.sessions.get(playerId);
    if (!session || session.currentRoomId !== record.roomId) {
      return;
    }

    const removal = this.roomService.removePlayer(record.roomId, playerId);
    session.leave();

    this.matchService.handlePlayerLeft(record.roomId, removal.removedMember, sink);
  }
}
