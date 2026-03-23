import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { AdminMapRecord, UpsertAdminMapPayload } from "@fog-maze-race/shared/contracts/admin-maps";
import { PLAYABLE_MAZE_SIZE, createBlankMazeRows } from "@fog-maze-race/shared/maps/map-definitions";

type SaveMode = "create" | "update";

type DraftMap = {
  mapId: string;
  name: string;
  mazeText: string;
};

export function AdminMapsPage() {
  const [maps, setMaps] = useState<AdminMapRecord[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mode, setMode] = useState<SaveMode>("update");
  const [draft, setDraft] = useState<DraftMap>(() => createDraft());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadMaps();
  }, []);

  const previewRows = useMemo(() => normalizeMazeText(draft.mazeText), [draft.mazeText]);
  const wallRatio = useMemo(() => {
    const cells = previewRows.join("");
    if (!cells.length) {
      return 0;
    }
    return cells.split("").filter((tile) => tile === "#").length / cells.length;
  }, [previewRows]);

  async function loadMaps(nextSelectedMapId?: string | null) {
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
        loadDraftFromMap(fallbackMap);
      } else {
        startCreate();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "맵 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function loadDraftFromMap(map: AdminMapRecord) {
    setSelectedMapId(map.mapId);
    setMode(map.editable ? "update" : "create");
    setDraft({
      mapId: map.mapId,
      name: map.name,
      mazeText: map.mazeRows.join("\n")
    });
  }

  function startCreate() {
    setSelectedMapId(null);
    setMode("create");
    setDraft(createDraft());
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
      mazeRows: previewRows
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
      await loadMaps(result.map.mapId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "맵 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
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
        <p style={sidebarCopyStyle}>플레이 맵은 25x25 기준으로 만들고, 시작 구역과 연결되는 입구는 최소 1개 이상 열어 둡니다.</p>
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
            <span style={statChipStyle}>{PLAYABLE_MAZE_SIZE}x{PLAYABLE_MAZE_SIZE}</span>
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

            <label style={fieldLabelStyle}>
              미로 본문
              <textarea
                value={draft.mazeText}
                onChange={(event) => setDraft((current) => ({ ...current, mazeText: event.target.value }))}
                spellCheck={false}
                style={textareaStyle}
              />
            </label>

            <div style={legendStyle}>
              <span style={legendChipStyle}>`.` 통로</span>
              <span style={legendChipStyle}>`#` 벽</span>
              <span style={legendChipStyle}>`G` 골</span>
              <span style={legendChipStyle}>줄 수 25개, 각 줄 25글자</span>
            </div>

            <div style={formActionsStyle}>
              <button type="button" onClick={handleSave} disabled={saving} style={saveButtonStyle}>
                {saving ? "저장 중..." : mode === "create" ? "맵 생성" : "변경 저장"}
              </button>
            </div>
          </section>

          <section style={previewCardStyle}>
            <div style={previewHeaderStyle}>
              <h3 style={previewTitleStyle}>실시간 미리보기</h3>
              <p style={previewBodyStyle}>시작 구역과 연결 통로는 고정입니다. 오른쪽 25x25만 편집됩니다.</p>
            </div>
            <div style={previewFrameStyle}>
              <div style={previewStageStyle}>
                <div style={startPreviewStyle}>
                  {Array.from({ length: 15 }, (_, index) => (
                    <span key={index} style={startTileStyle} />
                  ))}
                </div>
                <div style={connectorPreviewStyle}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <span key={index} style={connectorTileStyle} />
                  ))}
                </div>
                <div
                  style={{
                    ...mazePreviewStyle,
                    gridTemplateColumns: `repeat(${PLAYABLE_MAZE_SIZE}, 1fr)`
                  }}
                >
                  {previewRows.flatMap((row, rowIndex) =>
                    row.split("").map((tile, columnIndex) => (
                      <span
                        key={`${rowIndex}-${columnIndex}`}
                        style={previewTileStyle(tile)}
                        title={`${columnIndex},${rowIndex}`}
                      />
                    ))
                  )}
                </div>
              </div>
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
    mazeText: createBlankMazeRows().join("\n")
  };
}

function normalizeMazeText(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
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

function previewTileStyle(tile: string): CSSProperties {
  if (tile === "#") {
    return {
      ...basePreviewTileStyle,
      background: "#7a8aa3"
    };
  }

  if (tile === "G") {
    return {
      ...basePreviewTileStyle,
      background: "#facc15"
    };
  }

  return {
    ...basePreviewTileStyle,
    background: "#223248"
  };
}

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr)",
  gap: "18px",
  width: "100%",
  maxWidth: "1340px",
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
  gridTemplateColumns: "minmax(0, 1fr) 360px",
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

const textareaStyle: CSSProperties = {
  minHeight: "620px",
  padding: "14px",
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#f8fafc",
  fontFamily: "\"IBM Plex Mono\", monospace",
  fontSize: "0.88rem",
  lineHeight: 1.45,
  resize: "vertical",
  marginTop: "10px"
};

const legendStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "12px"
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

const previewFrameStyle: CSSProperties = {
  marginTop: "16px",
  minHeight: "520px",
  padding: "16px",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.58)"
};

const previewStageStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "54px 18px 1fr",
  gap: "10px",
  alignItems: "start"
};

const startPreviewStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "1px",
  padding: "5px",
  borderRadius: "12px",
  background: "rgba(34, 211, 238, 0.12)"
};

const connectorPreviewStyle: CSSProperties = {
  display: "grid",
  gap: "1px",
  padding: "5px 0"
};

const mazePreviewStyle: CSSProperties = {
  display: "grid",
  gap: "1px",
  padding: "5px",
  borderRadius: "12px",
  background: "rgba(15, 23, 42, 0.9)"
};

const startTileStyle: CSSProperties = {
  width: "14px",
  aspectRatio: "1 / 1",
  background: "#26cfe6"
};

const connectorTileStyle: CSSProperties = {
  width: "14px",
  aspectRatio: "1 / 1",
  background: "#18b6a4"
};

const basePreviewTileStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1"
};
