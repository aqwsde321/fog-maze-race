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
});
