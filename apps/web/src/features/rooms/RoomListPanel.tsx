import { useEffect, useState, type CSSProperties } from "react";

import type { RoomListItem } from "@fog-maze-race/shared/contracts/realtime";
import type { RoomMode, RoomStatus } from "@fog-maze-race/shared/domain/status";

import { SelectField } from "./SelectField.js";

type RoomListPanelProps = {
  rooms: RoomListItem[];
  roomName: string;
  roomMode: RoomMode;
  nickname: string;
  connectionState: "idle" | "connecting" | "connected" | "disconnected";
  onNicknameSubmit: (value: string) => void;
  onRoomNameChange: (value: string) => void;
  onRoomModeChange: (value: RoomMode) => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
};

type ActiveDialog = "nickname" | "create-room" | null;
type RoomListFilter = "all" | "joinable" | "active";

const SCROLLABLE_LIST_CLASS = "lobby-room-list-scrollable";

export function RoomListPanel({
  rooms,
  roomName,
  roomMode,
  nickname,
  connectionState,
  onNicknameSubmit,
  onRoomNameChange,
  onRoomModeChange,
  onCreateRoom,
  onJoinRoom
}: RoomListPanelProps) {
  const [nicknameDraft, setNicknameDraft] = useState(nickname);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [activeFilter, setActiveFilter] = useState<RoomListFilter>("all");

  useEffect(() => {
    setNicknameDraft(nickname);
  }, [nickname]);

  useEffect(() => {
    if (!activeDialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDialog(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDialog]);

  const canSubmitNickname = Boolean(nicknameDraft.trim()) && nicknameDraft.trim().slice(0, 5) !== nickname && connectionState !== "connecting";
  const filteredRooms = rooms.filter((room) => matchesRoomFilter(activeFilter, room.status));
  const joinableCount = rooms.filter((room) => room.status === "waiting").length;
  const activeCount = rooms.filter((room) => room.status === "countdown" || room.status === "playing").length;

  const dialogTitleId = activeDialog === "nickname" ? "nickname-dialog-title" : "create-room-dialog-title";

  function closeDialog() {
    setActiveDialog(null);
  }

  function handleNicknameSubmit() {
    if (!canSubmitNickname) {
      return;
    }

    onNicknameSubmit(nicknameDraft);
    closeDialog();
  }

  function handleCreateRoomSubmit() {
    onCreateRoom();
    closeDialog();
  }

  return (
    <section style={layoutStyle}>
      <style>
        {`
          .${SCROLLABLE_LIST_CLASS} {
            scrollbar-width: thin;
            scrollbar-color: rgba(56, 189, 248, 0.5) rgba(15, 23, 42, 0.22);
          }

          .${SCROLLABLE_LIST_CLASS}::-webkit-scrollbar {
            width: 10px;
          }

          .${SCROLLABLE_LIST_CLASS}::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.22);
            border-radius: 999px;
          }

          .${SCROLLABLE_LIST_CLASS}::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(56, 189, 248, 0.78), rgba(14, 165, 233, 0.5));
            border: 2px solid rgba(8, 15, 30, 0.92);
            border-radius: 999px;
          }
        `}
      </style>

      <header data-testid="lobby-header" style={headerStyle}>
        <div style={headerIdentityStyle}>
          <p style={miniLabelStyle}>LOBBY</p>
          <span style={nicknameBadgeStyle}>{nickname}</span>
        </div>
        <div style={headerActionsStyle}>
          <button
            data-testid="open-nickname-dialog-button"
            type="button"
            onClick={() => setActiveDialog("nickname")}
            aria-haspopup="dialog"
            aria-expanded={activeDialog === "nickname"}
            style={secondaryHeaderButtonStyle}
          >
            닉네임 변경
          </button>
          <button
            data-testid="open-create-room-dialog-button"
            type="button"
            onClick={() => setActiveDialog("create-room")}
            aria-haspopup="dialog"
            aria-expanded={activeDialog === "create-room"}
            style={primaryHeaderButtonStyle}
          >
            방 만들기
          </button>
        </div>
      </header>

      <div data-testid="room-list-card" style={listCardStyle}>
        <div style={listIntroStyle}>
          <h3 style={listTitleStyle}>참가 가능한 방</h3>
          <span style={roomCountStyle}>
            {activeFilter === "all" ? `${rooms.length}개의 대기실` : `${rooms.length}개 중 ${filteredRooms.length}개 표시`}
          </span>
        </div>
        <div style={listToolbarStyle}>
          <div style={filterGroupStyle}>
            <button
              data-testid="room-filter-all"
              type="button"
              onClick={() => setActiveFilter("all")}
              aria-pressed={activeFilter === "all"}
              style={activeFilter === "all" ? activeFilterButtonStyle : filterButtonStyle}
            >
              전체
              <span style={filterCountStyle}>{rooms.length}</span>
            </button>
            <button
              data-testid="room-filter-joinable"
              type="button"
              onClick={() => setActiveFilter("joinable")}
              aria-pressed={activeFilter === "joinable"}
              style={activeFilter === "joinable" ? activeFilterButtonStyle : filterButtonStyle}
            >
              입장 가능
              <span style={filterCountStyle}>{joinableCount}</span>
            </button>
            <button
              data-testid="room-filter-active"
              type="button"
              onClick={() => setActiveFilter("active")}
              aria-pressed={activeFilter === "active"}
              style={activeFilter === "active" ? activeFilterButtonStyle : filterButtonStyle}
            >
              진행 중
              <span style={filterCountStyle}>{activeCount}</span>
            </button>
          </div>
        </div>
        <div data-testid="room-list-body" className={SCROLLABLE_LIST_CLASS} style={listBodyStyle}>
          {rooms.length === 0 ? (
            <p style={emptyStyle}>생성된 방이 없습니다. 헤더의 방 만들기 버튼으로 첫 번째 레이스를 열어보세요.</p>
          ) : filteredRooms.length === 0 ? (
            <p style={emptyStyle}>해당 조건의 방이 없습니다. 다른 필터를 선택해 보세요.</p>
          ) : (
            filteredRooms.map((room) => {
              const statusTheme = getRoomStatusTheme(room.status);

              return (
              <article
                key={room.roomId}
                data-testid={`room-card-${room.roomId}`}
                style={{
                  ...roomCardStyle,
                  background: statusTheme.cardBackground,
                  borderColor: statusTheme.borderColor,
                  boxShadow: statusTheme.boxShadow
                }}
              >
                <div style={roomInfoStyle}>
                  <div style={roomTitleRowStyle}>
                    <strong style={roomNameStyle}>{room.name}</strong>
                    <span
                      data-testid={`room-status-badge-${room.roomId}`}
                      style={{
                        ...statusBadgeStyle,
                        background: statusTheme.badgeBackground,
                        borderColor: statusTheme.borderColor,
                        color: statusTheme.badgeColor
                      }}
                    >
                      {statusTheme.label}
                    </span>
                  </div>
                  <p style={roomMetaStyle}>
                    방장 {room.hostNickname} · {room.playerCount}명 · {room.mode === "bot_race" ? "봇 전용" : "일반"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`입장 ${room.name}`}
                  onClick={() => onJoinRoom(room.roomId)}
                  disabled={room.status !== "waiting"}
                  style={room.status === "waiting" ? joinButtonStyle : lockedJoinButtonStyle}
                >
                  입장
                </button>
              </article>
            )})
          )}
        </div>
      </div>

      {activeDialog ? (
        <div style={dialogScrimStyle} onClick={closeDialog}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            data-testid={activeDialog === "nickname" ? "nickname-dialog" : "create-room-dialog"}
            style={dialogStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={dialogHeaderStyle}>
              <div style={dialogTitleWrapStyle}>
                <p style={dialogEyebrowStyle}>{activeDialog === "nickname" ? "PLAYER" : "ROOM"}</p>
                <h3 id={dialogTitleId} style={dialogTitleStyle}>
                  {activeDialog === "nickname" ? "닉네임 변경" : "방 만들기"}
                </h3>
              </div>
              <button type="button" onClick={closeDialog} aria-label="닫기" style={dialogCloseButtonStyle}>
                닫기
              </button>
            </div>

            {activeDialog === "nickname" ? (
              <div style={dialogBodyStyle}>
                <div style={fieldWrapStyle}>
                  <label htmlFor="lobby-nickname" style={fieldLabelStyle}>
                    닉네임
                  </label>
                  <input
                    id="lobby-nickname"
                    name="lobby-nickname"
                    maxLength={5}
                    value={nicknameDraft}
                    onChange={(event) => setNicknameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleNicknameSubmit();
                      }
                    }}
                    aria-label="닉네임 수정"
                    style={fieldStyle}
                  />
                </div>
                <div style={dialogActionRowStyle}>
                  <button type="button" onClick={closeDialog} style={ghostButtonStyle}>
                    취소
                  </button>
                  <button
                    data-testid="nickname-submit-button"
                    type="button"
                    onClick={handleNicknameSubmit}
                    disabled={!canSubmitNickname}
                    style={primaryActionButtonStyle}
                  >
                    {connectionState === "connecting" ? "변경 중..." : "변경 저장"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={dialogBodyStyle}>
                <div style={fieldWrapStyle}>
                  <label htmlFor="room-name" style={fieldLabelStyle}>
                    방 이름
                  </label>
                  <input
                    id="room-name"
                    name="room-name"
                    value={roomName}
                    onChange={(event) => onRoomNameChange(event.target.value)}
                    style={fieldStyle}
                  />
                </div>
                <div style={fieldWrapStyle}>
                  <label htmlFor="room-mode" style={fieldLabelStyle}>
                    방 모드
                  </label>
                  <SelectField
                    id="room-mode"
                    name="room-mode"
                    aria-label="방 모드"
                    value={roomMode}
                    onChange={(event) => onRoomModeChange(event.target.value as RoomMode)}
                    shellTestId="room-mode-select-shell"
                    chevronTestId="room-mode-select-chevron"
                  >
                    <option value="normal">일반 방</option>
                    <option value="bot_race">봇 전용 방</option>
                  </SelectField>
                </div>
                <div style={dialogActionRowStyle}>
                  <button type="button" onClick={closeDialog} style={ghostButtonStyle}>
                    취소
                  </button>
                  <button
                    data-testid="create-room-submit-button"
                    type="button"
                    onClick={handleCreateRoomSubmit}
                    style={primaryActionButtonStyle}
                  >
                    생성하기
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}

const layoutStyle: CSSProperties = {
  display: "grid",
  gap: "20px",
  width: "min(1080px, 100%)",
  alignItems: "start"
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "18px 20px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(10, 18, 32, 0.94), rgba(7, 13, 26, 0.94))",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  boxShadow: "0 16px 40px rgba(2, 6, 23, 0.18)"
};

const headerIdentityStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px"
};

const miniLabelStyle: CSSProperties = {
  margin: 0,
  color: "#38bdf8",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: "0.76rem"
};

const nicknameBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "30px",
  padding: "0 12px",
  borderRadius: "999px",
  background: "rgba(56, 189, 248, 0.12)",
  border: "1px solid rgba(56, 189, 248, 0.2)",
  color: "#bae6fd",
  fontSize: "0.92rem",
  fontWeight: 700
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "10px"
};

const headerButtonBaseStyle: CSSProperties = {
  minHeight: "46px",
  padding: "0 16px",
  borderRadius: "999px",
  fontSize: "0.95rem",
  fontWeight: 700,
  cursor: "pointer"
};

const secondaryHeaderButtonStyle: CSSProperties = {
  ...headerButtonBaseStyle,
  border: "1px solid rgba(148, 163, 184, 0.2)",
  background: "rgba(15, 23, 42, 0.84)",
  color: "#e2e8f0"
};

const primaryHeaderButtonStyle: CSSProperties = {
  ...headerButtonBaseStyle,
  border: 0,
  background: "#f8fafc",
  color: "#0f172a"
};

const listCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr)",
  gap: "14px",
  width: "min(780px, 100%)",
  margin: "0 auto",
  padding: "28px",
  maxHeight: "min(72vh, 720px)",
  overflow: "hidden",
  borderRadius: "28px",
  background: "rgba(8, 15, 30, 0.92)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  boxShadow: "0 24px 56px rgba(2, 6, 23, 0.22)"
};

const listIntroStyle: CSSProperties = {
  display: "grid",
  gap: "4px"
};

const listTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.45rem",
  color: "#f8fafc"
};

const roomCountStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.92rem"
};

const listToolbarStyle: CSSProperties = {
  display: "grid"
};

const filterGroupStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px"
};

const filterButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0 12px",
  borderRadius: "999px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "rgba(148, 163, 184, 0.18)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#cbd5e1",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer"
};

const activeFilterButtonStyle: CSSProperties = {
  ...filterButtonStyle,
  borderColor: "rgba(56, 189, 248, 0.28)",
  background: "rgba(56, 189, 248, 0.14)",
  color: "#e0f2fe"
};

const filterCountStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "20px",
  minHeight: "20px",
  padding: "0 6px",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.08)",
  fontSize: "0.72rem",
  lineHeight: 1
};

const listBodyStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  maxHeight: "min(54vh, 580px)",
  overflowY: "auto",
  paddingRight: "6px"
};

const roomCardStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "15px 16px",
  borderRadius: "18px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "rgba(148, 163, 184, 0.14)"
};

const roomInfoStyle: CSSProperties = {
  minWidth: 0
};

const roomTitleRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px"
};

const roomNameStyle: CSSProperties = {
  display: "block",
  fontSize: "1.02rem",
  color: "#f8fafc"
};

const statusBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "26px",
  padding: "0 10px",
  borderRadius: "999px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "rgba(148, 163, 184, 0.18)",
  fontSize: "0.75rem",
  fontWeight: 700,
  lineHeight: 1
};

const roomMetaStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#94a3b8",
  fontSize: "0.84rem",
  lineHeight: 1.6
};

const joinButtonStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0 14px",
  borderRadius: "999px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "rgba(250, 204, 21, 0.28)",
  background: "rgba(250, 204, 21, 0.12)",
  color: "#fde68a",
  cursor: "pointer",
  fontWeight: 700
};

const lockedJoinButtonStyle: CSSProperties = {
  ...joinButtonStyle,
  borderColor: "rgba(148, 163, 184, 0.18)",
  background: "rgba(51, 65, 85, 0.28)",
  color: "#94a3b8",
  cursor: "not-allowed"
};

const emptyStyle: CSSProperties = {
  margin: 0,
  minHeight: "200px",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  color: "#94a3b8",
  lineHeight: 1.7
};

const dialogScrimStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 20,
  display: "grid",
  placeItems: "center",
  padding: "20px",
  background: "rgba(2, 6, 23, 0.68)",
  backdropFilter: "blur(14px)"
};

const dialogStyle: CSSProperties = {
  width: "min(460px, 100%)",
  padding: "22px",
  borderRadius: "24px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(8, 15, 30, 0.98))",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 28px 80px rgba(2, 6, 23, 0.34)"
};

const dialogHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px"
};

const dialogTitleWrapStyle: CSSProperties = {
  display: "grid",
  gap: "6px"
};

const dialogEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#7dd3fc",
  fontSize: "0.76rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase"
};

const dialogTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.3rem",
  color: "#f8fafc"
};

const dialogCloseButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#cbd5e1",
  cursor: "pointer"
};

const dialogBodyStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
  marginTop: "18px"
};

const fieldWrapStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  minWidth: 0
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  color: "#94a3b8",
  fontSize: "0.82rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const fieldStyle: CSSProperties = {
  width: "100%",
  minHeight: "50px",
  padding: "0 15px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  background: "rgba(15, 23, 42, 0.84)",
  color: "#f8fafc",
  fontSize: "1rem",
  boxSizing: "border-box"
};

const dialogActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "10px"
};

const ghostButtonStyle: CSSProperties = {
  minHeight: "46px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#cbd5e1",
  cursor: "pointer",
  fontWeight: 700
};

const primaryActionButtonStyle: CSSProperties = {
  minHeight: "46px",
  padding: "0 18px",
  borderRadius: "999px",
  border: 0,
  background: "#f8fafc",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 700
};

function matchesRoomFilter(filter: RoomListFilter, status: RoomStatus) {
  if (filter === "joinable") {
    return status === "waiting";
  }

  if (filter === "active") {
    return status === "countdown" || status === "playing";
  }

  return true;
}

function getRoomStatusTheme(status: RoomStatus) {
  switch (status) {
    case "waiting":
      return {
        label: "입장 가능",
        badgeColor: "#99f6e4",
        badgeBackground: "rgba(20, 184, 166, 0.16)",
        borderColor: "rgba(45, 212, 191, 0.28)",
        cardBackground: "linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(7, 30, 24, 0.88))",
        boxShadow: "inset 0 1px 0 rgba(94, 234, 212, 0.08)"
      };
    case "countdown":
      return {
        label: "시작 중",
        badgeColor: "#fde68a",
        badgeBackground: "rgba(245, 158, 11, 0.16)",
        borderColor: "rgba(251, 191, 36, 0.3)",
        cardBackground: "linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(42, 24, 4, 0.88))",
        boxShadow: "inset 0 1px 0 rgba(253, 224, 71, 0.08)"
      };
    case "playing":
      return {
        label: "진행 중",
        badgeColor: "#fecdd3",
        badgeBackground: "rgba(244, 63, 94, 0.16)",
        borderColor: "rgba(251, 113, 133, 0.28)",
        cardBackground: "linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(52, 12, 23, 0.88))",
        boxShadow: "inset 0 1px 0 rgba(253, 164, 175, 0.08)"
      };
    case "ended":
    default:
      return {
        label: "결과",
        badgeColor: "#cbd5e1",
        badgeBackground: "rgba(71, 85, 105, 0.2)",
        borderColor: "rgba(148, 163, 184, 0.2)",
        cardBackground: "linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(17, 24, 39, 0.82))",
        boxShadow: "inset 0 1px 0 rgba(148, 163, 184, 0.04)"
      };
  }
}
