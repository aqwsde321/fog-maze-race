import { afterEach, describe, expect, it, vi } from "vitest";
import { movePosition, type Direction, type GridPosition } from "@fog-maze-race/shared/domain/grid-position";

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
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 0, y: 1 });

    matchService.move(created.roomId, "host", { direction: "left", inputSeq: 4 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 0, y: 1 });

    matchService.move(created.roomId, "host", { direction: "right", inputSeq: 5 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members[0]?.position).toEqual({ x: 1, y: 1 });

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

  it("spawns one item box per active racer when an item map starts", () => {
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

    matchService.startGame(created.roomId, "host", createSink());
    vi.advanceTimersByTime(120);

    const snapshot = roomService.getSnapshot(created.roomId);
    expect(snapshot.room.status).toBe("playing");
    expect(snapshot.match?.map.featureFlags?.itemBoxes).toBe(true);
    expect(snapshot.match?.itemBoxes).toHaveLength(4);
  });

  it("keeps a one-slot inventory and freezes another racer after an ice trap triggers", () => {
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
    roomService.joinRoom({
      roomId: created.roomId,
      session: new PlayerSession({
        playerId: "third",
        nickname: "세번째"
      })
    });

    matchService.startGame(created.roomId, "host", createSink());
    vi.advanceTimersByTime(120);

    const firstSnapshot = roomService.getSnapshot(created.roomId);
    const boxes = firstSnapshot.match?.itemBoxes ?? [];
    expect(boxes.length).toBeGreaterThanOrEqual(3);

    const hostBox = boxes[0]!;
    moveAlongPath(
      matchService,
      created.roomId,
      "host",
      findPath(firstSnapshot.match!.map, { x: 0, y: 1 }, hostBox.position, { avoidGoal: true })
    );

    let snapshot = roomService.getSnapshot(created.roomId);
    expect(snapshot.members.find((member) => member.playerId === "host")?.heldItemType).toBe("ice_trap");

    const guestBox = snapshot.match?.itemBoxes?.[0];
    if (!guestBox) {
      throw new Error("expected a remaining item box for the guest");
    }

    moveAlongPath(
      matchService,
      created.roomId,
      "guest",
      findPath(snapshot.match!.map, { x: 0, y: 1 }, guestBox.position, { avoidGoal: true })
    );

    snapshot = roomService.getSnapshot(created.roomId);
    expect(snapshot.members.find((member) => member.playerId === "guest")?.heldItemType).toBe("ice_trap");

    const remainingBox = snapshot.match?.itemBoxes?.[0];
    if (!remainingBox) {
      throw new Error("expected another item box for one-slot inventory test");
    }

    const hostPosition = snapshot.members.find((member) => member.playerId === "host")?.position;
    if (!hostPosition) {
      throw new Error("host position missing");
    }

    moveAlongPath(
      matchService,
      created.roomId,
      "host",
      findPath(snapshot.match!.map, hostPosition, remainingBox.position, { avoidGoal: true })
    );
    snapshot = roomService.getSnapshot(created.roomId);
    expect(snapshot.members.find((member) => member.playerId === "host")?.heldItemType).toBe("ice_trap");

    matchService.useItem(created.roomId, "host", createSink());
    snapshot = roomService.getSnapshot(created.roomId);
    const trapPosition = snapshot.members.find((member) => member.playerId === "host")?.position;
    if (!trapPosition) {
      throw new Error("trap position missing");
    }
    expect(snapshot.members.find((member) => member.playerId === "host")?.heldItemType ?? null).toBeNull();
    expect(snapshot.match?.traps?.[0]).toMatchObject({
      ownerPlayerId: "host",
      position: trapPosition,
      state: "arming"
    });

    matchService.move(created.roomId, "host", { direction: "right", inputSeq: 999 }, createSink());
    snapshot = roomService.getSnapshot(created.roomId);
    expect(snapshot.match?.traps?.[0]?.state).toBe("armed");

    const guestPosition = snapshot.members.find((member) => member.playerId === "guest")?.position;
    if (!guestPosition) {
      throw new Error("guest position missing");
    }

    const retreatDirection = findAdjacentWalkableDirection(snapshot.match!.map, trapPosition);
    if (!retreatDirection) {
      throw new Error("expected a walkable retreat step next to the trap");
    }

    roomService.requireRuntime(created.roomId).room.updateMemberPosition(
      "guest",
      movePosition(trapPosition, retreatDirection)
    );
    roomService.syncRoomRevision(created.roomId);
    matchService.move(
      created.roomId,
      "guest",
      { direction: reverseDirection(retreatDirection), inputSeq: 2_001 },
      createSink()
    );

    snapshot = roomService.getSnapshot(created.roomId);
    const frozenGuest = snapshot.members.find((member) => member.playerId === "guest");
    expect(frozenGuest?.frozenUntil).not.toBeNull();
    expect(snapshot.match?.traps).toHaveLength(0);

    const frozenPosition = frozenGuest?.position;
    if (!frozenPosition) {
      throw new Error("frozen guest position missing");
    }

    matchService.move(created.roomId, "guest", { direction: "right", inputSeq: 1_000 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members.find((member) => member.playerId === "guest")?.position).toEqual(frozenPosition);

    vi.advanceTimersByTime(1_500);
    matchService.move(created.roomId, "guest", { direction: "right", inputSeq: 1_001 }, createSink());
    expect(roomService.getSnapshot(created.roomId).members.find((member) => member.playerId === "guest")?.position).not.toEqual(frozenPosition);
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

function moveAlongPath(
  matchService: MatchService,
  roomId: string,
  playerId: string,
  path: Array<"up" | "down" | "left" | "right">
) {
  path.forEach((direction, index) => {
    matchService.move(roomId, playerId, { direction, inputSeq: index + 1 }, createSink());
  });
}

function findPath(
  map: NonNullable<ReturnType<RoomService["getSnapshot"]>["match"]>["map"],
  start: GridPosition,
  target: GridPosition,
  options?: { avoidGoal?: boolean }
) {
  const queue = [{ position: start, path: [] as Array<"up" | "down" | "left" | "right"> }];
  const visited = new Set([`${start.x},${start.y}`]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.position.x === target.x && current.position.y === target.y) {
      return current.path;
    }

    for (const [direction, nextPosition] of [
      ["up", movePosition(current.position, "up")],
      ["down", movePosition(current.position, "down")],
      ["left", movePosition(current.position, "left")],
      ["right", movePosition(current.position, "right")]
    ] as const) {
      if (
        nextPosition.x < 0 ||
        nextPosition.y < 0 ||
        nextPosition.x >= map.width ||
        nextPosition.y >= map.height
      ) {
        continue;
      }

      const tile = map.tiles[nextPosition.y]?.[nextPosition.x];
      if (tile === "#" || tile === " ") {
        continue;
      }

      const isGoalTile =
        nextPosition.x >= map.goalZone.minX &&
        nextPosition.x <= map.goalZone.maxX &&
        nextPosition.y >= map.goalZone.minY &&
        nextPosition.y <= map.goalZone.maxY;
      if (
        options?.avoidGoal &&
        isGoalTile &&
        (nextPosition.x !== target.x || nextPosition.y !== target.y)
      ) {
        continue;
      }

      const key = `${nextPosition.x},${nextPosition.y}`;
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({
        position: nextPosition,
        path: [...current.path, direction]
      });
    }
  }

  throw new Error(`No path from ${start.x},${start.y} to ${target.x},${target.y}`);
}

function findAdjacentWalkableDirection(
  map: NonNullable<ReturnType<RoomService["getSnapshot"]>["match"]>["map"],
  position: GridPosition
): Direction | null {
  for (const direction of ["up", "down", "left", "right"] as const) {
    const nextPosition = movePosition(position, direction);
    if (
      nextPosition.x < 0 ||
      nextPosition.y < 0 ||
      nextPosition.x >= map.width ||
      nextPosition.y >= map.height
    ) {
      continue;
    }

    const tile = map.tiles[nextPosition.y]?.[nextPosition.x];
    const isGoalTile =
      nextPosition.x >= map.goalZone.minX &&
      nextPosition.x <= map.goalZone.maxX &&
      nextPosition.y >= map.goalZone.minY &&
      nextPosition.y <= map.goalZone.maxY;
    if (tile === "#" || tile === " " || isGoalTile) {
      continue;
    }

    return direction;
  }

  return null;
}

function reverseDirection(direction: Direction): Direction {
  switch (direction) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}
