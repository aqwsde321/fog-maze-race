import { describe, expect, it } from "vitest";

import {
  CHAT_BUBBLE_LIFETIME_MS,
  CHAT_BUBBLE_MAX_LENGTH,
  clampOverlayCenterX,
  collectActivePlayerChats,
  resolveHeldItemBadgeVisual,
  truncatePlayerChatMessage
} from "../../src/game/pixi/player-overlays.js";

describe("player overlays", () => {
  it("keeps only the latest message per player within the visibility window", () => {
    const now = Date.parse("2026-03-30T01:00:03.000Z");

    const messages = collectActivePlayerChats({
      chat: [
        {
          messageId: "m1",
          playerId: "p1",
          nickname: "bot1",
          color: "#ffffff",
          content: "첫 메시지",
          sentAt: "2026-03-30T01:00:00.200Z"
        },
        {
          messageId: "m2",
          playerId: "p2",
          nickname: "bot2",
          color: "#ffffff",
          content: "두번째",
          sentAt: "2026-03-30T01:00:01.500Z"
        },
        {
          messageId: "m3",
          playerId: "p1",
          nickname: "bot1",
          color: "#ffffff",
          content: "마지막 메시지다",
          sentAt: "2026-03-30T01:00:02.400Z"
        }
      ],
      now
    });

    expect(messages.get("p1")).toEqual({
      content: truncatePlayerChatMessage("마지막 메시지다"),
      expiresAt: Date.parse("2026-03-30T01:00:02.400Z") + CHAT_BUBBLE_LIFETIME_MS
    });
    expect(messages.get("p2")).toEqual({
      content: "두번째",
      expiresAt: Date.parse("2026-03-30T01:00:01.500Z") + CHAT_BUBBLE_LIFETIME_MS
    });
  });

  it("truncates long messages with an ellipsis", () => {
    expect(truncatePlayerChatMessage("  one   two    three   four five  ")).toBe("one two three…");
    expect(truncatePlayerChatMessage("짧음")).toBe("짧음");
    expect(truncatePlayerChatMessage("x".repeat(CHAT_BUBBLE_MAX_LENGTH + 5))).toHaveLength(CHAT_BUBBLE_MAX_LENGTH);
  });

  it("clamps overlay centers inside the viewport", () => {
    expect(clampOverlayCenterX({ centerX: 20, overlayWidth: 80, viewportWidth: 300 })).toBe(50);
    expect(clampOverlayCenterX({ centerX: 280, overlayWidth: 80, viewportWidth: 300 })).toBe(250);
    expect(clampOverlayCenterX({ centerX: 150, overlayWidth: 80, viewportWidth: 300 })).toBe(150);
  });

  it("maps held item types to distinct badge visuals", () => {
    expect(resolveHeldItemBadgeVisual("ice_trap")).toMatchObject({
      icon: "❄",
      fillColor: 0x0b2942
    });
    expect(resolveHeldItemBadgeVisual("return_trap")).toMatchObject({
      icon: "↺",
      fillColor: 0x3b0764
    });
    expect(resolveHeldItemBadgeVisual("flare")).toMatchObject({
      icon: "✦",
      fillColor: 0x78350f
    });
    expect(resolveHeldItemBadgeVisual("boost")).toMatchObject({
      icon: "≫",
      fillColor: 0x14532d
    });
    expect(resolveHeldItemBadgeVisual("scanner")).toMatchObject({
      icon: "⌖",
      fillColor: 0x082f49
    });
    expect(resolveHeldItemBadgeVisual(null)).toBeNull();
  });
});
