import { describe, expect, it } from "vitest";

import {
  getFrozenPrisonMetrics,
  getIceTrapPalette,
  getItemBoxMetrics,
  isFrozenActive
} from "../../src/game/pixi/item-visuals.js";

describe("item visuals", () => {
  it("scales the item box question mark inside the tile bounds", () => {
    const metrics = getItemBoxMetrics(32);

    expect(metrics.inset).toBeGreaterThanOrEqual(4);
    expect(metrics.size).toBeLessThan(32);
    expect(metrics.questionFontSize).toBeGreaterThanOrEqual(14);
    expect(metrics.radius).toBeGreaterThanOrEqual(6);
  });

  it("returns distinct palettes for armed and triggered ice traps", () => {
    const armed = getIceTrapPalette("armed");
    const triggered = getIceTrapPalette("triggered");

    expect(armed.spikeAlpha).toBeGreaterThan(triggered.spikeAlpha);
    expect(armed.coreAlpha).toBeGreaterThan(triggered.coreAlpha);
    expect(armed.shellStroke).not.toBe(triggered.shellStroke);
  });

  it("treats only future frozen timestamps as active", () => {
    const now = new Date("2026-04-11T00:00:00.000Z").getTime();

    expect(isFrozenActive(new Date(now + 1_500).toISOString(), now)).toBe(true);
    expect(isFrozenActive(new Date(now - 1_500).toISOString(), now)).toBe(false);
    expect(isFrozenActive("not-a-date", now)).toBe(false);
    expect(isFrozenActive(null, now)).toBe(false);
  });

  it("sizes the frozen prison larger than the player marker footprint", () => {
    const metrics = getFrozenPrisonMetrics(28);

    expect(metrics.width).toBeGreaterThan(24);
    expect(metrics.height).toBeGreaterThan(metrics.width);
    expect(metrics.crackInset).toBeGreaterThan(0);
  });
});
