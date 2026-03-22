import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { Direction } from "@fog-maze-race/shared/domain/grid-position";
import type {
  ConnectedPayload,
  CountdownPayload,
  ErrorPayload,
  RoomLeftPayload,
  RoomJoinedPayload,
  RoomListItem,
  RoomListUpdatePayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";

import { ConnectionBanner } from "../features/session/ConnectionBanner.js";
import { NicknameGate } from "../features/session/NicknameGate.js";
import { RoomListPanel } from "../features/rooms/RoomListPanel.js";
import { GameScreen } from "../views/GameScreen.js";
import { getSocketClient } from "../services/socket-client.js";
import { useRoomStore } from "../stores/roomStore.js";
import { useSessionStore } from "../stores/sessionStore.js";

export function App() {
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
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [selfPlayerId, setSelfPlayerId] = useState<string | null>(playerId);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
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
    socket.on("ERROR", handleError);

    return () => {
      socket.off("CONNECTED", handleConnected);
      socket.off("ROOM_LIST_UPDATE", handleRoomList);
      socket.off("ROOM_JOINED", handleRoomJoined);
      socket.off("ROOM_LEFT", handleRoomLeft);
      socket.off("ROOM_STATE_UPDATE", handleRoomState);
      socket.off("COUNTDOWN", handleCountdown);
      socket.off("PLAYER_MOVED", applyMove);
      socket.off("ERROR", handleError);
      socket.off("connect", handleConnectTransport);
      socket.off("disconnect", handleDisconnectTransport);
    };
  }, [applyMove, clearRoom, nickname, playerId, replaceSnapshot, selfPlayerId, setConnectionState, setNickname, setPlayerId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!nickname.trim() || !playerId || socket.connected) {
      return;
    }

    socket.connect();
  }, [nickname, playerId]);

  useEffect(() => {
    if (!snapshot || snapshot.room.status !== "playing") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const direction = toDirection(event.key);
      if (!direction) {
        return;
      }

      event.preventDefault();
      handleMove(direction);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [snapshot]);

  function handleEnterLobby() {
    const nextNickname = nickname.trim().slice(0, 5);
    if (!nextNickname) {
      return;
    }

    const socket = socketRef.current;
    setConnectionState("connecting");
    setNickname(nextNickname);

    if (socket.connected) {
      socket.emit("CONNECT", {
        nickname: nextNickname,
        playerId: playerId ?? undefined
      });
      return;
    }

    socket.connect();
  }

  function handleCreateRoom() {
    socketRef.current.emit("CREATE_ROOM", { name: roomName.trim() || "Alpha" });
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

  function handleForceEndRoom() {
    if (!snapshot) {
      return;
    }

    socketRef.current.emit("FORCE_END_ROOM", {
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

  return (
    <main style={pageStyle}>
      <div style={backgroundGlowStyle} />
      <div style={backgroundMeshStyle} />
      <div style={contentStyle}>
        <ConnectionBanner connectionState={connectionState} />
        {lastError ? <p style={errorStyle}>{lastError}</p> : null}
        {!snapshot ? (
          connectionState === "connected" ? (
            <RoomListPanel
              rooms={rooms}
              roomName={roomName}
              nickname={nickname}
              onRoomNameChange={setRoomName}
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
            countdownValue={countdownValue}
            onStartGame={handleStartGame}
            onRenameRoom={handleRenameRoom}
            onForceEndRoom={handleForceEndRoom}
            onLeaveRoom={handleLeaveRoom}
            onMove={handleMove}
          />
        )}
      </div>
    </main>
  );
}

function toDirection(key: string): Direction | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

const pageStyle: CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  padding: "32px 18px 44px",
  overflow: "hidden",
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
  width: "min(1240px, 100%)",
  margin: "0 auto",
  display: "grid",
  placeItems: "center"
};

const errorStyle: CSSProperties = {
  width: "min(1240px, 100%)",
  margin: "0 0 18px",
  padding: "14px 16px",
  borderRadius: "16px",
  background: "rgba(239, 68, 68, 0.14)",
  border: "1px solid rgba(248, 113, 113, 0.22)",
  color: "#fecaca"
};
