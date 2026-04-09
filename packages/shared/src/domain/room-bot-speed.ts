export const ROOM_BOT_SPEED_MULTIPLIERS = [1, 2, 3, 4, 5, 6] as const;
export type RoomBotSpeedMultiplier = (typeof ROOM_BOT_SPEED_MULTIPLIERS)[number];
