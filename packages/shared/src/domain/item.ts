export const MATCH_ITEM_TYPES = ["ice_trap", "return_trap", "flare", "boost", "scanner"] as const;
export type MatchItemType = (typeof MATCH_ITEM_TYPES)[number];
export const MATCH_TRAP_TYPES = ["ice_trap", "return_trap"] as const;
export type MatchTrapType = (typeof MATCH_TRAP_TYPES)[number];

export const MATCH_ITEM_LABELS: Record<MatchItemType, string> = {
  ice_trap: "얼음 함정",
  return_trap: "복귀 함정",
  flare: "플레어",
  boost: "부스트",
  scanner: "스캐너"
};

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

export function getMatchItemLabel(itemType: MatchItemType | null | undefined) {
  if (!itemType) {
    return null;
  }

  return MATCH_ITEM_LABELS[itemType];
}

export function rollMatchItemType(random: () => number): MatchItemType {
  const index = Math.floor(random() * MATCH_ITEM_TYPES.length);
  return MATCH_ITEM_TYPES[index] ?? MATCH_ITEM_TYPES[0];
}

export type MapFeatureFlags = {
  itemBoxes?: boolean;
  itemBoxSpawn?: ItemBoxSpawnRule;
};
