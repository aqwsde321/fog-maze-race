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

  it("shows eyes for every player marker and a border only for the current player", async () => {
    await act(async () => {
      root.render(<PlayerSidebar snapshot={buildSnapshot()} selfPlayerId="player-1" />);
    });

    expect(container.textContent).toContain("플레이어");

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
    expect(guestEyes).toHaveLength(2);
    expect(container.textContent).toContain("만두 (나)");
    expect(container.textContent).toContain("참가자");
  });

  it("caps the player list at half the viewport height and scrolls overflow internally", async () => {
    await act(async () => {
      root.render(<PlayerSidebar snapshot={buildSnapshot()} selfPlayerId="player-1" />);
    });

    const list = container.querySelector<HTMLElement>('[data-testid="player-sidebar-list"]');

    expect(list?.style.maxHeight).toBe("50vh");
    expect(list?.style.overflowY).toBe("auto");
  });

  it("hides human spectators from the player list in bot race rooms", async () => {
    await act(async () => {
      root.render(<PlayerSidebar snapshot={buildBotRaceSnapshot()} selfPlayerId="bot-1" />);
    });

    const cards = [...container.querySelectorAll("aside article")];

    expect(cards).toHaveLength(3);
    expect(container.textContent).toContain("레이서");
    expect(container.textContent).toContain("bot1");
    expect(container.textContent).toContain("bot2");
    expect(container.textContent).toContain("bot3");
    expect(container.querySelector('[data-testid="player-sidebar-list"]')?.textContent).not.toContain("관전자");
    const spectatorMeta = container.querySelector('[data-testid="spectator-meta"]')?.textContent ?? "";
    expect(spectatorMeta).toContain("관전자");
    expect(spectatorMeta).toContain("1명");
    expect(spectatorMeta).not.toContain("채팅 가능");
    expect(container.textContent).toContain("Frontier");
    expect(container.textContent).toContain("Tremaux");
    expect(container.textContent).toContain("Wall");
  });
});

function buildSnapshot(): RoomSnapshot {
  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      mode: "normal",
      gameMode: "normal",
      status: "waiting",
      hostPlayerId: "player-1",
      maxPlayers: 15,
      visibilitySize: 7
    },
    members: [
      {
        playerId: "player-1",
        nickname: "만두",
        kind: "human",
        color: "#ff8c42",
        shape: "circle",
        role: "racer",
        state: "waiting",
        position: { x: 0, y: 1 },
        finishRank: null,
        isHost: true
      },
      {
        playerId: "player-2",
        nickname: "아르민",
        kind: "human",
        color: "#3b82f6",
        shape: "square",
        role: "racer",
        state: "waiting",
        position: { x: 1, y: 1 },
        finishRank: null,
        isHost: false
      }
    ],
    chat: [],
    previewMap: null,
    match: null
  };
}

function buildBotRaceSnapshot(): RoomSnapshot {
  return {
    revision: 1,
    room: {
      roomId: "room-2",
      name: "Bot Only",
      mode: "bot_race",
      gameMode: "normal",
      status: "waiting",
      hostPlayerId: "viewer-1",
      maxPlayers: 15,
      visibilitySize: 7
    },
    members: [
      {
        playerId: "viewer-1",
        nickname: "관전자",
        kind: "human",
        color: "#ff8c42",
        shape: "circle",
        role: "spectator",
        state: "waiting",
        position: null,
        finishRank: null,
        isHost: true
      },
      {
        playerId: "bot-1",
        nickname: "bot1",
        kind: "bot",
        exploreStrategy: "frontier",
        color: "#3b82f6",
        shape: "square",
        role: "racer",
        state: "waiting",
        position: { x: 0, y: 1 },
        finishRank: null,
        isHost: false
      },
      {
        playerId: "bot-2",
        nickname: "bot2",
        kind: "bot",
        exploreStrategy: "tremaux",
        color: "#22c55e",
        shape: "diamond",
        role: "racer",
        state: "waiting",
        position: { x: 1, y: 1 },
        finishRank: null,
        isHost: false
      },
      {
        playerId: "bot-3",
        nickname: "bot3",
        kind: "bot",
        exploreStrategy: "wall",
        color: "#f59e0b",
        shape: "triangle",
        role: "racer",
        state: "waiting",
        position: { x: 2, y: 1 },
        finishRank: null,
        isHost: false
      }
    ],
    chat: [],
    previewMap: null,
    match: null
  };
}
