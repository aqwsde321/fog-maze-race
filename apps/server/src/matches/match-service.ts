import { randomUUID } from "node:crypto";
import type {
  CountdownPayload,
  GameEndedPayload,
  GameStartingPayload,
  MovePayload,
  PlayerFinishedPayload,
  PlayerMovedPayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";
import {
  movePosition,
  samePosition
} from "@fog-maze-race/shared/domain/grid-position";
import {
  isInsideZone,
  isWalkableTile
} from "@fog-maze-race/shared/maps/map-definitions";

import { MatchAggregate } from "../core/match.js";
import { forceEndMatch } from "../rooms/force-end-match.js";
import { resetRoom } from "../rooms/reset-room.js";
import { RoomService } from "../rooms/room-service.js";

type MatchEventSink = {
  emitRoomState: (payload: RoomStateUpdatePayload) => void;
  emitCountdown: (payload: CountdownPayload) => void;
  emitPlayerMoved: (payload: PlayerMovedPayload) => void;
  emitPlayerFinished: (payload: PlayerFinishedPayload) => void;
  emitGameStarting: (payload: GameStartingPayload) => void;
  emitGameEnded: (payload: GameEndedPayload) => void;
  emitRoomListUpdate: () => void;
};

export type { MatchEventSink };

export type MatchServiceOptions = {
  countdownStepMs: number;
  resultsDurationMs: number;
  forcedMapId?: string | null;
  recoveryGraceMs?: number;
};

type TimerBucket = {
  countdown: ReturnType<typeof setTimeout>[];
  reset: ReturnType<typeof setTimeout> | null;
};

export class MatchService {
  private readonly timers = new Map<string, TimerBucket>();

  constructor(
    private readonly roomService: RoomService,
    private readonly options: MatchServiceOptions
  ) {}

  startGame(roomId: string, requestedBy: string, sink: MatchEventSink) {
    const runtime = this.roomService.requireRuntime(roomId);
    const mapId = runtime.previewMapId;
    const match = new MatchAggregate({
      matchId: randomUUID(),
      roomId,
      mapId
    });

    runtime.room.startCountdown(requestedBy);
    runtime.room.seedMatchPositions(match.map.startSlots);
    this.roomService.setMatch(roomId, match);
    this.roomService.syncRoomRevision(roomId);

    const initialDelayMs = this.getInitialCountdownDelay();
    const startsAt = new Date(Date.now() + initialDelayMs + this.options.countdownStepMs * 3).toISOString();
    sink.emitGameStarting({
      roomId,
      matchId: match.matchId,
      mapId: match.map.mapId,
      startsAt
    });
    sink.emitRoomState({
      roomId,
      snapshot: this.roomService.getSnapshot(roomId)
    });
    sink.emitRoomListUpdate();

    this.scheduleCountdown(roomId, sink, initialDelayMs);
  }

  move(
    roomId: string,
    playerId: string,
    input: Pick<MovePayload, "direction" | "inputSeq">,
    sink: MatchEventSink
  ) {
    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime) {
      return;
    }
    const member = runtime.room.getMember(playerId);
    const match = runtime.match;

    if (!member || !member.position) {
      return;
    }

    if (runtime.room.status === "waiting" || runtime.room.status === "countdown") {
      if (member.state === "disconnected" || member.state === "left" || member.state === "finished") {
        return;
      }

      const map = match?.map ?? this.roomService.getPreviewMap(roomId);
      if (!map) {
        return;
      }

      const nextPosition = movePosition(member.position, input.direction);
      if (
        samePosition(member.position, nextPosition) ||
        !isInsideZone(map.startZone, nextPosition) ||
        !isWalkableTile(map, nextPosition)
      ) {
        return;
      }

      this.emitPositionUpdate(roomId, playerId, nextPosition, input.inputSeq, sink);
      return;
    }

    if (!match || runtime.room.status !== "playing" || member.state !== "playing") {
      return;
    }

    const nextPosition = match.applyMove(member.position, input.direction);
    if (!match.hasPositionChanged(member.position, nextPosition)) {
      return;
    }

    const finishedRank = match.isGoal(nextPosition)
      ? match.markFinished({
          playerId,
          nickname: member.nickname,
          color: member.color,
          position: nextPosition
        })
      : null;

    runtime.room.updateMemberPosition(playerId, nextPosition);

    if (finishedRank) {
      runtime.room.markMemberFinished(playerId, finishedRank);
      this.roomService.syncRoomRevision(roomId);
      sink.emitPlayerFinished({
        roomId,
        playerId,
        rank: finishedRank,
        revision: this.roomService.getSnapshot(roomId).revision
      });
      sink.emitRoomState({
        roomId,
        snapshot: this.roomService.getSnapshot(roomId)
      });

      if (runtime.room.allMembersFinished()) {
        this.finishGame(roomId, sink);
      }

      return;
    }

    this.emitPositionUpdate(roomId, playerId, nextPosition, input.inputSeq, sink);
  }

  dispose() {
    for (const timers of this.timers.values()) {
      timers.countdown.forEach((timer) => clearTimeout(timer));
      if (timers.reset) {
        clearTimeout(timers.reset);
      }
    }

    this.timers.clear();
  }

  handlePlayerLeft(
    roomId: string,
    member: { playerId: string; nickname: string; color: string } | null,
    sink: MatchEventSink
  ) {
    const runtime = this.roomService.findRuntime(roomId);
    if (!member) {
      if (runtime) {
        sink.emitRoomListUpdate();
      }
      return;
    }

    if (!runtime) {
      sink.emitRoomListUpdate();
      return;
    }

    if (runtime.match) {
      runtime.match.markLeft(member);
    }

    this.roomService.syncRoomRevision(roomId);

    if (runtime.room.status === "playing" && runtime.room.allMembersFinished()) {
      this.finishGame(roomId, sink);
      return;
    }

    sink.emitRoomState({
      roomId,
      snapshot: this.roomService.getSnapshot(roomId)
    });
    sink.emitRoomListUpdate();
  }

  forceEnd(roomId: string, requestedBy: string, sink: MatchEventSink) {
    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime || !runtime.match) {
      return;
    }

    if (runtime.room.hostPlayerId !== requestedBy) {
      throw new Error("HOST_ONLY");
    }

    forceEndMatch(runtime.room, runtime.match);
    this.finishGame(roomId, sink);
  }

  private scheduleCountdown(roomId: string, sink: MatchEventSink, initialDelayMs: number) {
    const bucket = this.getTimerBucket(roomId);
    bucket.countdown.forEach((timer) => clearTimeout(timer));
    bucket.countdown = [];

    const values: Array<3 | 2 | 1 | 0> = [3, 2, 1, 0];

    values.forEach((value, index) => {
      const delay = initialDelayMs + this.options.countdownStepMs * index;
      const timer = setTimeout(() => {
        const runtime = this.roomService.findRuntime(roomId);
        if (!runtime) {
          return;
        }
        const match = runtime.match;
        if (!match) {
          return;
        }

        if (value !== 3) {
          match.setCountdownValue(value);
        }

        if (value === 0) {
          runtime.room.beginPlaying();
          runtime.room.markMembersPlaying();
          this.roomService.syncRoomRevision(roomId);
        } else {
          this.roomService.bumpStreamRevision(roomId);
        }

        sink.emitCountdown({
          roomId,
          value,
          endsAt: new Date(Date.now() + this.options.countdownStepMs).toISOString(),
          revision: this.roomService.getSnapshot(roomId).revision
        });
        sink.emitRoomState({
          roomId,
          snapshot: this.roomService.getSnapshot(roomId)
        });

        if (value === 0) {
          sink.emitRoomListUpdate();
        }
      }, delay);

      bucket.countdown.push(timer);
    });
  }

  private finishGame(roomId: string, sink: MatchEventSink) {
    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime) {
      return;
    }
    const match = runtime.match;
    if (!match) {
      return;
    }

    runtime.room.endRound();
    match.end();
    this.roomService.syncRoomRevision(roomId);

    const endedSnapshot = this.roomService.getSnapshot(roomId);
    sink.emitRoomState({
      roomId,
      snapshot: endedSnapshot
    });
    sink.emitGameEnded({
      roomId,
      results: [...match.results],
      returnToWaitingAt: new Date(Date.now() + this.options.resultsDurationMs).toISOString(),
      revision: endedSnapshot.revision
    });
    sink.emitRoomListUpdate();

    const bucket = this.getTimerBucket(roomId);
    if (bucket.reset) {
      clearTimeout(bucket.reset);
    }

    bucket.reset = setTimeout(() => {
      const activeRuntime = this.roomService.findRuntime(roomId);
      if (!activeRuntime) {
        return;
      }

      const snapshot = resetRoom(this.roomService, roomId);
      sink.emitRoomState({ roomId, snapshot });
      sink.emitRoomListUpdate();
    }, this.options.resultsDurationMs);
  }

  private emitPositionUpdate(
    roomId: string,
    playerId: string,
    position: { x: number; y: number },
    inputSeq: number,
    sink: MatchEventSink
  ) {
    this.roomService.requireRuntime(roomId).room.updateMemberPosition(playerId, position);
    this.roomService.syncRoomRevision(roomId);
    const snapshot = this.roomService.getSnapshot(roomId);

    sink.emitPlayerMoved({
      roomId,
      playerId,
      position,
      inputSeq,
      revision: snapshot.revision
    });
    sink.emitRoomState({
      roomId,
      snapshot
    });
  }

  private getTimerBucket(roomId: string): TimerBucket {
    const existing = this.timers.get(roomId);
    if (existing) {
      return existing;
    }

    const created: TimerBucket = {
      countdown: [],
      reset: null
    };

    this.timers.set(roomId, created);
    return created;
  }

  private getInitialCountdownDelay() {
    return Math.min(20, this.options.countdownStepMs);
  }
}
