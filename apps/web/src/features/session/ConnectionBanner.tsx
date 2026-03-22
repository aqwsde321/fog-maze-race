import type { CSSProperties } from "react";

type ConnectionBannerProps = {
  connectionState: "idle" | "connecting" | "connected" | "disconnected";
};

export function ConnectionBanner({ connectionState }: ConnectionBannerProps) {
  if (connectionState === "connected" || connectionState === "idle") {
    return null;
  }

  return (
    <div style={bannerStyle}>
      {connectionState === "connecting"
        ? "서버에 재연결 중입니다."
        : "연결이 끊겼습니다. 복구를 시도하고 있습니다."}
    </div>
  );
}

const bannerStyle: CSSProperties = {
  width: "min(1240px, 100%)",
  margin: "0 0 18px",
  padding: "12px 16px",
  borderRadius: "14px",
  background: "rgba(56, 189, 248, 0.14)",
  border: "1px solid rgba(56, 189, 248, 0.18)",
  color: "#bae6fd"
};
