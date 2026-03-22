import { describe, expect, it } from "vitest";

import { RevisionSync } from "../../src/ws/revision-sync.js";
import { RoomService } from "../../src/rooms/room-service.js";
import { PlayerSession } from "../../src/core/player-session.js";
import { MatchAggregate } from "../../src/core/match.js";

describe("RoomService", () => {
  it("assigns player colors from the non-tile palette", () => {
    const service = new RoomService(new RevisionSync());
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

    const colors = service.getSnapshot(created.roomId).members.map((member) => member.color);

    expect(colors).toEqual(["#ff5c7a", "#ff8a5b"]);
    expect(colors).not.toContain("#22d3ee");
    expect(colors).not.toContain("#14b8a6");
    expect(colors).not.toContain("#facc15");
    expect(colors).not.toContain("#64748b");
  });

  it("includes the result display duration in ended match snapshots", () => {
    const service = new RoomService(new RevisionSync(), { resultsDurationMs: 4_500 });
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
      mapId: "training-lap"
    });
    match.end();
    service.setMatch(created.roomId, match);

    const snapshot = service.getSnapshot(created.roomId);

    expect(snapshot.match?.resultsDurationMs).toBe(4_500);
  });
});
