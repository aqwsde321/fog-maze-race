import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { AdminMapRecord, UpsertAdminMapPayload } from "@fog-maze-race/shared/contracts/admin-maps";
import { PLAYABLE_MAZE_SIZE, createBlankMazeRows } from "@fog-maze-race/shared/maps/map-definitions";

type SaveMode = "create" | "update";
type PaintTool = "wall" | "path" | "goal";

type DraftMap = {
  mapId: string;
  name: string;
  mazeRows: string[];
};

const TOOLS: Array<{
  id: PaintTool;
  label: string;
  tile: "." | "#" | "G";
  description: string;
}> = [
  {
    id: "path",
    label: "통로",
    tile: ".",
    description: "이동 가능한 길을 엽니다."
  },
  {
    id: "wall",
    label: "벽",
    tile: "#",
    description: "막힌 벽을 배치합니다."
  },
  {
    id: "goal",
    label: "골",
    tile: "G",
    description: "골 타일은 항상 1개만 유지됩니다."
  }
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

  const pathCount = useMemo(
    () =>
      draft.mazeRows
        .join("")
        .split("")
        .filter((tile) => tile === "." || tile === "G").length,
    [draft.mazeRows]
  );

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
      mazeRows: normalizeMazeRows(map.mazeRows)
    });
    if (!preserveStatusMessage) {
      setStatusMessage(null);
    }
    setErrorMessage(null);
  }

  function startCreate() {
    setSelectedMapId(null);
    setMode("create");
    setDraft(createDraft());
    setSelectedTool("path");
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const payload: UpsertAdminMapPayload = {
      mapId: draft.mapId.trim(),
      name: draft.name.trim(),
      mazeRows: draft.mazeRows
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
                  mazeRows: payload.mazeRows
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

  function handleResetToDefault() {
    setDraft((current) => ({
      ...current,
      mazeRows: createBlankMazeRows()
    }));
  }

  return (
    <section style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div style={sidebarHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Admin URL</p>
            <h2 style={sidebarTitleStyle}>맵 관리</h2>
          </div>
          <button type="button" onClick={startCreate} style={primaryButtonStyle}>
            새 맵
          </button>
        </div>
        <p style={sidebarCopyStyle}>기본 격자는 25x25로 고정됩니다. 벽, 통로, 골 도구를 선택한 뒤 클릭하거나 드래그해서 미로를 편집하세요.</p>
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
                <div>
                  <strong style={mapNameStyle}>{map.name}</strong>
                  <p style={mapMetaStyle}>
                    {map.mapId} · {map.width}x{map.height}
                  </p>
                </div>
                <span style={badgeStyle(map.origin)}>{originLabel(map.origin)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div style={editorShellStyle}>
        <header style={editorHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Map Editor</p>
            <h1 style={editorTitleStyle}>{mode === "create" ? "새 플레이 맵 생성" : "플레이 맵 수정"}</h1>
          </div>
          <div style={editorStatsStyle}>
            <span style={statChipStyle}>벽 비율 {(wallRatio * 100).toFixed(0)}%</span>
            <span style={statChipStyle}>이동 칸 {pathCount}개</span>
            <span style={statChipStyle}>
              {PLAYABLE_MAZE_SIZE}x{PLAYABLE_MAZE_SIZE}
            </span>
          </div>
        </header>

        {statusMessage ? <p style={successBannerStyle}>{statusMessage}</p> : null}
        {errorMessage ? <p style={errorBannerStyle}>{errorMessage}</p> : null}

        <div style={editorGridStyle}>
          <section style={formCardStyle}>
            <div style={fieldGridStyle}>
              <label style={fieldLabelStyle}>
                맵 ID
                <input
                  value={draft.mapId}
                  onChange={(event) => setDraft((current) => ({ ...current, mapId: event.target.value }))}
                  disabled={mode === "update"}
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                맵 이름
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={toolSectionStyle}>
              <div style={toolHeaderStyle}>
                <div>
                  <strong style={toolTitleStyle}>도구 선택</strong>
                  <p style={toolCopyStyle}>클릭으로 한 칸, 드래그로 연속 칠하기가 가능합니다.</p>
                </div>
                <button type="button" onClick={handleResetToDefault} style={ghostButtonStyle}>
                  기본 경로로 초기화
                </button>
              </div>
              <div style={toolGridStyle}>
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
                    <span>
                      <strong style={toolButtonLabelStyle}>{tool.label}</strong>
                      <span style={toolButtonMetaStyle}>{tool.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={editorStageFrameStyle}>
              <div style={editorStageStyle}>
                <div>
                  <p style={stageLabelStyle}>시작 구역</p>
                  <div style={startPreviewStyle}>
                    {Array.from({ length: 15 }, (_, index) => (
                      <span key={index} style={startTileStyle} />
                    ))}
                  </div>
                </div>
                <div>
                  <p style={stageLabelStyle}>연결 통로</p>
                  <div style={connectorPreviewStyle}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} style={connectorTileStyle} />
                    ))}
                  </div>
                </div>
                <div style={mazeEditorShellStyle}>
                  <div style={mazeEditorHeaderStyle}>
                    <div>
                      <strong style={toolTitleStyle}>미로 영역 편집</strong>
                      <p style={toolCopyStyle}>왼쪽 시작 구역과 연결되는 첫 열은 최소 1칸 이상 열려 있어야 저장됩니다.</p>
                    </div>
                    <span style={selectedToolChipStyle}>{toolLabel(selectedTool)}</span>
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
                          onPointerDown={(event) => {
                            event.preventDefault();
                            handleCellPointerDown(rowIndex, columnIndex);
                          }}
                          onPointerEnter={() => handleCellPointerEnter(rowIndex, columnIndex)}
                          onClick={() => paintCell(rowIndex, columnIndex)}
                          style={mazeEditorCellStyle(tile)}
                          title={`${columnIndex},${rowIndex}`}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={legendStyle}>
              <span style={legendChipStyle}>벽을 깎아 길을 만듭니다.</span>
              <span style={legendChipStyle}>골은 자동으로 1개만 유지됩니다.</span>
              <span style={legendChipStyle}>드래그로 빠르게 페인트할 수 있습니다.</span>
            </div>

            <div style={formActionsStyle}>
              <button type="button" onClick={handleSave} disabled={saving} style={saveButtonStyle}>
                {saving ? "저장 중..." : mode === "create" ? "맵 생성" : "변경 저장"}
              </button>
            </div>
          </section>

          <section style={previewCardStyle}>
            <div style={previewHeaderStyle}>
              <h3 style={previewTitleStyle}>제약과 검증</h3>
              <p style={previewBodyStyle}>저장 시 서버가 입구 연결, 골 개수, 도달 가능 경로를 다시 검사합니다. 오른쪽 카드는 관리자가 놓치기 쉬운 규칙을 빠르게 확인하기 위한 요약입니다.</p>
            </div>

            <div style={inspectorStackStyle}>
              <article style={inspectorCardStyle}>
                <strong style={inspectorTitleStyle}>고정 영역</strong>
                <p style={inspectorBodyStyle}>시작 구역 3x5와 연결 통로 1x5는 고정입니다. 편집 대상은 오른쪽 25x25 미로뿐입니다.</p>
              </article>
              <article style={inspectorCardStyle}>
                <strong style={inspectorTitleStyle}>필수 조건</strong>
                <p style={inspectorBodyStyle}>첫 열 상단 5칸 안에는 시작 구역과 이어지는 입구가 1칸 이상 있어야 하고, 골은 정확히 1개여야 합니다.</p>
              </article>
              <article style={inspectorCardStyle}>
                <strong style={inspectorTitleStyle}>난이도 팁</strong>
                <p style={inspectorBodyStyle}>초반 입구만 열어 두고 나머지는 벽 중심으로 시작한 뒤, 골까지 이어지는 우회 경로를 조금씩 파내면 더 복잡한 맵을 만들 수 있습니다.</p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function createDraft(): DraftMap {
  return {
    mapId: "",
    name: "",
    mazeRows: createBlankMazeRows()
  };
}

function normalizeMazeRows(value: string[] | string) {
  if (Array.isArray(value)) {
    return value.map((row) => row.trim()).slice(0, PLAYABLE_MAZE_SIZE);
  }

  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .slice(0, PLAYABLE_MAZE_SIZE);
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

  nextRows[rowIndex]![columnIndex] = tool === "wall" ? "#" : ".";
  return nextRows.map((row) => row.join(""));
}

function toolLabel(tool: PaintTool) {
  return TOOLS.find((item) => item.id === tool)?.label ?? "도구";
}

function toErrorMessage(message?: string) {
  switch (message) {
    case "MAP_ID_INVALID":
      return "맵 ID는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.";
    case "MAP_SIZE_INVALID":
      return "플레이 맵은 25x25 크기로 입력해야 합니다.";
    case "MAP_ENTRY_BLOCKED":
      return "시작 구역에서 이어지는 첫 열 입구가 최소 1개는 열려 있어야 합니다.";
    case "MAP_UNREACHABLE":
      return "시작 입구에서 골까지 도달 가능한 경로가 있어야 합니다.";
    case "MAP_GOAL_INVALID":
      return "골 타일은 정확히 1개만 있어야 합니다.";
    case "MAP_ALREADY_EXISTS":
    case "MAP_ID_CONFLICT":
      return "같은 ID의 맵이 이미 있습니다.";
    case "MAP_NOT_EDITABLE":
      return "이 맵은 수정할 수 없습니다.";
    default:
      return "맵 저장에 실패했습니다.";
  }
}

function originLabel(origin: AdminMapRecord["origin"]) {
  switch (origin) {
    case "default":
      return "기본";
    case "override":
      return "기본 수정";
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

function toolSwatchStyle(tile: "." | "#" | "G"): CSSProperties {
  return {
    ...toolSwatchBaseStyle,
    ...(tile === "#"
      ? { background: "#6d7d92" }
      : tile === "G"
        ? { background: "#facc15" }
        : { background: "#1e3a5f" })
  };
}

function mazeEditorCellStyle(tile: string): CSSProperties {
  return {
    ...basePreviewTileStyle,
    width: "18px",
    border: 0,
    padding: 0,
    cursor: "crosshair",
    userSelect: "none",
    touchAction: "none",
    background: tile === "#" ? "#6d7d92" : tile === "G" ? "#facc15" : "#1e3a5f"
  };
}

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr)",
  gap: "18px",
  width: "100%",
  maxWidth: "1380px",
  margin: "0 auto",
  alignItems: "start"
};

const sidebarStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.16)"
};

const sidebarHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px"
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.74rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#7dd3fc"
};

const sidebarTitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.32rem"
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

const sidebarCopyStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#94a3b8",
  lineHeight: 1.6,
  fontSize: "0.88rem"
};

const mapListStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "18px",
  maxHeight: "calc(100vh - 240px)",
  overflowY: "auto"
};

const mapItemStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
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

const mapMetaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#94a3b8",
  fontSize: "0.76rem"
};

const baseBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "54px",
  padding: "5px 9px",
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
  alignItems: "flex-end",
  gap: "14px",
  padding: "16px 18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const editorTitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.46rem"
};

const editorStatsStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap"
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

const editorGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: "16px"
};

const formCardStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 220px) minmax(0, 1fr)",
  gap: "12px"
};

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  fontSize: "0.86rem",
  color: "#cbd5e1"
};

const inputStyle: CSSProperties = {
  minHeight: "40px",
  padding: "10px 12px",
  borderRadius: "13px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#f8fafc"
};

const toolSectionStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
  marginTop: "18px"
};

const toolHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px"
};

const toolTitleStyle: CSSProperties = {
  display: "block",
  fontSize: "0.94rem",
  color: "#f8fafc"
};

const toolCopyStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#94a3b8",
  fontSize: "0.82rem",
  lineHeight: 1.5
};

const ghostButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#cbd5e1",
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const toolGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px"
};

const toolButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "62px",
  padding: "10px 12px",
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  background: "rgba(15, 23, 42, 0.68)",
  color: "#e2e8f0",
  cursor: "pointer",
  textAlign: "left"
};

const activeToolButtonStyle: CSSProperties = {
  border: "1px solid rgba(56, 189, 248, 0.3)",
  background: "rgba(9, 29, 48, 0.92)"
};

const toolSwatchBaseStyle: CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "6px",
  flexShrink: 0
};

const toolButtonLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.88rem"
};

const toolButtonMetaStyle: CSSProperties = {
  display: "block",
  marginTop: "4px",
  fontSize: "0.76rem",
  color: "#94a3b8"
};

const editorStageFrameStyle: CSSProperties = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "20px",
  background: "rgba(15, 23, 42, 0.54)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const editorStageStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "86px 34px minmax(0, 1fr)",
  gap: "14px",
  alignItems: "start"
};

const stageLabelStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: "0.76rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#7dd3fc"
};

const startPreviewStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "2px",
  padding: "6px",
  borderRadius: "14px",
  background: "rgba(34, 211, 238, 0.12)"
};

const connectorPreviewStyle: CSSProperties = {
  display: "grid",
  gap: "2px",
  padding: "6px 0"
};

const startTileStyle: CSSProperties = {
  width: "22px",
  aspectRatio: "1 / 1",
  background: "#26cfe6"
};

const connectorTileStyle: CSSProperties = {
  width: "22px",
  aspectRatio: "1 / 1",
  background: "#18b6a4"
};

const mazeEditorShellStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: "12px"
};

const mazeEditorHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px"
};

const selectedToolChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "30px",
  padding: "0 12px",
  borderRadius: "999px",
  background: "rgba(56, 189, 248, 0.12)",
  color: "#7dd3fc",
  fontSize: "0.78rem",
  whiteSpace: "nowrap"
};

const mazeEditorGridStyle: CSSProperties = {
  display: "grid",
  gap: "2px",
  padding: "8px",
  borderRadius: "16px",
  background: "rgba(5, 15, 28, 0.96)",
  width: "fit-content",
  userSelect: "none"
};

const legendStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "14px"
};

const legendChipStyle: CSSProperties = {
  padding: "6px 9px",
  borderRadius: "999px",
  background: "rgba(15, 23, 42, 0.84)",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  fontSize: "0.76rem",
  color: "#94a3b8"
};

const formActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "18px"
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

const previewCardStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.92), rgba(7, 16, 30, 0.88))",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const previewHeaderStyle: CSSProperties = {
  display: "grid",
  gap: "6px"
};

const previewTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1rem"
};

const previewBodyStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.82rem",
  lineHeight: 1.55
};

const inspectorStackStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "16px"
};

const inspectorCardStyle: CSSProperties = {
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(15, 23, 42, 0.66)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const inspectorTitleStyle: CSSProperties = {
  display: "block",
  fontSize: "0.88rem",
  color: "#f8fafc"
};

const inspectorBodyStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#94a3b8",
  fontSize: "0.8rem",
  lineHeight: 1.55
};

const basePreviewTileStyle: CSSProperties = {
  aspectRatio: "1 / 1"
};
