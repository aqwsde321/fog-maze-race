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
          roomName="Alpha"
          visibilitySize={7}
          canEditVisibility
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={onSetVisibilitySize}
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
          roomName="Alpha"
          visibilitySize={5}
          canEditVisibility={false}
          onRenameRoom={vi.fn()}
          onSetVisibilitySize={onSetVisibilitySize}
        />
      );
    });

    expect(container.querySelector("select")?.disabled).toBe(true);
  });
});
