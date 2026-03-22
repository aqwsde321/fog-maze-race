import type { CSSProperties } from "react";

import type { RoomListItem } from "@fog-maze-race/shared/contracts/realtime";

type RoomListPanelProps = {
  rooms: RoomListItem[];
  roomName: string;
  nickname: string;
  onRoomNameChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
};

export function RoomListPanel({
  rooms,
  roomName,
  nickname,
  onRoomNameChange,
  onCreateRoom,
  onJoinRoom
}: RoomListPanelProps) {
  return (
    <section style={layoutStyle}>
      <div style={heroCardStyle}>
        <p style={miniLabelStyle}>Connected Player</p>
        <h2 style={headingStyle}>{nickname}</h2>
        <p style={copyStyle}>대기 중인 방을 고르거나 새 레이스를 바로 시작할 수 있습니다.</p>
        <label htmlFor="room-name" style={fieldLabelStyle}>
          방 이름
        </label>
        <div style={createRowStyle}>
          <input
            id="room-name"
            name="room-name"
            value={roomName}
            onChange={(event) => onRoomNameChange(event.target.value)}
            style={fieldStyle}
          />
          <button type="button" onClick={onCreateRoom} style={createButtonStyle}>
            방 만들기
          </button>
        </div>
      </div>

      <div style={listCardStyle}>
        <div style={listHeaderStyle}>
          <h3 style={listTitleStyle}>방 목록</h3>
          <span style={roomCountStyle}>{rooms.length} rooms</span>
        </div>
        <div style={listBodyStyle}>
          {rooms.length === 0 ? (
            <p style={emptyStyle}>생성된 방이 없습니다. 첫 번째 방장이 되어 보세요.</p>
          ) : (
            rooms.map((room) => (
              <article key={room.roomId} style={roomCardStyle}>
                <div>
                  <strong style={roomNameStyle}>{room.name}</strong>
                  <p style={roomMetaStyle}>
                    방장 {room.hostNickname} · {room.playerCount}명 · {room.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onJoinRoom(room.roomId)}
                  disabled={room.status !== "waiting"}
                  style={joinButtonStyle}
                >
                  입장 {room.name}
                </button>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
  gap: "24px",
  width: "min(1120px, 100%)",
  alignItems: "start"
};

const heroCardStyle: CSSProperties = {
  padding: "32px",
  borderRadius: "28px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(8, 15, 30, 0.92))",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  minHeight: "340px"
};

const miniLabelStyle: CSSProperties = {
  margin: 0,
  color: "#38bdf8",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: "0.8rem"
};

const headingStyle: CSSProperties = {
  margin: "14px 0 10px",
  fontSize: "clamp(2rem, 4vw, 3rem)"
};

const copyStyle: CSSProperties = {
  margin: "0 0 24px",
  color: "#cbd5e1",
  lineHeight: 1.65
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "10px",
  color: "#e2e8f0"
};

const createRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "12px"
};

const fieldStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "rgba(15, 23, 42, 0.68)",
  color: "#f8fafc",
  fontSize: "1rem"
};

const createButtonStyle: CSSProperties = {
  padding: "14px 18px",
  borderRadius: "999px",
  border: 0,
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer"
};

const listCardStyle: CSSProperties = {
  padding: "28px",
  borderRadius: "28px",
  background: "rgba(8, 15, 30, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.18)"
};

const listHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px"
};

const listTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.2rem"
};

const roomCountStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.88rem"
};

const listBodyStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "18px"
};

const roomCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "16px",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.72)",
  border: "1px solid rgba(148, 163, 184, 0.16)"
};

const roomNameStyle: CSSProperties = {
  display: "block",
  fontSize: "1.02rem"
};

const roomMetaStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#94a3b8",
  fontSize: "0.9rem"
};

const joinButtonStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "999px",
  border: "1px solid rgba(250, 204, 21, 0.28)",
  background: "rgba(250, 204, 21, 0.12)",
  color: "#fde68a",
  cursor: "pointer"
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  lineHeight: 1.7
};
