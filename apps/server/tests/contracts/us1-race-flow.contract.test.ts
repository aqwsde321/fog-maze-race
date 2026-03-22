import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ConnectedPayload,
  CountdownPayload,
  GameEndedPayload,
  GameStartingPayload,
  PlayerFinishedPayload,
  RoomJoinedPayload,
  RoomListUpdatePayload,
  RoomStateUpdatePayload
} from "@fog-maze-race/shared/contracts/realtime";
import { buildServer } from "../../src/app/server.js";

type EventMap = {
  CONNECTED: ConnectedPayload;
  ROOM_LIST_UPDATE: RoomListUpdatePayload;
  ROOM_JOINED: RoomJoinedPayload;
  ROOM_STATE_UPDATE: RoomStateUpdatePayload;
  GAME_STARTING: GameStartingPayload;
  COUNTDOWN: CountdownPayload;
  PLAYER_FINISHED: PlayerFinishedPayload;
  GAME_ENDED: GameEndedPayload;
};

describe("US1 race flow contract", () => {
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
    await Promise.all(sockets.map((socket) => socket.connected ? socket.close() : undefined));
    sockets.length = 0;
    await app.close();
  });

  it("lets two players create, join, start, finish, and reset a room", async () => {
    const host = createRaceSocket();
    const guest = createRaceSocket();

    host.connect();
    guest.connect();

    host.emit("CONNECT", { nickname: "호1" });
    guest.emit("CONNECT", { nickname: "게2" });

    const hostConnected = await once(host, "CONNECTED");
    const guestConnected = await once(guest, "CONNECTED");
    expect(hostConnected.playerId).not.toBe(guestConnected.playerId);

    await once(host, "ROOM_LIST_UPDATE");
    await once(guest, "ROOM_LIST_UPDATE");

    host.emit("CREATE_ROOM", { name: "Alpha" });
    const hostJoined = await once(host, "ROOM_JOINED");
    expect(hostJoined.snapshot.room.name).toBe("Alpha");
    expect(hostJoined.snapshot.room.status).toBe("waiting");
    expect(hostJoined.snapshot.previewMap?.mapId).toBe("training-lap");
    expect(hostJoined.snapshot.previewMap?.startSlots.length).toBeGreaterThan(0);
    expect(hostJoined.snapshot.members[0]?.position).toEqual({ x: 0, y: 1 });

    const guestRoomList = await once(guest, "ROOM_LIST_UPDATE");
    expect(guestRoomList.rooms[0]?.name).toBe("Alpha");

    guest.emit("JOIN_ROOM", { roomId: hostJoined.roomId });
    const guestJoined = await once(guest, "ROOM_JOINED");
    expect(guestJoined.snapshot.members).toHaveLength(2);
    expect(guestJoined.snapshot.previewMap?.mapId).toBe(hostJoined.snapshot.previewMap?.mapId);
    expect(guestJoined.snapshot.members[1]?.position).toEqual({ x: 1, y: 1 });

    host.emit("MOVE", { roomId: hostJoined.roomId, direction: "right", inputSeq: 1 });
    await waitFor(
      async () => {
        const snapshot = await once(host, "ROOM_STATE_UPDATE");
        const hostMember = snapshot.snapshot.members.find((member) => member.playerId === hostConnected.playerId);
        return (
          snapshot.snapshot.room.status === "waiting" &&
          hostMember?.position?.x === 1 &&
          hostMember.position.y === 1
        );
      },
      1_000
    );

    host.emit("START_GAME", { roomId: hostJoined.roomId });
    const gameStarting = await once(host, "GAME_STARTING");
    expect(gameStarting.mapId).toBe("training-lap");

    host.emit("MOVE", { roomId: hostJoined.roomId, direction: "right", inputSeq: 2 });
    await waitFor(
      async () => {
        const snapshot = await once(host, "ROOM_STATE_UPDATE");
        const hostMember = snapshot.snapshot.members.find((member) => member.playerId === hostConnected.playerId);
        return (
          snapshot.snapshot.room.status === "countdown" &&
          hostMember?.position?.x === 2 &&
          hostMember.position.y === 1
        );
      },
      1_000
    );

    const countdownEvents: number[] = [];
    const finishEvents: PlayerFinishedPayload[] = [];
    const gameEndedEvents: GameEndedPayload[] = [];
    host.on("COUNTDOWN", (payload) => {
      countdownEvents.push(payload.value);
    });
    host.on("PLAYER_FINISHED", (payload) => {
      finishEvents.push(payload);
    });
    host.on("GAME_ENDED", (payload) => {
      gameEndedEvents.push(payload);
    });

    await waitFor(
      async () => {
        const snapshot = await once(host, "ROOM_STATE_UPDATE");
        return snapshot.snapshot.room.status === "playing";
      },
      1000
    );

    for (let step = 0; step < 8; step += 1) {
      host.emit("MOVE", { roomId: hostJoined.roomId, direction: "right", inputSeq: step + 1 });
      guest.emit("MOVE", { roomId: hostJoined.roomId, direction: "right", inputSeq: step + 1 });
      await delay(10);
    }

    await waitFor(async () => finishEvents.length === 2, 1_000);
    expect(finishEvents.map((event) => event.rank).sort()).toEqual([1, 2]);

    await waitFor(async () => gameEndedEvents.length > 0, 1_000);
    const gameEnded = gameEndedEvents[0];
    if (!gameEnded) {
      throw new Error("GAME_ENDED was not received");
    }
    expect(gameEnded.results).toHaveLength(2);
    expect(gameEnded.results.map((entry) => entry.rank).sort()).toEqual([1, 2]);
    expect(countdownEvents).toEqual(expect.arrayContaining([3, 2, 1, 0]));

    await waitFor(
      async () => {
        const snapshot = await once(host, "ROOM_STATE_UPDATE");
        return snapshot.snapshot.room.status === "waiting" && snapshot.snapshot.previewMap !== null;
      },
      1000
    );
  });

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

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number
): Promise<void> {
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
