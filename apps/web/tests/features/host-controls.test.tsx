import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HostControls } from "../../src/features/rooms/HostControls.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("HostControls", () => {
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

  it("changes the visibility size and disables the selector outside waiting", async () => {
    const onSetVisibilitySize = vi.fn();

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="normal"
          visibilitySize={7}
          canEditVisibility
          canManageBots
          availableBotSlots={4}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={onSetVisibilitySize}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    const select = container.querySelector("select");
    expect(select).not.toBeNull();

    await act(async () => {
      select!.value = "5";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onSetVisibilitySize).toHaveBeenCalledWith(5);

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="normal"
          visibilitySize={5}
          canEditVisibility={false}
          canManageBots={false}
          availableBotSlots={0}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={onSetVisibilitySize}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    expect(container.querySelector("select")?.disabled).toBe(true);
  });

  it("prefills editable bot names and submits the edited list for the host", async () => {
    const onAddBots = vi.fn();

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="bot_race"
          visibilitySize={7}
          canEditVisibility
          canManageBots
          availableBotSlots={4}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onAddBots={onAddBots}
          onRemoveBots={vi.fn()}
        />
      );
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="toggle-bot-panel-button"]');
    expect(toggleButton).not.toBeNull();
    expect(document.body.querySelector('[data-testid="bot-panel-overlay"]')).toBeNull();

    await act(async () => {
      toggleButton?.click();
    });

    const overlay = document.body.querySelector<HTMLElement>('[data-testid="bot-panel-overlay"]');
    expect(overlay).not.toBeNull();

    const nameInputs = document.body.querySelectorAll<HTMLInputElement>('input[data-testid^="bot-name-input-"]');
    expect(nameInputs).toHaveLength(2);
    expect(nameInputs[0]?.value).toBe("bot1");
    expect(nameInputs[1]?.value).toBe("bot2");

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(nameInputs[0], "red");
      nameInputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const submitButton = document.body.querySelector<HTMLButtonElement>('[data-testid="add-bots-button"]');
    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton?.click();
    });

    expect(onAddBots).toHaveBeenCalledWith({
      kind: "explore",
      nicknames: ["red", "bot2"]
    });
    expect(document.body.querySelector('[data-testid="bot-panel-overlay"]')).toBeNull();
  });

  it("shows bot count options only up to the remaining room slots", async () => {
    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="normal"
          visibilitySize={7}
          canEditVisibility
          canManageBots
          availableBotSlots={3}
          memberNicknames={["host", "user1", "user2"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="toggle-bot-panel-button"]');
    await act(async () => {
      toggleButton?.click();
    });

    const countSelect = document.body.querySelector<HTMLSelectElement>('#bot-count');
    expect(countSelect).not.toBeNull();
    expect([...countSelect!.options].map((option) => option.value)).toEqual(["1", "2", "3"]);
  });

  it("disables bot settings when no room slot remains", async () => {
    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="normal"
          visibilitySize={7}
          canEditVisibility
          canManageBots
          availableBotSlots={0}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="toggle-bot-panel-button"]');
    expect(toggleButton?.disabled).toBe(true);
  });

  it("lets the host remove a specific current bot from the overlay", async () => {
    const onRemoveBots = vi.fn();

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="normal"
          visibilitySize={7}
          canEditVisibility
          canManageBots
          availableBotSlots={2}
          memberNicknames={["host", "bot1"]}
          currentBots={[{ playerId: "bot-1", nickname: "bot1" }]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onAddBots={vi.fn()}
          onRemoveBots={onRemoveBots}
        />
      );
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="toggle-bot-panel-button"]');
    await act(async () => {
      toggleButton?.click();
    });

    const removeButton = document.body.querySelector<HTMLButtonElement>('[data-testid="remove-bot-button-bot-1"]');
    expect(removeButton).not.toBeNull();

    await act(async () => {
      removeButton?.click();
    });

    expect(onRemoveBots).toHaveBeenCalledWith(["bot-1"]);
  });
});
