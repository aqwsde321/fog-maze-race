export const MATCH_ITEM_TYPES = ["ice_trap"] as const;
export type MatchItemType = (typeof MATCH_ITEM_TYPES)[number];

export const MATCH_TRAP_STATES = ["arming", "armed", "triggered"] as const;
export type MatchTrapState = (typeof MATCH_TRAP_STATES)[number];

export const ITEM_BOX_SPAWN_MODES = ["per_racer", "fixed"] as const;
export type ItemBoxSpawnMode = (typeof ITEM_BOX_SPAWN_MODES)[number];

export type ItemBoxSpawnRule = {
  mode: ItemBoxSpawnMode;
  value: number;
};

export const DEFAULT_ITEM_BOX_SPAWN_RULE: ItemBoxSpawnRule = {
  mode: "per_racer",
  value: 2
};

export type MapFeatureFlags = {
  itemBoxes?: boolean;
  itemBoxSpawn?: ItemBoxSpawnRule;
};
