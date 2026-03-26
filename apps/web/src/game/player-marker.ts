import type { CSSProperties } from "react";
import type { Graphics } from "pixi.js";
import type { PlayerMarkerFace } from "@fog-maze-race/shared/domain/player-marker-face";
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

export function getPlayerMarkerEyeContent(face: PlayerMarkerFace) {
  switch (face) {
    case "dot":
      return "";
    case "flat":
      return "";
    case "caret":
      return "^";
  }
}

export function getPlayerMarkerEyeStyle(face: PlayerMarkerFace, size: number): CSSProperties {
  if (face === "dot") {
    const eyeSize = Math.max(2, Math.round(size * 0.14));

    return {
      width: `${eyeSize}px`,
      height: `${eyeSize}px`,
      borderRadius: "999px",
      background: MARKER_EYE_COLOR,
      opacity: 0.92
    };
  }

  if (face === "flat") {
    const eyeWidth = Math.max(4, Math.round(size * 0.22));
    const eyeHeight = Math.max(2, Math.round(size * 0.08));

    return {
      width: `${eyeWidth}px`,
      height: `${eyeHeight}px`,
      borderRadius: "999px",
      background: MARKER_EYE_COLOR,
      opacity: 0.92
    };
  }

  return {
    minWidth: `${Math.max(5, Math.round(size * 0.18))}px`,
    color: MARKER_EYE_COLOR,
    fontSize: `${Math.max(6, Math.round(size * 0.24))}px`,
    lineHeight: 1,
    fontWeight: 700,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    textAlign: "center",
    opacity: 0.96
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
  face: PlayerMarkerFace,
  style?: {
    color?: number;
    alpha?: number;
  }
) {
  const eyeOffsetX = Math.max(2, radius * 0.36);
  const eyeOffsetY = Math.max(1, radius * 0.18);
  const color = style?.color ?? 0x081120;
  const alpha = style?.alpha ?? 0.92;
  const eyeCenterY = centerY - eyeOffsetY;

  if (face === "dot") {
    const eyeRadius = Math.max(1.1, radius * 0.14);
    graphics.circle(centerX - eyeOffsetX, eyeCenterY, eyeRadius).fill({ color, alpha });
    graphics.circle(centerX + eyeOffsetX, eyeCenterY, eyeRadius).fill({ color, alpha });
    return;
  }

  if (face === "flat") {
    const eyeWidth = Math.max(3.8, radius * 0.44);
    const eyeHeight = Math.max(1.4, radius * 0.1);
    const roundness = eyeHeight / 2;

    graphics
      .roundRect(centerX - eyeOffsetX - eyeWidth / 2, eyeCenterY - eyeHeight / 2, eyeWidth, eyeHeight, roundness)
      .fill({ color, alpha });
    graphics
      .roundRect(centerX + eyeOffsetX - eyeWidth / 2, eyeCenterY - eyeHeight / 2, eyeWidth, eyeHeight, roundness)
      .fill({ color, alpha });
    return;
  }

  const eyeWidth = Math.max(3.6, radius * 0.42);
  const eyeHeight = Math.max(2.2, radius * 0.22);
  const lineWidth = Math.max(1.1, radius * 0.08);

  graphics
    .poly([
      centerX - eyeOffsetX - eyeWidth / 2,
      eyeCenterY + eyeHeight / 2,
      centerX - eyeOffsetX,
      eyeCenterY - eyeHeight / 2,
      centerX - eyeOffsetX + eyeWidth / 2,
      eyeCenterY + eyeHeight / 2
    ])
    .stroke({ color, width: lineWidth, alpha });
  graphics
    .poly([
      centerX + eyeOffsetX - eyeWidth / 2,
      eyeCenterY + eyeHeight / 2,
      centerX + eyeOffsetX,
      eyeCenterY - eyeHeight / 2,
      centerX + eyeOffsetX + eyeWidth / 2,
      eyeCenterY + eyeHeight / 2
    ])
    .stroke({ color, width: lineWidth, alpha });
}
