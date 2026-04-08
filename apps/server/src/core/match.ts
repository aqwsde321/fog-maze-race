import { randomUUID } from "node:crypto";
import {
  movePosition,
  samePosition,
  type Direction,
  type GridPosition
} from "@fog-maze-race/shared/domain/grid-position";
import type { MatchItemType, MatchTrapState } from "@fog-maze-race/shared/domain/item";
import type { ResultEntry } from "@fog-maze-race/shared/domain/result-entry";
import type { MatchStatus } from "@fog-maze-race/shared/domain/status";
import {
  isInsideZone,
  isFakeGoalTile,
  isWalkableTile,
  type MapDefinition
} from "@fog-maze-race/shared/maps/map-definitions";

export type MatchItemBoxRecord = {
  boxId: string;
  position: GridPosition;
  itemType: MatchItemType;
};

export type MatchTrapRecord = {
  trapId: string;
  ownerPlayerId: string;
  position: GridPosition;
  state: MatchTrapState;
  armedAt: number | null;
};

const ITEM_BOX_GOAL_EXCLUSION_RADIUS = 2;
const ITEM_BOX_ENTRY_EXCLUSION_COLUMNS = 2;

export class MatchAggregate {
  readonly matchId: string;
  readonly roomId: string;
  readonly map: MapDefinition;
  status: MatchStatus;
  countdownValue: 3 | 2 | 1 | 0 | null;
  finishOrder: string[];
  results: ResultEntry[];
  itemBoxes: MatchItemBoxRecord[];
  traps: MatchTrapRecord[];
  startedAt: number | null;
  endedAt: number | null;

  constructor(input: { matchId: string; roomId: string; map: MapDefinition }) {
    this.matchId = input.matchId;
    this.roomId = input.roomId;
    this.map = input.map;
    this.status = "countdown";
    this.countdownValue = 3;
    this.finishOrder = [];
    this.results = [];
    this.itemBoxes = [];
    this.traps = [];
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

  markFinished(
    input: { playerId: string; nickname: string; color: string; position: GridPosition },
    now = Date.now()
  ) {
    if (!this.isGoal(input.position)) {
      return null;
    }

    if (this.finishOrder.includes(input.playerId)) {
      const existing = this.results.find((entry) => entry.playerId === input.playerId);
      return existing?.rank ?? null;
    }

    this.finishOrder.push(input.playerId);
    const rank = this.finishOrder.length;
    const elapsedMs = this.startedAt === null ? null : Math.max(now - this.startedAt, 0);

    this.results.push({
      playerId: input.playerId,
      nickname: input.nickname,
      color: input.color,
      outcome: "finished",
      rank,
      elapsedMs
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
      rank: null,
      elapsedMs: null
    });
  }

  spawnItemBoxes(count: number, random: () => number) {
    if (!this.map.featureFlags?.itemBoxes) {
      this.itemBoxes = [];
      return this.itemBoxes;
    }

    const candidates: GridPosition[] = [];
    for (let y = this.map.mazeZone.minY; y <= this.map.mazeZone.maxY; y += 1) {
      for (let x = this.map.mazeZone.minX; x <= this.map.mazeZone.maxX; x += 1) {
        const position = { x, y };
        if (!this.isItemBoxCandidate(position)) {
          continue;
        }

        candidates.push(position);
      }
    }

    const pool = [...candidates];
    const nextBoxes: MatchItemBoxRecord[] = [];
    const targetCount = Math.min(count, pool.length);

    for (let index = 0; index < targetCount; index += 1) {
      const nextIndex = Math.floor(random() * pool.length);
      const [position] = pool.splice(nextIndex, 1);
      if (!position) {
        continue;
      }

      nextBoxes.push({
        boxId: randomUUID(),
        position,
        itemType: "ice_trap"
      });
    }

    this.itemBoxes = nextBoxes;
    return this.itemBoxes;
  }

  claimItemBoxAt(position: GridPosition) {
    const nextBoxes: MatchItemBoxRecord[] = [];
    let claimedItemType: MatchItemType | null = null;

    for (const box of this.itemBoxes) {
      if (claimedItemType === null && samePosition(box.position, position)) {
        claimedItemType = box.itemType;
        continue;
      }

      nextBoxes.push(box);
    }

    this.itemBoxes = nextBoxes;
    return claimedItemType;
  }

  placeIceTrap(ownerPlayerId: string, position: GridPosition) {
    if (this.traps.some((trap) => samePosition(trap.position, position))) {
      return null;
    }

    const trap: MatchTrapRecord = {
      trapId: randomUUID(),
      ownerPlayerId,
      position,
      state: "arming",
      armedAt: null
    };

    this.traps.push(trap);
    return trap;
  }

  armTrapForOwner(ownerPlayerId: string, previousPosition: GridPosition, nextPosition: GridPosition, now = Date.now()) {
    if (samePosition(previousPosition, nextPosition)) {
      return null;
    }

    const trap = this.traps.find((candidate) =>
      candidate.ownerPlayerId === ownerPlayerId &&
      candidate.state === "arming" &&
      samePosition(candidate.position, previousPosition)
    );
    if (!trap) {
      return null;
    }

    trap.state = "armed";
    trap.armedAt = now;
    return trap;
  }

  triggerTrapAt(playerId: string, position: GridPosition, now = Date.now()) {
    const trapIndex = this.traps.findIndex((candidate) =>
      candidate.ownerPlayerId !== playerId &&
      candidate.state === "armed" &&
      samePosition(candidate.position, position)
    );
    if (trapIndex < 0) {
      return null;
    }

    const trap = this.traps[trapIndex]!;
    const triggered: MatchTrapRecord = {
      ...trap,
      state: "triggered",
      armedAt: trap.armedAt ?? now
    };
    this.traps.splice(trapIndex, 1);
    return triggered;
  }

  end() {
    this.status = "ended";
    this.endedAt = Date.now();
    this.itemBoxes = [];
    this.traps = [];
  }

  hasPositionChanged(previous: GridPosition, next: GridPosition) {
    return !samePosition(previous, next);
  }

  private isItemBoxCandidate(position: GridPosition) {
    if (!isWalkableTile(this.map, position)) {
      return false;
    }

    if (isInsideZone(this.map.goalZone, position)) {
      return false;
    }

    if (isFakeGoalTile(this.map, position)) {
      return false;
    }

    if (position.x < this.map.mazeZone.minX + ITEM_BOX_ENTRY_EXCLUSION_COLUMNS) {
      return false;
    }

    const goalDistance =
      Math.abs(position.x - this.map.goalZone.minX) +
      Math.abs(position.y - this.map.goalZone.minY);
    if (goalDistance <= ITEM_BOX_GOAL_EXCLUSION_RADIUS) {
      return false;
    }

    return true;
  }
}
