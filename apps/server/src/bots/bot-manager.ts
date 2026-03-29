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
  createExplorerSeed,
  decideExplorerMove,
  rememberBlockedMove,
  updateExplorerMemory
} from "./explorer-policy.js";

const DEFAULT_BOT_KIND: RoomBotKind = "explore";
const DEFAULT_EXPLORE_STRATEGY: RoomExploreStrategy = "frontier";
const DEFAULT_BOT_JOIN_MESSAGE = "들어왔다.";
const DEFAULT_BOT_FINISH_MESSAGE = "도착했다.";
const BOT_LOOP_INTERVAL_MS = 30;
const BOT_JOIN_MOVE_INTERVAL_MS = 120;
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
  explorerMemory: ReturnType<typeof createExplorerMemory>;
};

export class BotManager {
  private readonly bots = new Map<string, BotRuntime>();
  private readonly loopHandle: ReturnType<typeof setInterval>;

  constructor(
    private readonly io: Server,
    private readonly roomService: RoomService,
    private readonly matchService: MatchService,
    private readonly sessions: Map<string, PlayerSession>,
    private readonly loadMonitor?: ServerLoadMonitor
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
        explorerSeed: createExplorerSeed(nickname),
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
    for (const bot of this.bots.values()) {
      try {
        this.tickBot(bot);
      } catch {
        continue;
      }
    }
  }

  private tickBot(bot: BotRuntime) {
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

    const now = Date.now();
    const moveIntervalMs = bot.kind === "join" ? BOT_JOIN_MOVE_INTERVAL_MS : BOT_EXPLORE_MOVE_INTERVAL_MS;
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
