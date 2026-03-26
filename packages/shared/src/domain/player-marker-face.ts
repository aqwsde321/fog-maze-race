export const PLAYER_MARKER_FACES = ["dot", "flat", "caret"] as const;

export type PlayerMarkerFace = (typeof PLAYER_MARKER_FACES)[number];
