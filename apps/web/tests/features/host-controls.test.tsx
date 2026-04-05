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
          botSpeedMultiplier={1}
          canEditVisibility
          canManageBots
          availableBotSlots={4}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={onSetVisibilitySize}
          onSetBotSpeedMultiplier={vi.fn()}
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
          botSpeedMultiplier={1}
          canEditVisibility={false}
          canManageBots={false}
          availableBotSlots={0}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={onSetVisibilitySize}
          onSetBotSpeedMultiplier={vi.fn()}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    expect(container.querySelector("select")?.disabled).toBe(true);
  });

  it("starts with one editable bot row by default and lets the host expand it", async () => {
    const onAddBots = vi.fn();

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="bot_race"
          visibilitySize={7}
          botSpeedMultiplier={2}
          canEditVisibility
          canManageBots
          availableBotSlots={4}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={vi.fn()}
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

    let nameInputs = document.body.querySelectorAll<HTMLInputElement>('input[data-testid^="bot-name-input-"]');
    expect(nameInputs).toHaveLength(1);
    expect(nameInputs[0]?.value).toBe("bot1");
    expect(document.body.querySelector('[data-testid="bot-name-row-0"]')?.textContent).toContain("01");
    let strategySelects = document.body.querySelectorAll<HTMLSelectElement>('select[data-testid^="bot-strategy-select-"]');
    expect(strategySelects).toHaveLength(1);
    expect(strategySelects[0]?.value).toBe("frontier");
    expect([...strategySelects[0]!.options].map((option) => option.value)).toEqual(["frontier", "tremaux", "wall"]);
    const strategyTooltipButton = document.body.querySelector<HTMLButtonElement>('[data-testid="strategy-tooltip-button"]');
    expect(strategyTooltipButton).not.toBeNull();
    expect(document.body.querySelector('[data-testid="strategy-tooltip"]')).toBeNull();

    const countSelect = document.body.querySelector<HTMLSelectElement>('#bot-count');
    expect(countSelect).not.toBeNull();

    await act(async () => {
      countSelect!.value = "2";
      countSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    nameInputs = document.body.querySelectorAll<HTMLInputElement>('input[data-testid^="bot-name-input-"]');
    strategySelects = document.body.querySelectorAll<HTMLSelectElement>('select[data-testid^="bot-strategy-select-"]');
    expect(nameInputs).toHaveLength(2);
    expect(nameInputs[1]?.value).toBe("bot2");
    expect(document.body.querySelector('[data-testid="bot-name-row-1"]')?.textContent).toContain("02");
    expect(strategySelects).toHaveLength(2);
    expect(strategySelects[1]?.value).toBe("frontier");

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

  it("uses the spectator nickname as the default bot-name base when provided", async () => {
    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="bot_race"
          visibilitySize={7}
          botSpeedMultiplier={2}
          canEditVisibility={false}
          canManageBots
          availableBotSlots={1}
          memberNicknames={["관전1"]}
          currentBots={[]}
          defaultBotNicknameBase="관전1"
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={vi.fn()}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('[data-testid="toggle-bot-panel-button"]');
    expect(toggleButton).not.toBeNull();

    await act(async () => {
      toggleButton?.click();
    });

    const nameInput = document.body.querySelector<HTMLInputElement>('[data-testid="bot-name-input-0"]');
    expect(nameInput).not.toBeNull();
    expect(nameInput?.value).toBe("관전2");
  });

  it("hides the strategy tooltip when the bot kind is not explore", async () => {
    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="normal"
          visibilitySize={7}
          botSpeedMultiplier={1}
          canEditVisibility
          canManageBots
          availableBotSlots={2}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={vi.fn()}
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
          botSpeedMultiplier={1}
          canEditVisibility
          canManageBots
          availableBotSlots={3}
          memberNicknames={["host", "user1", "user2"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={vi.fn()}
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
          botSpeedMultiplier={1}
          canEditVisibility
          canManageBots
          availableBotSlots={0}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={vi.fn()}
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
          botSpeedMultiplier={3}
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
          onSetBotSpeedMultiplier={vi.fn()}
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
          botSpeedMultiplier={1}
          canEditVisibility
          canManageBots
          availableBotSlots={2}
          memberNicknames={["host", "bot1"]}
          currentBots={[{ playerId: "bot-1", nickname: "bot1", strategy: "frontier" }]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={vi.fn()}
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

  it("shows and changes the bot speed selector only in bot race rooms", async () => {
    const onSetBotSpeedMultiplier = vi.fn();

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="bot_race"
          visibilitySize={7}
          botSpeedMultiplier={3}
          canEditVisibility
          canManageBots
          availableBotSlots={2}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={onSetBotSpeedMultiplier}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    const speedRow = container.querySelector<HTMLElement>('[data-testid="bot-speed-control-row"]');
    const speedSelect = container.querySelector<HTMLSelectElement>('#bot-speed-multiplier');
    expect(speedRow?.textContent).toContain("배속");
    expect(speedSelect?.value).toBe("3");
    expect([...speedSelect!.options].map((option) => option.value)).toEqual(["1", "2", "3", "4", "5", "6"]);

    await act(async () => {
      speedSelect!.value = "6";
      speedSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onSetBotSpeedMultiplier).toHaveBeenCalledWith(6);

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="normal"
          visibilitySize={7}
          botSpeedMultiplier={1}
          canEditVisibility
          canManageBots
          availableBotSlots={2}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={onSetBotSpeedMultiplier}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="bot-speed-control-row"]')).toBeNull();
  });

  it("keeps the bot speed selector enabled when visibility edits are locked", async () => {
    const onSetBotSpeedMultiplier = vi.fn();

    await act(async () => {
      root.render(
        <HostControls
          roomId="room-1"
          roomName="Alpha"
          roomMode="bot_race"
          visibilitySize={7}
          botSpeedMultiplier={2}
          canEditVisibility={false}
          canEditBotSpeed
          canManageBots={false}
          availableBotSlots={0}
          memberNicknames={["host"]}
          currentBots={[]}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={vi.fn()}
          onSetBotSpeedMultiplier={onSetBotSpeedMultiplier}
          onAddBots={vi.fn()}
          onRemoveBots={vi.fn()}
        />
      );
    });

    const speedSelect = container.querySelector<HTMLSelectElement>('#bot-speed-multiplier');
    expect(speedSelect).not.toBeNull();
    expect(speedSelect?.disabled).toBe(false);

    await act(async () => {
      speedSelect!.value = "5";
      speedSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onSetBotSpeedMultiplier).toHaveBeenCalledWith(5);
  });

});
