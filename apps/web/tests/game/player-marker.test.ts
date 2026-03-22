import { describe, expect, it } from "vitest";

import { buildPlayerMarkerMetaMap, getContrastTextColor } from "../../src/game/player-marker.js";

describe("player marker meta", () => {
  it("assigns sequential labels and repeating patterns", () => {
    const members = Array.from({ length: 7 }, (_, index) => ({
      playerId: `p${index + 1}`,
      color: "#ff5f7a"
    }));

    const markerMap = buildPlayerMarkerMetaMap(members);

    expect(markerMap.get("p1")).toMatchObject({ label: "1", pattern: "horizontal" });
    expect(markerMap.get("p2")).toMatchObject({ label: "2", pattern: "vertical" });
    expect(markerMap.get("p3")).toMatchObject({ label: "3", pattern: "diagonal-up" });
    expect(markerMap.get("p4")).toMatchObject({ label: "4", pattern: "diagonal-down" });
    expect(markerMap.get("p5")).toMatchObject({ label: "5", pattern: "cross" });
    expect(markerMap.get("p6")).toMatchObject({ label: "6", pattern: "horizontal" });
  });

  it("chooses dark text for light marker fills and light text for dark fills", () => {
    expect(getContrastTextColor("#facc15")).toBe("#08111f");
    expect(getContrastTextColor("#8b5cf6")).toBe("#f8fafc");
  });
});
