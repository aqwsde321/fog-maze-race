import type { CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { buildPlayerMarkerMetaMap, getPatternBackground } from "../../game/player-marker.js";

type PlayerSidebarProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
};

export function PlayerSidebar({ snapshot, selfPlayerId }: PlayerSidebarProps) {
  const markerMetaMap = buildPlayerMarkerMetaMap(snapshot.members);

  return (
    <aside style={sidebarStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>플레이어</h3>
        <span style={countStyle}>{snapshot.members.length}</span>
      </div>
      <div style={listStyle}>
        {snapshot.members.map((member, index) => (
          <article key={member.playerId} style={memberCardStyle}>
            <div style={identityStyle}>
              <span style={orderChipStyle}>{index + 1}</span>
              <span
                style={{
                  ...patternChipStyle,
                  backgroundImage: getPatternBackground(
                    markerMetaMap.get(member.playerId)?.pattern ?? "horizontal",
                    markerMetaMap.get(member.playerId)?.contrastColor ?? "#f8fafc",
                    0.58
                  )
                }}
              />
              <span
                style={{
                  ...colorDotStyle,
                  background: member.color
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
  gap: "9px",
  alignItems: "center",
  minWidth: 0
};

const orderChipStyle: CSSProperties = {
  minWidth: "18px",
  height: "18px",
  display: "inline-grid",
  placeItems: "center",
  borderRadius: "999px",
  fontSize: "0.66rem",
  fontWeight: 700,
  color: "#94a3b8",
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(148, 163, 184, 0.1)",
  flexShrink: 0
};

const patternChipStyle: CSSProperties = {
  width: "14px",
  height: "14px",
  borderRadius: "4px",
  backgroundColor: "rgba(15, 23, 42, 0.96)",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  flexShrink: 0
};

const colorDotStyle: CSSProperties = {
  width: "11px",
  height: "11px",
  borderRadius: "999px",
  boxShadow: "0 0 0 3px rgba(8,17,31,0.92)",
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
