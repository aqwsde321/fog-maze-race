import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Direction } from "@fog-maze-race/shared/domain/grid-position";
import type { ServerHealthSnapshot } from "@fog-maze-race/shared/contracts/server-health";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { GameScreen } from "../../src/views/GameScreen.js";

const {
  getSocketClientMock,
  hostControlsPropsMock,
  pingEmitMock,
  pingTimeoutMock
} = vi.hoisted(() => {
  const pingEmitMock = vi.fn();
  const pingTimeoutMock = vi.fn(() => ({
    emit: pingEmitMock
  }));
  const hostControlsPropsMock = vi.fn();
  const getSocketClientMock = vi.fn(() => ({
    connected: true,
    timeout: pingTimeoutMock
  }));

  return {
    getSocketClientMock,
    hostControlsPropsMock,
    pingEmitMock,
    pingTimeoutMock
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../src/services/socket-client.js", () => ({
  getSocketClient: getSocketClientMock
}));

vi.mock("../../src/game/GameCanvas.js", () => ({
  GameCanvas: () => <div data-testid="game-canvas" />
}));

vi.mock("../../src/features/rooms/HostControls.js", () => ({
  HostControls: (props: unknown) => {
    hostControlsPropsMock(props);
    return <div data-testid="host-controls" />;
  }
}));

vi.mock("../../src/features/rooms/PlayerSidebar.js", () => ({
  PlayerSidebar: () => <aside data-testid="player-sidebar" />
}));

vi.mock("../../src/features/rooms/RoomChatPanel.js", () => ({
  RoomChatPanel: () => <section data-testid="room-chat-panel" />
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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildServerHealth()));
    vi.stubGlobal("fetch", fetchMock);
    pingEmitMock.mockReset();
    pingTimeoutMock.mockClear();
    getSocketClientMock.mockClear();
    hostControlsPropsMock.mockReset();
    pingEmitMock.mockImplementation((eventName: string, payload: unknown, acknowledge?: () => void) => {
      if (eventName === "PING_CHECK") {
        acknowledge?.();
      }
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
          onSendChatMessage={vi.fn()}
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

  it("opens quick chat with slash and sends the message on enter", async () => {
    const onSendChatMessage = vi.fn();

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={onSendChatMessage}
        />
      );
    });

    const openEvent = new KeyboardEvent("keydown", {
      key: "/",
      bubbles: true,
      cancelable: true
    });

    await act(async () => {
      getGameShell().dispatchEvent(openEvent);
    });
    await flush();

    const quickChatInput = container.querySelector<HTMLInputElement>('[data-testid="quick-chat-input"]');

    expect(openEvent.defaultPrevented).toBe(true);
    expect(quickChatInput).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(quickChatInput, "테스트");
      quickChatInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const submitEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true
    });

    await act(async () => {
      quickChatInput?.dispatchEvent(submitEvent);
    });
    await flush();
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });

    expect(onSendChatMessage).toHaveBeenCalledWith("테스트");
    expect(container.querySelector('[data-testid="quick-chat-composer"]')).toBeNull();
    expect(document.activeElement).toBe(getGameShell());
  });

  it("shows a centered fake-goal alert when the local player steps onto a fake goal tile", async () => {
    vi.useFakeTimers();
    const initialSnapshot = buildSnapshot("playing");
    const movedSnapshot: RoomSnapshot = {
      ...initialSnapshot,
      revision: 2,
      members: initialSnapshot.members.map((member) => (
        member.playerId === "player-1"
          ? {
              ...member,
              position: { x: 4, y: 1 }
            }
          : member
      )),
      match: initialSnapshot.match
        ? {
            ...initialSnapshot.match,
            map: {
              ...initialSnapshot.match.map,
              fakeGoalTiles: [{ x: 4, y: 1 }]
            }
          }
        : null
    };

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={{
            ...initialSnapshot,
            match: initialSnapshot.match
              ? {
                  ...initialSnapshot.match,
                  map: {
                    ...initialSnapshot.match.map,
                    fakeGoalTiles: [{ x: 4, y: 1 }]
                  }
                }
              : null
          }}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="fake-goal-alert"]')).toBeNull();

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={movedSnapshot}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    const fakeGoalWord = container.querySelector<HTMLElement>('[data-testid="fake-goal-alert-word"]');
    const fakeGoalCard = container.querySelector<HTMLElement>('[data-testid="fake-goal-alert-card"]');
    const fakeGoalCaption = container.querySelector<HTMLElement>('[data-testid="fake-goal-alert-caption"]');
    const fakeGoalPixels = container.querySelectorAll('[data-testid="fake-goal-alert-pixel"]');
    const topKiyeokColumns = [...fakeGoalPixels]
      .filter((pixel) => (pixel as HTMLElement).style.gridRow === "1")
      .map((pixel) => (pixel as HTMLElement).style.gridColumn);
    const bottomStrokeColumns = [...fakeGoalPixels]
      .filter((pixel) => (pixel as HTMLElement).style.gridRow === "6")
      .map((pixel) => (pixel as HTMLElement).style.gridColumn);

    expect(container.querySelector('[data-testid="fake-goal-alert"]')?.textContent).toContain("가짜 골");
    expect(fakeGoalWord?.getAttribute("aria-label")).toBe("쿠!");
    expect(fakeGoalWord?.style.gridTemplateColumns).toBe("repeat(11, 22px)");
    expect(fakeGoalWord?.style.gridTemplateRows).toBe("repeat(8, 22px)");
    expect(fakeGoalCard?.style.position).toBe("absolute");
    expect(fakeGoalCard?.style.left).toBe("50%");
    expect(fakeGoalCard?.style.top).toBe("calc(50% - 32px)");
    expect(fakeGoalCard?.style.width).toBe("0px");
    expect(fakeGoalCard?.style.height).toBe("0px");
    expect(fakeGoalWord?.style.position).toBe("absolute");
    expect(fakeGoalWord?.style.left).toBe("0px");
    expect(fakeGoalWord?.style.top).toBe("0px");
    expect(fakeGoalWord?.style.transform).toBe("translate(-128px, -102px)");
    expect(fakeGoalCaption?.style.position).toBe("absolute");
    expect(fakeGoalCaption?.style.left).toBe("0px");
    expect(fakeGoalCaption?.style.top).toBe("118px");
    expect(fakeGoalPixels).toHaveLength(28);
    expect(topKiyeokColumns).toEqual(["2", "3", "4", "5", "6", "10"]);
    expect(bottomStrokeColumns).toEqual(["1", "2", "3", "4", "5", "6", "7", "10"]);

    await act(async () => {
      vi.advanceTimersByTime(1_999);
    });

    expect(container.querySelector('[data-testid="fake-goal-alert"]')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(container.querySelector('[data-testid="fake-goal-alert"]')).toBeNull();
  });

  it("positions the fake-goal alert at the center of the measured game canvas", async () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      const testId = this.getAttribute("data-testid");
      if (testId === "game-shell") {
        return 1280;
      }

      if (testId === "game-canvas") {
        return 960;
      }

      return 0;
    });
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      const testId = this.getAttribute("data-testid");
      if (testId === "game-shell") {
        return 720;
      }

      if (testId === "game-canvas") {
        return 540;
      }

      return 0;
    });
    const offsetLeftSpy = vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      return this.getAttribute("data-testid") === "game-canvas" ? 140 : 0;
    });
    const offsetTopSpy = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      return this.getAttribute("data-testid") === "game-canvas" ? 36 : 0;
    });
    const initialSnapshot = buildSnapshot("playing");
    const movedSnapshot: RoomSnapshot = {
      ...initialSnapshot,
      revision: initialSnapshot.revision + 1,
      members: initialSnapshot.members.map((member) => (
        member.playerId === "player-1"
          ? {
              ...member,
              position: { x: 4, y: 1 }
            }
          : member
      )),
      match: initialSnapshot.match
        ? {
            ...initialSnapshot.match,
            map: {
              ...initialSnapshot.match.map,
              fakeGoalTiles: [{ x: 4, y: 1 }]
            }
          }
        : null
    };

    try {
      await act(async () => {
        root.render(
          <GameScreen
            snapshot={{
              ...initialSnapshot,
              match: initialSnapshot.match
                ? {
                    ...initialSnapshot.match,
                    map: {
                      ...initialSnapshot.match.map,
                      fakeGoalTiles: [{ x: 4, y: 1 }]
                    }
                  }
                : null
            }}
            selfPlayerId="player-1"
            countdownValue={null}
            onStartGame={vi.fn()}
            onRenameRoom={vi.fn()}
            onSetVisibilitySize={vi.fn()}
            onForceEndRoom={vi.fn()}
            onResetToWaiting={vi.fn()}
            onLeaveRoom={vi.fn()}
            onMove={vi.fn()}
            onSendChatMessage={vi.fn()}
          />
        );
      });

      await act(async () => {
        root.render(
          <GameScreen
            snapshot={movedSnapshot}
            selfPlayerId="player-1"
            countdownValue={null}
            onStartGame={vi.fn()}
            onRenameRoom={vi.fn()}
            onSetVisibilitySize={vi.fn()}
            onForceEndRoom={vi.fn()}
            onResetToWaiting={vi.fn()}
            onLeaveRoom={vi.fn()}
            onMove={vi.fn()}
            onSendChatMessage={vi.fn()}
          />
        );
      });

      const overlay = container.querySelector<HTMLElement>('[data-testid="fake-goal-alert"]');
      const card = container.querySelector<HTMLElement>('[data-testid="fake-goal-alert-card"]');

      expect(overlay).not.toBeNull();
      expect(overlay?.style.left).toBe("140px");
      expect(overlay?.style.top).toBe("36px");
      expect(overlay?.style.width).toBe("960px");
      expect(overlay?.style.height).toBe("540px");
      expect(overlay?.style.inset).toBe("");
      expect(card?.style.left).toBe("648px");
      expect(card?.style.top).toBe("238px");
    } finally {
      clientWidthSpy.mockRestore();
      clientHeightSpy.mockRestore();
      offsetLeftSpy.mockRestore();
      offsetTopSpy.mockRestore();
    }
  });

  it("does not show the fake-goal alert when another player stands on a fake goal tile", async () => {
    const snapshot = buildSnapshot("playing");

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={{
            ...snapshot,
            revision: 2,
            members: [
              ...snapshot.members,
              {
                playerId: "player-2",
                nickname: "호2",
                kind: "human",
                color: "#fb7185",
                shape: "square",
                role: "racer",
                state: "playing",
                position: { x: 4, y: 1 },
                finishRank: null,
                isHost: false
              }
            ],
            match: snapshot.match
              ? {
                  ...snapshot.match,
                  map: {
                    ...snapshot.match.map,
                    fakeGoalTiles: [{ x: 4, y: 1 }]
                  }
                }
              : null
          }}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="fake-goal-alert"]')).toBeNull();
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
          onSendChatMessage={vi.fn()}
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
          onSendChatMessage={vi.fn()}
        />
      );
    });

    expect(container.textContent).not.toContain("시작");
  });

  it("shows bot controls to bot race spectators and limits them to one add slot", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting", {
            mode: "bot_race",
            hostPlayerId: "player-host",
            selfPlayerId: "player-1",
            members: [
              {
                playerId: "player-1",
                nickname: "관전1",
                kind: "human",
                color: "#38bdf8",
                shape: "circle",
                role: "spectator",
                state: "waiting",
                position: null,
                finishRank: null,
                isHost: false
              },
              {
                playerId: "player-host",
                nickname: "호1",
                kind: "human",
                color: "#f97316",
                shape: "square",
                role: "spectator",
                state: "waiting",
                position: null,
                finishRank: null,
                isHost: true
              },
              {
                playerId: "bot-host",
                nickname: "hostb",
                kind: "bot",
                creatorPlayerId: "player-host",
                exploreStrategy: "frontier",
                color: "#22c55e",
                shape: "diamond",
                role: "racer",
                state: "waiting",
                position: null,
                finishRank: null,
                isHost: false
              }
            ]
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
          onSendChatMessage={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="host-controls"]')).not.toBeNull();
    expect(hostControlsPropsMock).toHaveBeenCalled();
    expect(hostControlsPropsMock.mock.lastCall?.[0]).toMatchObject({
      canManageBots: true,
      availableBotSlots: 1,
      currentBots: [],
      defaultBotNicknameBase: "관전1"
    });
  });

  it("keeps the room chat panel collapsed until the floating toggle is opened", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    const chatToggle = container.querySelector<HTMLButtonElement>('[data-testid="room-chat-toggle"]');

    expect(chatToggle?.style.pointerEvents).toBe("auto");
    expect(container.querySelector('[data-testid="room-chat-panel"]')).toBeNull();

    await act(async () => {
      chatToggle?.click();
    });

    expect(container.querySelector('[data-testid="room-chat-panel"]')).not.toBeNull();

    await act(async () => {
      chatToggle?.click();
    });

    expect(container.querySelector('[data-testid="room-chat-panel"]')).toBeNull();
  });

  it("positions the floating server controls to the left of the right rail", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    const dock = container.querySelector<HTMLElement>('[data-testid="server-floating-dock"]');

    expect(dock).not.toBeNull();
    expect(dock?.style.right.startsWith("calc(")).toBe(true);
    expect(dock?.style.bottom).toBe("clamp(10px, 1vw, 14px)");
  });

  it("hides the floating server controls for non-host players", async () => {
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
          onSendChatMessage={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="server-floating-dock"]')).toBeNull();
    expect(container.querySelector('[data-testid="server-health-toggle"]')).toBeNull();
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
          onSendChatMessage={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="result-overlay-role"]')?.textContent).toBe("host");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="result-overlay-reset"]')?.click();
    });

    expect(onResetToWaiting).toHaveBeenCalledTimes(1);
  });

  it("opens the race history sheet from the room header when logs are available", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          gameResultLogs={buildGameResultLogs()}
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>('[data-testid="results-history-toggle"]');
    const actionPanel = container.querySelector<HTMLElement>('[data-testid="room-action-panel"]');
    const roomHeader = container.querySelector<HTMLElement>('[data-testid="room-header-row"]');

    expect(toggle?.textContent).toContain("로그");
    expect(toggle?.textContent).toContain("2경기");
    expect(actionPanel?.contains(toggle ?? null)).toBe(true);
    expect(roomHeader?.contains(toggle ?? null)).toBe(false);
    expect(document.body.querySelector('[data-testid="results-history-panel"]')).toBeNull();

    await act(async () => {
      toggle?.click();
    });

    expect(document.body.querySelector('[data-testid="results-history-panel"]')?.textContent).toContain("bot2");
    expect(document.body.querySelector('[data-testid="results-history-panel"]')?.textContent).toContain("00:25.368");
  });

  it("keeps server diagnostics collapsed until the floating toggle is opened", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="server-health-panel"]')).toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal)
      })
    );
    expect(pingTimeoutMock).toHaveBeenCalledWith(4_000);
    expect(pingEmitMock).toHaveBeenCalledWith(
      "PING_CHECK",
      expect.objectContaining({
        clientSentAt: expect.any(String)
      }),
      expect.any(Function)
    );
    expect(container.querySelector('[data-testid="server-health-panel"]')).not.toBeNull();
    expect(container.textContent).toContain("온라인");
    expect(container.textContent).toContain("현재 / 10초 평균 또는 최대");
    expect(container.textContent).toContain("Ping");
    expect(container.textContent).toMatch(/\d+\.\dms \/ \d+\.\dms/);
    expect(container.textContent).toContain("linux x64");
    expect(container.textContent).toContain("12.5% / 10.2%");
    expect(container.textContent).toContain("3.8ms / 7.4ms");
    expect(container.textContent).toContain("1 / 1");
    expect(container.textContent).toContain("방 인원");
    expect(container.textContent).toContain("전체 플레이어");
    expect(container.textContent).toContain("전체 소켓");
    expect(container.textContent).toContain("128.0 MB");
    expect(container.textContent).toContain("48.0 MB / 64.0 MB");
    expect(container.textContent).toContain("4.0 GB / 16.0 GB");
    expect(container.textContent).toContain("24.0 / 18.5");
    expect(container.textContent).toContain("60.0 / 52.1");
    expect(container.textContent).toContain("2.0 / 0.6");
    expect(container.textContent).toContain("900.0 / 750.0");
  });

  it("keeps info icons only on metrics that need explanation", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    expect(container.querySelector('[data-testid="server-metric-info-ping"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-info-cpu"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-info-uptime"]')).toBeNull();
    expect(container.querySelector('[data-testid="server-metric-info-moves"]')).toBeNull();
    expect(container.querySelector('[data-testid="server-metric-info-node"]')).toBeNull();
  });

  it("renders sparklines only for the trend metrics", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    expect(container.querySelector('[data-testid="server-metric-graph-ping"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-graph-cpu"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-graph-loop"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-graph-heap"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-graph-rss"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-graph-fanout"]')).not.toBeNull();

    expect(container.querySelector('[data-testid="server-metric-graph-sockets"]')).toBeNull();
    expect(container.querySelector('[data-testid="server-metric-graph-memory"]')).toBeNull();
    expect(container.querySelector('[data-testid="server-metric-graph-state"]')).toBeNull();
  });

  it("shows a metric tooltip when the info icon is hovered", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    const cpuInfo = container.querySelector<HTMLElement>('[data-testid="server-metric-info-cpu"]');

    expect(cpuInfo).not.toBeNull();
    expect(container.querySelector('[data-testid="server-metric-tooltip-cpu"]')).toBeNull();

    await act(async () => {
      cpuInfo?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    const tooltip = document.body.querySelector<HTMLElement>('[data-testid="server-metric-tooltip-cpu"]');

    expect(tooltip?.textContent).toContain("현재, 오른쪽은 최근 10초 평균 CPU 사용률");
    expect(tooltip?.parentElement).toBe(document.body);

    await act(async () => {
      cpuInfo?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });

    expect(document.body.querySelector('[data-testid="server-metric-tooltip-cpu"]')).toBeNull();
  });

  it("keeps the tooltip layer outside the panel body and avoids internal panel scrolling", async () => {
    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    const panel = container.querySelector<HTMLElement>('[data-testid="server-health-panel"]');
    const scrollBody = container.querySelector<HTMLElement>('[data-testid="server-health-scroll"]');

    expect(panel?.style.overflow).toBe("visible");
    expect(scrollBody?.style.overflowY).toBe("visible");
  });

  it("shows a degraded state when the health check fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network failed"));

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    expect(container.textContent).toContain("상태 확인 실패");
  });

  it("keeps the previous server status when a health refresh returns 304", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildServerHealth()))
      .mockResolvedValueOnce(notModifiedResponse());

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    expect(container.textContent).toContain("온라인");

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    await flush();

    expect(container.textContent).toContain("온라인");
    expect(container.textContent).not.toContain("상태 확인 실패");
  });

  it("stops polling again when the floating diagnostics panel is closed", async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(
        <GameScreen
          snapshot={buildSnapshot("waiting")}
          selfPlayerId="player-1"
          countdownValue={null}
          onStartGame={vi.fn()}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onForceEndRoom={vi.fn()}
          onResetToWaiting={vi.fn()}
          onLeaveRoom={vi.fn()}
          onMove={vi.fn()}
          onSendChatMessage={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="server-health-toggle"]')?.click();
    });
    await flush();

    await act(async () => {
      vi.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="server-health-panel"]')).toBeNull();
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
          onSendChatMessage={vi.fn()}
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
    members?: RoomSnapshot["members"];
    mode?: RoomSnapshot["room"]["mode"];
    selfPlayerId?: string;
  }
): RoomSnapshot {
  const selfPlayerId = overrides?.selfPlayerId ?? "player-1";
  const hostPlayerId = overrides?.hostPlayerId ?? selfPlayerId;
  const mode = overrides?.mode ?? "normal";
  const members = overrides?.members ?? [
    {
      playerId: selfPlayerId,
      nickname: "호1",
      kind: "human",
      color: "#38bdf8",
      shape: "circle",
      role: mode === "bot_race" ? "spectator" : "racer",
      state: status === "playing" ? "playing" : status === "ended" ? "finished" : "waiting",
      position: mode === "bot_race" ? null : { x: 0, y: 1 },
      finishRank: status === "ended" ? 1 : null,
      isHost: selfPlayerId === hostPlayerId
    }
  ];

  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      mode,
      status,
      hostPlayerId,
      maxPlayers: 15,
      visibilitySize: 7,
      botSpeedMultiplier: 1
    },
    members,
    chat: [],
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
                  rank: 1,
                  elapsedMs: 20_000
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

function buildServerHealth(): ServerHealthSnapshot {
  return {
    ok: true,
    service: "fog-maze-race",
    version: "dev",
    checkedAt: "2026-03-28T01:00:00.000Z",
    uptimeSeconds: 321,
    runtime: {
      nodeVersion: "v22.15.0",
      platform: "linux",
      arch: "x64"
    },
    system: {
      cpuCores: 8,
      totalMemoryBytes: 16 * 1024 * 1024 * 1024,
      freeMemoryBytes: 4 * 1024 * 1024 * 1024
    },
    process: {
      rssBytes: 128 * 1024 * 1024,
      heapUsedBytes: 48 * 1024 * 1024,
      heapTotalBytes: 64 * 1024 * 1024,
      externalBytes: 12 * 1024 * 1024
    },
    load: {
      cpuPercent: 12.5,
      eventLoopLagMs: 3.8,
      eventLoopLagMaxMs: 5.2,
      activeRooms: 1,
      activePlayers: 15,
      activeMatches: 1,
      connectedSockets: 15,
      movesPerSecond: 24,
      chatMessagesPerSecond: 2,
      roomStateUpdatesPerSecond: 60,
      broadcastsPerSecond: 75,
      fanoutPerSecond: 900
    },
    recent: {
      avgCpuPercent10s: 10.2,
      avgEventLoopLagMs10s: 4.1,
      peakEventLoopLagMs10s: 7.4,
      avgMovesPerSecond10s: 18.5,
      avgChatMessagesPerSecond10s: 0.6,
      avgRoomStateUpdatesPerSecond10s: 52.1,
      avgBroadcastsPerSecond10s: 66.8,
      avgFanoutPerSecond10s: 750
    }
  };
}

function buildGameResultLogs() {
  return [
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
          outcome: "finished" as const,
          rank: 1,
          elapsedMs: 25_368
        },
        {
          playerId: "bot-8",
          nickname: "bot8",
          outcome: "finished" as const,
          rank: 2,
          elapsedMs: 26_883
        }
      ]
    },
    {
      id: "room-1:1",
      roomId: "room-1",
      roomName: "Alpha",
      hostNickname: "호1",
      endedAt: "2026-03-31T12:58:12.334Z",
      result: "1위 bot3(00:28.120)",
      results: [
        {
          playerId: "bot-3",
          nickname: "bot3",
          outcome: "finished" as const,
          rank: 1,
          elapsedMs: 28_120
        }
      ]
    }
  ];
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } satisfies Pick<Response, "ok" | "json" | "status">;
}

function notModifiedResponse() {
  return {
    ok: false,
    status: 304,
    json: async () => undefined
  } satisfies Pick<Response, "ok" | "json" | "status">;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}
