import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ConnectionBanner } from "../../src/features/session/ConnectionBanner.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ConnectionBanner", () => {
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

  it("explains that a sleeping deployment might take a moment to reconnect", async () => {
    await act(async () => {
      root.render(<ConnectionBanner connectionState="connecting" />);
    });

    expect(container.textContent).toContain("배포 서버가 잠들어 있었다면");
    expect(container.textContent).toContain("잠시만 기다려 주세요");
  });
});
