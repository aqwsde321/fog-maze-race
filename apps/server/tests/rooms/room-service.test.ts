import { describe, expect, it } from "vitest";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";

import { RevisionSync } from "../../src/ws/revision-sync.js";
import { RoomService } from "../../src/rooms/room-service.js";
import { PlayerSession } from "../../src/core/player-session.js";
import { MatchAggregate } from "../../src/core/match.js";
import { MapRegistry } from "../../src/maps/map-registry.js";

describe("RoomService", () => {
  it("assigns player colors and marker shapes from the server palette", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
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
    expect(shapes).toEqual(["circle", "square"]);
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

  it("cycles marker shapes deterministically by join order", () => {
    const service = new RoomService(new RevisionSync(), new MapRegistry());
    const room = service.createRoom({
      session: new PlayerSession({
        playerId: "p0",
        nickname: "P0"
      }),
      name: "Alpha"
    });

    for (let index = 1; index < 7; index += 1) {
      service.joinRoom({
        roomId: room.roomId,
        session: new PlayerSession({
          playerId: `p${index}`,
          nickname: `P${index}`
        })
      });
    }

    const shapes = service.getSnapshot(room.roomId).members.map((member) => member.shape);

    expect(shapes).toEqual([
      "circle",
      "square",
      "diamond",
      "triangle",
      "triangle-down",
      "circle",
      "square"
    ]);
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
