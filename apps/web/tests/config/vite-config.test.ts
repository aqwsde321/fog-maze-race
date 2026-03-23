// @vitest-environment node

import { describe, expect, it } from "vitest";

import viteConfig from "../../vite.config.js";

describe("vite config", () => {
  it("binds the dev server to all interfaces for LAN playtests", () => {
    expect(viteConfig.server?.host).toBe("0.0.0.0");
  });
});
