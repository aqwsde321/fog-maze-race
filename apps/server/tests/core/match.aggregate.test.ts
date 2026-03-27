import { describe, expect, it } from "vitest";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";

import { MatchAggregate } from "../../src/core/match.js";

describe("MatchAggregate", () => {
  it("records each finisher's elapsed race time from the match start", () => {
    const trainingLap = getMapById("training-lap");
    if (!trainingLap) {
      throw new Error("training-lap map is required");
    }

    const match = new MatchAggregate({
      matchId: "match-1",
      roomId: "room-1",
      map: trainingLap
    });

    match.setCountdownValue(0, 10_000);

    const rank = match.markFinished(
      {
        playerId: "player-1",
        nickname: "호1",
        color: "#38bdf8",
        position: { x: 8, y: 1 }
      },
      12_345
    );

    expect(rank).toBe(1);
    expect(match.results).toEqual([
      expect.objectContaining({
        playerId: "player-1",
        outcome: "finished",
        rank: 1,
        elapsedMs: 2_345
      })
    ]);
  });
});
