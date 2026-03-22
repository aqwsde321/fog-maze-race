import { useEffect, useState, type CSSProperties } from "react";

type HostControlsProps = {
  roomName: string;
  roomStatus: "waiting" | "countdown" | "playing" | "ended";
  onRenameRoom: (name: string) => void;
  onForceEndRoom: () => void;
};

export function HostControls({
  roomName,
  roomStatus,
  onRenameRoom,
  onForceEndRoom
}: HostControlsProps) {
  const [draftName, setDraftName] = useState(roomName);

  useEffect(() => {
    setDraftName(roomName);
  }, [roomName]);

  return (
    <div style={panelStyle}>
      <label htmlFor="rename-room-name" style={labelStyle}>
        방 이름 수정
      </label>
      <div style={rowStyle}>
        <input
          id="rename-room-name"
          name="rename-room-name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
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
      <button
        type="button"
        onClick={onForceEndRoom}
        disabled={roomStatus === "waiting"}
        style={forceEndButtonStyle}
      >
        강제 종료
      </button>
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  minWidth: "280px"
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.82rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "10px"
};

const inputStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#f8fafc"
};

const renameButtonStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "999px",
  border: "1px solid rgba(56, 189, 248, 0.24)",
  background: "rgba(56, 189, 248, 0.12)",
  color: "#bae6fd",
  cursor: "pointer"
};

const forceEndButtonStyle: CSSProperties = {
  justifySelf: "start",
  padding: "12px 16px",
  borderRadius: "999px",
  border: "1px solid rgba(248, 113, 113, 0.24)",
  background: "rgba(239, 68, 68, 0.14)",
  color: "#fecaca",
  cursor: "pointer"
};
