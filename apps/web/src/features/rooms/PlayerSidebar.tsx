import type { CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

type PlayerSidebarProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
};

export function PlayerSidebar({ snapshot, selfPlayerId }: PlayerSidebarProps) {
  return (
    <aside style={sidebarStyle}>
      <h3 style={titleStyle}>플레이어</h3>
      <div style={listStyle}>
        {snapshot.members.map((member) => (
          <article key={member.playerId} style={memberCardStyle}>
            <div style={identityStyle}>
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
                <p style={metaStyle}>
                  {member.isHost ? "방장" : "참가자"} · {member.state}
                </p>
              </div>
            </div>
            <strong style={rankStyle}>
              {member.finishRank ? `${member.finishRank}위` : member.state === "playing" ? "주행 중" : "-"}
            </strong>
          </article>
        ))}
      </div>
    </aside>
  );
}

const sidebarStyle: CSSProperties = {
  width: "300px",
  minWidth: "300px",
  maxWidth: "300px",
  padding: "18px",
  borderRadius: "20px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.9), rgba(7, 16, 30, 0.86))",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.16)",
  boxSizing: "border-box"
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.6rem",
  lineHeight: 1
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "14px"
};

const memberCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "center",
  padding: "12px 13px",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.6)",
  border: "1px solid rgba(148, 163, 184, 0.04)"
};

const identityStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center"
};

const colorDotStyle: CSSProperties = {
  width: "13px",
  height: "13px",
  borderRadius: "999px",
  boxShadow: "0 0 0 3px rgba(255,255,255,0.08)"
};

const nameStyle: CSSProperties = {
  display: "block"
};

const metaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#94a3b8",
  fontSize: "0.85rem"
};

const rankStyle: CSSProperties = {
  color: "#fde68a",
  fontSize: "0.92rem"
};
