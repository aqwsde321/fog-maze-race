import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { formatElapsedTime, formatLogTime, sortRankedResults, type GameResultLogEntry } from "./result-log.js";

type ResultsHistoryPanelProps = {
  isOpen: boolean;
  roomName: string;
  logs: ReadonlyArray<GameResultLogEntry>;
  onClose: () => void;
};

export function ResultsHistoryPanel({ isOpen, roomName, logs, onClose }: ResultsHistoryPanelProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div data-testid="results-history-overlay" style={overlayStyle} onClick={onClose}>
      <aside
        data-testid="results-history-panel"
        role="dialog"
        aria-modal="true"
        aria-label="레이스 기록"
        style={panelStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <header style={headerStyle}>
          <div style={headerContentStyle}>
            <p style={eyebrowStyle}>Race Log</p>
            <h2 style={titleStyle}>레이스 기록</h2>
            <p style={descriptionStyle}>
              {roomName} 방에서 끝난 레이스 {logs.length}개를 최신순으로 확인할 수 있습니다.
            </p>
          </div>
          <button
            data-testid="results-history-close-button"
            type="button"
            onClick={onClose}
            style={closeButtonStyle}
          >
            닫기
          </button>
        </header>

        {logs.length > 0 ? (
          <div data-testid="results-history-list" style={listStyle}>
            {logs.map((log) => (
              <article key={log.id} data-testid="results-history-item" style={itemStyle}>
                <div style={itemHeaderStyle}>
                  <div style={itemHeaderTextStyle}>
                    <strong style={itemTitleStyle}>{formatLogTime(log.endedAt) || "기록 시간 없음"}</strong>
                    <span style={itemMetaStyle}>{log.results.length}명 기록</span>
                  </div>
                  <span style={badgeStyle}>최근</span>
                </div>
                <div style={rowsStyle}>
                  {sortRankedResults(log.results).map((result) => (
                    <div key={`${log.id}:${result.playerId}`} style={rowStyle}>
                      <strong style={rankStyle}>{result.rank ? `${result.rank}위` : "나감"}</strong>
                      <span style={nameStyle}>{result.nickname}</span>
                      <span style={timeStyle}>
                        {result.outcome === "finished" && result.elapsedMs !== null
                          ? formatElapsedTime(result.elapsedMs)
                          : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div data-testid="results-history-empty" style={emptyStateStyle}>
            아직 기록이 없습니다. 첫 레이스가 끝나면 이곳에 순위와 시간이 쌓입니다.
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 20,
  display: "flex",
  justifyContent: "flex-end",
  background: "rgba(2, 6, 23, 0.44)",
  backdropFilter: "blur(6px)"
};

const panelStyle: CSSProperties = {
  width: "min(440px, calc(100vw - 24px))",
  height: "calc(100vh - 24px)",
  margin: "12px",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: "16px",
  padding: "22px",
  borderRadius: "24px",
  boxSizing: "border-box",
  background: "linear-gradient(180deg, rgba(10, 18, 33, 0.98), rgba(8, 15, 30, 0.96))",
  border: "1px solid rgba(250, 204, 21, 0.18)",
  boxShadow: "0 24px 64px rgba(2, 6, 23, 0.42)",
  color: "#e2e8f0"
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px"
};

const headerContentStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  minWidth: 0
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#fbbf24",
  fontSize: "0.72rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
  lineHeight: 1.1,
  color: "#f8fafc"
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.88rem",
  lineHeight: 1.5
};

const closeButtonStyle: CSSProperties = {
  minWidth: "64px",
  minHeight: "40px",
  padding: "10px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#e2e8f0",
  cursor: "pointer"
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  minHeight: 0,
  overflowY: "auto",
  paddingRight: "4px"
};

const itemStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  padding: "16px",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.72)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const itemHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px"
};

const itemHeaderTextStyle: CSSProperties = {
  display: "grid",
  gap: "4px"
};

const itemTitleStyle: CSSProperties = {
  fontSize: "0.92rem",
  color: "#f8fafc"
};

const itemMetaStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.76rem"
};

const badgeStyle: CSSProperties = {
  flexShrink: 0,
  padding: "6px 10px",
  borderRadius: "999px",
  background: "rgba(250, 204, 21, 0.12)",
  color: "#fde68a",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const rowsStyle: CSSProperties = {
  display: "grid",
  gap: "8px"
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "52px minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: "14px",
  background: "rgba(8, 15, 30, 0.74)"
};

const rankStyle: CSSProperties = {
  color: "#fde68a",
  fontSize: "0.92rem"
};

const nameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: 700,
  color: "#e2e8f0"
};

const timeStyle: CSSProperties = {
  color: "#fde68a",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap"
};

const emptyStateStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: 0,
  padding: "24px",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.52)",
  border: "1px dashed rgba(148, 163, 184, 0.2)",
  color: "#94a3b8",
  textAlign: "center",
  lineHeight: 1.6
};
