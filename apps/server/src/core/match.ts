import {
  movePosition,
  samePosition,
  type Direction,
  type GridPosition
} from "@fog-maze-race/shared/domain/grid-position";
import type { ResultEntry } from "@fog-maze-race/shared/domain/result-entry";
import type { MatchStatus } from "@fog-maze-race/shared/domain/status";
import {
  getMapById,
  isInsideZone,
  isWalkableTile,
  type MapDefinition
} from "@fog-maze-race/shared/maps/map-definitions";

export class MatchAggregate {
  readonly matchId: string;
  readonly roomId: string;
  readonly map: MapDefinition;
  status: MatchStatus;
  countdownValue: 3 | 2 | 1 | 0 | null;
  finishOrder: string[];
  results: ResultEntry[];
  startedAt: number | null;
  endedAt: number | null;

  constructor(input: { matchId: string; roomId: string; mapId: string }) {
    const map = getMapById(input.mapId);
    if (!map) {
      throw new Error(`Unknown map: ${input.mapId}`);
    }

    this.matchId = input.matchId;
    this.roomId = input.roomId;
    this.map = map;
    this.status = "countdown";
    this.countdownValue = 3;
    this.finishOrder = [];
    this.results = [];
    this.startedAt = null;
    this.endedAt = null;
  }

  tickCountdown() {
    if (this.countdownValue === null) {
      return null;
    }

    const nextValue = Math.max(this.countdownValue - 1, 0) as 3 | 2 | 1 | 0;
    this.countdownValue = nextValue;

    if (nextValue === 0) {
      this.status = "playing";
      this.startedAt = Date.now();
    }

    return nextValue;
  }

  setCountdownValue(value: 3 | 2 | 1 | 0, now = Date.now()) {
    this.countdownValue = value;

    if (value === 0) {
      this.status = "playing";
      this.startedAt = now;
    }
  }

  applyMove(position: GridPosition, direction: Direction) {
    const nextPosition = movePosition(position, direction);

    if (!isWalkableTile(this.map, nextPosition)) {
      return position;
    }

    return nextPosition;
  }

  isGoal(position: GridPosition) {
    return isInsideZone(this.map.goalZone, position);
  }

  markFinished(input: { playerId: string; nickname: string; color: string; position: GridPosition }) {
    if (!this.isGoal(input.position)) {
      return null;
    }

    if (this.finishOrder.includes(input.playerId)) {
      const existing = this.results.find((entry) => entry.playerId === input.playerId);
      return existing?.rank ?? null;
    }

    this.finishOrder.push(input.playerId);
    const rank = this.finishOrder.length;

    this.results.push({
      playerId: input.playerId,
      nickname: input.nickname,
      color: input.color,
      outcome: "finished",
      rank
    });

    return rank;
  }

  markLeft(input: { playerId: string; nickname: string; color: string }) {
    const alreadyTracked = this.results.find((entry) => entry.playerId === input.playerId);
    if (alreadyTracked || this.finishOrder.includes(input.playerId)) {
      return;
    }

    this.results.push({
      playerId: input.playerId,
      nickname: input.nickname,
      color: input.color,
      outcome: "left",
      rank: null
    });
  }

  end() {
    this.status = "ended";
    this.endedAt = Date.now();
  }

  hasPositionChanged(previous: GridPosition, next: GridPosition) {
    return !samePosition(previous, next);
  }
}
