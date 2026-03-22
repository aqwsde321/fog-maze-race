import {
  isConnectorTile,
  isInsideZone,
  type MapDefinition
} from "@fog-maze-race/shared/maps/map-definitions";

type BoardMap = Pick<
  MapDefinition,
  "width" | "height" | "startZone" | "mazeZone" | "goalZone" | "connectorTiles"
>;

export type BoardLayout = {
  viewportWidth: number;
  viewportHeight: number;
  tileSize: number;
  offsetX: number;
  offsetY: number;
};

const BOARD_PADDING = 28;
const MIN_TILE_SIZE = 18;
const MAX_TILE_SIZE = 56;

export function createBoardLayout(
  map: Pick<MapDefinition, "width" | "height">,
  input: { viewportWidth: number; viewportHeight: number }
): BoardLayout {
  const viewportWidth = Math.max(320, Math.floor(input.viewportWidth));
  const viewportHeight = Math.max(320, Math.floor(input.viewportHeight));
  const tileSize = Math.max(
    MIN_TILE_SIZE,
    Math.min(
      MAX_TILE_SIZE,
      Math.floor(
        Math.min(
          (viewportWidth - BOARD_PADDING * 2) / map.width,
          (viewportHeight - BOARD_PADDING * 2) / map.height
        )
      )
    )
  );

  const boardWidth = tileSize * map.width;
  const boardHeight = tileSize * map.height;

  return {
    viewportWidth,
    viewportHeight,
    tileSize,
    offsetX: Math.floor((viewportWidth - boardWidth) / 2),
    offsetY: Math.floor((viewportHeight - boardHeight) / 2)
  };
}

export function getTileVisual(input: {
  tile: string;
  map: BoardMap;
  position: { x: number; y: number };
  isVisible: boolean;
}) {
  if (input.tile === " ") {
    return null;
  }

  if (isInsideZone(input.map.startZone, input.position)) {
    return {
      fillColor: input.isVisible ? 0x22d3ee : 0x155e75,
      alpha: input.isVisible ? 1 : 0.82
    };
  }

  if (isConnectorTile(input.map, input.position)) {
    return {
      fillColor: input.isVisible ? 0x14b8a6 : 0x0f766e,
      alpha: input.isVisible ? 1 : 0.86
    };
  }

  if (isInsideZone(input.map.goalZone, input.position)) {
    return {
      fillColor: input.isVisible ? 0xfacc15 : 0x854d0e,
      alpha: input.isVisible ? 1 : 0.82
    };
  }

  if (input.tile === "#") {
    return {
      fillColor: input.isVisible ? 0x64748b : 0x334155,
      alpha: input.isVisible ? 1 : 0.84
    };
  }

  return {
    fillColor: input.isVisible ? 0x18263b : 0x0b1320,
    alpha: input.isVisible ? 1 : 0.82
  };
}
