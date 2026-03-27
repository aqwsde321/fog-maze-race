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

  it("shows a host-only reset button instead of an auto-close timer", async () => {
    const onResetToWaiting = vi.fn();

    await act(async () => {
      root.render(
        <ResultOverlay
          snapshot={buildEndedSnapshot()}
          isHost
          onResetToWaiting={onResetToWaiting}
        />
      );
    });

    expect(container.textContent).toContain("새 게임 준비");
    expect(container.textContent).not.toContain("초 뒤 결과창이 닫히고");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="results-reset-button"]')?.click();
    });

    expect(onResetToWaiting).toHaveBeenCalledTimes(1);
  });

  it("keeps long result lists scrollable inside the modal", async () => {
    await act(async () => {
      root.render(
        <ResultOverlay
          snapshot={buildEndedSnapshot(15)}
          isHost
          onResetToWaiting={vi.fn()}
        />
      );
    });

    const resultList = container.querySelector<HTMLElement>('[data-testid="results-list"]');
    expect(resultList).not.toBeNull();
    expect(resultList?.style.overflowY).toBe("auto");
    expect(resultList?.style.maxHeight).toBe("min(48vh, 420px)");
  });

  it("shows a waiting message to guests while the host prepares the next race", async () => {
    await act(async () => {
      root.render(
        <ResultOverlay
          snapshot={buildEndedSnapshot()}
          isHost={false}
          onResetToWaiting={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("호스트가 새 게임을 준비하면");
    expect(container.querySelector('[data-testid="results-reset-button"]')).toBeNull();
  });
});

function buildEndedSnapshot(resultCount = 1): RoomSnapshot {
  const results = Array.from({ length: resultCount }, (_, index) => ({
    playerId: `player-${index + 1}`,
    nickname: `호${index + 1}`,
    color: `hsl(${(index * 24) % 360} 80% 60%)`,
    outcome: "finished" as const,
    rank: index + 1
  }));

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
      finishOrder: results.map((result) => result.playerId),
      results,
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
