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
      kind: "human",
      color: "#f97316",
      shape: "circle",
      role: "racer",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "guest-1",
      nickname: "Guest1",
      kind: "human",
      color: "#38bdf8",
      shape: "square",
      role: "racer",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "guest-2",
      nickname: "Guest2",
      kind: "human",
      color: "#22c55e",
      shape: "diamond",
      role: "racer",
      state: "waiting",
      position: null
    });

    room.leave("host");

    expect(room.hostPlayerId).toBe("guest-1");
    expect(room.listMembers().map((member) => member.playerId)).toEqual(["guest-1", "guest-2"]);
  });

  it("reassigns the host to the earliest remaining human before any bot", () => {
    const room = new RoomAggregate({
      roomId: "room-1",
      name: "Alpha",
      hostPlayerId: "host"
    });

    room.join({
      playerId: "host",
      nickname: "Host",
      kind: "human",
      color: "#f97316",
      shape: "circle",
      role: "racer",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "bot-1",
      nickname: "bot1",
      kind: "bot",
      color: "#38bdf8",
      shape: "square",
      role: "racer",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "guest-1",
      nickname: "Guest1",
      kind: "human",
      color: "#22c55e",
      shape: "diamond",
      role: "racer",
      state: "waiting",
      position: null
    });

    room.leave("host");

    expect(room.hostPlayerId).toBe("guest-1");
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
      kind: "human",
      color: "#f97316",
      shape: "circle",
      role: "racer",
      state: "waiting",
      position: null
    });
    room.startCountdown("host");

    expect(() =>
      room.join({
        playerId: "late-player",
        nickname: "Late",
        kind: "human",
        color: "#38bdf8",
        shape: "square",
        role: "racer",
        state: "waiting",
        position: null
      })
    ).toThrowError("ROOM_NOT_JOINABLE");
  });

  it("stores room-wide chat messages and trims the history to the latest 30 entries", () => {
    const room = new RoomAggregate({
      roomId: "room-1",
      name: "Alpha",
      hostPlayerId: "host"
    });

    room.join({
      playerId: "host",
      nickname: "Host",
      kind: "human",
      color: "#f97316",
      shape: "circle",
      role: "racer",
      state: "waiting",
      position: null
    });

    for (let index = 0; index < 31; index += 1) {
      room.addChatMessage({
        playerId: "host",
        messageId: `message-${index}`,
        content: `메시지 ${index}`,
        sentAt: `2026-03-27T00:00:${String(index).padStart(2, "0")}.000Z`
      });
    }

    expect(room.listChatMessages()).toHaveLength(30);
    expect(room.listChatMessages()[0]?.content).toBe("메시지 1");
    expect(room.listChatMessages().at(-1)).toMatchObject({
      messageId: "message-30",
      playerId: "host",
      nickname: "Host",
      color: "#f97316",
      content: "메시지 30"
    });
  });

  it("rejects blank chat messages from room members", () => {
    const room = new RoomAggregate({
      roomId: "room-1",
      name: "Alpha",
      hostPlayerId: "host"
    });

    room.join({
      playerId: "host",
      nickname: "Host",
      kind: "human",
      color: "#f97316",
      shape: "circle",
      role: "racer",
      state: "waiting",
      position: null
    });

    expect(() =>
      room.addChatMessage({
        playerId: "host",
        messageId: "message-1",
        content: "   ",
        sentAt: "2026-03-27T00:00:00.000Z"
      })
    ).toThrowError("INVALID_CHAT_MESSAGE");
  });

  it("assigns start slots and completion rules only to racers in a bot race room", () => {
    const room = new RoomAggregate({
      roomId: "room-1",
      name: "Bot Race",
      hostPlayerId: "host",
      mode: "bot_race"
    });

    room.join({
      playerId: "host",
      nickname: "Host",
      kind: "human",
      color: "#f97316",
      shape: "circle",
      role: "spectator",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "bot-1",
      nickname: "bot1",
      kind: "bot",
      color: "#38bdf8",
      shape: "square",
      role: "racer",
      state: "waiting",
      position: null
    });
    room.join({
      playerId: "viewer",
      nickname: "Viewr",
      kind: "human",
      color: "#22c55e",
      shape: "diamond",
      role: "spectator",
      state: "waiting",
      position: null
    });

    room.seedMatchPositions([
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ]);
    room.markMembersPlaying();

    expect(room.listMembers()).toEqual([
      expect.objectContaining({
        playerId: "host",
        role: "spectator",
        state: "waiting",
        position: null
      }),
      expect.objectContaining({
        playerId: "bot-1",
        role: "racer",
        state: "playing",
        position: { x: 0, y: 1 }
      }),
      expect.objectContaining({
        playerId: "viewer",
        role: "spectator",
        state: "waiting",
        position: null
      })
    ]);

    expect(room.allMembersFinished()).toBe(false);

    room.markMemberFinished("bot-1", 1);

    expect(room.allMembersFinished()).toBe(true);
  });
});
