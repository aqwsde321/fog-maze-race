import { afterEach, describe, expect, it } from "vitest";

import { PlayerSession } from "../../src/core/player-session.js";
import { MapRegistry } from "../../src/maps/map-registry.js";
import { MatchService, type MatchEventSink } from "../../src/matches/match-service.js";
import { RoomService } from "../../src/rooms/room-service.js";
import { RevisionSync } from "../../src/ws/revision-sync.js";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";

describe("MatchService start-zone movement", () => {
  const services: MatchService[] = [];

  afterEach(() => {
    services.forEach((service) => service.dispose());
    services.length = 0;
  });

  it("allows movement inside the start zone before playing and blocks entering the connector", () => {
    const mapRegistry = new MapRegistry();
    const roomService = new RoomService(new RevisionSync(), mapRegistry, {
      forcedPreviewMapId: getMapById("training-lap")!.mapId
    });
    const matchService = new MatchService(roomService, {
      countdownStepMs: 1_000,
      resultsDurationMs: 6_000
    });
    services.push(matchService);

    const created = roomService.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha"
    });

    matchService.move(created.roomId, "host", { direction: "right", inputSeq: 1 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 1, y: 1 });

    matchService.move(created.roomId, "host", { direction: "right", inputSeq: 2 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 2, y: 1 });

    matchService.move(created.roomId, "host", { direction: "right", inputSeq: 3 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 2, y: 1 });

    matchService.startGame(created.roomId, "host", createSink());
    expect(roomService.getSnapshot(created.roomId).room.status).toBe("countdown");
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 2, y: 1 });

    matchService.move(created.roomId, "host", { direction: "left", inputSeq: 4 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 1, y: 1 });

    matchService.move(created.roomId, "host", { direction: "right", inputSeq: 5 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 2, y: 1 });

    matchService.move(created.roomId, "host", { direction: "right", inputSeq: 6 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 2, y: 1 });
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
