import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ConnectedPayload,
  ErrorPayload,
  GameEndedPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomListUpdatePayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { buildServer } from "../../src/app/server.js";

type EventMap = {
  CONNECTED: ConnectedPayload;
  ROOM_LIST_UPDATE: RoomListUpdatePayload;
  ROOM_JOINED: RoomJoinedPayload;
  ROOM_LEFT: RoomLeftPayload;
  ROOM_STATE_UPDATE: RoomStateUpdatePayload;
  GAME_ENDED: GameEndedPayload;
  ERROR: ErrorPayload;
};

describe("US3 room administration contract", () => {
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

  it("renames rooms, reassigns the host, and lets the new host force-end the match", async () => {
    const host = createRaceSocket();
    const guest = createRaceSocket();
    const watcher = createRaceSocket();

    host.connect();
    guest.connect();
    watcher.connect();

    host.emit("CONNECT", { nickname: "호1" });
    guest.emit("CONNECT", { nickname: "게2" });
    watcher.emit("CONNECT", { nickname: "관3" });

    const hostConnected = await once(host, "CONNECTED");
    const guestConnected = await once(guest, "CONNECTED");
    await once(watcher, "CONNECTED");

    await delay(60);

    host.emit("CREATE_ROOM", { name: "Alpha" });
    const hostJoined = await once(host, "ROOM_JOINED");

    guest.emit("JOIN_ROOM", { roomId: hostJoined.roomId });
    await once(guest, "ROOM_JOINED");

    guest.emit("RENAME_ROOM", { roomId: hostJoined.roomId, name: "Gamma" });
    const renameDenied = await once(guest, "ERROR");
    expect(renameDenied.code).toBe("HOST_ONLY");

    guest.emit("START_GAME", { roomId: hostJoined.roomId });
    const startDenied = await once(guest, "ERROR");
    expect(startDenied.code).toBe("HOST_ONLY");

    host.emit("RENAME_ROOM", { roomId: hostJoined.roomId, name: "Beta" });
    const renamedList = await waitForRoomList(
      watcher,
      (payload) => payload.rooms.some((room) => room.roomId === hostJoined.roomId && room.name === "Beta"),
      1_000
    );
    expect(renamedList.rooms.find((room) => room.roomId === hostJoined.roomId)?.name).toBe("Beta");

    const hostLeftPromise = once(host, "ROOM_LEFT");
    host.emit("LEAVE_ROOM", { roomId: hostJoined.roomId });
    const hostLeft = await hostLeftPromise;
    expect(hostLeft.reason).toBe("manual");
    expect(hostLeft.playerId).toBe(hostConnected.playerId);

    const reassignedSnapshot = await waitForSnapshot(
      guest,
      (snapshot) => snapshot.room.hostPlayerId === guestConnected.playerId && snapshot.members.length === 1,
      1_000
    );
    expect(reassignedSnapshot.members[0]?.playerId).toBe(guestConnected.playerId);

    watcher.emit("JOIN_ROOM", { roomId: hostJoined.roomId });
    const watcherJoined = await once(watcher, "ROOM_JOINED");
    expect(watcherJoined.snapshot.members).toHaveLength(2);

    guest.emit("START_GAME", { roomId: hostJoined.roomId });
    await waitForSnapshot(guest, (snapshot) => snapshot.room.status === "playing", 1_000);

    watcher.emit("FORCE_END_ROOM", { roomId: hostJoined.roomId });
    const forceEndDenied = await once(watcher, "ERROR");
    expect(forceEndDenied.code).toBe("HOST_ONLY");

    const endedPromise = once(guest, "GAME_ENDED");

    guest.emit("FORCE_END_ROOM", { roomId: hostJoined.roomId });

    const ended = await endedPromise;
    expect(ended.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: guestConnected.playerId, outcome: "left" }),
        expect.objectContaining({ playerId: watcherJoined.selfPlayerId, outcome: "left" })
      ])
    );

    await waitForSnapshot(guest, (snapshot) => snapshot.room.status === "waiting", 1_000);
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

async function waitForSnapshot(
  socket: Socket,
  predicate: (snapshot: RoomSnapshot) => boolean,
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

async function waitForRoomList(
  socket: Socket,
  predicate: (payload: RoomListUpdatePayload) => boolean,
  timeoutMs: number
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const payload = await once(socket, "ROOM_LIST_UPDATE");
    if (predicate(payload)) {
      return payload;
    }
  }

  throw new Error("Timed out waiting for room list");
}

function once<EventName extends keyof EventMap>(
  socket: Socket,
  eventName: EventName
): Promise<EventMap[EventName]> {
  return new Promise((resolve) => {
    const untypedSocket = socket as any;
    untypedSocket.once(eventName, (payload: EventMap[EventName]) => resolve(payload));
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
