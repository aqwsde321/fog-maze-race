import { describe, expect, it } from "vitest";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";

import { MatchAggregate } from "../../src/core/match.js";
import { RoomAggregate } from "../../src/core/room.js";
import { forceEndMatch } from "../../src/rooms/force-end-match.js";

describe("forceEndMatch", () => {
  it("excludes bot-race spectators from forced end results", () => {
    const map = getMapById("training-lap");
    if (!map) {
      throw new Error("training-lap map is required");
    }

    const room = new RoomAggregate({
      roomId: "room-1",
      name: "Bot Only",
      hostPlayerId: "host",
      mode: "bot_race"
    });

    room.join({
      playerId: "host",
      nickname: "호스트",
      kind: "human",
      color: "#fb7185",
      shape: "circle",
      role: "spectator",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "bot-1",
      nickname: "bot1",
      kind: "bot",
      color: "#38bdf8",
      shape: "square",
      role: "racer",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "viewer",
      nickname: "관전",
      kind: "human",
      color: "#22c55e",
      shape: "diamond",
      role: "spectator",
      state: "waiting",
      position: null
    });

    room.seedMatchPositions(map.startSlots);
    room.beginPlaying();
    room.markMembersPlaying();

    const match = new MatchAggregate({
      matchId: "match-1",
      roomId: room.roomId,
      map
    });
    match.setCountdownValue(0);

    forceEndMatch(room, match);

    expect(match.results).toEqual([
      expect.objectContaining({
        playerId: "bot-1",
        outcome: "left"
      })
    ]);
  });
});
