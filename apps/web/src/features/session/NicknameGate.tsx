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
  const canEnter = Boolean(nickname.trim()) && connectionState !== "connecting";

  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>Fog Maze Race</p>
      <div style={headerRowStyle}>
        <h1 style={titleStyle}>닉네임</h1>
        <span style={hintBadgeStyle}>1-5자</span>
      </div>
      <div style={formRowStyle}>
        <input
          id="nickname"
          name="nickname"
          maxLength={5}
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canEnter) {
              event.preventDefault();
              onEnterLobby();
            }
          }}
          placeholder="닉네임 입력"
          autoComplete="nickname"
          aria-label="닉네임"
          style={inputStyle}
        />
        <p style={helperTextStyle}>{connectionState === "connecting" ? "연결 중..." : "입력 후 바로 입장"}</p>
      </div>
      <button
        type="button"
        onClick={onEnterLobby}
        disabled={!canEnter}
        style={primaryButtonStyle}
      >
        {connectionState === "connecting" ? "연결 중..." : "입장"}
      </button>
    </section>
  );
}

const panelStyle: CSSProperties = {
  width: "min(520px, 100%)",
  padding: "clamp(28px, 4vw, 36px)",
  borderRadius: "20px",
  background: "linear-gradient(160deg, rgba(15, 23, 42, 0.94), rgba(8, 15, 30, 0.92))",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.34)"
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#fbbf24",
  fontSize: "0.76rem",
  letterSpacing: "0.24em",
  textTransform: "uppercase"
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginTop: "12px"
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.75rem, 3.2vw, 2.4rem)",
  lineHeight: 1.05
};

const hintBadgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  background: "rgba(15, 23, 42, 0.56)",
  color: "#cbd5e1",
  fontSize: "0.8rem",
  whiteSpace: "nowrap"
};

const formRowStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "18px"
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.84rem"
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#f8fafc",
  fontSize: "1rem",
  boxSizing: "border-box"
};

const primaryButtonStyle: CSSProperties = {
  marginTop: "12px",
  width: "100%",
  minHeight: "52px",
  padding: "13px 18px",
  border: "1px solid rgba(249, 115, 22, 0.18)",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer"
};
