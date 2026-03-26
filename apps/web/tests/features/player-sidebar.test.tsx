import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { PlayerSidebar } from "../../src/features/rooms/PlayerSidebar.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PlayerSidebar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows a border and eyes only for the current player marker", async () => {
    await act(async () => {
      root.render(<PlayerSidebar snapshot={buildSnapshot()} selfPlayerId="player-1" />);
    });

    const cards = [...container.querySelectorAll("aside article")];
    expect(cards).toHaveLength(2);

    const selfRing = cards[0]?.querySelector('[data-marker-self-ring="true"]');
    const selfDot = cards[0]?.querySelector('[data-marker-shape]');
    const selfEyes = cards[0]?.querySelectorAll('[data-marker-eye="true"]');
    const guestDot = cards[1]?.querySelector('[data-marker-shape]');
    const guestEyes = cards[1]?.querySelectorAll('[data-marker-eye="true"]');

    expect(selfRing).not.toBeNull();
    expect(selfDot?.getAttribute("data-marker-shape")).toBe("circle");
    expect(selfEyes).toHaveLength(2);
    expect(guestDot?.getAttribute("data-marker-shape")).toBe("square");
    expect(guestEyes).toHaveLength(0);
    expect(container.textContent).toContain("만두 (나)");
    expect(container.textContent).toContain("참가자");
  });
});

function buildSnapshot(): RoomSnapshot {
  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      status: "waiting",
      hostPlayerId: "player-1",
      maxPlayers: 15,
      visibilitySize: 7
    },
    members: [
      {
        playerId: "player-1",
        nickname: "만두",
        color: "#ff8c42",
        shape: "circle",
        state: "waiting",
        position: { x: 0, y: 1 },
        finishRank: null,
        isHost: true
      },
      {
        playerId: "player-2",
        nickname: "아르민",
        color: "#3b82f6",
        shape: "square",
        state: "waiting",
        position: { x: 1, y: 1 },
        finishRank: null,
        isHost: false
      }
    ],
    previewMap: null,
    match: null
  };
}
