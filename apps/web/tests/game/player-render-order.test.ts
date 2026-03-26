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
          shape: "circle",
          face: "dot",
          state: "playing",
          position: { x: 1, y: 1 },
          finishRank: null,
          isHost: true
        },
        {
          playerId: "guest",
          nickname: "상대",
          color: "#ff8a5b",
          shape: "square",
          face: "flat",
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
