import type { CSSProperties } from "react";
import type { Graphics } from "pixi.js";

export const PLAYER_MARKER_DIAMETER_RATIO = 0.64;
export const PLAYER_MARKER_SELF_RING_RATIO = 0.39;

export const PLAYER_MARKER_SHAPES = [
  "circle",
  "square",
  "diamond",
  "triangle",
  "triangle-down"
] as const;

export type PlayerMarkerShape = (typeof PLAYER_MARKER_SHAPES)[number];

export function buildPlayerMarkerShapeMap(
  members: Array<{ playerId: string }>
) {
  const shapes = new Map<string, PlayerMarkerShape>();

  members.forEach((member, index) => {
    shapes.set(member.playerId, PLAYER_MARKER_SHAPES[index % PLAYER_MARKER_SHAPES.length]!);
  });

  return shapes;
}

export function getPlayerMarkerStyle(
  shape: PlayerMarkerShape,
  size: number
): CSSProperties {
  const base: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    display: "block",
    background: "currentColor"
  };

  switch (shape) {
    case "circle":
      return {
        ...base,
        borderRadius: "999px"
      };
    case "square":
      return base;
    case "diamond":
      return {
        ...base,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
      };
    case "triangle":
      return {
        ...base,
        clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)"
      };
    case "triangle-down":
      return {
        ...base,
        clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)"
      };
  }
}

export function drawPlayerMarkerShape(
  graphics: Graphics,
  shape: PlayerMarkerShape,
  centerX: number,
  centerY: number,
  radius: number,
  style: {
    color: number;
    mode: "fill" | "stroke";
    width?: number;
    alpha?: number;
  }
) {
  const draw = (() => {
    switch (shape) {
      case "circle":
        return graphics.circle(centerX, centerY, radius);
      case "square":
        return graphics.rect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      case "diamond":
        return graphics.poly([
          centerX,
          centerY - radius,
          centerX + radius,
          centerY,
          centerX,
          centerY + radius,
          centerX - radius,
          centerY
        ]);
      case "triangle":
        return graphics.poly([
          centerX,
          centerY - radius,
          centerX + radius,
          centerY + radius,
          centerX - radius,
          centerY + radius
        ]);
      case "triangle-down":
        return graphics.poly([
          centerX - radius,
          centerY - radius,
          centerX + radius,
          centerY - radius,
          centerX,
          centerY + radius
        ]);
    }
  })();

  if (style.mode === "fill") {
    draw.fill({ color: style.color, alpha: style.alpha ?? 1 });
  } else {
    draw.stroke({
      color: style.color,
      width: style.width ?? 2,
      alpha: style.alpha ?? 1
    });
  }
}
