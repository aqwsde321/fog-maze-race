export type PlayerPattern = "horizontal" | "vertical" | "diagonal-up" | "diagonal-down" | "cross";

export const PLAYER_MARKER_DIAMETER_RATIO = 0.58;
export const PLAYER_MARKER_SELF_RING_RATIO = 0.34;
export const PLAYER_MARKER_PATTERN_ALPHA_PREVIEW = 0.34;
export const PLAYER_MARKER_PATTERN_ALPHA_LIVE = 0.42;

export type PlayerMarkerMeta = {
  order: number;
  label: string;
  pattern: PlayerPattern;
  contrastColor: string;
};

const PATTERN_ORDER: PlayerPattern[] = [
  "horizontal",
  "vertical",
  "diagonal-up",
  "diagonal-down",
  "cross"
];

export function buildPlayerMarkerMetaMap(
  members: Array<{ playerId: string; color: string }>
) {
  return new Map(
    members.map((member, index) => [
      member.playerId,
      {
        order: index + 1,
        label: String(index + 1),
        pattern: PATTERN_ORDER[index % PATTERN_ORDER.length] ?? "horizontal",
        contrastColor: getContrastTextColor(member.color)
      } satisfies PlayerMarkerMeta
    ])
  );
}

export function getPatternBackground(pattern: PlayerPattern, color: string, alpha = 0.32) {
  const stroke = hexToRgba(color, alpha);
  switch (pattern) {
    case "horizontal":
      return `linear-gradient(180deg, transparent 36%, ${stroke} 36%, ${stroke} 64%, transparent 64%)`;
    case "vertical":
      return `linear-gradient(90deg, transparent 36%, ${stroke} 36%, ${stroke} 64%, transparent 64%)`;
    case "diagonal-up":
      return `linear-gradient(45deg, transparent 38%, ${stroke} 38%, ${stroke} 62%, transparent 62%)`;
    case "diagonal-down":
      return `linear-gradient(135deg, transparent 38%, ${stroke} 38%, ${stroke} 62%, transparent 62%)`;
    case "cross":
      return [
        `linear-gradient(180deg, transparent 36%, ${stroke} 36%, ${stroke} 64%, transparent 64%)`,
        `linear-gradient(90deg, transparent 36%, ${stroke} 36%, ${stroke} 64%, transparent 64%)`
      ].join(", ");
  }
}

export function getMarkerLabelFontSize(markerSize: number, labelLength: number) {
  const ratio = labelLength > 1 ? 0.42 : 0.52;
  return Math.max(labelLength > 1 ? 10 : 11, Math.floor(markerSize * ratio));
}

export function getContrastTextColor(hexColor: string) {
  const { r, g, b } = parseHexColor(hexColor);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.64 ? "#08111f" : "#f8fafc";
}

function hexToRgba(hexColor: string, alpha: number) {
  const { r, g, b } = parseHexColor(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseHexColor(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const hex = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : normalized;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}
