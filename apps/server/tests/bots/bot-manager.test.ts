import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayerSession } from "../../src/core/player-session.js";
import { MatchAggregate } from "../../src/core/match.js";
import { MapRegistry } from "../../src/maps/map-registry.js";
import { MatchService } from "../../src/matches/match-service.js";
import { RoomService } from "../../src/rooms/room-service.js";
import { RevisionSync } from "../../src/ws/revision-sync.js";
import { BotManager } from "../../src/bots/bot-manager.js";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";
import type { Server } from "socket.io";

describe("BotManager item map behavior", () => {
  const services: MatchService[] = [];
  const botManagers: BotManager[] = [];

  afterEach(() => {
    vi.useRealTimers();
    services.forEach((service) => service.dispose());
    services.length = 0;
    botManagers.forEach((manager) => manager.dispose());
    botManagers.length = 0;
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
    services.push(matchService);

    const fakeIo = createFakeIo();
    const hostSession = new PlayerSession({
      playerId: "host",
      nickname: "호스트"
    });
    const sessions = new Map<string, PlayerSession>([["host", hostSession]]);
    const botManager = new BotManager(
      fakeIo as unknown as Server,
      roomService,
      matchService,
      sessions
    );
    botManagers.push(botManager);

    const created = roomService.createRoom({
      session: hostSession,
      name: "Alpha",
      mode: "bot_race"
    });

    botManager.addRoomBots({
      roomId: created.roomId,
      requestedBy: "host",
      bots: [{ nickname: "bot1", kind: "explore", strategy: "frontier" }]
    });

    const runtime = roomService.requireRuntime(created.roomId);
    const botMember = runtime.room.listMembers().find((member) => member.kind === "bot");
    expect(botMember).toBeDefined();

    const map = getMapById("kappa-trap");
    if (!map || !botMember) {
      throw new Error("kappa-trap map and bot member are required");
    }

    runtime.room.startCountdown("host");
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

function createFakeIo() {
  const roomEmitter = {
    emit: () => undefined
  };

  return {
    to: () => roomEmitter,
    emit: () => undefined,
    of: () => ({
      sockets: new Map(),
      adapter: {
        rooms: new Map()
      }
    })
  };
}
