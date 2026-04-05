import { randomUUID } from "node:crypto";

import type { Server } from "socket.io";

import type { RoomBotKind, RoomBotRequest, RoomExploreStrategy } from "@fog-maze-race/shared/contracts/realtime";
import type { MapView } from "@fog-maze-race/shared/contracts/snapshots";
import { samePosition, type Direction, type GridPosition } from "@fog-maze-race/shared/domain/grid-position";

import type { ServerLoadMonitor } from "../app/server-load-monitor.js";
import { PlayerSession } from "../core/player-session.js";
import { type MatchEventSink, MatchService } from "../matches/match-service.js";
import { RoomService } from "../rooms/room-service.js";
import { createRoomEventSink } from "../ws/handlers/recovery-handlers.js";
import {
  createExplorerMemory,
  decideExplorerMove,
  rememberBlockedMove,
  updateExplorerMemory
} from "./explorer-policy.js";

const DEFAULT_BOT_KIND: RoomBotKind = "explore";
const DEFAULT_EXPLORE_STRATEGY: RoomExploreStrategy = "frontier";
const DEFAULT_BOT_JOIN_MESSAGE = "들어왔다.";
const DEFAULT_BOT_FINISH_MESSAGE = "도착했다.";
const BOT_LOOP_INTERVAL_MS = 30;
const BOT_JOIN_MOVE_INTERVAL_MS = 180;
const BOT_EXPLORE_MOVE_INTERVAL_MS = 180;

type BotRuntime = {
  playerId: string;
  kind: RoomBotKind;
  strategy: RoomExploreStrategy | null;
  inputSeq: number;
  lastActionAt: number;
  finishAnnouncedMatchId: string | null;
  activeMatchId: string | null;
  explorerSeed: number;
  tickOrderSeed: number;
  explorerMemory: ReturnType<typeof createExplorerMemory>;
};

export class BotManager {
  private readonly bots = new Map<string, BotRuntime>();
  private readonly roomTickCursors = new Map<string, number>();
  private readonly roomSeededMatches = new Map<string, string>();
  private readonly loopHandle: ReturnType<typeof setInterval>;

  constructor(
    private readonly io: Server,
    private readonly roomService: RoomService,
    private readonly matchService: MatchService,
    private readonly sessions: Map<string, PlayerSession>,
    private readonly loadMonitor?: ServerLoadMonitor,
    private readonly random: () => number = Math.random
  ) {
    this.loopHandle = setInterval(() => {
      this.tickBots();
    }, BOT_LOOP_INTERVAL_MS);
    this.loopHandle.unref?.();
  }

  addRoomBots(input: {
    roomId: string;
    requestedBy: string;
    kind?: RoomBotKind;
    strategy?: RoomExploreStrategy;
    nicknames?: string[];
    bots?: RoomBotRequest[];
  }) {
    const runtime = this.roomService.requireRuntime(input.roomId);
    if (runtime.room.hostPlayerId !== input.requestedBy) {
      throw new Error("HOST_ONLY");
    }

    if (runtime.room.status !== "waiting") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    const normalizedBots = normalizeRequestedBots({
      requestedBots: input.bots,
      requestedNicknames: input.nicknames,
      kind: input.kind,
      strategy: input.strategy,
      existingNicknames: runtime.room.listMembers().map((member) => member.nickname)
    });
    if (normalizedBots.length === 0) {
      throw new Error("INVALID_NICKNAME");
    }

    const sink = this.createSink(input.roomId);

    for (const requestedBot of normalizedBots) {
      const kind = requestedBot.kind ?? DEFAULT_BOT_KIND;
      const nickname = requestedBot.nickname;
      const playerId = randomUUID();
      const session = new PlayerSession({
        playerId,
        nickname,
        kind: "bot"
      });
      this.sessions.set(playerId, session);
      this.roomService.joinRoom({
        roomId: input.roomId,
        session,
        role: "racer",
        exploreStrategy: kind === "explore" ? requestedBot.strategy ?? DEFAULT_EXPLORE_STRATEGY : null
      });
      this.roomService.sendChatMessage(input.roomId, playerId, DEFAULT_BOT_JOIN_MESSAGE);
      this.bots.set(playerId, {
        playerId,
        kind,
        strategy: kind === "explore" ? requestedBot.strategy ?? DEFAULT_EXPLORE_STRATEGY : null,
        inputSeq: 0,
        lastActionAt: 0,
        finishAnnouncedMatchId: null,
        activeMatchId: null,
        explorerSeed: 0,
        tickOrderSeed: 0,
        explorerMemory: createExplorerMemory()
      });
    }

    sink.emitRoomState({
      roomId: input.roomId,
      snapshot: this.roomService.getSnapshot(input.roomId)
    });
    sink.emitRoomListUpdate();
  }

  removeRoomBots(input: {
    roomId: string;
    requestedBy: string;
    playerIds?: string[];
  }) {
    const runtime = this.roomService.requireRuntime(input.roomId);
    if (runtime.room.hostPlayerId !== input.requestedBy) {
      throw new Error("HOST_ONLY");
    }

    if (runtime.room.status !== "waiting") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    const botPlayerIds = new Set(this.roomService.listBotPlayerIds(input.roomId));
    const targetPlayerIds = (input.playerIds?.length ? input.playerIds : [...botPlayerIds]).filter((playerId) =>
      botPlayerIds.has(playerId)
    );
    if (targetPlayerIds.length === 0) {
      return;
    }

    this.removeBotPlayers(input.roomId, targetPlayerIds);
  }

  removeBotsIfNoHumansRemain(roomId: string) {
    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime || this.roomService.hasHumanMembers(roomId)) {
      return;
    }

    const botPlayerIds = this.roomService.listBotPlayerIds(roomId);
    if (botPlayerIds.length === 0) {
      return;
    }

    this.removeBotPlayers(roomId, botPlayerIds);
  }

  dispose() {
    clearInterval(this.loopHandle);
    this.bots.clear();
  }

  private tickBots() {
    const now = Date.now();
    const botsByRoom = new Map<string, BotRuntime[]>();
    const orphanBots: BotRuntime[] = [];

    for (const bot of this.bots.values()) {
      const roomId = this.sessions.get(bot.playerId)?.currentRoomId;
      if (!roomId) {
        orphanBots.push(bot);
        continue;
      }

      const roomBots = botsByRoom.get(roomId);
      if (roomBots) {
        roomBots.push(bot);
        continue;
      }

      botsByRoom.set(roomId, [bot]);
    }

    for (const bot of orphanBots) {
      try {
        this.tickBot(bot, now);
      } catch {
        continue;
      }
    }

    for (const [roomId, roomBots] of botsByRoom) {
      this.assignRoomMatchSeeds(roomId, roomBots);

      const orderedBots = [...roomBots].sort((left, right) => {
        if (left.tickOrderSeed !== right.tickOrderSeed) {
          return left.tickOrderSeed - right.tickOrderSeed;
        }

        return left.playerId.localeCompare(right.playerId);
      });
      const cursor = this.roomTickCursors.get(roomId) ?? 0;
      const rotatedBots = rotateBots(orderedBots, cursor);

      for (const bot of rotatedBots) {
        try {
          this.tickBot(bot, now);
        } catch {
          continue;
        }
      }

      this.roomTickCursors.set(roomId, orderedBots.length <= 1 ? 0 : (cursor + 1) % orderedBots.length);
    }

    for (const roomId of this.roomTickCursors.keys()) {
      if (!botsByRoom.has(roomId)) {
        this.roomTickCursors.delete(roomId);
      }
    }

    for (const roomId of this.roomSeededMatches.keys()) {
      if (!botsByRoom.has(roomId)) {
        this.roomSeededMatches.delete(roomId);
      }
    }
  }

  private tickBot(bot: BotRuntime, now = Date.now()) {
    const session = this.sessions.get(bot.playerId);
    const roomId = session?.currentRoomId;
    if (!session || !roomId) {
      this.forgetBot(bot.playerId);
      return;
    }

    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime) {
      this.forgetBot(bot.playerId);
      return;
    }

    const member = runtime.room.getMember(bot.playerId);
    if (!member) {
      this.forgetBot(bot.playerId);
      return;
    }

    const snapshot = this.roomService.getSnapshot(roomId);
    const sink = this.createSink(roomId);
    const currentMatchId = snapshot.match?.matchId ?? null;
    if (bot.activeMatchId !== currentMatchId) {
      bot.activeMatchId = currentMatchId;
      bot.explorerMemory = createExplorerMemory();
    }

    if (
      member.state === "finished" &&
      currentMatchId &&
      bot.finishAnnouncedMatchId !== currentMatchId
    ) {
      this.roomService.sendChatMessage(roomId, bot.playerId, DEFAULT_BOT_FINISH_MESSAGE);
      bot.finishAnnouncedMatchId = currentMatchId;
      sink.emitRoomState({
        roomId,
        snapshot: this.roomService.getSnapshot(roomId)
      });
      return;
    }

    if (
      snapshot.room.status !== "playing" ||
      member.state !== "playing" ||
      !member.position ||
      !snapshot.match
    ) {
      if (snapshot.room.status !== "playing") {
        bot.lastActionAt = 0;
      }
      return;
    }

    const moveIntervalMs = resolveBotMoveIntervalMs(
      bot.kind === "join" ? BOT_JOIN_MOVE_INTERVAL_MS : BOT_EXPLORE_MOVE_INTERVAL_MS,
      this.roomService.getBotSpeedMultiplier(roomId)
    );
    if (now - bot.lastActionAt < moveIntervalMs) {
      return;
    }

    const nextDirection = this.decideNextDirection(bot, snapshot.match.map, member.position, snapshot);
    if (!nextDirection) {
      return;
    }

    bot.inputSeq += 1;
    bot.lastActionAt = now;

    const previousPosition = member.position;
    this.matchService.move(
      roomId,
      bot.playerId,
      {
        direction: nextDirection,
        inputSeq: bot.inputSeq
      },
      sink
    );

    if (bot.kind !== "explore") {
      return;
    }

    const nextMember = this.roomService.findRuntime(roomId)?.room.getMember(bot.playerId);
    if (nextMember?.position && samePosition(nextMember.position, previousPosition)) {
      bot.explorerMemory = rememberBlockedMove({
        memory: bot.explorerMemory,
        map: snapshot.match.map,
        position: previousPosition,
        direction: nextDirection
      });
    }
  }

  private assignRoomMatchSeeds(roomId: string, roomBots: BotRuntime[]) {
    const runtime = this.roomService.findRuntime(roomId);
    const currentMatchId = runtime?.match?.matchId ?? null;
    if (!currentMatchId) {
      this.roomSeededMatches.delete(roomId);
      return;
    }

    if (this.roomSeededMatches.get(roomId) === currentMatchId) {
      return;
    }

    const roomSeed = createMatchExplorerSeed(this.random);
    const exploreBots = roomBots.filter((bot) => bot.kind === "explore");
    const shuffledOffsets = createShuffledSeedOffsets(exploreBots.length, this.random);

    for (const bot of roomBots) {
      bot.tickOrderSeed = createTickOrderSeed(roomSeed, bot.playerId);
    }

    for (const [index, bot] of exploreBots.entries()) {
      bot.explorerSeed = roomSeed + (shuffledOffsets[index] ?? 0);
    }

    this.roomSeededMatches.set(roomId, currentMatchId);
  }

  private decideNextDirection(
    bot: BotRuntime,
    map: MapView,
    position: GridPosition,
    snapshot: ReturnType<RoomService["getSnapshot"]>
  ): Direction | null {
    if (bot.kind === "join") {
      return findPathToGoal(map, position)?.[0] ?? null;
    }

    bot.explorerMemory = updateExplorerMemory({
      previous: bot.explorerMemory,
      snapshot,
      selfPlayerId: bot.playerId
    });

    return decideExplorerMove({
      map,
      memory: bot.explorerMemory,
      position,
      seed: bot.explorerSeed,
      strategy: bot.strategy ?? DEFAULT_EXPLORE_STRATEGY
    })?.direction ?? null;
  }

  private createSink(roomId: string): MatchEventSink {
    return createRoomEventSink(this.io, this.roomService, roomId, this.loadMonitor);
  }

  private forgetBot(playerId: string) {
    this.bots.delete(playerId);
    this.sessions.delete(playerId);
  }

  private removeBotPlayers(roomId: string, playerIds: string[]) {
    const sink = this.createSink(roomId);

    for (const playerId of playerIds) {
      const session = this.sessions.get(playerId);
      if (!session) {
        this.bots.delete(playerId);
        continue;
      }

      if (session.currentRoomId !== roomId) {
        this.forgetBot(playerId);
        continue;
      }

      this.roomService.removePlayer(roomId, playerId);
      session.leave();
      this.forgetBot(playerId);
    }

    const runtime = this.roomService.findRuntime(roomId);
    if (!runtime) {
      sink.emitRoomListUpdate();
      return;
    }

    sink.emitRoomState({
      roomId,
      snapshot: this.roomService.getSnapshot(roomId)
    });
    sink.emitRoomListUpdate();
  }
}

function findPathToGoal(map: MapView, start: GridPosition) {
  const queue: Array<{ x: number; y: number; path: Direction[] }> = [{
    x: start.x,
    y: start.y,
    path: []
  }];
  const seen = new Set([`${start.x},${start.y}`]);
  const steps: Array<{ x: number; y: number; direction: Direction }> = [
    { x: 1, y: 0, direction: "right" },
    { x: -1, y: 0, direction: "left" },
    { x: 0, y: 1, direction: "down" },
    { x: 0, y: -1, direction: "up" }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (isGoalTile(map, current.x, current.y)) {
      return current.path;
    }

    for (const step of steps) {
      const nextX = current.x + step.x;
      const nextY = current.y + step.y;
      const key = `${nextX},${nextY}`;

      if (seen.has(key) || !isPassableTile(map, nextX, nextY)) {
        continue;
      }

      seen.add(key);
      queue.push({
        x: nextX,
        y: nextY,
        path: [...current.path, step.direction]
      });
    }
  }

  return null;
}

function isPassableTile(map: MapView, x: number, y: number) {
  return tileAt(map, x, y) !== "#";
}

function isGoalTile(map: MapView, x: number, y: number) {
  if (tileAt(map, x, y) === "G") {
    return true;
  }

  return (
    x >= map.goalZone.minX &&
    x <= map.goalZone.maxX &&
    y >= map.goalZone.minY &&
    y <= map.goalZone.maxY &&
    isPassableTile(map, x, y)
  );
}

function tileAt(map: MapView, x: number, y: number) {
  const row = map.tiles[y];
  if (!row || x < 0 || x >= row.length) {
    return "#";
  }

  return row[x] ?? "#";
}

function resolveBotMoveIntervalMs(baseIntervalMs: number, botSpeedMultiplier: number) {
  return Math.max(BOT_LOOP_INTERVAL_MS, Math.floor(baseIntervalMs / botSpeedMultiplier));
}

function createMatchExplorerSeed(random: () => number) {
  return Math.floor(random() * 0x1_0000_0000) >>> 0;
}

function createTickOrderSeed(seed: number, playerId: string) {
  let hash = seed >>> 0;
  for (const character of playerId) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0;
  }

  return hash >>> 0;
}

function createShuffledSeedOffsets(count: number, random: () => number) {
  const offsets = Array.from({ length: count }, (_value, index) => index);
  for (let index = offsets.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = offsets[index]!;
    offsets[index] = offsets[swapIndex]!;
    offsets[swapIndex] = current;
  }

  return offsets;
}

function rotateBots<T>(bots: T[], cursor: number) {
  if (bots.length <= 1) {
    return bots;
  }

  const offset = ((cursor % bots.length) + bots.length) % bots.length;
  return bots.slice(offset).concat(bots.slice(0, offset));
}

function normalizeRequestedBots(input: {
  requestedBots?: RoomBotRequest[];
  requestedNicknames?: string[];
  kind?: RoomBotKind;
  strategy?: RoomExploreStrategy;
  existingNicknames: string[];
}) {
  const used = new Set(input.existingNicknames.map((nickname) => nickname.trim().slice(0, 5)).filter(Boolean));
  const resolved: Array<{ nickname: string; kind: RoomBotKind; strategy?: RoomExploreStrategy }> = [];
  let fallbackIndex = 1;
  const requestedBots =
    input.requestedBots && input.requestedBots.length > 0
      ? input.requestedBots
      : (input.requestedNicknames ?? []).map((nickname) => ({
          nickname,
          kind: input.kind,
          strategy: input.strategy
        }));

  for (const requestedBot of requestedBots) {
    const kind = requestedBot.kind ?? input.kind ?? DEFAULT_BOT_KIND;
    const strategy = kind === "explore"
      ? requestedBot.strategy ?? input.strategy ?? DEFAULT_EXPLORE_STRATEGY
      : undefined;
    const normalized = requestedBot.nickname.trim().slice(0, 5);
    if (normalized) {
      const unique = uniquifyNickname(normalized, used);
      used.add(unique);
      resolved.push({
        nickname: unique,
        kind,
        strategy
      });
      continue;
    }

    const fallback = createNextDefaultNickname(used, fallbackIndex);
    fallbackIndex = extractBotSuffix(fallback) + 1;
    used.add(fallback);
    resolved.push({
      nickname: fallback,
      kind,
      strategy
    });
  }

  return resolved;
}

function createNextDefaultNickname(used: Set<string>, initialIndex: number) {
  let index = Math.max(initialIndex, 1);
  while (index < 100) {
    const candidate = `bot${index}`.slice(0, 5);
    if (!used.has(candidate)) {
      return candidate;
    }
    index += 1;
  }

  return uniquifyNickname("bot", used);
}

function uniquifyNickname(rawNickname: string, used: Set<string>) {
  const nickname = rawNickname.slice(0, 5);
  if (!used.has(nickname)) {
    return nickname;
  }

  for (let suffixNumber = 2; suffixNumber < 100; suffixNumber += 1) {
    const suffix = String(suffixNumber);
    const prefixLength = Math.max(0, 5 - suffix.length);
    const candidate = `${nickname.slice(0, prefixLength)}${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return nickname;
}

function extractBotSuffix(nickname: string) {
  const suffix = nickname.match(/(\d+)$/)?.[1];
  return suffix ? Number.parseInt(suffix, 10) : 1;
}
