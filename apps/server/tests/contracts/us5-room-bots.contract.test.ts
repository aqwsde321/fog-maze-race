import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ConnectedPayload,
  ErrorPayload,
  GameEndedPayload,
  RoomListUpdatePayload,
  RoomLeftPayload,
  RoomJoinedPayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";
import { buildServer } from "../../src/app/server.js";

type EventMap = {
  CONNECTED: ConnectedPayload;
  ERROR: ErrorPayload;
  GAME_ENDED: GameEndedPayload;
  ROOM_LIST_UPDATE: RoomListUpdatePayload;
  ROOM_LEFT: RoomLeftPayload;
  ROOM_JOINED: RoomJoinedPayload;
  ROOM_STATE_UPDATE: RoomStateUpdatePayload;
};

describe("US5 room bots contract", () => {
  let port = 0;
  let app: Awaited<ReturnType<typeof buildServer>>["app"];
  const sockets: Socket[] = [];

  beforeEach(async () => {
    const server = await buildServer({
      countdownStepMs: 25,
      resultsDurationMs: 60,
      forcedMapId: "training-lap"
    });

    app = server.app;

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to start test server");
    }

    port = address.port;
  });

  afterEach(async () => {
    await Promise.all(sockets.map((socket) => (socket.connected ? socket.close() : undefined)));
    sockets.length = 0;
    await app.close();
  });

  it("lets the host add named bots with per-bot explore strategies to a normal room and rejects guest bot requests", async () => {
    const host = createRaceSocket();
    const guest = createRaceSocket();

    host.connect();
    guest.connect();

    host.emit("CONNECT", { nickname: "호1" });
    guest.emit("CONNECT", { nickname: "게2" });

    const hostConnected = await once(host, "CONNECTED");
    const guestConnected = await once(guest, "CONNECTED");

    host.emit("CREATE_ROOM", { name: "Alpha", mode: "normal" });
    const hostJoined = await once(host, "ROOM_JOINED");

    guest.emit("JOIN_ROOM", { roomId: hostJoined.roomId });
    await once(guest, "ROOM_JOINED");

    guest.emit("ADD_ROOM_BOTS", {
      roomId: hostJoined.roomId,
      bots: [{ nickname: "red", kind: "explore", strategy: "frontier" }]
    });
    const denied = await once(guest, "ERROR");
    expect(denied.code).toBe("HOST_ONLY");

    host.emit("ADD_ROOM_BOTS", {
      roomId: hostJoined.roomId,
      bots: [
        { nickname: "red", kind: "explore", strategy: "frontier" },
        { nickname: "blue", kind: "explore", strategy: "tremaux" }
      ]
    });

    const updated = await waitForSnapshot(
      host,
      (snapshot) =>
        snapshot.members.length === 4 &&
        snapshot.members.some((member) => member.nickname === "red") &&
        snapshot.members.some((member) => member.nickname === "blue") &&
        snapshot.chat.filter((message) => message.content === "들어왔다.").length === 2,
      2_000
    );

    expect(updated.room.hostPlayerId).toBe(hostConnected.playerId);
    expect(updated.members.find((member) => member.playerId === guestConnected.playerId)).toMatchObject({
      role: "racer"
    });
    expect(updated.members.find((member) => member.nickname === "red")).toMatchObject({
      role: "racer",
      state: "waiting"
    });
    expect(updated.members.find((member) => member.nickname === "blue")).toMatchObject({
      role: "racer",
      state: "waiting"
    });
  }, 15_000);

  it("lets the host add named bots to a bot race room and those bots finish automatically", async () => {
    const host = createRaceSocket();

    host.connect();
    host.emit("CONNECT", { nickname: "호1" });

    const hostConnected = await once(host, "CONNECTED");

    host.emit("CREATE_ROOM", { name: "Bot Only", mode: "bot_race" });
    const hostJoined = await once(host, "ROOM_JOINED");
    expect(hostJoined.snapshot.members[0]).toMatchObject({
      playerId: hostConnected.playerId,
      role: "spectator"
    });

    host.emit("ADD_ROOM_BOTS", {
      roomId: hostJoined.roomId,
      kind: "join",
      nicknames: ["red", "blue"]
    });

    const botReadySnapshot = await waitForSnapshot(
      host,
      (snapshot) =>
        snapshot.members.length === 3 &&
        snapshot.members.filter((member) => member.role === "racer").length === 2 &&
        snapshot.members.some((member) => member.nickname === "red") &&
        snapshot.members.some((member) => member.nickname === "blue"),
      2_000
    );

    expect(botReadySnapshot.members.find((member) => member.playerId === hostConnected.playerId)).toMatchObject({
      role: "spectator",
      state: "waiting",
      position: null
    });

    host.emit("START_GAME", { roomId: hostJoined.roomId });

    const ended = await once(host, "GAME_ENDED");
    expect(ended.results).toHaveLength(2);
    expect(ended.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ nickname: "red" }),
      expect.objectContaining({ nickname: "blue" })
    ]));
    expect(ended.results.map((entry) => entry.rank).sort()).toEqual([1, 2]);
  }, 15_000);

  it("lets the host remove selected bots from a waiting room", async () => {
    const host = createRaceSocket();

    host.connect();
    host.emit("CONNECT", { nickname: "호1" });

    await once(host, "CONNECTED");

    host.emit("CREATE_ROOM", { name: "Alpha", mode: "normal" });
    const joined = await once(host, "ROOM_JOINED");

    host.emit("ADD_ROOM_BOTS", {
      roomId: joined.roomId,
      kind: "explore",
      nicknames: ["red", "blue"]
    });

    const withBots = await waitForSnapshot(
      host,
      (snapshot) =>
        snapshot.members.some((member) => member.nickname === "red") &&
        snapshot.members.some((member) => member.nickname === "blue"),
      2_000
    );

    const blueBot = withBots.members.find((member) => member.nickname === "blue");
    expect(blueBot).toBeDefined();

    host.emit("REMOVE_ROOM_BOTS", {
      roomId: joined.roomId,
      playerIds: [blueBot!.playerId]
    });

    const afterRemoval = await waitForSnapshot(
      host,
      (snapshot) =>
        snapshot.members.some((member) => member.nickname === "red") &&
        !snapshot.members.some((member) => member.nickname === "blue"),
      2_000
    );

    expect(afterRemoval.members.map((member) => member.nickname)).toEqual(expect.arrayContaining(["호1", "red"]));
  }, 15_000);

  it("cleans up bots when the last human leaves the room", async () => {
    const host = createRaceSocket();

    host.connect();
    host.emit("CONNECT", { nickname: "호1" });

    await once(host, "CONNECTED");

    host.emit("CREATE_ROOM", { name: "Alpha", mode: "normal" });
    const joined = await once(host, "ROOM_JOINED");

    host.emit("ADD_ROOM_BOTS", {
      roomId: joined.roomId,
      kind: "explore",
      nicknames: ["red", "blue"]
    });

    await waitForSnapshot(
      host,
      (snapshot) => snapshot.members.length === 3,
      2_000
    );

    const leftPromise = once(host, "ROOM_LEFT");
    host.emit("LEAVE_ROOM", { roomId: joined.roomId });
    const left = await leftPromise;
    expect(left.reason).toBe("manual");

    await waitFor(async () => {
      const rooms = await once(host, "ROOM_LIST_UPDATE");
      return rooms.rooms.every((room) => room.roomId !== joined.roomId);
    }, 2_000);
  }, 15_000);

  it("allows 15 bots plus human spectators in a bot race room and spectators can chat", async () => {
    const host = createRaceSocket();
    const viewer = createRaceSocket();

    host.connect();
    viewer.connect();
    host.emit("CONNECT", { nickname: "호1" });
    viewer.emit("CONNECT", { nickname: "관전1" });

    await once(host, "CONNECTED");
    const viewerConnected = await once(viewer, "CONNECTED");

    host.emit("CREATE_ROOM", { name: "Bot Only", mode: "bot_race" });
    const joined = await once(host, "ROOM_JOINED");

    host.emit("ADD_ROOM_BOTS", {
      roomId: joined.roomId,
      kind: "explore",
      nicknames: Array.from({ length: 15 }, (_, index) => `b${index + 1}`)
    });

    const filled = await waitForSnapshot(
      host,
      (snapshot) => snapshot.members.filter((member) => member.role === "racer").length === 15,
      4_000
    );
    expect(filled.members.filter((member) => member.role === "racer")).toHaveLength(15);

    viewer.emit("JOIN_ROOM", { roomId: joined.roomId });
    const viewerJoined = await once(viewer, "ROOM_JOINED");
    expect(viewerJoined.snapshot.members.find((member) => member.playerId === viewerConnected.playerId)).toMatchObject({
      role: "spectator",
      kind: "human"
    });

    viewer.emit("SEND_CHAT_MESSAGE", {
      roomId: joined.roomId,
      content: "관전자도 채팅"
    });

    const chatted = await waitForSnapshot(
      host,
      (snapshot) => snapshot.chat.some((message) => message.content === "관전자도 채팅"),
      2_000
    );
    expect(chatted.chat.at(-1)).toMatchObject({
      content: "관전자도 채팅"
    });
  }, 15_000);

  function createRaceSocket() {
    const socket = createClient(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      autoConnect: false,
      forceNew: true
    });
    sockets.push(socket);
    return socket;
  }
});

function once<EventName extends keyof EventMap>(
  socket: Socket,
  eventName: EventName
): Promise<EventMap[EventName]> {
  return new Promise((resolve) => {
    const untypedSocket = socket as any;
    untypedSocket.once(eventName, (payload: EventMap[EventName]) => resolve(payload));
  });
}

async function waitForSnapshot(
  socket: Socket,
  predicate: (snapshot: RoomJoinedPayload["snapshot"]) => boolean,
  timeoutMs: number
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const payload = await once(socket, "ROOM_STATE_UPDATE");
    if (predicate(payload.snapshot)) {
      return payload.snapshot;
    }
  }

  throw new Error("Timed out waiting for room snapshot");
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }
  }

  throw new Error("Timed out waiting for condition");
}
