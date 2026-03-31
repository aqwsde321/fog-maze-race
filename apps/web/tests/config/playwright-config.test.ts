// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildPlaywrightConfig } from "../../../../playwright.config.js";

describe("playwright config", () => {
  it("keeps retries disabled for local runs", () => {
    expect(buildPlaywrightConfig({}).retries).toBe(0);
  });

  it("retries flaky E2E failures once in CI", () => {
    expect(buildPlaywrightConfig({ CI: "1" }).retries).toBe(1);
  });
});
