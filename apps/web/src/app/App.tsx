import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { Direction } from "@fog-maze-race/shared/domain/grid-position";
import type { RoomMode } from "@fog-maze-race/shared/domain/status";
import type {
  ConnectedPayload,
  CountdownPayload,
  ErrorPayload,
  GameEndedPayload,
  RoomBotKind,
  RoomBotRequest,
  RoomBotSpeedMultiplier,
  RoomLeftPayload,
  RoomJoinedPayload,
  RoomListItem,
  RoomListUpdatePayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";

import { ConnectionBanner } from "../features/session/ConnectionBanner.js";
import { NicknameGate } from "../features/session/NicknameGate.js";
import { AdminMapsPage } from "../features/admin/AdminMapsPage.js";
import { RoomListPanel } from "../features/rooms/RoomListPanel.js";
import { summarizeGameResult, type GameResultLogEntry } from "../features/rooms/result-log.js";
import { GameScreen } from "../views/GameScreen.js";
import { getSocketClient } from "../services/socket-client.js";
import { useRoomStore } from "../stores/roomStore.js";
import { useSessionStore } from "../stores/sessionStore.js";

export function App() {
  const isAdminRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin/maps");
  const socketRef = useRef(getSocketClient());
  const inputSeqRef = useRef(0);

  const nickname = useSessionStore((state) => state.nickname);
  const playerId = useSessionStore((state) => state.playerId);
  const connectionState = useSessionStore((state) => state.connectionState);
  const setNickname = useSessionStore((state) => state.setNickname);
  const setPlayerId = useSessionStore((state) => state.setPlayerId);
  const setConnectionState = useSessionStore((state) => state.setConnectionState);

  const snapshot = useRoomStore((state) => state.snapshot);
  const replaceSnapshot = useRoomStore((state) => state.replaceSnapshot);
  const applyMove = useRoomStore((state) => state.applyMove);
  const clearRoom = useRoomStore((state) => state.clearRoom);

  const [roomName, setRoomName] = useState("Alpha");
  const [roomMode, setRoomMode] = useState<RoomMode>("normal");
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [selfPlayerId, setSelfPlayerId] = useState<string | null>(playerId);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [gameResultLogs, setGameResultLogs] = useState<GameResultLogEntry[]>([]);

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyMargin = document.body.style.margin;
    const previousBodyWidth = document.body.style.width;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    const resetViewportScroll = () => {
      if (window.scrollX === 0 && window.scrollY === 0) {
        return;
      }

      window.scrollTo(0, 0);
    };

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.width = "100%";
    document.body.style.overscrollBehavior = "none";
    resetViewportScroll();
    window.addEventListener("scroll", resetViewportScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", resetViewportScroll);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.margin = previousBodyMargin;
      document.body.style.width = previousBodyWidth;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }

    const socket = socketRef.current;

    const handleConnectTransport = () => {
      setConnectionState("connecting");

      if (!nickname.trim()) {
        return;
      }

      socket.emit("CONNECT", {
        nickname: nickname.trim().slice(0, 5),
        playerId: playerId ?? undefined
      });
    };

    const handleDisconnectTransport = () => {
      setConnectionState("disconnected");
    };

    const handleConnected = (payload: ConnectedPayload) => {
      setPlayerId(payload.playerId);
      setNickname(payload.nickname);
      setSelfPlayerId(payload.playerId);
      setConnectionState("connected");
      setLastError(null);
    };

    const handleRoomList = (payload: RoomListUpdatePayload) => {
      setRooms(payload.rooms);
    };

    const handleRoomJoined = (payload: RoomJoinedPayload) => {
      setSelfPlayerId(payload.selfPlayerId);
      setCountdownValue(payload.snapshot.match?.countdownValue ?? null);
      replaceSnapshot(payload);
    };

    const handleRoomState = (payload: RoomStateUpdatePayload) => {
      setCountdownValue(
        payload.snapshot.room.status === "countdown" ? payload.snapshot.match?.countdownValue ?? null : null
      );
      replaceSnapshot(payload);
    };

    const handleCountdown = (payload: CountdownPayload) => {
      setCountdownValue(payload.value);
    };

    const handleRoomLeft = (payload: RoomLeftPayload) => {
      if (payload.playerId !== (playerId ?? selfPlayerId)) {
        return;
      }

      setCountdownValue(null);
      clearRoom();
    };

    const handleGameEnded = (payload: GameEndedPayload) => {
      const currentSnapshot = useRoomStore.getState().snapshot;
      if (!currentSnapshot || currentSnapshot.room.roomId !== payload.roomId) {
        return;
      }

      const host = currentSnapshot.members.find(
        (member) => member.playerId === currentSnapshot.room.hostPlayerId
      );

      const nextLogEntry: GameResultLogEntry = {
        id: `${payload.roomId}-${payload.revision}`,
        roomId: payload.roomId,
        roomName: currentSnapshot.room.name,
        hostNickname: host?.nickname ?? "방장",
        endedAt: currentSnapshot.match?.endedAt ?? new Date().toISOString(),
        result: summarizeGameResult(payload.results),
        results: payload.results.map((entry) => ({
          playerId: entry.playerId,
          nickname: entry.nickname,
          outcome: entry.outcome,
          rank: entry.rank,
          elapsedMs: entry.elapsedMs
        }))
      };

      setGameResultLogs((previous) =>
        previous.some((entry) => entry.id === nextLogEntry.id) ? previous : [nextLogEntry, ...previous]
      );
    };

    const handleError = (payload: ErrorPayload) => {
      setLastError(payload.message);
    };

    socket.on("connect", handleConnectTransport);
    socket.on("disconnect", handleDisconnectTransport);
    socket.on("CONNECTED", handleConnected);
    socket.on("ROOM_LIST_UPDATE", handleRoomList);
    socket.on("ROOM_JOINED", handleRoomJoined);
    socket.on("ROOM_LEFT", handleRoomLeft);
    socket.on("ROOM_STATE_UPDATE", handleRoomState);
    socket.on("COUNTDOWN", handleCountdown);
    socket.on("PLAYER_MOVED", applyMove);
    socket.on("GAME_ENDED", handleGameEnded);
    socket.on("ERROR", handleError);

    return () => {
      socket.off("CONNECTED", handleConnected);
      socket.off("ROOM_LIST_UPDATE", handleRoomList);
      socket.off("ROOM_JOINED", handleRoomJoined);
      socket.off("ROOM_LEFT", handleRoomLeft);
      socket.off("ROOM_STATE_UPDATE", handleRoomState);
      socket.off("COUNTDOWN", handleCountdown);
      socket.off("PLAYER_MOVED", applyMove);
      socket.off("GAME_ENDED", handleGameEnded);
      socket.off("ERROR", handleError);
      socket.off("connect", handleConnectTransport);
      socket.off("disconnect", handleDisconnectTransport);
    };
  }, [applyMove, clearRoom, isAdminRoute, nickname, playerId, replaceSnapshot, selfPlayerId, setConnectionState, setNickname, setPlayerId]);

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }

    const socket = socketRef.current;
    if (!nickname.trim() || !playerId || socket.connected) {
      return;
    }

    socket.connect();
  }, [isAdminRoute, nickname, playerId]);

  function handleEnterLobby() {
    submitNickname(nickname);
  }

  function handleUpdateNickname(nextNickname: string) {
    submitNickname(nextNickname);
  }

  function submitNickname(nextNickname: string) {
    const normalizedNickname = nextNickname.trim().slice(0, 5);
    if (!normalizedNickname) {
      return;
    }

    const socket = socketRef.current;
    setConnectionState("connecting");
    setNickname(normalizedNickname);

    if (socket.connected) {
      socket.emit("CONNECT", {
        nickname: normalizedNickname,
        playerId: playerId ?? undefined
      });
      return;
    }

    socket.connect();
  }

  function handleCreateRoom() {
    socketRef.current.emit("CREATE_ROOM", {
      name: roomName.trim() || "Alpha",
      mode: roomMode
    });
  }

  function handleJoinRoom(roomId: string) {
    socketRef.current.emit("JOIN_ROOM", { roomId });
  }

  function handleStartGame() {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("START_GAME", { roomId: snapshot.room.roomId });
  }

  function handleRenameRoom(name: string) {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("RENAME_ROOM", {
      roomId: snapshot.room.roomId,
      name
    });
  }

  function handleSetVisibilitySize(visibilitySize: 3 | 5 | 7) {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("SET_VISIBILITY_SIZE", {
      roomId: snapshot.room.roomId,
      visibilitySize
    });
  }

  function handleSetBotSpeedMultiplier(botSpeedMultiplier: RoomBotSpeedMultiplier) {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("SET_BOT_SPEED", {
      roomId: snapshot.room.roomId,
      botSpeedMultiplier
    });
  }

  function handleAddBots(input: { kind: RoomBotKind; bots: RoomBotRequest[] }) {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("ADD_ROOM_BOTS", {
      roomId: snapshot.room.roomId,
      kind: input.kind,
      bots: input.bots
    });
  }

  function handleRemoveBots(playerIds?: string[]) {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("REMOVE_ROOM_BOTS", {
      roomId: snapshot.room.roomId,
      playerIds
    });
  }

  function handleForceEndRoom() {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("FORCE_END_ROOM", {
      roomId: snapshot.room.roomId
    });
  }

  function handleResetToWaiting() {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("RESET_ROOM", {
      roomId: snapshot.room.roomId
    });
  }

  function handleLeaveRoom() {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("LEAVE_ROOM", {
      roomId: snapshot.room.roomId
    });
  }

  function handleMove(direction: Direction) {
    if (!snapshot) {
      return;
    }

    inputSeqRef.current += 1;
    socketRef.current.emit("MOVE", {
      roomId: snapshot.room.roomId,
      direction,
      inputSeq: inputSeqRef.current
    });
  }

  function handleSendChatMessage(content: string) {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("SEND_CHAT_MESSAGE", {
      roomId: snapshot.room.roomId,
      content
    });
  }

  const visibleGameResultLogs = snapshot
    ? gameResultLogs.filter((entry) => entry.roomId === snapshot.room.roomId)
    : [];

  return (
    <main style={pageStyle}>
      <div style={backgroundGlowStyle} />
      <div style={backgroundMeshStyle} />
      <div style={contentStyle}>
        {isAdminRoute ? (
          <AdminMapsPage />
        ) : (
          <>
            <ConnectionBanner connectionState={connectionState} />
            {lastError ? <p style={errorStyle}>{lastError}</p> : null}
            {!snapshot ? (
              connectionState === "connected" ? (
                <RoomListPanel
                  rooms={rooms}
                  roomName={roomName}
                  roomMode={roomMode}
                  nickname={nickname}
                  connectionState={connectionState}
                  onNicknameSubmit={handleUpdateNickname}
                  onRoomNameChange={setRoomName}
                  onRoomModeChange={setRoomMode}
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                />
              ) : (
                <NicknameGate
                  nickname={nickname}
                  connectionState={connectionState}
                  onNicknameChange={setNickname}
                  onEnterLobby={handleEnterLobby}
                />
              )
            ) : (
        <GameScreen
          snapshot={snapshot}
          selfPlayerId={selfPlayerId}
          gameResultLogs={visibleGameResultLogs}
          countdownValue={countdownValue}
          onStartGame={handleStartGame}
          onRenameRoom={handleRenameRoom}
          onSetVisibilitySize={handleSetVisibilitySize}
          onSetBotSpeedMultiplier={handleSetBotSpeedMultiplier}
          onAddBots={handleAddBots}
          onRemoveBots={handleRemoveBots}
          onForceEndRoom={handleForceEndRoom}
          onResetToWaiting={handleResetToWaiting}
          onLeaveRoom={handleLeaveRoom}
                onMove={handleMove}
                onSendChatMessage={handleSendChatMessage}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "100vw",
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "18px 10px 24px",
  overflow: "hidden",
  overscrollBehavior: "none",
  background: "linear-gradient(180deg, #030712, #081120 38%, #06111d 100%)",
  color: "#e2e8f0",
  fontFamily: "\"Pretendard\", \"IBM Plex Sans KR\", sans-serif"
};

const backgroundGlowStyle: CSSProperties = {
  position: "absolute",
  inset: "0 auto auto 0",
  width: "56vw",
  height: "56vw",
  background: "radial-gradient(circle, rgba(14, 165, 233, 0.22), transparent 62%)",
  filter: "blur(24px)",
  pointerEvents: "none"
};

const backgroundMeshStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
  maskImage: "linear-gradient(180deg, rgba(255,255,255,0.6), transparent 92%)",
  pointerEvents: "none"
};

const contentStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "1500px",
  margin: "0 auto",
  display: "grid",
  justifyItems: "stretch"
};

const errorStyle: CSSProperties = {
  width: "min(1500px, 100%)",
  margin: "0 0 18px",
  padding: "14px 16px",
  borderRadius: "16px",
  background: "rgba(239, 68, 68, 0.14)",
  border: "1px solid rgba(248, 113, 113, 0.22)",
  color: "#fecaca"
};
