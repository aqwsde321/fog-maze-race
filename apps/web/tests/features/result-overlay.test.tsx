import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { ResultOverlay } from "../../src/features/rooms/ResultOverlay.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ResultOverlay", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T00:00:00.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    vi.useRealTimers();
    container.remove();
  });

  it("shows the remaining seconds until the result overlay closes", async () => {
    await act(async () => {
      root.render(<ResultOverlay snapshot={buildEndedSnapshot()} />);
    });

    expect(container.textContent).toContain("6초 뒤 결과창이 닫히고 새 게임 대기 상태로 돌아갑니다.");

    await act(async () => {
      vi.advanceTimersByTime(2_200);
    });

    expect(container.textContent).toContain("4초 뒤 결과창이 닫히고 새 게임 대기 상태로 돌아갑니다.");
  });
});

function buildEndedSnapshot(): RoomSnapshot {
  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      status: "ended",
      hostPlayerId: "player-1",
      maxPlayers: 15,
      visibilitySize: 7
    },
    members: [
      {
        playerId: "player-1",
        nickname: "호1",
        color: "#38bdf8",
        shape: "circle",
        face: "dot",
        state: "finished",
        position: { x: 8, y: 1 },
        finishRank: 1,
        isHost: true
      }
    ],
    previewMap: null,
    match: {
      matchId: "match-1",
      mapId: "training-lap",
      status: "ended",
      countdownValue: null,
      startedAt: "2026-03-22T23:59:40.000Z",
      endedAt: "2026-03-23T00:00:00.000Z",
      resultsDurationMs: 6_000,
      finishOrder: ["player-1"],
      results: [
        {
          playerId: "player-1",
          nickname: "호1",
          color: "#38bdf8",
          outcome: "finished",
          rank: 1
        }
      ],
      map: {
        mapId: "training-lap",
        width: 9,
        height: 5,
        tiles: [
          "SSSC.#...",
          "SSSC....G",
          "SSSC.#.#.",
          "SSSC.#...",
          "SSSC....."
        ],
        startZone: {
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 4
        },
        mazeZone: {
          minX: 4,
          minY: 0,
          maxX: 8,
          maxY: 4
        },
        goalZone: {
          minX: 8,
          minY: 1,
          maxX: 8,
          maxY: 1
        },
        startSlots: [{ x: 0, y: 1 }],
        connectorTiles: [
          { x: 3, y: 0 },
          { x: 3, y: 1 },
          { x: 3, y: 2 },
          { x: 3, y: 3 },
          { x: 3, y: 4 }
        ],
        visibilityRadius: 3
      }
    }
  };
}
