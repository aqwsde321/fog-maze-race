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

    const visibilityRow = container.querySelector<HTMLElement>('[data-testid="visibility-control-row"]');
    const select = container.querySelector("select");
    expect(visibilityRow).not.toBeNull();
    expect(visibilityRow?.textContent).toContain("시야");
    expect(select).not.toBeNull();
    expect(visibilityRow?.style.gridTemplateColumns).toBe("auto minmax(0, 1fr)");

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

  it("prefills editable bot rows and submits per-bot strategies for the host", async () => {
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
    expect(document.body.querySelector('[data-testid="bot-config-section"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="bot-names-section"]')?.textContent).toContain("봇 이름");
    expect(document.body.querySelector<HTMLElement>('[data-testid="bot-kind-field"]')?.style.borderRadius).toBe("12px");
    expect(document.body.querySelector<HTMLElement>('[data-testid="bot-count-field"]')?.style.borderRadius).toBe("12px");
    expect(document.body.querySelector<HTMLElement>('[data-testid="bot-name-list"]')?.style.overflowY).toBe("auto");
    expect(document.body.querySelector<HTMLElement>('[data-testid="bot-name-list"]')?.style.maxHeight).toBe("220px");

    const nameInputs = document.body.querySelectorAll<HTMLInputElement>('input[data-testid^="bot-name-input-"]');
    expect(nameInputs).toHaveLength(2);
    expect(nameInputs[0]?.value).toBe("bot1");
    expect(nameInputs[1]?.value).toBe("bot2");
    expect(document.body.querySelector('[data-testid="bot-name-row-0"]')?.textContent).toContain("01");
    expect(document.body.querySelector('[data-testid="bot-name-row-1"]')?.textContent).toContain("02");
    const strategySelects = document.body.querySelectorAll<HTMLSelectElement>('select[data-testid^="bot-strategy-select-"]');
    expect(strategySelects).toHaveLength(2);
    expect(strategySelects[0]?.value).toBe("frontier");
    expect(strategySelects[1]?.value).toBe("frontier");
    expect([...strategySelects[0]!.options].map((option) => option.value)).toEqual(["frontier", "tremaux", "wall"]);
    const strategyTooltipButton = document.body.querySelector<HTMLButtonElement>('[data-testid="strategy-tooltip-button"]');
    expect(strategyTooltipButton).not.toBeNull();
    expect(document.body.querySelector('[data-testid="strategy-tooltip"]')).toBeNull();

    await act(async () => {
      strategyTooltipButton?.click();
    });

    expect(document.body.querySelector('[data-testid="strategy-tooltip"]')?.textContent).toContain("Frontier");
    expect(document.body.querySelector('[data-testid="strategy-tooltip"]')?.textContent).toContain("Tremaux");
    expect(document.body.querySelector('[data-testid="strategy-tooltip"]')?.textContent).toContain("Wall");

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(nameInputs[0], "red");
      nameInputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      strategySelects[1]!.value = "wall";
      strategySelects[1]!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const submitButton = document.body.querySelector<HTMLButtonElement>('[data-testid="add-bots-button"]');
    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton?.click();
    });

    expect(onAddBots).toHaveBeenCalledWith({
      kind: "explore",
      bots: [
        { nickname: "red", kind: "explore", strategy: "frontier" },
        { nickname: "bot2", kind: "explore", strategy: "wall" }
      ]
    });
    expect(document.body.querySelector('[data-testid="bot-panel-overlay"]')).toBeNull();
  });

  it("hides the strategy tooltip when the bot kind is not explore", async () => {
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
    await act(async () => {
      toggleButton?.click();
    });

    const kindSelect = document.body.querySelector<HTMLSelectElement>('#bot-kind');
    expect(kindSelect).not.toBeNull();

    await act(async () => {
      kindSelect!.value = "join";
      kindSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(document.body.querySelector('[data-testid="strategy-tooltip-button"]')).toBeNull();
    expect(document.body.querySelector('[data-testid^="bot-strategy-select-"]')).toBeNull();
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

  it("keeps bot settings available for removals even when no room slot remains", async () => {
    const onRemoveBots = vi.fn();

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="bot_race"
          visibilitySize={7}
          canEditVisibility
          canManageBots
          availableBotSlots={0}
          memberNicknames={["host", "bot1", "bot2"]}
          currentBots={[
            { playerId: "bot-1", nickname: "bot1", strategy: "frontier" },
            { playerId: "bot-2", nickname: "bot2", strategy: "tremaux" }
          ]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onAddBots={vi.fn()}
          onRemoveBots={onRemoveBots}
        />
      );
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="toggle-bot-panel-button"]');
    expect(toggleButton?.disabled).toBe(false);

    await act(async () => {
      toggleButton?.click();
    });

    expect(document.body.textContent).toContain("남은 봇 슬롯 0명");

    const addButton = document.body.querySelector<HTMLButtonElement>('[data-testid="add-bots-button"]');
    expect(addButton?.disabled).toBe(true);

    const removeButton = document.body.querySelector<HTMLButtonElement>('[data-testid="remove-bot-button-bot-1"]');
    expect(removeButton).not.toBeNull();
    expect(document.body.querySelector<HTMLElement>('[data-testid="current-bot-list"]')?.style.overflowY).toBe("auto");
    expect(document.body.querySelector<HTMLElement>('[data-testid="current-bot-list"]')?.style.maxHeight).toBe("220px");
    expect(document.body.querySelector('[data-testid="current-bot-list"]')?.textContent).toContain("Frontier");
    expect(document.body.querySelector('[data-testid="current-bot-list"]')?.textContent).toContain("Tremaux");

    await act(async () => {
      removeButton?.click();
    });

    expect(onRemoveBots).toHaveBeenCalledWith(["bot-1"]);
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
          currentBots={[{ playerId: "bot-1", nickname: "bot1", strategy: "frontier" }]}
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
