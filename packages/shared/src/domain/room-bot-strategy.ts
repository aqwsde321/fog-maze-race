export const ROOM_EXPLORE_STRATEGIES = ["frontier", "tremaux"] as const;

export type RoomExploreStrategy = (typeof ROOM_EXPLORE_STRATEGIES)[number];
