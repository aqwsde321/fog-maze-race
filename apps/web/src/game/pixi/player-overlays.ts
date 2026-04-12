import type { RoomChatMessageView } from "@fog-maze-race/shared/contracts/snapshots";
import type { MatchItemType } from "@fog-maze-race/shared/domain/item";

export const CHAT_BUBBLE_LIFETIME_MS = 2_000;
export const CHAT_BUBBLE_MAX_LENGTH = 14;

export type HeldItemBadgeVisual = {
  icon: string;
  fillColor: number;
  strokeColor: number;
  textColor: string;
};

export function truncatePlayerChatMessage(content: string, maxLength = CHAT_BUBBLE_MAX_LENGTH) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxLength - 1))}\u2026`;
}

export function collectActivePlayerChats(input: {
  chat: RoomChatMessageView[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const activeMessages = new Map<string, { content: string; expiresAt: number }>();

  for (let index = input.chat.length - 1; index >= 0; index -= 1) {
    const message = input.chat[index];
    if (activeMessages.has(message.playerId)) {
      continue;
    }

    const sentAt = Date.parse(message.sentAt);
    if (Number.isNaN(sentAt)) {
      continue;
    }

    const expiresAt = sentAt + CHAT_BUBBLE_LIFETIME_MS;
    if (expiresAt <= now) {
      continue;
    }

    const content = truncatePlayerChatMessage(message.content);
    if (!content) {
      continue;
    }

    activeMessages.set(message.playerId, {
      content,
      expiresAt
    });
  }

  return activeMessages;
}

export function clampOverlayCenterX(input: {
  centerX: number;
  overlayWidth: number;
  viewportWidth: number;
  padding?: number;
}) {
  const padding = input.padding ?? 10;
  const halfWidth = input.overlayWidth / 2;
  const minCenter = padding + halfWidth;
  const maxCenter = input.viewportWidth - padding - halfWidth;

  if (maxCenter <= minCenter) {
    return input.viewportWidth / 2;
  }

  return Math.min(maxCenter, Math.max(minCenter, input.centerX));
}

export function resolveHeldItemBadgeVisual(itemType: MatchItemType | null | undefined): HeldItemBadgeVisual | null {
  switch (itemType) {
    case "ice_trap":
      return {
        icon: "❄",
        fillColor: 0x0b2942,
        strokeColor: 0x7dd3fc,
        textColor: "#e0f2fe"
      };
    case "return_trap":
      return {
        icon: "↺",
        fillColor: 0x3b0764,
        strokeColor: 0xf472b6,
        textColor: "#fdf2f8"
      };
    case "flare":
      return {
        icon: "✦",
        fillColor: 0x78350f,
        strokeColor: 0xfacc15,
        textColor: "#fef3c7"
      };
    case "boost":
      return {
        icon: "≫",
        fillColor: 0x14532d,
        strokeColor: 0x4ade80,
        textColor: "#dcfce7"
      };
    case "scanner":
      return {
        icon: "⌖",
        fillColor: 0x082f49,
        strokeColor: 0x7dd3fc,
        textColor: "#e0f2fe"
      };
    default:
      return null;
  }
}
