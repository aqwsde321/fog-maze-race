import type {
  PlayerMovedPayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { create } from "zustand";

type RoomState = {
  snapshot: RoomSnapshot | null;
  replaceSnapshot: (payload: RoomStateUpdatePayload | { snapshot: RoomSnapshot }) => void;
  applyMove: (payload: PlayerMovedPayload) => void;
  clearRoom: () => void;
};

export const useRoomStore = create<RoomState>()((set) => ({
  snapshot: null,
  replaceSnapshot: (payload) => {
    set({ snapshot: payload.snapshot });
  },
  applyMove: (payload) => {
    set((state) => {
      if (!state.snapshot || state.snapshot.revision + 1 !== payload.revision) {
        return state;
      }

      return {
        snapshot: {
          ...state.snapshot,
          revision: payload.revision,
          members: state.snapshot.members.map((member) =>
            member.playerId === payload.playerId
              ? { ...member, position: payload.position }
              : member
          )
        }
      };
    });
  },
  clearRoom: () => set({ snapshot: null })
}));
