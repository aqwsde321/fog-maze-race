import {
  isConnectorTile,
  isInsideZone,
  type ZoneBounds,
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
  input: { viewportWidth: number; viewportHeight: number },
  bounds?: Pick<ZoneBounds, "minX" | "minY" | "maxX" | "maxY">
): BoardLayout {
  const viewportWidth = Math.max(320, Math.floor(input.viewportWidth));
  const viewportHeight = Math.max(320, Math.floor(input.viewportHeight));
  const renderBounds = bounds ?? {
    minX: 0,
    minY: 0,
    maxX: map.width - 1,
    maxY: map.height - 1
  };
  const renderWidth = renderBounds.maxX - renderBounds.minX + 1;
  const renderHeight = renderBounds.maxY - renderBounds.minY + 1;
  const tileSize = Math.max(
    MIN_TILE_SIZE,
    Math.min(
      MAX_TILE_SIZE,
      Math.floor(
        Math.min(
          (viewportWidth - BOARD_PADDING * 2) / renderWidth,
          (viewportHeight - BOARD_PADDING * 2) / renderHeight
        )
      )
    )
  );

  const boardWidth = tileSize * renderWidth;
  const boardHeight = tileSize * renderHeight;
  const offsetX = Math.floor((viewportWidth - boardWidth) / 2) - renderBounds.minX * tileSize;
  const offsetY = Math.floor((viewportHeight - boardHeight) / 2) - renderBounds.minY * tileSize;

  return {
    viewportWidth,
    viewportHeight,
    tileSize,
    offsetX,
    offsetY
  };
}

export function getTileVisual(input: {
  tile: string;
  map: BoardMap;
  position: { x: number; y: number };
  isVisible: boolean;
  mode: "live" | "preview";
}) {
  if (input.tile === " ") {
    return null;
  }

  if (input.mode === "preview" && !isInsideZone(input.map.startZone, input.position)) {
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

  if (!input.isVisible) {
    return {
      fillColor: 0x050b16,
      alpha: 1
    };
  }

  if (input.tile === "#") {
    return {
      fillColor: 0x64748b,
      alpha: 1
    };
  }

  return {
    fillColor: 0x18263b,
    alpha: 1
  };
}
