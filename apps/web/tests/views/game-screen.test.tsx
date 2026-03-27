import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Direction } from "@fog-maze-race/shared/domain/grid-position";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { GameScreen } from "../../src/views/GameScreen.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../src/game/GameCanvas.js", () => ({
  GameCanvas: () => <div data-testid="game-canvas" />
}));

vi.mock("../../src/features/rooms/HostControls.js", () => ({
  HostControls: () => <div data-testid="host-controls" />
}));

vi.mock("../../src/features/rooms/PlayerSidebar.js", () => ({
  PlayerSidebar: () => <aside data-testid="player-sidebar" />
}));

vi.mock("../../src/features/rooms/ResultOverlay.js", () => ({
  ResultOverlay: ({
    isHost,
    onResetToWaiting
  }: {
    isHost: boolean;
    onResetToWaiting: () => void;
  }) => (
    <div data-testid="result-overlay">
      <span data-testid="result-overlay-role">{isHost ? "host" : "guest"}</span>
      <button data-testid="result-overlay-reset" type="button" onClick={onResetToWaiting}>
        reset
      </button>
    </div>
  )
}));

describe("GameScreen keyboard control", () => {
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

  it("focuses the game frame and handles arrow keys only while playing", async () => {
    const onMove = vi.fn();

    await renderScreen(buildSnapshot("playing"), onMove);

    const gameShell = getGameShell();
    expect(document.activeElement).toBe(gameShell);

    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true
    });

    gameShell.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onMove).toHaveBeenCalledWith("right");
  });

  it("handles arrow keys while waiting so the player can move in the start zone", async () => {
    const onMove = vi.fn();

    await renderScreen(buildSnapshot("waiting"), onMove);

    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true
    });

    getGameShell().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onMove).toHaveBeenCalledWith("right");
  });

  it("handles arrow keys while countdown is visible so the player can reposition in the start zone", async () => {
    const onMove = vi.fn();

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("countdown")}
          selfPlayerId="player-1"
          countdownValue={3}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={onMove}
        />
      );
    });

    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true
    });

    getGameShell().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onMove).toHaveBeenCalledWith("right");
  });

  it("renders a centered countdown overlay during countdown", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("countdown")}
          selfPlayerId="player-1"
          countdownValue={3}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
        />
      );
    });

    const overlay = container.querySelector('[data-testid="countdown-overlay"]');
    expect(overlay?.textContent).toContain("3");
  });

  it("hides the start button for non-host players", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting", {
            hostPlayerId: "player-2",
            selfPlayerId: "player-1"
          })}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
        />
      );
    });

    expect(container.textContent).not.toContain("시작");
  });

  it("passes the reset action to the result overlay for hosts after the race ends", async () => {
    const onResetToWaiting = vi.fn();

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("ended")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={onResetToWaiting}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="result-overlay-role"]')?.textContent).toBe("host");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="result-overlay-reset"]')?.click();
    });

    expect(onResetToWaiting).toHaveBeenCalledTimes(1);
  });

  async function renderScreen(snapshot: RoomSnapshot, onMove: (direction: Direction) => void) {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={snapshot}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={onMove}
        />
      );
    });
  }

  function getGameShell() {
    const shell = container.querySelector<HTMLElement>('[data-testid="game-shell"]');
    if (!shell) {
      throw new Error("Game shell not found");
    }

    return shell;
  }
});

function buildSnapshot(
  status: RoomSnapshot["room"]["status"],
  overrides?: {
    hostPlayerId?: string;
    selfPlayerId?: string;
  }
): RoomSnapshot {
  const selfPlayerId = overrides?.selfPlayerId ?? "player-1";
  const hostPlayerId = overrides?.hostPlayerId ?? selfPlayerId;

  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      status,
      hostPlayerId,
      maxPlayers: 15,
      visibilitySize: 7
    },
    members: [
      {
        playerId: selfPlayerId,
        nickname: "호1",
        color: "#38bdf8",
        shape: "circle",
        state: status === "playing" ? "playing" : status === "ended" ? "finished" : "waiting",
        position: { x: 0, y: 1 },
        finishRank: status === "ended" ? 1 : null,
        isHost: selfPlayerId === hostPlayerId
      }
    ],
    previewMap: null,
    match: status === "countdown" || status === "playing" || status === "ended"
      ? {
          matchId: "match-1",
          mapId: "training-lap",
          status: status === "countdown" ? "countdown" : status === "ended" ? "ended" : "playing",
          countdownValue: status === "countdown" ? 3 : null,
          startedAt: status === "ended" ? "2026-03-22T23:59:40.000Z" : null,
          endedAt: status === "ended" ? "2026-03-23T00:00:00.000Z" : null,
          resultsDurationMs: status === "ended" ? 6_000 : null,
          finishOrder: status === "ended" ? [selfPlayerId] : [],
          results: status === "ended"
            ? [
                {
                  playerId: selfPlayerId,
                  nickname: "호1",
                  color: "#38bdf8",
                  outcome: "finished",
                  rank: 1
                }
              ]
            : [],
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
      : null
  };
}
