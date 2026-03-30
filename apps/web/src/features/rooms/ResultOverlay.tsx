import type { CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import type { GameResultLogEntry } from "./result-log.js";

type ResultOverlayProps = {
  snapshot: RoomSnapshot;
  isHost: boolean;
  gameLogs?: ReadonlyArray<GameResultLogEntry>;
  onResetToWaiting: () => void;
};

const SCROLLABLE_RESULTS_CLASS = "result-overlay-scrollable";

export function ResultOverlay({ snapshot, isHost, onResetToWaiting }: ResultOverlayProps) {
  const results = snapshot.match?.results ?? [];
  const isVisible = snapshot.room.status === "ended" && results.length > 0;

  if (!isVisible) {
    return null;
  }

  return (
    <div data-testid="results-overlay" style={overlayStyle}>
      <section style={cardStyle}>
        <style>
          {`
            .${SCROLLABLE_RESULTS_CLASS} {
              scrollbar-width: thin;
              scrollbar-color: rgba(250, 204, 21, 0.62) rgba(15, 23, 42, 0.28);
            }

            .${SCROLLABLE_RESULTS_CLASS}::-webkit-scrollbar {
              width: 10px;
            }

            .${SCROLLABLE_RESULTS_CLASS}::-webkit-scrollbar-track {
              background: rgba(15, 23, 42, 0.22);
              border-radius: 999px;
            }

            .${SCROLLABLE_RESULTS_CLASS}::-webkit-scrollbar-thumb {
              background: linear-gradient(180deg, rgba(253, 224, 71, 0.88), rgba(245, 158, 11, 0.68));
              border: 2px solid rgba(8, 15, 30, 0.94);
              border-radius: 999px;
            }

            .${SCROLLABLE_RESULTS_CLASS}::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(180deg, rgba(254, 240, 138, 0.92), rgba(251, 191, 36, 0.78));
            }
          `}
        </style>

        <p style={eyebrowStyle}>Result</p>
        <h2 style={headingStyle}>레이스 종료</h2>
        <p style={descriptionStyle}>
          {isHost
            ? "순위를 확인한 뒤 새 게임 준비 버튼을 눌러 다음 레이스 대기 상태로 돌아가세요."
            : "호스트가 새 게임을 준비하면 새 게임 대기 상태로 돌아갑니다."}
        </p>
        <div className={SCROLLABLE_RESULTS_CLASS} data-testid="results-list" style={resultListStyle}>
          {results.map((result) => (
            <article key={result.playerId} style={resultItemStyle}>
              <strong style={placeStyle}>{result.rank ? `${result.rank}위` : "나감"}</strong>
              <div style={summaryStyle}>
                <span style={nameStyle}>{result.nickname}</span>
                <span style={metaStyle}>{result.outcome === "finished" ? "완주" : "나감"}</span>
              </div>
              <span style={timeStyle}>
                {result.outcome === "finished" && result.elapsedMs !== null
                  ? formatElapsedTime(result.elapsedMs)
                : "-"}
              </span>
            </article>
          ))}
        </div>
        {isHost ? (
          <button
            data-testid="results-reset-button"
            type="button"
            onClick={onResetToWaiting}
            style={resetButtonStyle}
          >
            새 게임 준비
          </button>
        ) : null}
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
  display: "grid",
  gridTemplateRows: "auto auto auto minmax(0, 1fr) auto",
  width: "min(560px, calc(100% - 32px))",
  maxHeight: "min(560px, calc(100vh - 32px))",
  padding: "28px",
  borderRadius: "26px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(8, 15, 30, 0.94))",
  border: "1px solid rgba(250, 204, 21, 0.24)",
  boxShadow: "0 28px 80px rgba(2, 6, 23, 0.42)",
  boxSizing: "border-box"
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

const descriptionStyle: CSSProperties = {
  margin: "0 0 18px",
  color: "#cbd5e1",
  fontSize: "0.92rem",
  lineHeight: 1.5
};

const resultListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  minHeight: 0,
  maxHeight: "min(48vh, 420px)",
  overflowY: "auto",
  paddingRight: "6px"
};

const resultItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr) auto",
  gap: "16px",
  alignItems: "center",
  padding: "14px 18px",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.78)"
};

const placeStyle: CSSProperties = {
  fontSize: "1.2rem",
  color: "#fde68a"
};

const summaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "10px",
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap"
};

const nameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontWeight: 700
};

const metaStyle: CSSProperties = {
  flexShrink: 0,
  color: "#94a3b8"
};

const timeStyle: CSSProperties = {
  flexShrink: 0,
  color: "#fde68a",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  whiteSpace: "nowrap"
};

const resetButtonStyle: CSSProperties = {
  marginTop: "18px",
  border: "none",
  borderRadius: "16px",
  padding: "14px 18px",
  fontSize: "0.98rem",
  fontWeight: 700,
  color: "#020617",
  background: "linear-gradient(135deg, #fde68a, #f59e0b)",
  cursor: "pointer"
};

function formatElapsedTime(elapsedMs: number) {
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
  const milliseconds = elapsedMs % 1_000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}
