import type { CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

type PlayerSidebarProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
};

export function PlayerSidebar({ snapshot, selfPlayerId }: PlayerSidebarProps) {
  return (
    <aside style={sidebarStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>플레이어</h3>
        <span style={countStyle}>{snapshot.members.length}</span>
      </div>
      <div style={listStyle}>
        {snapshot.members.map((member) => (
          <article key={member.playerId} style={memberCardStyle}>
            <div style={identityStyle}>
              <span
                style={{
                  ...colorDotStyle,
                  background: member.color,
                  boxShadow:
                    member.playerId === selfPlayerId
                      ? "0 0 0 2px rgba(8,17,31,0.96), 0 0 0 4px rgba(248,250,252,0.92)"
                      : "none"
                }}
              />
              <div>
                <strong style={nameStyle}>
                  {member.nickname}
                  {member.playerId === selfPlayerId ? " (나)" : ""}
                </strong>
                <p style={metaStyle}>{member.isHost ? "방장" : "참가자"}</p>
              </div>
            </div>
            <span style={rankStyle}>
              {member.finishRank ? `${member.finishRank}위` : member.state === "playing" ? "주행" : member.state === "waiting" ? "대기" : "-"}
            </span>
          </article>
        ))}
      </div>
    </aside>
  );
}

const sidebarStyle: CSSProperties = {
  width: "252px",
  minWidth: "252px",
  maxWidth: "252px",
  padding: "14px 15px",
  borderRadius: "18px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.9), rgba(7, 16, 30, 0.86))",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.16)",
  boxSizing: "border-box"
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.3rem",
  lineHeight: 1
};

const countStyle: CSSProperties = {
  minWidth: "26px",
  height: "26px",
  display: "inline-grid",
  placeItems: "center",
  borderRadius: "999px",
  fontSize: "0.82rem",
  color: "#cbd5e1",
  background: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "2px",
  marginTop: "10px",
  maxHeight: "min(70vh, 760px)",
  overflowY: "auto",
  paddingRight: "4px"
};

const memberCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  alignItems: "center",
  padding: "10px 4px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.06)"
};

const identityStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  minWidth: 0
};

const colorDotStyle: CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "999px",
  flexShrink: 0
};

const nameStyle: CSSProperties = {
  display: "block",
  fontSize: "0.98rem",
  lineHeight: 1.1
};

const metaStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#94a3b8",
  fontSize: "0.8rem"
};

const rankStyle: CSSProperties = {
  color: "#fde68a",
  fontSize: "0.78rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap"
};
