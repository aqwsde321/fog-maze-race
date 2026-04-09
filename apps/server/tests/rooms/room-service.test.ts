import { describe, expect, it } from "vitest";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";
import { PLAYER_MARKER_SHAPES } from "@fog-maze-race/shared/domain/player-marker-shape";

import { RevisionSync } from "../../src/ws/revision-sync.js";
import { RoomService } from "../../src/rooms/room-service.js";
import { PlayerSession } from "../../src/core/player-session.js";
import { MatchAggregate } from "../../src/core/match.js";
import { MapRegistry } from "../../src/maps/map-registry.js";

describe("RoomService", () => {
  it("assigns player colors and marker shapes from the server palette", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry(), {
      random: () => 0
    });
    const hostSession = new PlayerSession({
      playerId: "host",
      nickname: "호스트"
    });

    const created = service.createRoom({
      session: hostSession,
      name: "Alpha"
    });

    const guestSession = new PlayerSession({
      playerId: "guest",
      nickname: "게스트"
    });
    service.joinRoom({
      roomId: created.roomId,
      session: guestSession
    });

    const members = service.getSnapshot(created.roomId).members;
    const colors = members.map((member) => member.color);
    const shapes = members.map((member) => member.shape);

    expect(colors).toEqual(["#ff355e", "#ff8a00"]);
    expect(shapes).toEqual(["square", "diamond"]);
    expect(colors).not.toContain("#22d3ee");
    expect(colors).not.toContain("#14b8a6");
    expect(colors).not.toContain("#facc15");
    expect(colors).not.toContain("#64748b");
  });

  it("keeps the first 15 assigned player colors unique", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const room = service.createRoom({
      session: new PlayerSession({
        playerId: "p0",
        nickname: "P0"
      }),
      name: "Alpha"
    });

    for (let index = 1; index < 15; index += 1) {
      service.joinRoom({
        roomId: room.roomId,
        session: new PlayerSession({
          playerId: `p${index}`,
          nickname: `P${index}`
        })
      });
    }

    const colors = service.getSnapshot(room.roomId).members.map((member) => member.color);
    expect(new Set(colors).size).toBe(15);
  });

  it("assigns the same preview start position to every racer while waiting", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry(), {
      forcedPreviewMapId: getMapById("training-lap")!.mapId
    });
    const created = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha"
    });

    service.joinRoom({
      roomId: created.roomId,
      session: new PlayerSession({
        playerId: "guest",
        nickname: "게스트"
      })
    });

    const snapshot = service.getSnapshot(created.roomId);
    const sharedStartPosition = snapshot.previewMap?.startSlots[0];

    expect(sharedStartPosition).toEqual({ x: 0, y: 1 });
    expect(snapshot.members[0]?.position).toEqual(sharedStartPosition);
    expect(snapshot.members[1]?.position).toEqual(sharedStartPosition);
  });

  it("starts rooms in normal game mode and switches preview maps when the host changes to item mode", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry(), {
      random: () => 0
    });

    const created = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "아이템전"
    });

    expect(created.snapshot.room.gameMode).toBe("normal");
    expect(created.snapshot.previewMap?.featureFlags?.itemBoxes ?? false).toBe(false);

    const updated = service.setGameMode(created.roomId, "host", "item");

    expect(updated.room.gameMode).toBe("item");
    expect(updated.previewMap?.mapId).toBe("kappa-trap");
    expect(updated.previewMap?.featureFlags?.itemBoxes).toBe(true);
  });

  it("reuses only colors that are no longer occupied when a player leaves and rejoins", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry(), {
      random: () => 0
    });
    const room = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "Host"
      }),
      name: "Alpha"
    });

    service.joinRoom({
      roomId: room.roomId,
      session: new PlayerSession({
        playerId: "guest-1",
        nickname: "Guest1"
      })
    });
    service.joinRoom({
      roomId: room.roomId,
      session: new PlayerSession({
        playerId: "guest-2",
        nickname: "Guest2"
      })
    });

    const beforeLeave = service.getSnapshot(room.roomId).members.map((member) => member.color);
    expect(beforeLeave).toEqual(["#ff355e", "#ff8a00", "#ff2bd6"]);

    service.removePlayer(room.roomId, "guest-1");

    service.joinRoom({
      roomId: room.roomId,
      session: new PlayerSession({
        playerId: "guest-3",
        nickname: "Guest3"
      })
    });

    const afterRejoin = service.getSnapshot(room.roomId).members.map((member) => member.color);
    expect(afterRejoin).toEqual(["#ff355e", "#ff2bd6", "#ff8a00"]);
    expect(new Set(afterRejoin).size).toBe(3);
  });

  it("distributes marker shapes evenly across 15 players", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const room = service.createRoom({
      session: new PlayerSession({
        playerId: "p0",
        nickname: "P0"
      }),
      name: "Alpha"
    });

    for (let index = 1; index < 15; index += 1) {
      service.joinRoom({
        roomId: room.roomId,
        session: new PlayerSession({
          playerId: `p${index}`,
          nickname: `P${index}`
        })
      });
    }

    const shapes = service.getSnapshot(room.roomId).members.map((member) => member.shape);
    const counts = new Map(PLAYER_MARKER_SHAPES.map((shape) => [shape, 0]));

    for (const shape of shapes) {
      counts.set(shape, (counts.get(shape) ?? 0) + 1);
    }

    expect(shapes).toHaveLength(15);
    expect(new Set(shapes).size).toBe(PLAYER_MARKER_SHAPES.length);
    expect([...counts.values()]).toEqual([3, 3, 3, 3, 3]);
  });

  it("includes the result display duration in ended match snapshots", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry(), { resultsDurationMs: 4_500 });
    const hostSession = new PlayerSession({
      playerId: "host",
      nickname: "호스트"
    });

    const created = service.createRoom({
      session: hostSession,
      name: "Alpha"
    });

    const match = new MatchAggregate({
      matchId: "match-1",
      roomId: created.roomId,
      map: getMapById("training-lap")!
    });
    match.end();
    service.setMatch(created.roomId, match);

    const snapshot = service.getSnapshot(created.roomId);

    expect(snapshot.match?.resultsDurationMs).toBe(4_500);
  });

  it("starts new rooms with a 5x5 visibility window by default", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const created = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha"
    });

    expect(created.snapshot.room.visibilitySize).toBe(5);
    expect(created.snapshot.previewMap?.visibilityRadius).toBe(2);
  });

  it("starts new rooms with x1 bot speed by default", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const created = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha",
      mode: "bot_race"
    });

    expect(created.snapshot.room.botSpeedMultiplier).toBe(1);
  });

  it("lets only the host change the room visibility size while waiting", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const created = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha"
    });

    service.joinRoom({
      roomId: created.roomId,
      session: new PlayerSession({
        playerId: "guest",
        nickname: "게스트"
      })
    });

    expect(() => service.setVisibilitySize(created.roomId, "guest", 3)).toThrowError("HOST_ONLY");

    const updated = service.setVisibilitySize(created.roomId, "host", 5);

    expect(updated.room.visibilitySize).toBe(5);
    expect(updated.previewMap?.visibilityRadius).toBe(2);
  });

  it("lets only the host change the bot speed multiplier before and during a bot race", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const created = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha",
      mode: "bot_race"
    });

    service.joinRoom({
      roomId: created.roomId,
      session: new PlayerSession({
        playerId: "guest",
        nickname: "게스트"
      })
    });

    expect(() => service.setBotSpeedMultiplier(created.roomId, "guest", 6)).toThrowError("HOST_ONLY");

    const updated = service.setBotSpeedMultiplier(created.roomId, "host", 6);

    expect(updated.room.botSpeedMultiplier).toBe(6);

    const runtime = service.requireRuntime(created.roomId);
    runtime.room.beginPlaying();

    const boostedWhilePlaying = service.setBotSpeedMultiplier(created.roomId, "host", 3);
    expect(boostedWhilePlaying.room.botSpeedMultiplier).toBe(3);

    runtime.room.endRound();
    expect(() => service.setBotSpeedMultiplier(created.roomId, "host", 2)).toThrowError("ROOM_NOT_JOINABLE");
  });

  it("includes room chat messages in snapshots and normalizes the submitted text", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const created = service.createRoom({
      session: new PlayerSession({
        playerId: "host",
        nickname: "호스트"
      }),
      name: "Alpha"
    });

    service.sendChatMessage(created.roomId, "host", "  같이 갑시다   ");

    const snapshot = service.getSnapshot(created.roomId);

    expect(snapshot.chat).toHaveLength(1);
    expect(snapshot.chat[0]).toMatchObject({
      playerId: "host",
      nickname: "호스트",
      content: "같이 갑시다",
      color: "#ff355e"
    });
  });

  it("adds three fake goal tiles only for normal rooms", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry(), {
      forcedPreviewMapId: getMapById("training-lap")!.mapId,
      random: () => 0
    });
    const normalRoom = service.createRoom({
      session: new PlayerSession({
        playerId: "normal-host",
        nickname: "일반방장"
      }),
      name: "일반방",
      mode: "normal"
    });
    const botRaceRoom = service.createRoom({
      session: new PlayerSession({
        playerId: "bot-host",
        nickname: "봇방장"
      }),
      name: "봇방",
      mode: "bot_race"
    });

    expect(normalRoom.snapshot.previewMap?.fakeGoalTiles).toHaveLength(3);
    expect(normalRoom.snapshot.previewMap?.fakeGoalTiles).not.toContainEqual({
      x: normalRoom.snapshot.previewMap?.goalZone.minX,
      y: normalRoom.snapshot.previewMap?.goalZone.minY
    });
    expect(botRaceRoom.snapshot.previewMap?.fakeGoalTiles ?? []).toHaveLength(0);
  });
});
