import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { AdminMapRecord, UpsertAdminMapPayload } from "@fog-maze-race/shared/contracts/admin-maps";
import { DEFAULT_ITEM_BOX_SPAWN_RULE, type MapFeatureFlags } from "@fog-maze-race/shared/domain/item";
import { PLAYABLE_MAZE_SIZE, createBlankMazeRows } from "@fog-maze-race/shared/maps/map-definitions";

type SaveMode = "create" | "update";
type PaintTool = "wall" | "path" | "goal" | "fakeGoal";

type DraftMap = {
  mapId: string;
  name: string;
  mazeRows: string[];
  featureFlags: Required<MapFeatureFlags>;
};

const TOOLS: Array<{
  id: PaintTool;
  label: string;
  tile: "." | "#" | "G" | "F";
}> = [
  { id: "path", label: "통로", tile: "." },
  { id: "wall", label: "벽", tile: "#" },
  { id: "goal", label: "골", tile: "G" },
  { id: "fakeGoal", label: "꽝", tile: "F" }
];

export function AdminMapsPage() {
  const [maps, setMaps] = useState<AdminMapRecord[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mode, setMode] = useState<SaveMode>("update");
  const [draft, setDraft] = useState<DraftMap>(() => createDraft());
  const [selectedTool, setSelectedTool] = useState<PaintTool>("path");
  const [isPainting, setIsPainting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void loadMaps();
  }, []);

  useEffect(() => {
    function handlePointerUp() {
      setIsPainting(false);
    }

    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const wallRatio = useMemo(() => {
    const cells = draft.mazeRows.join("");
    if (!cells.length) {
      return 0;
    }

    return cells.split("").filter((tile) => tile === "#").length / cells.length;
  }, [draft.mazeRows]);

  const shortestRoute = useMemo(() => findShortestRoute(draft.mazeRows), [draft.mazeRows]);
  const connectedKeys = useMemo(() => new Set(shortestRoute.tiles.map((tile) => `${tile.x},${tile.y}`)), [shortestRoute.tiles]);

  const selectedMap = useMemo(
    () => maps.find((map) => map.mapId === selectedMapId) ?? null,
    [maps, selectedMapId]
  );

  const canDelete = mode === "update" && selectedMap !== null && selectedMap.origin !== "default" && selectedMap.editable;

  async function loadMaps(nextSelectedMapId?: string | null, preserveStatusMessage = false) {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/maps");
      if (!response.ok) {
        throw new Error("맵 목록을 불러오지 못했습니다.");
      }

      const payload = (await response.json()) as { maps: AdminMapRecord[] };
      setMaps(payload.maps);

      const fallbackMap =
        payload.maps.find((map) => map.mapId === nextSelectedMapId) ??
        payload.maps.find((map) => map.editable) ??
        payload.maps[0] ??
        null;

      if (fallbackMap) {
        loadDraftFromMap(fallbackMap, preserveStatusMessage);
      } else {
        startCreate();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "맵 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function loadDraftFromMap(map: AdminMapRecord, preserveStatusMessage = false) {
    setSelectedMapId(map.mapId);
    setMode(map.editable ? "update" : "create");
    setDraft({
      mapId: map.mapId,
      name: map.name,
      mazeRows: normalizeMazeRows(map.mazeRows),
      featureFlags: normalizeFeatureFlags(map.featureFlags)
    });
    if (!preserveStatusMessage) {
      setStatusMessage(null);
    }
    setErrorMessage(null);
  }

  function startCreate() {
    setSelectedMapId(null);
    setMode("create");
    setSelectedTool("path");
    setDraft(createDraft());
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const name = draft.name.trim();
    const payload: UpsertAdminMapPayload = {
      mapId: mode === "create" ? createGeneratedMapId(name) : draft.mapId.trim(),
      name,
      mazeRows: draft.mazeRows,
      featureFlags: {
        itemBoxes: draft.featureFlags.itemBoxes,
        itemBoxSpawn: {
          mode: draft.featureFlags.itemBoxSpawn.mode,
          value: Math.max(1, Math.floor(draft.featureFlags.itemBoxSpawn.value))
        }
      }
    };

    try {
      const response = await fetch(
        mode === "create" ? "/api/admin/maps" : `/api/admin/maps/${draft.mapId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(
            mode === "create"
              ? payload
              : {
                  name: payload.name,
                  mazeRows: payload.mazeRows,
                  featureFlags: payload.featureFlags
                }
          )
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(toErrorMessage(body?.message));
      }

      const result = (await response.json()) as { map: AdminMapRecord };
      setStatusMessage(mode === "create" ? "맵을 생성했습니다." : "맵을 저장했습니다.");
      await loadMaps(result.map.mapId, true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "맵 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedMapId || !canDelete) {
      return;
    }

    setDeleting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/maps/${selectedMapId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(toErrorMessage(body?.message));
      }

      setStatusMessage("맵을 삭제했습니다.");
      await loadMaps(selectedMapId, true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "맵 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  function paintCell(rowIndex: number, columnIndex: number) {
    setDraft((current) => ({
      ...current,
      mazeRows: applyPaint(current.mazeRows, rowIndex, columnIndex, selectedTool)
    }));
  }

  function handleCellPointerDown(rowIndex: number, columnIndex: number) {
    paintCell(rowIndex, columnIndex);
    setIsPainting(true);
  }

  function handleCellPointerEnter(rowIndex: number, columnIndex: number) {
    if (!isPainting) {
      return;
    }

    paintCell(rowIndex, columnIndex);
  }

  function handleReset() {
    setDraft((current) => ({
      ...current,
      mazeRows: createBlankMazeRows()
    }));
  }

  return (
    <section style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div style={sidebarHeaderStyle}>
          <h2 style={sidebarTitleStyle}>맵 관리</h2>
          <button type="button" onClick={startCreate} style={primaryButtonStyle}>
            새 맵
          </button>
        </div>
        <div style={mapListStyle}>
          {loading ? (
            <p style={hintStyle}>목록을 불러오는 중입니다.</p>
          ) : (
            maps.map((map) => (
              <button
                key={map.mapId}
                type="button"
                onClick={() => loadDraftFromMap(map)}
                style={{
                  ...mapItemStyle,
                  ...(map.mapId === selectedMapId ? activeMapItemStyle : null)
                }}
              >
                <strong style={mapNameStyle}>{map.name}</strong>
                <div style={mapMetaRowStyle}>
                  <span style={mapMetaStyle}>
                    {map.width}x{map.height}
                  </span>
                  <span style={badgeStyle(map.origin)}>{originLabel(map.origin)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <div style={editorShellStyle}>
        <header style={editorHeaderStyle}>
          <div>
            <h1 style={editorTitleStyle}>{mode === "create" ? "새 맵" : draft.name || "맵 수정"}</h1>
            <p style={editorMetaStyle}>{PLAYABLE_MAZE_SIZE}x{PLAYABLE_MAZE_SIZE}</p>
          </div>
          <div style={headerStatsStyle}>
            <span style={statChipStyle}>벽 {(wallRatio * 100).toFixed(0)}%</span>
            <span style={statChipStyle}>
              최단경로 {shortestRoute.tiles.length}칸{shortestRoute.reachesGoal ? " · 골 연결됨" : ""}
            </span>
          </div>
        </header>

        {statusMessage ? <p style={successBannerStyle}>{statusMessage}</p> : null}
        {errorMessage ? <p style={errorBannerStyle}>{errorMessage}</p> : null}

        <section style={editorCardStyle}>
          <div style={topBarStyle}>
            <label style={fieldLabelStyle}>
              이름
              <input
                aria-label="맵 이름"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                style={inputStyle}
              />
            </label>

            <div style={actionsStyle}>
              {canDelete ? (
                <button type="button" onClick={handleDelete} disabled={deleting} style={dangerButtonStyle}>
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              ) : null}
              <button type="button" onClick={handleReset} style={ghostButtonStyle}>
                초기화
              </button>
              <button type="button" onClick={handleSave} disabled={saving} style={saveButtonStyle}>
                {saving ? "저장 중..." : mode === "create" ? "맵 생성" : "변경 저장"}
              </button>
            </div>
          </div>

          <div style={itemSettingsRowStyle}>
            <label style={checkboxFieldStyle}>
              <input
                aria-label="아이템 박스 사용"
                type="checkbox"
                checked={draft.featureFlags.itemBoxes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    featureFlags: {
                      ...current.featureFlags,
                      itemBoxes: event.target.checked
                    }
                  }))
                }
              />
              <span>아이템 박스 사용</span>
            </label>

            <div style={spawnRuleGroupStyle}>
              <span style={fieldLabelCaptionStyle}>생성 규칙</span>
              <div style={spawnRuleOptionsStyle}>
                <label style={radioFieldStyle}>
                  <input
                    aria-label="참가자 수 배수"
                    type="radio"
                    name="item-box-spawn-mode"
                    checked={draft.featureFlags.itemBoxSpawn.mode === "per_racer"}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        featureFlags: {
                          ...current.featureFlags,
                          itemBoxSpawn: {
                            ...current.featureFlags.itemBoxSpawn,
                            mode: "per_racer"
                          }
                        }
                      }))
                    }
                  />
                  <span>참가자 수 배수</span>
                </label>
                <label style={radioFieldStyle}>
                  <input
                    aria-label="고정 개수"
                    type="radio"
                    name="item-box-spawn-mode"
                    checked={draft.featureFlags.itemBoxSpawn.mode === "fixed"}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        featureFlags: {
                          ...current.featureFlags,
                          itemBoxSpawn: {
                            ...current.featureFlags.itemBoxSpawn,
                            mode: "fixed"
                          }
                        }
                      }))
                    }
                  />
                  <span>고정 개수</span>
                </label>
              </div>
            </div>

            <label style={fieldLabelStyle}>
              {draft.featureFlags.itemBoxSpawn.mode === "per_racer" ? "배수" : "생성 개수"}
              <input
                aria-label="생성 개수"
                type="number"
                min={1}
                step={1}
                value={draft.featureFlags.itemBoxSpawn.value}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    featureFlags: {
                      ...current.featureFlags,
                      itemBoxSpawn: {
                        ...current.featureFlags.itemBoxSpawn,
                        value: Number(event.target.value || 1)
                      }
                    }
                  }))
                }
                style={inputStyle}
              />
            </label>
          </div>

          <div style={toolRowStyle}>
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                aria-label={`${tool.label} 도구`}
                onClick={() => setSelectedTool(tool.id)}
                style={{
                  ...toolButtonStyle,
                  ...(selectedTool === tool.id ? activeToolButtonStyle : null)
                }}
              >
                <span style={toolSwatchStyle(tool.tile)} />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>

          <div
            role="grid"
            aria-label="미로 편집 그리드"
            style={{
              ...mazeEditorGridStyle,
              gridTemplateColumns: `repeat(${PLAYABLE_MAZE_SIZE}, 1fr)`
            }}
          >
            {draft.mazeRows.flatMap((row, rowIndex) =>
              row.split("").map((tile, columnIndex) => (
                <button
                  key={`${rowIndex}-${columnIndex}`}
                  type="button"
                  aria-label={`maze-cell-${rowIndex}-${columnIndex}`}
                  data-testid={`maze-cell-${rowIndex}-${columnIndex}`}
                  data-connected-route={connectedKeys.has(`${columnIndex},${rowIndex}`) ? "true" : "false"}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    handleCellPointerDown(rowIndex, columnIndex);
                  }}
                  onPointerEnter={() => handleCellPointerEnter(rowIndex, columnIndex)}
                  onClick={() => paintCell(rowIndex, columnIndex)}
                  style={mazeEditorCellStyle(tile, connectedKeys.has(`${columnIndex},${rowIndex}`))}
                  title={`${columnIndex},${rowIndex}`}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function createDraft(): DraftMap {
  return {
    mapId: "",
    name: "",
    mazeRows: createBlankMazeRows(),
    featureFlags: normalizeFeatureFlags()
  };
}

function normalizeFeatureFlags(featureFlags?: MapFeatureFlags): Required<MapFeatureFlags> {
  return {
    itemBoxes: featureFlags?.itemBoxes ?? false,
    itemBoxSpawn: {
      mode: featureFlags?.itemBoxSpawn?.mode ?? DEFAULT_ITEM_BOX_SPAWN_RULE.mode,
      value: featureFlags?.itemBoxSpawn?.value ?? DEFAULT_ITEM_BOX_SPAWN_RULE.value
    }
  };
}

function normalizeMazeRows(rows: string[]) {
  return rows.map((row) => row.trim()).slice(0, PLAYABLE_MAZE_SIZE);
}

function applyPaint(mazeRows: string[], rowIndex: number, columnIndex: number, tool: PaintTool) {
  const nextRows = mazeRows.map((row) => row.split(""));

  if (tool === "goal") {
    for (const row of nextRows) {
      for (let index = 0; index < row.length; index += 1) {
        if (row[index] === "G") {
          row[index] = ".";
        }
      }
    }

    nextRows[rowIndex]![columnIndex] = "G";
    return nextRows.map((row) => row.join(""));
  }

  nextRows[rowIndex]![columnIndex] = tool === "wall" ? "#" : tool === "fakeGoal" ? "F" : ".";
  return nextRows.map((row) => row.join(""));
}

function findShortestRoute(mazeRows: string[]) {
  const queue = findEntryPoints(mazeRows);
  const visited = new Set<string>();
  const parents = new Map<string, string | null>();

  for (const entry of queue) {
    const key = `${entry.x},${entry.y}`;
    visited.add(key);
    parents.set(key, null);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.x},${current.y}`;

    if (mazeRows[current.y]?.[current.x] === "G") {
      return {
        tiles: restorePath(currentKey, parents),
        reachesGoal: true
      };
    }

    for (const next of getNeighbors(current.x, current.y, mazeRows)) {
      const nextKey = `${next.x},${next.y}`;
      if (visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      parents.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  return {
    tiles: [],
    reachesGoal: false
  };
}

function findEntryPoints(mazeRows: string[]) {
  const entries: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < Math.min(5, mazeRows.length); y += 1) {
    const tile = mazeRows[y]?.[0];
    if (tile === "." || tile === "G" || tile === "F") {
      entries.push({ x: 0, y });
    }
  }

  return entries;
}

function getNeighbors(x: number, y: number, mazeRows: string[]) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ].filter((position) => {
    const tile = mazeRows[position.y]?.[position.x];
    return tile === "." || tile === "G" || tile === "F";
  });
}

function restorePath(goalKey: string, parents: Map<string, string | null>) {
  const path: Array<{ x: number; y: number }> = [];
  let cursor: string | null = goalKey;

  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    path.push({ x, y });
    cursor = parents.get(cursor) ?? null;
  }

  return path.reverse();
}

function createGeneratedMapId(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = Date.now().toString(36).slice(-6);
  return `${slug || "map"}-${suffix}`;
}

function toErrorMessage(message?: string) {
  switch (message) {
    case "MAP_ID_INVALID":
      return "자동 생성된 맵 ID가 유효하지 않습니다.";
    case "MAP_SIZE_INVALID":
      return "플레이 맵은 25x25 크기여야 합니다.";
    case "MAP_ENTRY_BLOCKED":
      return "첫 열 상단 5칸 안에 입구가 1칸 이상 있어야 합니다.";
    case "MAP_UNREACHABLE":
      return "입구에서 골까지 도달 가능한 경로가 있어야 합니다.";
    case "MAP_GOAL_INVALID":
      return "골 타일은 정확히 1개만 있어야 합니다.";
    case "MAP_ALREADY_EXISTS":
    case "MAP_ID_CONFLICT":
      return "같은 ID의 맵이 이미 있습니다.";
    case "MAP_NOT_EDITABLE":
      return "이 맵은 수정할 수 없습니다.";
    case "MAP_NOT_FOUND":
      return "맵을 찾을 수 없습니다.";
    default:
      return "맵 저장에 실패했습니다.";
  }
}

function originLabel(origin: AdminMapRecord["origin"]) {
  switch (origin) {
    case "default":
      return "기본";
    case "override":
      return "수정";
    case "custom":
      return "커스텀";
  }
}

function badgeStyle(origin: AdminMapRecord["origin"]): CSSProperties {
  return {
    ...baseBadgeStyle,
    ...(origin === "custom"
      ? { background: "rgba(14, 165, 233, 0.12)", color: "#7dd3fc" }
      : origin === "override"
        ? { background: "rgba(245, 158, 11, 0.12)", color: "#fcd34d" }
        : { background: "rgba(148, 163, 184, 0.1)", color: "#cbd5e1" })
  };
}

function toolSwatchStyle(tile: "." | "#" | "G" | "F"): CSSProperties {
  return {
    ...toolSwatchBaseStyle,
    background: tile === "#" ? "#6d7d92" : tile === "G" || tile === "F" ? "#facc15" : "#1e3a5f"
  };
}

function mazeEditorCellStyle(tile: string, isConnectedRoute: boolean): CSSProperties {
  return {
    ...basePreviewTileStyle,
    width: "20px",
    border: 0,
    padding: 0,
    cursor: "crosshair",
    userSelect: "none",
    touchAction: "none",
    background: tile === "#" ? "#6d7d92" : tile === "G" || tile === "F" ? "#facc15" : "#1e3a5f",
    boxShadow: isConnectedRoute ? "inset 0 0 0 2px rgba(56, 189, 248, 0.92)" : "none"
  };
}

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px minmax(0, 1fr)",
  gap: "18px",
  width: "100%",
  maxWidth: "1280px",
  margin: "0 auto",
  alignItems: "start"
};

const sidebarStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const sidebarHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px"
};

const sidebarTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.2rem"
};

const primaryButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 14px",
  borderRadius: "999px",
  border: 0,
  background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
  color: "#082032",
  fontWeight: 700,
  cursor: "pointer"
};

const mapListStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "18px",
  maxHeight: "calc(100vh - 180px)",
  overflowY: "auto"
};

const mapItemStyle: CSSProperties = {
  width: "100%",
  display: "grid",
  gap: "8px",
  padding: "12px 13px",
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  background: "rgba(15, 23, 42, 0.6)",
  color: "#e2e8f0",
  cursor: "pointer",
  textAlign: "left"
};

const activeMapItemStyle: CSSProperties = {
  border: "1px solid rgba(56, 189, 248, 0.28)",
  background: "rgba(10, 24, 40, 0.94)"
};

const mapNameStyle: CSSProperties = {
  display: "block",
  fontSize: "0.96rem"
};

const mapMetaRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px"
};

const mapMetaStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.76rem"
};

const baseBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "48px",
  padding: "4px 8px",
  borderRadius: "999px",
  fontSize: "0.72rem",
  whiteSpace: "nowrap"
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8"
};

const editorShellStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: "14px"
};

const editorHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "16px 18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const headerStatsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap"
};

const editorTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.3rem"
};

const editorMetaStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#94a3b8",
  fontSize: "0.8rem"
};

const statChipStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: "999px",
  background: "rgba(15, 23, 42, 0.84)",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  fontSize: "0.78rem",
  color: "#cbd5e1"
};

const successBannerStyle: CSSProperties = {
  margin: 0,
  padding: "12px 14px",
  borderRadius: "16px",
  background: "rgba(34, 197, 94, 0.14)",
  border: "1px solid rgba(34, 197, 94, 0.24)",
  color: "#bbf7d0"
};

const errorBannerStyle: CSSProperties = {
  margin: 0,
  padding: "12px 14px",
  borderRadius: "16px",
  background: "rgba(239, 68, 68, 0.14)",
  border: "1px solid rgba(248, 113, 113, 0.22)",
  color: "#fecaca"
};

const editorCardStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: "16px"
};

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  minWidth: "280px",
  fontSize: "0.86rem",
  color: "#cbd5e1"
};

const itemSettingsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 220px) minmax(260px, 1fr) minmax(140px, 180px)",
  gap: "16px",
  marginTop: "16px",
  marginBottom: "14px",
  alignItems: "end"
};

const checkboxFieldStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "40px",
  color: "#cbd5e1",
  fontSize: "0.86rem"
};

const spawnRuleGroupStyle: CSSProperties = {
  display: "grid",
  gap: "8px"
};

const fieldLabelCaptionStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: "0.84rem"
};

const spawnRuleOptionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap"
};

const radioFieldStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "#cbd5e1",
  fontSize: "0.84rem"
};

const inputStyle: CSSProperties = {
  minHeight: "40px",
  padding: "10px 12px",
  borderRadius: "13px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#f8fafc"
};

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px"
};

const ghostButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#cbd5e1",
  cursor: "pointer"
};

const saveButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "9px 16px",
  borderRadius: "999px",
  border: 0,
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer"
};

const dangerButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "9px 16px",
  borderRadius: "999px",
  border: "1px solid rgba(248, 113, 113, 0.24)",
  background: "rgba(127, 29, 29, 0.42)",
  color: "#fecaca",
  fontWeight: 700,
  cursor: "pointer"
};

const toolRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  marginTop: "16px"
};

const toolButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "40px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  background: "rgba(15, 23, 42, 0.68)",
  color: "#e2e8f0",
  cursor: "pointer"
};

const activeToolButtonStyle: CSSProperties = {
  border: "1px solid rgba(56, 189, 248, 0.3)",
  background: "rgba(9, 29, 48, 0.92)"
};

const toolSwatchBaseStyle: CSSProperties = {
  width: "14px",
  height: "14px",
  borderRadius: "4px",
  flexShrink: 0
};

const mazeEditorGridStyle: CSSProperties = {
  display: "grid",
  gap: "2px",
  padding: "12px",
  borderRadius: "18px",
  background: "rgba(5, 15, 28, 0.96)",
  width: "fit-content",
  marginTop: "18px",
  userSelect: "none"
};

const basePreviewTileStyle: CSSProperties = {
  aspectRatio: "1 / 1"
};
