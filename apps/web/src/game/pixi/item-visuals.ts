import type { MatchTrapState, MatchTrapType } from "@fog-maze-race/shared/domain/item";

export type ItemBoxMetrics = {
  inset: number;
  size: number;
  radius: number;
  questionFontSize: number;
};

export type FrozenPrisonMetrics = {
  width: number;
  height: number;
  radius: number;
  crackInset: number;
};

export type TrapPalette = {
  shellColor: number;
  shellAlpha: number;
  shellStroke: number;
  shellStrokeAlpha: number;
  spikeColor: number;
  spikeAlpha: number;
  coreColor: number;
  coreAlpha: number;
};

export function getItemBoxMetrics(tileSize: number): ItemBoxMetrics {
  const inset = Math.max(4, Math.floor(tileSize * 0.16));
  const size = Math.max(14, tileSize - inset * 2 - 2);

  return {
    inset,
    size,
    radius: Math.max(6, Math.floor(size * 0.24)),
    questionFontSize: Math.max(14, Math.floor(size * 0.7))
  };
}

export function getIceTrapPalette(state: MatchTrapState): TrapPalette {
  switch (state) {
    case "arming":
      return {
        shellColor: 0x0b2242,
        shellAlpha: 0.22,
        shellStroke: 0x7dd3fc,
        shellStrokeAlpha: 0.52,
        spikeColor: 0x38bdf8,
        spikeAlpha: 0.74,
        coreColor: 0xe0f2fe,
        coreAlpha: 0.68
      };
    case "armed":
      return {
        shellColor: 0x082f49,
        shellAlpha: 0.28,
        shellStroke: 0xe0f2fe,
        shellStrokeAlpha: 0.82,
        spikeColor: 0x67e8f9,
        spikeAlpha: 0.96,
        coreColor: 0xffffff,
        coreAlpha: 0.92
      };
    case "triggered":
      return {
        shellColor: 0x1e3a5f,
        shellAlpha: 0.18,
        shellStroke: 0xbfdbfe,
        shellStrokeAlpha: 0.48,
        spikeColor: 0xbfdbfe,
        spikeAlpha: 0.58,
        coreColor: 0xe0f2fe,
        coreAlpha: 0.42
      };
  }
}

export function getReturnTrapPalette(state: MatchTrapState): TrapPalette {
  switch (state) {
    case "arming":
      return {
        shellColor: 0x2e1065,
        shellAlpha: 0.2,
        shellStroke: 0xc084fc,
        shellStrokeAlpha: 0.48,
        spikeColor: 0xfb7185,
        spikeAlpha: 0.7,
        coreColor: 0xfef3c7,
        coreAlpha: 0.62
      };
    case "armed":
      return {
        shellColor: 0x3b0764,
        shellAlpha: 0.3,
        shellStroke: 0xf5d0fe,
        shellStrokeAlpha: 0.84,
        spikeColor: 0xf472b6,
        spikeAlpha: 0.94,
        coreColor: 0xfef3c7,
        coreAlpha: 0.9
      };
    case "triggered":
      return {
        shellColor: 0x581c87,
        shellAlpha: 0.16,
        shellStroke: 0xf9a8d4,
        shellStrokeAlpha: 0.42,
        spikeColor: 0xf9a8d4,
        spikeAlpha: 0.56,
        coreColor: 0xfef3c7,
        coreAlpha: 0.38
      };
  }
}

export function getTrapPalette(trapType: MatchTrapType, state: MatchTrapState): TrapPalette {
  return trapType === "return_trap" ? getReturnTrapPalette(state) : getIceTrapPalette(state);
}

export function getFrozenPrisonMetrics(tileSize: number): FrozenPrisonMetrics {
  return {
    width: Math.max(18, tileSize * 0.92),
    height: Math.max(22, tileSize * 1.06),
    radius: Math.max(7, tileSize * 0.24),
    crackInset: Math.max(3, tileSize * 0.12)
  };
}

export function isFrozenActive(frozenUntil: string | null | undefined, now = Date.now()) {
  if (!frozenUntil) {
    return false;
  }

  const expiresAt = Date.parse(frozenUntil);
  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt > now;
}
