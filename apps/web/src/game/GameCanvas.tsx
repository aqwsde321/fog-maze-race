import { useEffect, useRef } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

import { createSceneController, type SceneController } from "./pixi/scene-controller.js";

type GameCanvasProps = {
  snapshot: RoomSnapshot | null;
  selfPlayerId: string | null;
};

export function GameCanvas({ snapshot, selfPlayerId }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || controllerRef.current) {
        return;
      }

      const controller = await createSceneController(containerRef.current);
      if (cancelled) {
        controller.destroy();
        return;
      }

      controllerRef.current = controller;
      controller.render(snapshot, selfPlayerId);
    }

    init().catch((error) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.render(snapshot, selfPlayerId);
  }, [snapshot, selfPlayerId]);

  return (
    <div
      ref={containerRef}
      data-testid="game-canvas"
      style={{
        width: "100%",
        minHeight: "420px",
        height: "clamp(420px, 62vh, 760px)",
        display: "grid",
        placeItems: "center",
        borderRadius: "26px",
        overflow: "hidden",
        background: "rgba(7, 17, 31, 0.94)",
        border: "1px solid rgba(56, 189, 248, 0.18)"
      }}
    />
  );
}
