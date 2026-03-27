// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildViteConfig, resolveAllowedHosts } from "../../vite.config.js";

describe("vite config", () => {
  it("binds the dev server to all interfaces for LAN playtests", () => {
    expect(buildViteConfig({}).server?.host).toBe("0.0.0.0");
  });

  it("allows every host by default for tunnel-based testing", () => {
    expect(buildViteConfig({}).server?.allowedHosts).toBe(true);
  });

  it("can switch to an explicit allowlist when full host access is disabled", () => {
    const config = buildViteConfig({
      VITE_ALLOW_ALL_HOSTS: "false",
      VITE_ALLOWED_HOSTS: "nonmaturely-unloaning-merilyn.ngrok-free.dev"
    });

    expect(config.server?.allowedHosts).toEqual(["nonmaturely-unloaning-merilyn.ngrok-free.dev"]);
  });

  it("merges and deduplicates allowed hosts from both env sources", () => {
    expect(
      resolveAllowedHosts({
        VITE_ALLOW_ALL_HOSTS: "false",
        VITE_ALLOWED_HOSTS: "demo.ngrok-free.dev, demo.ngrok-free.dev",
        __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: "alpha.ngrok-free.dev"
      })
    ).toEqual(["demo.ngrok-free.dev", "alpha.ngrok-free.dev"]);
  });
});
