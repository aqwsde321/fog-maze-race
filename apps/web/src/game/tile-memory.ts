import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

export type TileVisibilityState = "visible" | "remembered" | "hidden";

export type TileMemoryState = {
  matchKey: string | null;
  rememberedTileKeys: Set<string>;
};

export function createTileMemoryState(): TileMemoryState {
  return {
    matchKey: null,
    rememberedTileKeys: new Set<string>()
  };
}

export function updateTileMemory(input: {
  previous: TileMemoryState;
  snapshot: RoomSnapshot | null;
  selfPlayerId: string | null;
  visibleTileKeys: string[];
}): TileMemoryState {
  const nextMatchKey = getMatchMemoryKey(input.snapshot, input.selfPlayerId);

  if (!nextMatchKey) {
    return createTileMemoryState();
  }

  const rememberedTileKeys =
    input.previous.matchKey === nextMatchKey
      ? new Set(input.previous.rememberedTileKeys)
      : new Set<string>();

  for (const tileKey of input.visibleTileKeys) {
    rememberedTileKeys.add(tileKey);
  }

  return {
    matchKey: nextMatchKey,
    rememberedTileKeys
  };
}

export function resolveTileVisibilityState(input: {
  showFullMap: boolean;
  tileKey: string;
  visibleTileKeys: Set<string>;
  rememberedTileKeys: Set<string>;
}): TileVisibilityState {
  if (input.showFullMap || input.visibleTileKeys.has(input.tileKey)) {
    return "visible";
  }

  if (input.rememberedTileKeys.has(input.tileKey)) {
    return "remembered";
  }

  return "hidden";
}

function getMatchMemoryKey(snapshot: RoomSnapshot | null, selfPlayerId: string | null) {
  if (!snapshot?.match || !selfPlayerId) {
    return null;
  }

  return `${snapshot.room.roomId}:${snapshot.match.matchId}:${selfPlayerId}`;
}
