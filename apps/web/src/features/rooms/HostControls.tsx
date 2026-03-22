import { useEffect, useState, type CSSProperties } from "react";

type HostControlsProps = {
  roomName: string;
  onRenameRoom: (name: string) => void;
};

export function HostControls({ roomName, onRenameRoom }: HostControlsProps) {
  const [draftName, setDraftName] = useState(roomName);

  useEffect(() => {
    setDraftName(roomName);
  }, [roomName]);

  return (
    <div style={panelStyle}>
      <label htmlFor="rename-room-name" style={hiddenLabelStyle}>
        방 이름 수정
      </label>
      <div style={rowStyle}>
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
  minWidth: "248px"
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
  gridTemplateColumns: "1fr auto",
  gap: "8px"
};

const inputStyle: CSSProperties = {
  minHeight: "40px",
  padding: "9px 12px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#f8fafc"
};

const renameButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "10px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(56, 189, 248, 0.24)",
  background: "rgba(56, 189, 248, 0.12)",
  color: "#bae6fd",
  cursor: "pointer"
};
