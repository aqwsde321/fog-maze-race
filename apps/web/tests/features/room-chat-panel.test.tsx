import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { RoomChatPanel } from "../../src/features/rooms/RoomChatPanel.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RoomChatPanel", () => {
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

  it("renders chat history and sends a trimmed message on submit", async () => {
    const onSendMessage = vi.fn();

    await act(async () => {
      root.render(
        <RoomChatPanel
          snapshot={buildSnapshot()}
          selfPlayerId="player-1"
          onSendMessage={onSendMessage}
        />
      );
    });

    const input = container.querySelector<HTMLInputElement>('[data-testid="room-chat-input"]');
    expect(container.textContent).toContain("같이 갑시다");
    expect(container.textContent).toContain("만두");
    expect(input).not.toBeNull();

    await act(async () => {
      if (!input) {
        throw new Error("chat input not found");
      }

      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor?.set?.call(input, "  오른쪽으로 가요  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="room-chat-submit"]')?.click();
    });

    expect(onSendMessage).toHaveBeenCalledWith("오른쪽으로 가요");
    expect(input?.value).toBe("");
  });

  it("uses a taller fixed panel size and keeps chat overflow inside the log area", async () => {
    await act(async () => {
      root.render(
        <RoomChatPanel
          snapshot={buildSnapshot(18)}
          selfPlayerId="player-1"
          onSendMessage={vi.fn()}
        />
      );
    });

    const panel = container.querySelector<HTMLElement>('[data-testid="room-chat-panel"]');
    const log = container.querySelector<HTMLElement>('[data-testid="room-chat-log"]');

    expect(panel?.style.width).toBe("291px");
    expect(panel?.style.height).toBe("480px");
    expect(log?.style.overflowY).toBe("auto");
    expect(log?.style.minHeight).toBe("0");
    expect(log?.className).toContain("room-chat-log-scroll");
  });
});

function buildSnapshot(messageCount = 1): RoomSnapshot {
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
      visibilitySize: 7,
      botSpeedMultiplier: 1
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
      }
    ],
    chat: Array.from({ length: messageCount }, (_, index) => ({
      messageId: `message-${index + 1}`,
      playerId: "player-1",
      nickname: "만두",
      color: "#ff8c42",
      content: index === 0 ? "같이 갑시다" : `메시지 ${index + 1}`,
      sentAt: `2026-03-27T00:${String(index).padStart(2, "0")}:00.000Z`
    })),
    previewMap: null,
    match: null
  };
}
