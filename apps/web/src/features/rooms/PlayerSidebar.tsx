import type { CSSProperties } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import {
  getPlayerMarkerEyeStyle,
  getPlayerMarkerEyesWrapStyle,
  getPlayerMarkerStyle
} from "../../game/player-marker.js";

type PlayerSidebarProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
};

export function PlayerSidebar({ snapshot, selfPlayerId }: PlayerSidebarProps) {
  const isBotRaceRoom = snapshot.room.mode === "bot_race";
  const visibleMembers = isBotRaceRoom
    ? snapshot.members.filter((member) => !(member.kind === "human" && member.role === "spectator"))
    : snapshot.members;
  const spectatorCount = isBotRaceRoom
    ? snapshot.members.filter((member) => member.kind === "human" && member.role === "spectator").length
    : 0;
  const title = isBotRaceRoom ? "레이서" : "플레이어";

  return (
    <aside style={sidebarStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>{title}</h3>
        <span style={countStyle}>{visibleMembers.length}</span>
      </div>
      <div data-testid="player-sidebar-list" style={listStyle}>
        {visibleMembers.map((member) => (
          <article key={member.playerId} style={memberCardStyle}>
            <div style={identityStyle}>
              <span style={markerWrapStyle}>
                {member.playerId === selfPlayerId ? (
                  <span
                    data-marker-self-ring="true"
                    style={{
                      ...markerPieceStyle(18),
                      ...getPlayerMarkerStyle(member.shape, 18),
                      color: "#f8fafc"
                    }}
                  />
                ) : null}
                <span
                  data-marker-shape={member.shape}
                  style={{
                    ...markerPieceStyle(12),
                    ...getPlayerMarkerStyle(member.shape, 12),
                    color: member.color
                  }}
                />
                <span
                  data-marker-eyes="true"
                  style={getPlayerMarkerEyesWrapStyle(12)}
                >
                  <span data-marker-eye="true" style={getPlayerMarkerEyeStyle(12)} />
                  <span data-marker-eye="true" style={getPlayerMarkerEyeStyle(12)} />
                </span>
              </span>
              <div>
                <strong style={nameStyle}>
                  {member.nickname}
                  {member.playerId === selfPlayerId ? " (나)" : ""}
                </strong>
                <p style={metaStyle}>
                  {member.isHost ? "방장" : isBotRaceRoom ? "레이서" : "참가자"} · {member.kind === "bot" ? "봇" : "사람"}
                </p>
              </div>
            </div>
            <span style={rankStyle}>
              {member.finishRank ? `${member.finishRank}위` : member.state === "playing" ? "주행" : member.state === "waiting" ? "대기" : "-"}
            </span>
          </article>
        ))}
      </div>
      {isBotRaceRoom ? (
        <div data-testid="spectator-summary" style={spectatorCardStyle}>
          <div style={spectatorHeaderStyle}>
            <span style={spectatorTitleStyle}>관전자</span>
            <strong style={spectatorCountStyle}>{spectatorCount}명</strong>
          </div>
          <p style={spectatorMetaStyle}>채팅 가능 · 레이스에는 참여하지 않음</p>
        </div>
      ) : null}
    </aside>
  );
}

const sidebarStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  maxWidth: "none",
  padding: "8px 9px",
  borderRadius: "14px",
  background: "linear-gradient(180deg, rgba(8, 15, 30, 0.9), rgba(7, 16, 30, 0.86))",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.16)",
  boxSizing: "border-box",
  overflow: "hidden"
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.92rem",
  lineHeight: 1
};

const countStyle: CSSProperties = {
  minWidth: "22px",
  height: "22px",
  display: "inline-grid",
  placeItems: "center",
  borderRadius: "999px",
  fontSize: "0.7rem",
  color: "#cbd5e1",
  background: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.08)"
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "2px",
  marginTop: "4px",
  maxHeight: "50vh",
  overflowY: "auto",
  paddingRight: "2px"
};

const spectatorCardStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  marginTop: "8px",
  padding: "9px 10px",
  borderRadius: "12px",
  background: "rgba(15, 23, 42, 0.62)",
  border: "1px solid rgba(148, 163, 184, 0.1)"
};

const spectatorHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px"
};

const spectatorTitleStyle: CSSProperties = {
  color: "#e2e8f0",
  fontSize: "0.76rem",
  letterSpacing: "0.08em"
};

const spectatorCountStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.78rem"
};

const spectatorMetaStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.7rem",
  lineHeight: 1.4
};

const memberCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "6px",
  alignItems: "center",
  padding: "6px 2px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.06)"
};

const identityStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  minWidth: 0
};

const markerWrapStyle: CSSProperties = {
  position: "relative",
  width: "14px",
  height: "14px",
  flexShrink: 0
};

function markerPieceStyle(size: number): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: `${size}px`,
    height: `${size}px`
  };
}

const nameStyle: CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  lineHeight: 1.1
};

const metaStyle: CSSProperties = {
  margin: "2px 0 0",
  color: "#94a3b8",
  fontSize: "0.68rem"
};

const rankStyle: CSSProperties = {
  color: "#fde68a",
  fontSize: "0.64rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap"
};
