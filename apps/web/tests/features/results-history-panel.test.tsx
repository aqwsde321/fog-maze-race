import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultsHistoryPanel } from "../../src/features/rooms/ResultsHistoryPanel.js";
import type { GameResultLogEntry } from "../../src/features/rooms/result-log.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ResultsHistoryPanel", () => {
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

  it("renders the latest room race logs with ranked rows in a side sheet", async () => {
    await act(async () => {
      root.render(
        <ResultsHistoryPanel
          isOpen
          roomName="Alpha"
          logs={[
            {
              id: "room-1:2",
              roomId: "room-1",
              roomName: "Alpha",
              hostNickname: "호1",
              endedAt: "2026-03-31T12:59:12.334Z",
              result: "1위 bot2(00:25.368) / 2위 bot8(00:26.883)",
              results: [
                {
                  playerId: "bot-2",
                  nickname: "bot2",
                  outcome: "finished",
                  rank: 1,
                  elapsedMs: 25_368
                },
                {
                  playerId: "bot-8",
                  nickname: "bot8",
                  outcome: "finished",
                  rank: 2,
                  elapsedMs: 26_883
                }
              ]
            }
          ]}
          onClose={vi.fn()}
        />
      );
    });

    const panel = document.body.querySelector<HTMLElement>('[data-testid="results-history-panel"]');
    const title = panel?.querySelector<HTMLElement>("h2");

    expect(panel).not.toBeNull();
    expect(panel?.style.color).toBe("rgb(226, 232, 240)");
    expect(panel?.textContent).toContain("레이스 기록");
    expect(panel?.textContent).toContain("Alpha");
    expect(panel?.textContent).toContain("bot2");
    expect(panel?.textContent).toContain("1위");
    expect(panel?.textContent).toContain("00:25.368");
    expect(title?.style.color).toBe("rgb(248, 250, 252)");
    expect(document.body.querySelectorAll('[data-testid="results-history-item"]')).toHaveLength(1);
  });

  it("shows an empty state when there are no room race logs yet", async () => {
    await act(async () => {
      root.render(
        <ResultsHistoryPanel
          isOpen
          roomName="Alpha"
          logs={[]}
          onClose={vi.fn()}
        />
      );
    });

    expect(document.body.querySelector('[data-testid="results-history-empty"]')?.textContent).toContain(
      "아직 기록이 없습니다"
    );
  });

  it("closes when the overlay is clicked", async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <ResultsHistoryPanel
          isOpen
          roomName="Alpha"
          logs={buildLogs()}
          onClose={onClose}
        />
      );
    });

    await act(async () => {
      document.body.querySelector<HTMLElement>('[data-testid="results-history-overlay"]')?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function buildLogs(): GameResultLogEntry[] {
  return [
    {
      id: "room-1:1",
      roomId: "room-1",
      roomName: "Alpha",
      hostNickname: "호1",
      endedAt: "2026-03-31T12:59:12.334Z",
      result: "1위 bot2(00:25.368)",
      results: [
        {
          playerId: "bot-2",
          nickname: "bot2",
          outcome: "finished",
          rank: 1,
          elapsedMs: 25_368
        }
      ]
    }
  ];
}
