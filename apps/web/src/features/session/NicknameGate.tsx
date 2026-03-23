import type { CSSProperties } from "react";

type NicknameGateProps = {
  nickname: string;
  connectionState: "idle" | "connecting" | "connected" | "disconnected";
  onNicknameChange: (nickname: string) => void;
  onEnterLobby: () => void;
};

export function NicknameGate({
  nickname,
  connectionState,
  onNicknameChange,
  onEnterLobby
}: NicknameGateProps) {
  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>Fog Maze Race</p>
      <h1 style={titleStyle}>안개 속 미로를 먼저 빠져나가세요</h1>
      <p style={bodyStyle}>
        닉네임만 입력하면 바로 방 목록으로 진입합니다. 서버가 위치와 순위를 authoritative하게
        관리하고, 클라이언트는 렌더링과 입력만 담당합니다.
      </p>
      <div style={formRowStyle}>
        <label htmlFor="nickname" style={labelStyle}>
          닉네임
        </label>
        <input
          id="nickname"
          name="nickname"
          maxLength={5}
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          style={inputStyle}
        />
      </div>
      <button
        type="button"
        onClick={onEnterLobby}
        disabled={!nickname.trim() || connectionState === "connecting"}
        style={primaryButtonStyle}
      >
        {connectionState === "connecting" ? "연결 중..." : "입장"}
      </button>
    </section>
  );
}

const panelStyle: CSSProperties = {
  width: "min(620px, 100%)",
  padding: "clamp(28px, 4vw, 40px)",
  borderRadius: "24px",
  background: "linear-gradient(160deg, rgba(15, 23, 42, 0.94), rgba(8, 15, 30, 0.92))",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.42)"
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#fbbf24",
  fontSize: "0.82rem",
  letterSpacing: "0.28em",
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  margin: "16px 0 12px",
  fontSize: "clamp(2rem, 5vw, 3.6rem)",
  lineHeight: 1.05
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.68,
  maxWidth: "34ch"
};

const formRowStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "24px"
};

const labelStyle: CSSProperties = {
  fontSize: "0.92rem",
  color: "#e2e8f0"
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  borderRadius: "13px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#f8fafc",
  fontSize: "1rem"
};

const primaryButtonStyle: CSSProperties = {
  marginTop: "18px",
  width: "100%",
  padding: "13px 18px",
  border: 0,
  borderRadius: "999px",
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer"
};
