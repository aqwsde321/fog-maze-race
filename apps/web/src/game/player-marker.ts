import type { CSSProperties } from "react";
import type { Graphics } from "pixi.js";
import type { PlayerMarkerShape } from "@fog-maze-race/shared/domain/player-marker-shape";

export const PLAYER_MARKER_DIAMETER_RATIO = 0.64;
export const PLAYER_MARKER_SELF_RING_RATIO = 0.39;
const MARKER_EYE_COLOR = "#081120";

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

export function getPlayerMarkerEyesWrapStyle(size: number): CSSProperties {
  const width = Math.max(6, Math.round(size * 0.5));
  const height = Math.max(4, Math.round(size * 0.18));

  return {
    position: "absolute",
    left: "50%",
    top: "42%",
    transform: "translate(-50%, -50%)",
    width: `${width}px`,
    height: `${height}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    pointerEvents: "none"
  };
}

export function getPlayerMarkerEyeStyle(size: number): CSSProperties {
  const eyeSize = Math.max(2, Math.round(size * 0.14));

  return {
    width: `${eyeSize}px`,
    height: `${eyeSize}px`,
    borderRadius: "999px",
    background: MARKER_EYE_COLOR,
    opacity: 0.92
  };
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

export function drawPlayerMarkerEyes(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  style?: {
    color?: number;
    alpha?: number;
  }
) {
  const eyeRadius = Math.max(1.1, radius * 0.14);
  const eyeOffsetX = Math.max(2, radius * 0.36);
  const eyeOffsetY = Math.max(1, radius * 0.18);
  const color = style?.color ?? 0x081120;
  const alpha = style?.alpha ?? 0.92;

  graphics.circle(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius).fill({ color, alpha });
  graphics.circle(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius).fill({ color, alpha });
}
