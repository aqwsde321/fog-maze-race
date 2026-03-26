import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { getMapById } from "@fog-maze-race/shared/maps/map-definitions";

vi.mock("../../src/game/pixi/scene-controller.js", () => ({
  createSceneController: vi.fn()
}));

import { GameCanvas } from "../../src/game/GameCanvas.js";
import { PLAYER_MARKER_DIAMETER_RATIO } from "../../src/game/player-marker.js";
import { createPreviewLayout } from "../../src/game/GameCanvas.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("GameCanvas preview layout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "960px";
    container.style.height = "540px";
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the live board composition in waiting mode but hides the connector strip", async () => {
    await act(async () => {
      root.render(<GameCanvas snapshot={buildWaitingSnapshot()} selfPlayerId="player-1" />);
    });

    const startPanel = container.querySelector<HTMLElement>('[data-testid="preview-start-panel"]');
    const mazePanel = container.querySelector<HTMLElement>('[data-testid="preview-maze-panel"]');
    const connectorPanel = container.querySelector('[data-testid="preview-connector-panel"]');
    const startTiles = container.querySelectorAll('[data-testid="preview-start-tile"]');

    expect(startPanel).not.toBeNull();
    expect(mazePanel).not.toBeNull();
    expect(connectorPanel).toBeNull();
    expect(startTiles).toHaveLength(15);
    expect(Number.parseFloat(startPanel!.style.left)).toBeLessThan(Number.parseFloat(mazePanel!.style.left));
    expect(Number.parseFloat(startPanel!.style.width)).toBeLessThan(Number.parseFloat(mazePanel!.style.width));
  });

  it("uses the shared marker size ratio and renders faces for the waiting preview marker", async () => {
    const snapshot = buildWaitingSnapshot();
    const map = getMapById("alpha-run")!;

    await act(async () => {
      root.render(<GameCanvas snapshot={snapshot} selfPlayerId="player-1" />);
    });

    const selfRing = container.querySelector<HTMLElement>('[data-marker-self-ring="true"]');
    const selfDot = container.querySelector<HTMLElement>('[data-marker-shape="circle"]');
    const selfEyes = container.querySelectorAll('[data-marker-eye="true"]');
    const selfFace = container.querySelector('[data-marker-face="flat"]');
    const layout = createPreviewLayout(map, {
      viewportWidth: 960,
      viewportHeight: 540
    });
    const expectedDotSize = Math.max(15, Math.floor(layout.tileSize * PLAYER_MARKER_DIAMETER_RATIO));

    expect(selfDot).not.toBeNull();
    expect(selfRing).not.toBeNull();
    expect(selfEyes).toHaveLength(2);
    expect(selfFace).not.toBeNull();
    expect(selfDot?.style.width).toBe(`${expectedDotSize}px`);
    expect(selfDot?.style.height).toBe(`${expectedDotSize}px`);
  });
});

function buildWaitingSnapshot(): RoomSnapshot {
  const map = getMapById("alpha-run");
  if (!map) {
    throw new Error("alpha-run map not found");
  }

  return {
    revision: 1,
    room: {
      roomId: "room-1",
      name: "Alpha",
      status: "waiting",
      hostPlayerId: "player-1",
      maxPlayers: 15,
      visibilitySize: 7
    },
    members: [
      {
        playerId: "player-1",
        nickname: "아르민",
        color: "#fb7185",
        shape: "circle",
        face: "flat",
        state: "waiting",
        position: map.startSlots[0] ?? { x: 0, y: 1 },
        finishRank: null,
        isHost: true
      }
    ],
    previewMap: {
      mapId: map.mapId,
      width: map.width,
      height: map.height,
      tiles: map.tiles,
      startZone: map.startZone,
      mazeZone: map.mazeZone,
      goalZone: map.goalZone,
      startSlots: map.startSlots,
      connectorTiles: map.connectorTiles,
      visibilityRadius: map.visibilityRadius
    },
    match: null
  };
}
