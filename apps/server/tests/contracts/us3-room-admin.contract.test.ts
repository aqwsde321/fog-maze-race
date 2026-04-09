import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ConnectedPayload,
  ErrorPayload,
  GameEndedPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomListUpdatePayload,
  RoomStateUpdatePayload,
  SetRoomGameModePayload,
  SetVisibilitySizePayload
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
  SET_VISIBILITY_SIZE: SetVisibilitySizePayload;
  SET_ROOM_GAME_MODE: SetRoomGameModePayload;
};

describe("US3 room administration contract", () => {
  let port = 0;
  let app: Awaited<ReturnType<typeof buildServer>>["app"];
  const sockets: Socket[] = [];

  beforeEach(async () => {
    const server = await buildServer({
      countdownStepMs: 25,
      resultsDurationMs: 60,
      mapStorePath: null
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

  it("renames rooms, reassigns the host, and lets the new host force-end then reset the match", async () => {
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

    guest.emit("SET_VISIBILITY_SIZE", { roomId: hostJoined.roomId, visibilitySize: 3 });
    const visionDenied = await once(guest, "ERROR");
    expect(visionDenied.code).toBe("HOST_ONLY");

    guest.emit("SET_ROOM_GAME_MODE", { roomId: hostJoined.roomId, gameMode: "item" });
    const gameModeDenied = await once(guest, "ERROR");
    expect(gameModeDenied.code).toBe("HOST_ONLY");

    host.emit("SET_VISIBILITY_SIZE", { roomId: hostJoined.roomId, visibilitySize: 5 });
    const visibilityUpdated = await waitForSnapshot(
      host,
      (snapshot) => snapshot.room.visibilitySize === 5 && snapshot.previewMap?.visibilityRadius === 2,
      1_000
    );
    expect(visibilityUpdated.room.visibilitySize).toBe(5);

    host.emit("SET_ROOM_GAME_MODE", { roomId: hostJoined.roomId, gameMode: "item" });
    const itemModeUpdated = await waitForSnapshot(
      host,
      (snapshot) => snapshot.room.gameMode === "item" && snapshot.previewMap?.featureFlags?.itemBoxes === true,
      1_000
    );
    expect(itemModeUpdated.room.gameMode).toBe("item");

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
    await waitForSnapshot(
      guest,
      (snapshot) => snapshot.room.status === "playing" && snapshot.match?.map.visibilityRadius === 2,
      1_000
    );

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

    watcher.emit("RESET_ROOM", { roomId: hostJoined.roomId });
    const resetDenied = await once(watcher, "ERROR");
    expect(resetDenied.code).toBe("HOST_ONLY");

    guest.emit("RESET_ROOM", { roomId: hostJoined.roomId });
    const resetSnapshot = await waitForSnapshot(
      guest,
      (snapshot) => snapshot.room.status === "waiting" && snapshot.room.gameMode === "item",
      1_000
    );
    expect(resetSnapshot.previewMap?.featureFlags?.itemBoxes).toBe(true);
  }, 15_000);

  it("syncs room chat messages to every member in the room", async () => {
    const host = createRaceSocket();
    const guest = createRaceSocket();

    host.connect();
    guest.connect();

    host.emit("CONNECT", { nickname: "호1" });
    guest.emit("CONNECT", { nickname: "게2" });

    await once(host, "CONNECTED");
    await once(guest, "CONNECTED");
    await delay(60);

    host.emit("CREATE_ROOM", { name: "Alpha" });
    const hostJoined = await once(host, "ROOM_JOINED");

    guest.emit("JOIN_ROOM", { roomId: hostJoined.roomId });
    await once(guest, "ROOM_JOINED");

    host.emit("SEND_CHAT_MESSAGE", {
      roomId: hostJoined.roomId,
      content: "  안개 조심  "
    });

    const hostSnapshot = await waitForSnapshot(host, (snapshot) => snapshot.chat.length === 1, 1_000);
    const guestSnapshot = await waitForSnapshot(guest, (snapshot) => snapshot.chat.length === 1, 1_000);

    expect(hostSnapshot.chat).toEqual(guestSnapshot.chat);
    expect(guestSnapshot.chat[0]).toMatchObject({
      nickname: "호1",
      content: "안개 조심"
    });
  }, 10_000);

  it("acknowledges ping checks so the client can measure round-trip latency", async () => {
    const socket = createRaceSocket();
    socket.connect();

    await new Promise<void>((resolve) => {
      socket.once("connect", () => resolve());
    });

    const acknowledgement = await new Promise<{ serverReceivedAt: string }>((resolve, reject) => {
      socket.timeout(1_000).emit("PING_CHECK", { clientSentAt: new Date().toISOString() }, (
        error: Error | null,
        payload: { serverReceivedAt: string }
      ) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(payload);
      });
    });

    expect(typeof acknowledgement.serverReceivedAt).toBe("string");
    expect(Number.isNaN(new Date(acknowledgement.serverReceivedAt).getTime())).toBe(false);
  }, 5_000);

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
