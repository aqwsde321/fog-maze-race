import type { CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

type ResultOverlayProps = {
  snapshot: RoomSnapshot;
};

export function ResultOverlay({ snapshot }: ResultOverlayProps) {
  if (snapshot.room.status !== "ended" || !snapshot.match?.results.length) {
    return null;
  }

  return (
    <div data-testid="results-overlay" style={overlayStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>Result</p>
        <h2 style={headingStyle}>레이스 종료</h2>
        <div style={resultListStyle}>
          {snapshot.match.results.map((result) => (
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
