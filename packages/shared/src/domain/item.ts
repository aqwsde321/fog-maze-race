export const MATCH_ITEM_TYPES = ["ice_trap"] as const;
export type MatchItemType = (typeof MATCH_ITEM_TYPES)[number];

export const MATCH_TRAP_STATES = ["arming", "armed", "triggered"] as const;
export type MatchTrapState = (typeof MATCH_TRAP_STATES)[number];

export type MapFeatureFlags = {
  itemBoxes?: boolean;
};
