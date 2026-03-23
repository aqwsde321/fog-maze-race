export const PLAYER_MARKER_SHAPES = [
  "circle",
  "square",
  "diamond",
  "triangle",
  "triangle-down"
] as const;

export type PlayerMarkerShape = (typeof PLAYER_MARKER_SHAPES)[number];
