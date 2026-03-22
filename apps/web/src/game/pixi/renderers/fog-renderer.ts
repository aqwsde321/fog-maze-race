import { Graphics } from "pixi.js";

import { toTileKey } from "@fog-maze-race/shared/visibility/apply-visibility";
import type { MatchView } from "@fog-maze-race/shared/contracts/snapshots";

export function renderFogOverlay(
  graphics: Graphics,
  input: {
    match: MatchView;
    tileSize: number;
    offsetX: number;
    offsetY: number;
    visibleTileKeys: string[];
    tileVisibilityByKey: Record<string, number>;
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
      const tile = input.match.map.tiles[y]?.[x] ?? " ";
      if (tile === " ") {
        continue;
      }

      const tileKey = toTileKey({ x, y });
      if (visibleTileSet.has(tileKey)) {
        const clarity = input.tileVisibilityByKey[tileKey] ?? 1;
        const edgeFogAlpha = Math.max(0, (1 - clarity) * 0.78);
        if (edgeFogAlpha <= 0.02) {
          continue;
        }

        graphics
          .rect(
            input.offsetX + x * input.tileSize,
            input.offsetY + y * input.tileSize,
            input.tileSize,
            input.tileSize
          )
          .fill({ color: 0x020617, alpha: edgeFogAlpha });
        continue;
      }

      graphics
        .rect(
          input.offsetX + x * input.tileSize,
          input.offsetY + y * input.tileSize,
          input.tileSize,
          input.tileSize
        )
        .fill({ color: 0x020617, alpha: 1 });
    }
  }
}
