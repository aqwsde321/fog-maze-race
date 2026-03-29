import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ConnectedPayload,
  GameEndedPayload,
  RoomJoinedPayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";
import type { RoomSnapshot } from "@fog-maze-race/shared/contracts/snapshots";
import { buildServer } from "../../src/app/server.js";

type EventMap = {
  CONNECTED: ConnectedPayload;
  ROOM_JOINED: RoomJoinedPayload;
  ROOM_STATE_UPDATE: RoomStateUpdatePayload;
  GAME_ENDED: GameEndedPayload;
};

describe("US2 recovery contract", () => {
  let port = 0;
  let app: Awaited<ReturnType<typeof buildServer>>["app"];
  const sockets: Socket[] = [];

  beforeEach(async () => {
    const server = await buildServer({
      countdownStepMs: 25,
      resultsDurationMs: 60,
      forcedMapId: "training-lap",
      recoveryGraceMs: 250
    } as any);

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

  it("restores a disconnected player within the grace window", async () => {
    const { host, guest, roomId, guestPlayerId } = await bootstrapPlayingRoom();

    guest.emit("MOVE", { roomId, direction: "right", inputSeq: 1 });
    guest.emit("MOVE", { roomId, direction: "right", inputSeq: 2 });

    await delay(30);
    guest.disconnect();

    const disconnectedSnapshot = await waitForSnapshot(
      host,
      (snapshot) => snapshot.members.find((member) => member.playerId === guestPlayerId)?.state === "disconnected",
      1_000
    );
    const disconnectedGuest = disconnectedSnapshot.members.find((member) => member.playerId === guestPlayerId);
    expect(disconnectedGuest?.position).toEqual({ x: 2, y: 1 });

    const recoveredGuest = createRaceSocket();
    const connectedPromise = once(recoveredGuest, "CONNECTED");
    const joinedPromise = once(recoveredGuest, "ROOM_JOINED");
    recoveredGuest.connect();
    recoveredGuest.emit("CONNECT", { playerId: guestPlayerId, nickname: "게2" });

    const recoveredConnected = await connectedPromise;
    expect(recoveredConnected.recovered).toBe(true);
    expect(recoveredConnected.currentRoomId).toBe(roomId);

    const recoveredJoined = await joinedPromise;
    const recoveredMember = recoveredJoined.snapshot.members.find(
      (member) => member.playerId === guestPlayerId
    );
    expect(recoveredMember?.state).toBe("playing");
    expect(recoveredMember?.position).toEqual({ x: 2, y: 1 });
  });

  it("marks the player as left after the grace window and excludes them from completion logic", async () => {
    const { host, guest, roomId, guestPlayerId } = await bootstrapPlayingRoom();

    guest.disconnect();

    await waitForSnapshot(
      host,
      (snapshot) => snapshot.members.find((member) => member.playerId === guestPlayerId)?.state === "disconnected",
      1_000
    );

    const timeoutSnapshot = await waitForSnapshot(
      host,
      (snapshot) => !snapshot.members.some((member) => member.playerId === guestPlayerId),
      1_000
    );
    expect(timeoutSnapshot.members).toHaveLength(1);

    const lateGuest = createRaceSocket();
    lateGuest.connect();
    lateGuest.emit("CONNECT", { playerId: guestPlayerId, nickname: "게2" });

    const lateConnected = await once(lateGuest, "CONNECTED");
    expect(lateConnected.recovered).toBe(false);
    expect(lateConnected.currentRoomId).toBeNull();

    const endedEvents: GameEndedPayload[] = [];
    host.on("GAME_ENDED", (payload) => {
      endedEvents.push(payload);
    });

    for (let step = 0; step < 8; step += 1) {
      host.emit("MOVE", { roomId, direction: "right", inputSeq: step + 1 });
      await delay(10);
    }

    await waitFor(async () => endedEvents.length > 0, 1_000);
    expect(endedEvents[0]?.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: guestPlayerId,
          outcome: "left",
          rank: null
        })
      ])
    );
  });

  async function bootstrapPlayingRoom() {
    const host = createRaceSocket();
    const guest = createRaceSocket();

    host.connect();
    guest.connect();

    host.emit("CONNECT", { nickname: "호1" });
    guest.emit("CONNECT", { nickname: "게2" });

    const hostConnected = await once(host, "CONNECTED");
    const guestConnected = await once(guest, "CONNECTED");

    await delay(60);

    host.emit("CREATE_ROOM", { name: "Alpha" });
    const hostJoined = await once(host, "ROOM_JOINED");

    guest.emit("JOIN_ROOM", { roomId: hostJoined.roomId });
    await once(guest, "ROOM_JOINED");

    host.emit("START_GAME", { roomId: hostJoined.roomId });

    await waitForSnapshot(host, (snapshot) => snapshot.room.status === "playing", 1_000);

    return {
      host,
      guest,
      roomId: hostJoined.roomId,
      hostPlayerId: hostConnected.playerId,
      guestPlayerId: guestConnected.playerId
    };
  }

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

function once<EventName extends keyof EventMap>(
  socket: Socket,
  eventName: EventName
): Promise<EventMap[EventName]> {
  return new Promise((resolve) => {
    const untypedSocket = socket as any;
    untypedSocket.once(eventName, (payload: EventMap[EventName]) => resolve(payload));
  });
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
