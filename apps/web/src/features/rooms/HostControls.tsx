import { useEffect, useState, type CSSProperties } from "react";

type HostControlsProps = {
  roomName: string;
  visibilitySize: 3 | 5 | 7;
  canEditVisibility: boolean;
  onRenameRoom: (name: string) => void;
  onSetVisibilitySize: (visibilitySize: 3 | 5 | 7) => void;
};

export function HostControls({
  roomName,
  visibilitySize,
  canEditVisibility,
  onRenameRoom,
  onSetVisibilitySize
}: HostControlsProps) {
  const [draftName, setDraftName] = useState(roomName);

  useEffect(() => {
    setDraftName(roomName);
  }, [roomName]);

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <label htmlFor="visibility-size" style={hiddenLabelStyle}>
          시야 크기
        </label>
        <select
          id="visibility-size"
          name="visibility-size"
          value={visibilitySize}
          disabled={!canEditVisibility}
          onChange={(event) => onSetVisibilitySize(Number(event.target.value) as 3 | 5 | 7)}
          style={selectStyle}
        >
          <option value={7}>7x7</option>
          <option value={5}>5x5</option>
          <option value={3}>3x3</option>
        </select>
        <label htmlFor="rename-room-name" style={hiddenLabelStyle}>
          방 이름 수정
        </label>
        <input
          id="rename-room-name"
          name="rename-room-name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder="방 이름 수정"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => onRenameRoom(draftName)}
          style={renameButtonStyle}
        >
          이름 변경
        </button>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  width: "100%",
  minWidth: 0
};

const hiddenLabelStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "104px 1fr auto",
  gap: "8px"
};

const selectStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 12px",
  borderRadius: "13px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#f8fafc"
};

const inputStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 12px",
  borderRadius: "13px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#f8fafc"
};

const renameButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 13px",
  borderRadius: "13px",
  border: "1px solid rgba(56, 189, 248, 0.24)",
  background: "rgba(56, 189, 248, 0.12)",
  color: "#bae6fd",
  cursor: "pointer"
};
