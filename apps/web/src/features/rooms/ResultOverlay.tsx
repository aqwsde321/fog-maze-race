import { useEffect, useState, type CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

type ResultOverlayProps = {
  snapshot: RoomSnapshot;
};

export function ResultOverlay({ snapshot }: ResultOverlayProps) {
  const results = snapshot.match?.results ?? [];
  const isVisible = snapshot.room.status === "ended" && results.length > 0;
  const endsAt =
    snapshot.match?.endedAt && snapshot.match.resultsDurationMs
      ? new Date(snapshot.match.endedAt).getTime() + snapshot.match.resultsDurationMs
      : null;

  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(endsAt));

  useEffect(() => {
    setRemainingSeconds(getRemainingSeconds(endsAt));
    if (!endsAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(endsAt));
    }, 200);

    return () => {
      window.clearInterval(timer);
    };
  }, [endsAt]);

  if (!isVisible) {
    return null;
  }

  return (
    <div data-testid="results-overlay" style={overlayStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>Result</p>
        <h2 style={headingStyle}>레이스 종료</h2>
        <p data-testid="results-reset-timer" style={timerStyle}>
          {remainingSeconds}초 뒤 결과창이 닫히고 새 게임 대기 상태로 돌아갑니다.
        </p>
        <div style={resultListStyle}>
          {results.map((result) => (
            <article key={result.playerId} style={resultItemStyle}>
              <strong style={placeStyle}>{result.rank ? `${result.rank}위` : "나감"}</strong>
              <div>
                <p style={nameStyle}>{result.nickname}</p>
                <p style={metaStyle}>{result.outcome === "finished" ? "완주" : "나감"}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function getRemainingSeconds(endsAt: number | null) {
  if (!endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "rgba(2, 6, 23, 0.68)",
  backdropFilter: "blur(8px)"
};

const cardStyle: CSSProperties = {
  width: "min(420px, calc(100% - 32px))",
  padding: "28px",
  borderRadius: "26px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(8, 15, 30, 0.94))",
  border: "1px solid rgba(250, 204, 21, 0.24)",
  boxShadow: "0 28px 80px rgba(2, 6, 23, 0.42)"
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#fbbf24",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontSize: "0.8rem"
};

const headingStyle: CSSProperties = {
  margin: "10px 0 18px",
  fontSize: "2rem"
};

const timerStyle: CSSProperties = {
  margin: "0 0 18px",
  color: "#cbd5e1",
  fontSize: "0.92rem",
  lineHeight: 1.5
};

const resultListStyle: CSSProperties = {
  display: "grid",
  gap: "12px"
};

const resultItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px 1fr",
  gap: "14px",
  alignItems: "center",
  padding: "14px",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.78)"
};

const placeStyle: CSSProperties = {
  fontSize: "1.2rem",
  color: "#fde68a"
};

const nameStyle: CSSProperties = {
  margin: 0,
  fontWeight: 700
};

const metaStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#94a3b8"
};
