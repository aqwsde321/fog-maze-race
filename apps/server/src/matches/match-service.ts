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
import type { ResultEntry } from "@fog-maze-race/shared/domain/result-entry";

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
  random?: () => number;
};

const ICE_TRAP_FROZEN_MS = 1_500;

type TimerBucket = {
  countdown: ReturnType<typeof setTimeout>[];
};

export class MatchService {
  private readonly timers = new Map<string, TimerBucket>();

  constructor(
    private readonly roomService: RoomService,
    private readonly options: MatchServiceOptions
  ) {}

  startGame(roomId: string, requestedBy: string, sink: MatchEventSink) {
    const runtime = this.roomService.requireRuntime(roomId);
    const previewMap = this.roomService.getPreviewMap(roomId);
    if (!previewMap) {
      throw new Error("MAP_NOT_FOUND");
    }
    const configuredMap = {
      ...previewMap,
      visibilityRadius: this.roomService.getVisibilityRadius(roomId)
    };

    const match = new MatchAggregate({
      matchId: randomUUID(),
      roomId,
      map: configuredMap
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

    const now = Date.now();
    if (member.frozenUntil && member.frozenUntil > now) {
      return;
    }
    if (member.frozenUntil && member.frozenUntil <= now) {
      runtime.room.setFrozenUntil(playerId, null);
    }

    const nextPosition = match.applyMove(member.position, input.direction);
    if (!match.hasPositionChanged(member.position, nextPosition)) {
      return;
    }

    const previousPosition = member.position;
    match.armTrapForOwner(playerId, previousPosition, nextPosition, now);
    runtime.room.updateMemberPosition(playerId, nextPosition);

    const finishedRank = match.isGoal(nextPosition)
      ? match.markFinished({
          playerId,
          nickname: member.nickname,
          color: member.color,
          position: nextPosition
        }, now)
      : null;

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

    if (member.heldItemType === null) {
      const claimedItemType = match.claimItemBoxAt(nextPosition);
      if (claimedItemType) {
        runtime.room.setHeldItem(playerId, claimedItemType);
      }
    }

    const triggeredTrap = match.triggerTrapAt(playerId, nextPosition, now);
    if (triggeredTrap) {
      runtime.room.setFrozenUntil(playerId, now + ICE_TRAP_FROZEN_MS);
    }

    this.roomService.syncRoomRevision(roomId);
    const snapshot = this.roomService.getSnapshot(roomId);

    sink.emitPlayerMoved({
      roomId,
      playerId,
      position: nextPosition,
      inputSeq: input.inputSeq,
      revision: snapshot.revision
    });
    sink.emitRoomState({
      roomId,
      snapshot
    });
  }

  useItem(roomId: string, playerId: string, sink: MatchEventSink) {
    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime || !runtime.match || runtime.room.status !== "playing") {
      return;
    }

    const member = runtime.room.getMember(playerId);
    if (!member || member.role !== "racer" || member.state !== "playing" || !member.position) {
      return;
    }

    const now = Date.now();
    if (member.frozenUntil && member.frozenUntil > now) {
      return;
    }
    if (member.frozenUntil && member.frozenUntil <= now) {
      runtime.room.setFrozenUntil(playerId, null);
    }

    if (member.heldItemType !== "ice_trap") {
      return;
    }

    const placedTrap = runtime.match.placeIceTrap(playerId, member.position);
    if (!placedTrap) {
      return;
    }

    runtime.room.setHeldItem(playerId, null);
    this.roomService.syncRoomRevision(roomId);
    sink.emitRoomState({
      roomId,
      snapshot: this.roomService.getSnapshot(roomId)
    });
  }

  dispose() {
    for (const timers of this.timers.values()) {
      timers.countdown.forEach((timer) => clearTimeout(timer));
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

    if (runtime.room.status === "ended" || runtime.match.status === "ended") {
      return;
    }

    if (runtime.room.status !== "countdown" && runtime.room.status !== "playing") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    forceEndMatch(runtime.room, runtime.match);
    this.finishGame(roomId, sink);
  }

  resetRoomToWaiting(roomId: string, requestedBy: string, sink: MatchEventSink) {
    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime || !runtime.match) {
      return;
    }

    if (runtime.room.hostPlayerId !== requestedBy) {
      throw new Error("HOST_ONLY");
    }

    if (runtime.room.status !== "ended") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    const snapshot = resetRoom(this.roomService, roomId);
    sink.emitRoomState({ roomId, snapshot });
    sink.emitRoomListUpdate();
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
          match.spawnItemBoxes(
            runtime.room.listMembers().filter((member) => member.role === "racer" && member.state === "playing").length,
            this.options.random ?? Math.random
          );
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
    if (runtime.room.status === "ended" || runtime.match?.status === "ended") {
      return;
    }

    const match = runtime.match;
    if (!match) {
      return;
    }

    runtime.room.endRound();
    match.end();
    this.roomService.syncRoomRevision(roomId);
    const hostMember = runtime.room.getMember(runtime.room.hostPlayerId);
    const endedAt = new Date().toISOString();
    console.log(
      JSON.stringify({
        event: "GAME_ENDED",
        endedAt,
        roomId,
        roomName: runtime.room.name,
        hostNickname: hostMember?.nickname ?? "Unknown",
        result: this.summarizeResult(match.results)
      })
    );

    const endedSnapshot = this.roomService.getSnapshot(roomId);
    sink.emitRoomState({
      roomId,
      snapshot: endedSnapshot
    });
    sink.emitGameEnded({
      roomId,
      results: [...match.results],
      returnToWaitingAt: null,
      revision: endedSnapshot.revision
    });
    sink.emitRoomListUpdate();
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

  private summarizeResult(results: readonly ResultEntry[]) {
    if (results.length === 0) {
      return "완주자 없음";
    }

    const rankedResults = [...results]
      .sort((left, right) => {
        if (left.rank === null && right.rank === null) {
          return 0;
        }
        if (left.rank === null) {
          return 1;
        }
        if (right.rank === null) {
          return -1;
        }
        return left.rank - right.rank;
      })
      .map((entry) => {
        if (entry.outcome === "finished" && entry.rank !== null) {
          const elapsed = entry.elapsedMs === null ? "-" : this.formatElapsedTime(entry.elapsedMs);
          return `${entry.rank}위 ${entry.nickname}(${elapsed})`;
        }
        return `나감 ${entry.nickname}`;
      })
      .join(" / ");

    return rankedResults;
  }

  private formatElapsedTime(elapsedMs: number) {
    const minutes = Math.floor(elapsedMs / 60_000);
    const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
    const milliseconds = elapsedMs % 1_000;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  private getTimerBucket(roomId: string): TimerBucket {
    const existing = this.timers.get(roomId);
    if (existing) {
      return existing;
    }

    const created: TimerBucket = {
      countdown: []
    };

    this.timers.set(roomId, created);
    return created;
  }

  private getInitialCountdownDelay() {
    return Math.min(20, this.options.countdownStepMs);
  }
}
