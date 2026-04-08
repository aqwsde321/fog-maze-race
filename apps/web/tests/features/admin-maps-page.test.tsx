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

  it("loads editable maps and submits a new map payload with clicked cells", async () => {
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
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector("textarea")).toBeNull();

    await act(async () => {
      setElementValue(inputs[0] as HTMLInputElement, "Gamma Lock");
    });

    const paintedCell = container.querySelector('[data-testid="maze-cell-1-1"]');
    expect(paintedCell).toBeTruthy();

    await act(async () => {
      paintedCell!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      featureFlags: {
        itemBoxes: boolean;
        itemBoxSpawn: {
          mode: string;
          value: number;
        };
      };
    };
    expect(body.mapId).toMatch(/^gamma-lock-[a-z0-9]+$/);
    expect(body.name).toBe("Gamma Lock");
    expect(body.mazeRows).toHaveLength(25);
    expect(body.mazeRows[1]?.[1]).toBe(".");
    expect(body.featureFlags).toEqual({
      itemBoxes: false,
      itemBoxSpawn: {
        mode: "per_racer",
        value: 2
      }
    });
  });

  it("deletes a custom map from the editor", async () => {
    const customMap = buildAdminMap({
      mapId: "gamma-lock",
      name: "Gamma Lock",
      origin: "custom"
    });
    const fallbackMap = buildAdminMap({
      mapId: "alpha-run",
      name: "Alpha Run",
      origin: "default"
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ maps: [customMap] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ maps: [fallbackMap] }));

    await act(async () => {
      root.render(<AdminMapsPage />);
    });
    await flush();

    const deleteButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("삭제"));
    expect(deleteButton).toBeTruthy();

    await act(async () => {
      deleteButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/maps/gamma-lock",
      expect.objectContaining({
        method: "DELETE"
      })
    );
    expect(container.textContent).toContain("맵을 삭제했습니다.");
    expect(container.textContent).toContain("Alpha Run");
  });

  it("does not show delete for default maps", async () => {
    const baseMap = buildAdminMap({
      mapId: "alpha-run",
      name: "Alpha Run",
      origin: "default"
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ maps: [baseMap] }));

    await act(async () => {
      root.render(<AdminMapsPage />);
    });
    await flush();

    const deleteButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("삭제"));
    expect(deleteButton).toBeUndefined();
    expect(container.textContent).not.toContain("Training Lap");
  });

  it("marks only the shortest route from the entry to the goal", async () => {
    const baseMap: AdminMapRecord = {
      mapId: "alpha-run",
      name: "Alpha Run",
      mazeRows: createBranchMazeRows(),
      width: 25,
      height: 25,
      origin: "default",
      editable: true,
      updatedAt: null
    };

    fetchMock.mockResolvedValueOnce(jsonResponse({ maps: [baseMap] }));

    await act(async () => {
      root.render(<AdminMapsPage />);
    });
    await flush();

    expect(container.querySelector('[data-testid="maze-cell-2-0"]')?.getAttribute("data-connected-route")).toBe("true");
    expect(container.querySelector('[data-testid="maze-cell-2-4"]')?.getAttribute("data-connected-route")).toBe("true");
    expect(container.querySelector('[data-testid="maze-cell-1-2"]')?.getAttribute("data-connected-route")).toBe("false");
    expect(container.querySelector('[data-testid="maze-cell-4-2"]')?.getAttribute("data-connected-route")).toBe("false");
    expect(container.querySelector('[data-testid="maze-cell-0-0"]')?.getAttribute("data-connected-route")).toBe("false");
  });

  it("lets the editor paint fake goal tiles and includes them in the saved maze rows", async () => {
    const baseMap = buildAdminMap({
      mapId: "alpha-run",
      name: "Alpha Run",
      origin: "default"
    });
    const updatedMap = buildAdminMap({
      mapId: "alpha-run",
      name: "Alpha Run",
      origin: "override"
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ maps: [baseMap] }))
      .mockResolvedValueOnce(jsonResponse({ map: updatedMap }))
      .mockResolvedValueOnce(jsonResponse({ maps: [updatedMap] }));

    await act(async () => {
      root.render(<AdminMapsPage />);
    });
    await flush();

    const fakeGoalTool = [...container.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "꽝 도구");
    const targetCell = container.querySelector('[data-testid="maze-cell-1-1"]');
    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("변경 저장"));

    expect(fakeGoalTool).toBeTruthy();
    expect(targetCell).toBeTruthy();
    expect(saveButton).toBeTruthy();

    await act(async () => {
      fakeGoalTool!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      targetCell!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const body = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string) as {
      name: string;
      mazeRows: string[];
    };

    expect(body.mazeRows[1]?.[1]).toBe("F");
  });

  it("lets the admin enable item boxes and choose a fixed spawn count", async () => {
    const baseMap = buildAdminMap({
      mapId: "alpha-run",
      name: "Alpha Run",
      origin: "default"
    });
    const updatedMap = buildAdminMap({
      mapId: "alpha-run",
      name: "Alpha Run",
      origin: "override",
      featureFlags: {
        itemBoxes: true,
        itemBoxSpawn: {
          mode: "fixed",
          value: 9
        }
      }
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ maps: [baseMap] }))
      .mockResolvedValueOnce(jsonResponse({ map: updatedMap }))
      .mockResolvedValueOnce(jsonResponse({ maps: [updatedMap] }));

    await act(async () => {
      root.render(<AdminMapsPage />);
    });
    await flush();

    const itemToggle = container.querySelector('input[aria-label="아이템 박스 사용"]') as HTMLInputElement | null;
    const fixedMode = container.querySelector('input[aria-label="고정 개수"]') as HTMLInputElement | null;
    const countInput = container.querySelector('input[aria-label="생성 개수"]') as HTMLInputElement | null;
    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("변경 저장"));

    expect(itemToggle).toBeTruthy();
    expect(fixedMode).toBeTruthy();
    expect(countInput).toBeTruthy();
    expect(saveButton).toBeTruthy();

    await act(async () => {
      itemToggle!.click();
      fixedMode!.click();
      setElementValue(countInput!, "9");
    });

    await act(async () => {
      saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const body = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string) as {
      name: string;
      mazeRows: string[];
      featureFlags: {
        itemBoxes: boolean;
        itemBoxSpawn: {
          mode: string;
          value: number;
        };
      };
    };

    expect(body.featureFlags).toEqual({
      itemBoxes: true,
      itemBoxSpawn: {
        mode: "fixed",
        value: 9
      }
    });
  });
});

function buildAdminMap(
  input: Pick<AdminMapRecord, "mapId" | "name" | "origin"> & Pick<Partial<AdminMapRecord>, "featureFlags">
): AdminMapRecord {
  return {
    mapId: input.mapId,
    name: input.name,
    mazeRows: createBlankMazeRows(),
    width: 25,
    height: 25,
    origin: input.origin,
    editable: true,
    updatedAt: null,
    featureFlags: input.featureFlags
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

function createBranchMazeRows() {
  const rows = Array.from({ length: 25 }, () => "#".repeat(25).split(""));
  rows[2]![0] = ".";
  rows[2]![1] = ".";
  rows[2]![2] = ".";
  rows[2]![3] = ".";
  rows[2]![4] = "G";
  rows[1]![2] = ".";
  rows[3]![2] = ".";
  rows[4]![2] = ".";
  return rows.map((row) => row.join(""));
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function setElementValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
