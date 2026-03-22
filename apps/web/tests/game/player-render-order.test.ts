import { describe, expect, it } from "vitest";

import { getPlayerRenderOrder } from "../../src/game/player-render-order.js";

describe("getPlayerRenderOrder", () => {
  it("renders the local player last so overlapping players do not cover them", () => {
    const ordered = getPlayerRenderOrder(
      [
        {
          playerId: "self",
          nickname: "나",
          color: "#ff5c7a",
          state: "playing",
          position: { x: 1, y: 1 },
          finishRank: null,
          isHost: true
        },
        {
          playerId: "guest",
          nickname: "상대",
          color: "#ff8a5b",
          state: "playing",
          position: { x: 1, y: 1 },
          finishRank: null,
          isHost: false
        }
      ],
      "self"
    );

    expect(ordered.map((member) => member.playerId)).toEqual(["guest", "self"]);
  });
});
