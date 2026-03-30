import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import type { GameResultLogEntry } from "../../src/features/rooms/result-log.js";

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
    expect(resultList?.className).toContain("result-overlay-scrollable");
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

  it("shows each finished player's elapsed time on a single row without a time label", async () => {
    await act(async () => {
      root.render(
        <ResultOverlay
          snapshot={buildEndedSnapshot(2, { elapsedMsBase: 20_000 })}
          isHost
          onResetToWaiting={vi.fn()}
        />
      );
    });

    const resultItems = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="results-list"] article')
    );

    expect(container.textContent).not.toContain("소요시간");
    expect(container.textContent).toContain("00:20.000");
    expect(container.textContent).toContain("00:21.000");
    expect(resultItems[0]?.querySelectorAll("p")).toHaveLength(0);
    expect(resultItems[1]?.querySelectorAll("p")).toHaveLength(0);
  });

  it("does not render game logs inside the result modal", async () => {
    const logs: GameResultLogEntry[] = [
      {
        id: "room-1:101",
        roomId: "room-1",
        roomName: "Alpha",
        hostNickname: "호1",
        endedAt: "2026-03-23T00:00:00.000Z",
        result: "1위 호1(00:20.000) / 2위 호2(00:21.000)"
      }
    ];

    await act(async () => {
      root.render(
        <ResultOverlay
          snapshot={buildEndedSnapshot()}
          isHost
          gameLogs={logs}
          onResetToWaiting={vi.fn()}
        />
      );
    });

    expect(container.textContent).not.toContain("게임 기록");
    expect(container.textContent).not.toContain("방 이름: Alpha");
    expect(container.textContent).not.toContain("방장: 호1");
    expect(container.querySelector('[data-testid="results-history-list"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="results-history-item"]')).toHaveLength(0);
  });
});

function buildEndedSnapshot(
  resultCount = 1,
  options?: {
    elapsedMsBase?: number;
  }
): RoomSnapshot {
  const results = Array.from({ length: resultCount }, (_, index) => ({
    playerId: `player-${index + 1}`,
    nickname: `호${index + 1}`,
    color: `hsl(${(index * 24) % 360} 80% 60%)`,
    outcome: "finished" as const,
    rank: index + 1,
    elapsedMs: (options?.elapsedMsBase ?? 20_000) + index * 1_000
  })) as NonNullable<RoomSnapshot["match"]>["results"];

  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      mode: "normal",
      status: "ended",
      hostPlayerId: "player-1",
      maxPlayers: 15,
      visibilitySize: 7
    },
    members: [
      {
        playerId: "player-1",
        nickname: "호1",
        kind: "human",
        color: "#38bdf8",
        shape: "circle",
        role: "racer",
        state: "finished",
        position: { x: 8, y: 1 },
        finishRank: 1,
        isHost: true
      }
    ],
    chat: [],
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
