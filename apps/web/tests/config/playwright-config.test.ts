// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildPlaywrightConfig } from "../../../../playwright.config.js";

describe("playwright config", () => {
  it("keeps a single worker for local runs", () => {
    expect(buildPlaywrightConfig({}).workers).toBe(1);
  });

  it("keeps retries disabled for local runs", () => {
    expect(buildPlaywrightConfig({}).retries).toBe(0);
  });

  it("keeps a single worker in CI and relies on workflow sharding instead", () => {
    expect(buildPlaywrightConfig({ CI: "1" }).workers).toBe(1);
  });

  it("retries flaky E2E failures once in CI", () => {
    expect(buildPlaywrightConfig({ CI: "1" }).retries).toBe(1);
  });
});
