import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayerSession } from "../../src/core/player-session.js";
import { MatchAggregate } from "../../src/core/match.js";
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
    vi.useRealTimers();
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

  it("keeps ended results visible until the host explicitly resets the room", () => {
    vi.useFakeTimers();

    const mapRegistry = new MapRegistry();
    const roomService = new RoomService(new RevisionSync(), mapRegistry, {
      forcedPreviewMapId: getMapById("training-lap")!.mapId
    });
    const matchService = new MatchService(roomService, {
      countdownStepMs: 1_000,
      resultsDurationMs: 25
    });
    services.push(matchService);

    const created = roomService.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha"
    });

    const trainingLap = getMapById("training-lap");
    if (!trainingLap) {
      throw new Error("training-lap map is required");
    }

    roomService.setMatch(
      created.roomId,
      new MatchAggregate({
        matchId: "match-1",
        roomId: created.roomId,
        map: trainingLap
      })
    );

    (matchService as any).finishGame(created.roomId, createSink());
    vi.advanceTimersByTime(100);

    expect(roomService.getSnapshot(created.roomId).room.status).toBe("ended");
    expect(roomService.getSnapshot(created.roomId).match?.status).toBe("ended");

    vi.useRealTimers();
  });

  it("allows only the host to reset an ended room back to waiting", () => {
    const mapRegistry = new MapRegistry();
    const roomService = new RoomService(new RevisionSync(), mapRegistry, {
      forcedPreviewMapId: getMapById("training-lap")!.mapId
    });
    const matchService = new MatchService(roomService, {
      countdownStepMs: 1_000,
      resultsDurationMs: 25
    });
    services.push(matchService);

    const created = roomService.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha"
    });
    roomService.joinRoom({
      roomId: created.roomId,
      session: new PlayerSession({
        playerId: "guest",
        nickname: "게스트"
      })
    });

    const trainingLap = getMapById("training-lap");
    if (!trainingLap) {
      throw new Error("training-lap map is required");
    }

    roomService.setMatch(
      created.roomId,
      new MatchAggregate({
        matchId: "match-2",
        roomId: created.roomId,
        map: trainingLap
      })
    );
    roomService.requireRuntime(created.roomId).room.endRound();
    roomService.getMatch(created.roomId)?.end();
    roomService.syncRoomRevision(created.roomId);

    expect(() => matchService.resetRoomToWaiting(created.roomId, "guest", createSink())).toThrowError("HOST_ONLY");

    matchService.resetRoomToWaiting(created.roomId, "host", createSink());

    const resetSnapshot = roomService.getSnapshot(created.roomId);
    expect(resetSnapshot.room.status).toBe("waiting");
    expect(resetSnapshot.match).toBeNull();
    expect(resetSnapshot.previewMap).not.toBeNull();
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
