import { Graphics } from "pixi.js";

import { toTileKey } from "@fog-maze-race/shared/visibility/apply-visibility";
import type { MatchView } from "@fog-maze-race/shared/contracts/snapshots";

export function renderFogOverlay(
  graphics: Graphics,
  input: {
    match: MatchView;
    tileSize: number;
    visibleTileKeys: string[];
    showFullMap: boolean;
  }
) {
  graphics.clear();

  if (input.showFullMap) {
    return;
  }

  const visibleTileSet = new Set(input.visibleTileKeys);

  for (let y = 0; y < input.match.map.height; y += 1) {
    for (let x = 0; x < input.match.map.width; x += 1) {
      if (visibleTileSet.has(toTileKey({ x, y }))) {
        continue;
      }

      graphics
        .rect(x * input.tileSize, y * input.tileSize, input.tileSize, input.tileSize)
        .fill({ color: 0x020617, alpha: 0.78 });
    }
  }
}
