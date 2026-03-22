import { describe, expect, it } from "vitest";

import { RoomAggregate } from "../../src/core/room.js";

describe("RoomAggregate", () => {
  it("reassigns the host to the earliest remaining joiner when the current host leaves", () => {
    const room = new RoomAggregate({
      roomId: "room-1",
      name: "Alpha",
      hostPlayerId: "host"
    });

    room.join({
      playerId: "host",
      nickname: "Host",
      color: "#f97316",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "guest-1",
      nickname: "Guest1",
      color: "#38bdf8",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "guest-2",
      nickname: "Guest2",
      color: "#22c55e",
      state: "waiting",
      position: null
    });

    room.leave("host");

    expect(room.hostPlayerId).toBe("guest-1");
    expect(room.listMembers().map((member) => member.playerId)).toEqual(["guest-1", "guest-2"]);
  });

  it("blocks new joins once countdown has started", () => {
    const room = new RoomAggregate({
      roomId: "room-1",
      name: "Alpha",
      hostPlayerId: "host"
    });

    room.join({
      playerId: "host",
      nickname: "Host",
      color: "#f97316",
      state: "waiting",
      position: null
    });
    room.startCountdown("host");

    expect(() =>
      room.join({
        playerId: "late-player",
        nickname: "Late",
        color: "#38bdf8",
        state: "waiting",
        position: null
      })
    ).toThrowError("ROOM_NOT_JOINABLE");
  });
});
