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
  padding: "20px",
  borderRadius: "24px",
  background: "rgba(8, 15, 30, 0.88)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxSizing: "border-box"
};

const titleStyle: CSSProperties = {
  margin: 0
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "16px"
};

const memberCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  padding: "14px",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.72)"
};

const identityStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "center"
};

const colorDotStyle: CSSProperties = {
  width: "14px",
  height: "14px",
  borderRadius: "999px",
  boxShadow: "0 0 0 3px rgba(255,255,255,0.08)"
};

const nameStyle: CSSProperties = {
  display: "block"
};

const metaStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#94a3b8",
  fontSize: "0.88rem"
};

const rankStyle: CSSProperties = {
  color: "#fde68a",
  fontSize: "0.95rem"
};
