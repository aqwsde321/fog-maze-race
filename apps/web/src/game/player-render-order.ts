import type { RoomMemberView } from "@fog-maze-race/shared/contracts/snapshots";

export function getPlayerRenderOrder(
  members: RoomMemberView[],
  selfPlayerId: string | null
) {
  return [...members].sort((left, right) => {
    if (left.playerId === selfPlayerId && right.playerId !== selfPlayerId) {
      return 1;
    }

    if (right.playerId === selfPlayerId && left.playerId !== selfPlayerId) {
      return -1;
    }

    return left.playerId.localeCompare(right.playerId);
  });
}
