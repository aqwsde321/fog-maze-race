export const ROOM_EXPLORE_STRATEGIES = ["frontier", "tremaux", "wall"] as const;

export type RoomExploreStrategy = (typeof ROOM_EXPLORE_STRATEGIES)[number];
