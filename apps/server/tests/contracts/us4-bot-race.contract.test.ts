import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ConnectedPayload,
  GameEndedPayload,
  RoomJoinedPayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";
import { buildServer } from "../../src/app/server.js";

type EventMap = {
  CONNECTED: ConnectedPayload;
  ROOM_JOINED: RoomJoinedPayload;
  ROOM_STATE_UPDATE: RoomStateUpdatePayload;
  GAME_ENDED: GameEndedPayload;
};

describe("US4 bot race contract", () => {
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

  it("keeps people as spectators in a bot race room and ends the round once racers finish", async () => {
    const host = createRaceSocket();
    const racerOne = createRaceSocket();
    const racerTwo = createRaceSocket();
    const watcher = createRaceSocket();
    let lastSnapshot: RoomJoinedPayload["snapshot"] | null = null;

    host.on("ROOM_STATE_UPDATE", (payload) => {
      lastSnapshot = payload.snapshot;
    });

    host.connect();
    racerOne.connect();
    racerTwo.connect();
    watcher.connect();

    host.emit("CONNECT", { nickname: "호1" });
    racerOne.emit("CONNECT", { nickname: "봇1" });
    racerTwo.emit("CONNECT", { nickname: "봇2" });
    watcher.emit("CONNECT", { nickname: "관3" });

    const hostConnected = await once(host, "CONNECTED");
    const racerOneConnected = await once(racerOne, "CONNECTED");
    const racerTwoConnected = await once(racerTwo, "CONNECTED");
    const watcherConnected = await once(watcher, "CONNECTED");

    host.emit("CREATE_ROOM", {
      name: "Bot Only",
      mode: "bot_race"
    });
    const hostJoined = await once(host, "ROOM_JOINED");
    lastSnapshot = hostJoined.snapshot;
    expect(hostJoined.snapshot.room.mode).toBe("bot_race");
    expect(hostJoined.snapshot.members[0]).toMatchObject({
      playerId: hostConnected.playerId,
      role: "spectator",
      position: null
    });

    racerOne.emit("JOIN_ROOM", {
      roomId: hostJoined.roomId,
      role: "racer"
    });
    racerTwo.emit("JOIN_ROOM", {
      roomId: hostJoined.roomId,
      role: "racer"
    });
    watcher.emit("JOIN_ROOM", {
      roomId: hostJoined.roomId
    });

    await once(racerOne, "ROOM_JOINED");
    await once(racerTwo, "ROOM_JOINED");
    const watcherJoined = await once(watcher, "ROOM_JOINED");
    expect(watcherJoined.snapshot.members.find((member) => member.playerId === watcherConnected.playerId)).toMatchObject({
      role: "spectator",
      position: null
    });

    host.emit("START_GAME", { roomId: hostJoined.roomId });

    const playingSnapshot = await waitForSnapshot(
      host,
      (snapshot) =>
        snapshot.room.status === "playing" &&
        snapshot.members.filter((member) => member.role === "racer" && member.state === "playing").length === 2,
      1_500
    );

    expect(playingSnapshot.members.find((member) => member.playerId === hostConnected.playerId)).toMatchObject({
      role: "spectator",
      state: "waiting",
      position: null
    });
    expect(playingSnapshot.members.find((member) => member.playerId === racerOneConnected.playerId)).toMatchObject({
      role: "racer",
      state: "playing",
      position: { x: 0, y: 1 }
    });
    expect(playingSnapshot.members.find((member) => member.playerId === racerTwoConnected.playerId)).toMatchObject({
      role: "racer",
      state: "playing",
      position: { x: 0, y: 1 }
    });

    const endedPromise = once(host, "GAME_ENDED");

    for (let step = 0; step < 8; step += 1) {
      racerOne.emit("MOVE", { roomId: hostJoined.roomId, direction: "right", inputSeq: step + 1 });
      racerTwo.emit("MOVE", { roomId: hostJoined.roomId, direction: "right", inputSeq: step + 1 });
      await delay(10);
    }

    const ended = await endedPromise;
    expect(ended.results).toHaveLength(2);
    expect(ended.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: racerOneConnected.playerId }),
      expect.objectContaining({ playerId: racerTwoConnected.playerId })
    ]));
    expect(ended.results.map((entry) => entry.rank).sort()).toEqual([1, 2]);

    const finalSnapshot = await waitForValue(
      () => lastSnapshot?.room.status === "ended" ? lastSnapshot : null,
      1_000
    );
    expect(finalSnapshot.members.find((member) => member.playerId === watcherConnected.playerId)).toMatchObject({
      role: "spectator",
      state: "waiting",
      position: null
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

async function waitForValue<T>(
  getValue: () => T | null,
  timeoutMs: number
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = getValue();
    if (value) {
      return value;
    }

    await delay(10);
  }

  throw new Error("Timed out waiting for value");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
