import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminMapRecord } from "@fog-maze-race/shared/contracts/admin-maps";
import { createBlankMazeRows } from "@fog-maze-race/shared/maps/map-definitions";

import { AdminMapsPage } from "../../src/features/admin/AdminMapsPage.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AdminMapsPage", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("loads editable maps and submits a new map payload", async () => {
    const baseMap = buildAdminMap({
      mapId: "alpha-run",
      name: "Alpha Run",
      origin: "default"
    });
    const createdMap = buildAdminMap({
      mapId: "gamma-lock",
      name: "Gamma Lock",
      origin: "custom"
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ maps: [baseMap] }))
      .mockResolvedValueOnce(jsonResponse({ map: createdMap }, 201))
      .mockResolvedValueOnce(jsonResponse({ maps: [baseMap, createdMap] }));

    await act(async () => {
      root.render(<AdminMapsPage />);
    });
    await flush();

    expect(container.textContent).toContain("맵 관리");
    expect(container.textContent).toContain("Alpha Run");

    const createButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("새 맵"));
    expect(createButton).toBeTruthy();

    await act(async () => {
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const inputs = container.querySelectorAll("input");
    const textarea = container.querySelector("textarea");
    expect(inputs).toHaveLength(2);
    expect(textarea).toBeTruthy();

    await act(async () => {
      setElementValue(inputs[0] as HTMLInputElement, "gamma-lock");
      setElementValue(inputs[1] as HTMLInputElement, "Gamma Lock");
      setElementValue(textarea as HTMLTextAreaElement, createBlankMazeRows().join("\n"));
    });

    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("맵 생성"));
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/maps",
      expect.objectContaining({
        method: "POST"
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string) as {
      mapId: string;
      name: string;
      mazeRows: string[];
    };
    expect(body.mapId).toBe("gamma-lock");
    expect(body.mazeRows).toHaveLength(25);
  });
});

function buildAdminMap(input: Pick<AdminMapRecord, "mapId" | "name" | "origin">): AdminMapRecord {
  return {
    mapId: input.mapId,
    name: input.name,
    mazeRows: createBlankMazeRows(),
    width: 25,
    height: 25,
    origin: input.origin,
    editable: true,
    updatedAt: null
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json"
      }
    })
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
