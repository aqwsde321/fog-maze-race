import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomListPanel } from "../../src/features/rooms/RoomListPanel.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RoomListPanel", () => {
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

  it("submits a nickname update from the connected player card", async () => {
    const onUpdateNickname = vi.fn();

    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={onUpdateNickname}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    const nicknameInput = container.querySelector<HTMLInputElement>('#lobby-nickname');
    expect(nicknameInput).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(nicknameInput, "만두");
      nicknameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="nickname-submit-button"]')?.click();
    });

    expect(onUpdateNickname).toHaveBeenCalledWith("만두");
  });
});
