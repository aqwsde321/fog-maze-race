import type { Server } from "socket.io";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchAggregate } from "../../src/core/match.js";
import { PlayerSession } from "../../src/core/player-session.js";
import { BotManager } from "../../src/bots/bot-manager.js";
import { MapRegistry } from "../../src/maps/map-registry.js";
import { MatchService, type MatchEventSink } from "../../src/matches/match-service.js";
import { RoomService } from "../../src/rooms/room-service.js";
import { RevisionSync } from "../../src/ws/revision-sync.js";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";

describe("BotManager", () => {
  const matchServices: MatchService[] = [];
  const botManagers: BotManager[] = [];

  afterEach(() => {
    botManagers.forEach((manager) => manager.dispose());
    matchServices.forEach((service) => service.dispose());
    botManagers.length = 0;
    matchServices.length = 0;
    vi.useRealTimers();
  });

  it("applies the room bot speed multiplier to automated bot movement cadence", () => {
    vi.useFakeTimers();

    const roomService = new RoomService(new RevisionSync(), new MapRegistry(), {
      forcedPreviewMapId: getMapById("training-lap")!.mapId
    });
    const matchService = new MatchService(roomService, {
      countdownStepMs: 25,
      resultsDurationMs: 60
    });
    const sessions = new Map<string, PlayerSession>();
    const hostOne = new PlayerSession({
      playerId: "host-1",
      nickname: "호1"
    });
    const hostTwo = new PlayerSession({
      playerId: "host-2",
      nickname: "호2"
    });
    sessions.set(hostOne.playerId, hostOne);
    sessions.set(hostTwo.playerId, hostTwo);

    const botManager = new BotManager(createServerStub(), roomService, matchService, sessions);
    matchServices.push(matchService);
    botManagers.push(botManager);

    const normalSpeedRoom = roomService.createRoom({
      session: hostOne,
      name: "x1",
      mode: "bot_race"
    });
    const boostedSpeedRoom = roomService.createRoom({
      session: hostTwo,
      name: "x6",
      mode: "bot_race"
    });

    roomService.setBotSpeedMultiplier(boostedSpeedRoom.roomId, hostTwo.playerId, 6);
    botManager.addRoomBots({
      roomId: normalSpeedRoom.roomId,
      requestedBy: hostOne.playerId,
      kind: "join",
      nicknames: ["slow"]
    });
    botManager.addRoomBots({
      roomId: boostedSpeedRoom.roomId,
      requestedBy: hostTwo.playerId,
      kind: "join",
      nicknames: ["fast"]
    });

    matchService.startGame(normalSpeedRoom.roomId, hostOne.playerId, createSink());
    matchService.startGame(boostedSpeedRoom.roomId, hostTwo.playerId, createSink());

    vi.advanceTimersByTime(95);
    vi.advanceTimersByTime(120);
    vi.advanceTimersByTime(60);

    const slowBot = roomService.getSnapshot(normalSpeedRoom.roomId).members.find((member) => member.nickname === "slow");
    const fastBot = roomService.getSnapshot(boostedSpeedRoom.roomId).members.find((member) => member.nickname === "fast");

    expect(slowBot?.position).toEqual({ x: 1, y: 1 });
    expect(fastBot?.position).toEqual({ x: 6, y: 1 });
  });

  it("rerolls explorer seeds for each new match instead of fixing them to nicknames", () => {
    vi.useFakeTimers();

    const roomService = new RoomService(new RevisionSync(), new MapRegistry(), {
      forcedPreviewMapId: getMapById("training-lap")!.mapId
    });
    const matchService = new MatchService(roomService, {
      countdownStepMs: 25,
      resultsDurationMs: 60
    });
    const sessions = new Map<string, PlayerSession>();
    const host = new PlayerSession({
      playerId: "host",
      nickname: "호1"
    });
    sessions.set(host.playerId, host);

    const random = vi.fn<() => number>()
      .mockReturnValueOnce(0.125)
      .mockReturnValueOnce(0.875);
    const botManager = new BotManager(createServerStub(), roomService, matchService, sessions, undefined, random);
    matchServices.push(matchService);
    botManagers.push(botManager);

    const created = roomService.createRoom({
      session: host,
      name: "seed",
      mode: "bot_race"
    });
    botManager.addRoomBots({
      roomId: created.roomId,
      requestedBy: host.playerId,
      kind: "explore",
      nicknames: ["bot15"]
    });

    const botPlayerId = roomService.getSnapshot(created.roomId).members.find((member) => member.nickname === "bot15")?.playerId;
    if (!botPlayerId) {
      throw new Error("bot player not found");
    }

    matchService.startGame(created.roomId, host.playerId, createSink());
    vi.advanceTimersByTime(30);
    const firstSeed = readBotRuntime(botManager, botPlayerId).explorerSeed;

    matchService.forceEnd(created.roomId, host.playerId, createSink());
    matchService.resetRoomToWaiting(created.roomId, host.playerId, createSink());
    vi.advanceTimersByTime(30);

    matchService.startGame(created.roomId, host.playerId, createSink());
    vi.advanceTimersByTime(30);
    const secondSeed = readBotRuntime(botManager, botPlayerId).explorerSeed;

    expect(random).toHaveBeenCalledTimes(2);
    expect(firstSeed).not.toBe(secondSeed);
  });

  it("distributes unique consecutive explorer seeds across bots in the same match", () => {
    vi.useFakeTimers();

    const roomService = new RoomService(new RevisionSync(), new MapRegistry(), {
      forcedPreviewMapId: getMapById("training-lap")!.mapId
    });
    const matchService = new MatchService(roomService, {
      countdownStepMs: 25,
      resultsDurationMs: 60
    });
    const sessions = new Map<string, PlayerSession>();
    const host = new PlayerSession({
      playerId: "host-seeds",
      nickname: "호1"
    });
    sessions.set(host.playerId, host);

    const random = vi.fn<() => number>().mockReturnValue(0.5);
    const botManager = new BotManager(createServerStub(), roomService, matchService, sessions, undefined, random);
    matchServices.push(matchService);
    botManagers.push(botManager);

    const created = roomService.createRoom({
      session: host,
      name: "seed-pack",
      mode: "bot_race"
    });
    botManager.addRoomBots({
      roomId: created.roomId,
      requestedBy: host.playerId,
      kind: "explore",
      nicknames: ["bot1", "bot2", "bot3", "bot4", "bot5"]
    });

    matchService.startGame(created.roomId, host.playerId, createSink());
    vi.advanceTimersByTime(30);

    const botPlayerIds = roomService.getSnapshot(created.roomId).members
      .filter((member) => member.nickname.startsWith("bot"))
      .map((member) => member.playerId);
    const seeds = botPlayerIds.map((playerId) => readBotRuntime(botManager, playerId).explorerSeed);
    const minSeed = Math.min(...seeds);
    const normalizedSeeds = [...seeds].sort((left, right) => left - right).map((seed) => seed - minSeed);

    expect(new Set(seeds).size).toBe(5);
    expect(normalizedSeeds).toEqual([0, 1, 2, 3, 4]);
  });

  it("rotates bot processing order within a room instead of always favoring insertion order", () => {
    const sessions = new Map<string, PlayerSession>();
    const botManager = new BotManager(
      createServerStub(),
      {
        findRuntime: () => null
      } as unknown as RoomService,
      {} as MatchService,
      sessions
    );
    botManagers.push(botManager);

    const first = new PlayerSession({ playerId: "bot-1", nickname: "bot1", kind: "bot" });
    const second = new PlayerSession({ playerId: "bot-2", nickname: "bot2", kind: "bot" });
    const third = new PlayerSession({ playerId: "bot-3", nickname: "bot3", kind: "bot" });
    first.currentRoomId = "room-1";
    second.currentRoomId = "room-1";
    third.currentRoomId = "room-1";
    sessions.set(first.playerId, first);
    sessions.set(second.playerId, second);
    sessions.set(third.playerId, third);

    const internals = botManager as unknown as {
      bots: Map<string, { playerId: string; tickOrderSeed: number }>;
      tickBot: (bot: { playerId: string; tickOrderSeed: number }, now?: number) => void;
      tickBots: () => void;
    };
    internals.bots.set(first.playerId, { playerId: first.playerId, tickOrderSeed: 30 });
    internals.bots.set(second.playerId, { playerId: second.playerId, tickOrderSeed: 10 });
    internals.bots.set(third.playerId, { playerId: third.playerId, tickOrderSeed: 20 });

    const orders: string[][] = [];
    internals.tickBot = (bot) => {
      orders[orders.length - 1]?.push(bot.playerId);
    };

    orders.push([]);
    internals.tickBots();
    orders.push([]);
    internals.tickBots();
    orders.push([]);
    internals.tickBots();

    expect(orders).toEqual([
      ["bot-2", "bot-3", "bot-1"],
      ["bot-3", "bot-1", "bot-2"],
      ["bot-1", "bot-2", "bot-3"]
    ]);
  });

  it("places an ice trap automatically when an explore bot is holding one in the maze", () => {
    vi.useFakeTimers();

    const mapRegistry = new MapRegistry();
    const roomService = new RoomService(new RevisionSync(), mapRegistry, {
      forcedPreviewMapId: getMapById("kappa-trap")!.mapId
    });
    const matchService = new MatchService(roomService, {
      countdownStepMs: 25,
      resultsDurationMs: 60,
      random: () => 0
    });
    const hostSession = new PlayerSession({
      playerId: "host",
      nickname: "호스트"
    });
    const sessions = new Map<string, PlayerSession>([[hostSession.playerId, hostSession]]);
    const botManager = new BotManager(createServerStub(), roomService, matchService, sessions);
    matchServices.push(matchService);
    botManagers.push(botManager);

    const created = roomService.createRoom({
      session: hostSession,
      name: "Alpha",
      mode: "bot_race"
    });

    botManager.addRoomBots({
      roomId: created.roomId,
      requestedBy: hostSession.playerId,
      bots: [{ nickname: "bot1", kind: "explore", strategy: "frontier" }]
    });

    const runtime = roomService.requireRuntime(created.roomId);
    const botMember = runtime.room.listMembers().find((member) => member.kind === "bot");
    const map = getMapById("kappa-trap");
    if (!map || !botMember) {
      throw new Error("kappa-trap map and bot member are required");
    }

    runtime.room.startCountdown(hostSession.playerId);
    runtime.room.beginPlaying();
    runtime.room.markMembersPlaying();
    const match = new MatchAggregate({
      matchId: "match-1",
      roomId: created.roomId,
      map: {
        ...map,
        visibilityRadius: roomService.getVisibilityRadius(created.roomId)
      }
    });
    match.setCountdownValue(0, Date.now());
    roomService.setMatch(created.roomId, match);
    runtime.room.updateMemberPosition(botMember.playerId, { x: map.mazeZone.minX + 3, y: map.mazeZone.minY + 1 });
    runtime.room.setHeldItem(botMember.playerId, "ice_trap");
    roomService.syncRoomRevision(created.roomId);

    vi.advanceTimersByTime(250);

    const snapshot = roomService.getSnapshot(created.roomId);
    expect(snapshot.members.find((member) => member.playerId === botMember.playerId)?.heldItemType).toBeNull();
    expect(snapshot.match?.traps).toHaveLength(1);
    expect(snapshot.match?.traps?.[0]).toMatchObject({
      ownerPlayerId: botMember.playerId,
      state: "armed"
    });
  });
});

function createSink(): MatchEventSink {
  return {
    emitRoomState: () => {},
    emitCountdown: () => {},
    emitPlayerMoved: () => {},
    emitPlayerFinished: () => {},
    emitGameStarting: () => {},
    emitGameEnded: () => {},
    emitRoomListUpdate: () => {}
  };
}

function createServerStub() {
  const rooms = new Map<string, Set<string>>();
  return {
    emit: () => undefined,
    to: () => ({
      emit: () => undefined
    }),
    of: () => ({
      sockets: new Map(),
      adapter: {
        rooms
      }
    })
  } as unknown as Server;
}

function readBotRuntime(botManager: BotManager, playerId: string) {
  const bots = (botManager as unknown as { bots: Map<string, { explorerSeed: number }> }).bots;
  const runtime = bots.get(playerId);
  if (!runtime) {
    throw new Error(`bot runtime not found: ${playerId}`);
  }

  return runtime;
}
