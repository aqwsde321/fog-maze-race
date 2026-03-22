import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionState = {
  playerId: string | null;
  nickname: string;
  connectionState: "idle" | "connecting" | "connected" | "disconnected";
  setNickname: (nickname: string) => void;
  setPlayerId: (playerId: string) => void;
  setConnectionState: (connectionState: SessionState["connectionState"]) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      playerId: null,
      nickname: "",
      connectionState: "idle",
      setNickname: (nickname) => set({ nickname }),
      setPlayerId: (playerId) => set({ playerId }),
      setConnectionState: (connectionState) => set({ connectionState })
    }),
    {
      name: "fog-maze-race-session",
      partialize: (state) => ({
        playerId: state.playerId,
        nickname: state.nickname
      })
    }
  )
);
