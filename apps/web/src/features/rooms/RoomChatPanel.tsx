import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";

type RoomChatPanelProps = {
  snapshot: RoomSnapshot;
  selfPlayerId: string | null;
  onSendMessage: (content: string) => void;
};

export function RoomChatPanel({
  snapshot,
  selfPlayerId,
  onSendMessage
}: RoomChatPanelProps) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = logRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [snapshot.chat.length]);

  function handleSubmit() {
    const content = draft.trim();
    if (!content) {
      return;
    }

    onSendMessage(content);
    setDraft("");
  }

  function blockCanvasFocus(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <section
      data-testid="room-chat-panel"
      style={panelStyle}
      onPointerDown={blockCanvasFocus}
    >
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Room Chat</p>
          <strong style={titleStyle}>전체 채팅</strong>
        </div>
        <span style={countStyle}>{snapshot.chat.length}</span>
      </header>

      <div ref={logRef} data-testid="room-chat-log" style={logStyle}>
        {snapshot.chat.length > 0 ? (
          snapshot.chat.map((message) => {
            const isSelf = message.playerId === selfPlayerId;

            return (
              <article
                key={message.messageId}
                style={{
                  ...messageCardStyle,
                  justifySelf: isSelf ? "end" : "stretch",
                  background: isSelf ? "rgba(8, 47, 73, 0.94)" : "rgba(15, 23, 42, 0.92)",
                  borderColor: isSelf ? "rgba(56, 189, 248, 0.3)" : "rgba(148, 163, 184, 0.12)"
                }}
              >
                <div style={messageMetaStyle}>
                  <strong style={{ ...senderStyle, color: message.color }}>
                    {message.nickname}
                    {isSelf ? " (나)" : ""}
                  </strong>
                  <time style={timeStyle}>{formatSentAt(message.sentAt)}</time>
                </div>
                <p style={messageTextStyle}>{message.content}</p>
              </article>
            );
          })
        ) : (
          <p style={emptyStateStyle}>아직 메시지가 없습니다.</p>
        )}
      </div>

      <form
        style={composerStyle}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <input
          data-testid="room-chat-input"
          style={inputStyle}
          value={draft}
          maxLength={80}
          placeholder="메시지 입력"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <button data-testid="room-chat-submit" type="submit" style={submitButtonStyle}>
          전송
        </button>
      </form>
    </section>
  );
}

function formatSentAt(sentAt: string) {
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

const panelStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  gap: "10px",
  width: "291px",
  height: "480px",
  padding: "12px",
  borderRadius: "18px",
  boxSizing: "border-box",
  background: "linear-gradient(180deg, rgba(2, 6, 23, 0.84), rgba(7, 16, 30, 0.92))",
  border: "1px solid rgba(125, 211, 252, 0.16)",
  boxShadow: "0 18px 48px rgba(2, 6, 23, 0.34)",
  backdropFilter: "blur(8px)",
  pointerEvents: "auto"
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px"
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#7dd3fc",
  fontSize: "0.64rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  display: "block",
  marginTop: "2px",
  fontSize: "0.94rem",
  color: "#f8fafc"
};

const countStyle: CSSProperties = {
  minWidth: "26px",
  height: "26px",
  display: "inline-grid",
  placeItems: "center",
  borderRadius: "999px",
  fontSize: "0.72rem",
  color: "#bae6fd",
  background: "rgba(8, 47, 73, 0.88)",
  border: "1px solid rgba(56, 189, 248, 0.24)"
};

const logStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  minHeight: 0,
  overflowY: "auto",
  paddingRight: "4px"
};

const messageCardStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  width: "100%",
  maxWidth: "100%",
  padding: "10px 12px",
  borderRadius: "14px",
  border: "1px solid transparent",
  boxSizing: "border-box"
};

const messageMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px"
};

const senderStyle: CSSProperties = {
  fontSize: "0.74rem"
};

const timeStyle: CSSProperties = {
  fontSize: "0.68rem",
  color: "#94a3b8"
};

const messageTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.84rem",
  lineHeight: 1.35,
  color: "#e2e8f0",
  wordBreak: "break-word"
};

const emptyStateStyle: CSSProperties = {
  margin: 0,
  padding: "18px 12px",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.72)",
  border: "1px dashed rgba(148, 163, 184, 0.16)",
  color: "#94a3b8",
  fontSize: "0.8rem",
  textAlign: "center"
};

const composerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "8px",
  alignItems: "center"
};

const inputStyle: CSSProperties = {
  minWidth: 0,
  height: "40px",
  padding: "0 12px",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(15, 23, 42, 0.88)",
  color: "#f8fafc",
  outline: "none"
};

const submitButtonStyle: CSSProperties = {
  height: "40px",
  padding: "0 14px",
  borderRadius: "12px",
  border: 0,
  background: "linear-gradient(135deg, #38bdf8, #0284c7)",
  color: "#082032",
  fontWeight: 700,
  cursor: "pointer"
};
