import { describe, expect, it } from "vitest";

import { getPlayerRenderOrder } from "../../src/game/player-render-order.js";

describe("getPlayerRenderOrder", () => {
  it("renders the local player last so overlapping players do not cover them", () => {
    const ordered = getPlayerRenderOrder(
      [
        {
          playerId: "self",
          nickname: "나",
          kind: "human",
          color: "#ff5c7a",
          shape: "circle",
          role: "racer",
          state: "playing",
          position: { x: 1, y: 1 },
          finishRank: null,
          isHost: true
        },
        {
          playerId: "guest",
          nickname: "상대",
          kind: "human",
          color: "#ff8a5b",
          shape: "square",
          role: "racer",
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
