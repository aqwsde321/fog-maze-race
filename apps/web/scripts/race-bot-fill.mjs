import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { io } from "socket.io-client";

import { resolveFillBotScript, resolveFillConfig } from "./race-bot-fill-lib.mjs";

const config = resolveFillConfig();

runFillManager(config);

function runFillManager(fillConfig) {
  const scriptPath = fileURLToPath(new URL(resolveFillBotScript(fillConfig.botKind), import.meta.url));
  const children = [];
  let currentRoomId = null;
  let joinRequested = false;
  let waitingLogged = false;
  let createdRoom = false;
  let fillStarted = false;
  let shuttingDown = false;
  let failed = false;
  let timeoutId = null;

  const socket = io(fillConfig.url, {
    transports: ["websocket"],
    timeout: 10_000,
    autoConnect: false
  });

  function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  function buildChildEnv(nickname) {
    const env = {
      ...process.env,
      RACE_BOT_URL: fillConfig.url,
      RACE_BOT_ROOM: fillConfig.roomName,
      RACE_BOT_NICKNAME: nickname,
      RACE_BOT_COUNT: "1",
      RACE_BOT_AUTOPILOT: String(fillConfig.autoPilot)
    };

    if (fillConfig.joinMessage) {
      env.RACE_BOT_JOIN_MESSAGE = fillConfig.joinMessage;
      env.RACE_BOT_GREETING = fillConfig.joinMessage;
    } else {
      env.RACE_BOT_JOIN_MESSAGE = "false";
      delete env.RACE_BOT_GREETING;
    }

    if (fillConfig.finishMessage) {
      env.RACE_BOT_FINISH_MESSAGE = fillConfig.finishMessage;
    } else {
      env.RACE_BOT_FINISH_MESSAGE = "false";
    }

    return env;
  }

  function attachChildLogging(stream, nickname, isError) {
    if (!stream) {
      return;
    }

    const rl = readline.createInterface({ input: stream });
    rl.on("line", (line) => {
      const writer = isError ? console.error : console.log;
      writer(`[${nickname}] ${line}`);
    });
  }

  function fail(message) {
    if (failed) {
      return;
    }

    failed = true;
    log(message);
    shutdown(1);
  }

  function startFill() {
    if (fillStarted) {
      return;
    }

    fillStarted = true;
    clearTimeout(timeoutId);
    log(`starting fill for ${fillConfig.roomName} with ${fillConfig.nicknames.join(", ")} (${fillConfig.botKind})`);

    for (const nickname of fillConfig.nicknames) {
      const child = spawn(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        env: buildChildEnv(nickname),
        stdio: ["pipe", "pipe", "pipe"]
      });

      children.push({
        nickname,
        process: child
      });
      attachChildLogging(child.stdout, nickname, false);
      attachChildLogging(child.stderr, nickname, true);
      child.on("exit", (code, signal) => {
        log(`worker ${nickname} exited code=${code ?? "null"} signal=${signal ?? "null"}`);
        if (!shuttingDown && (code ?? 0) !== 0) {
          failed = true;
        }
        if (shuttingDown && children.every((entry) => entry.process.exitCode !== null)) {
          process.exit(failed ? 1 : 0);
        }
      });
    }
  }

  function shutdown(exitCode = 0) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    clearTimeout(timeoutId);
    rl.close();
    for (const child of children) {
      if (child.process.exitCode !== null || child.process.stdin.destroyed) {
        continue;
      }
      child.process.stdin.write("quit\n");
    }

    if (currentRoomId) {
      socket.emit("LEAVE_ROOM", { roomId: currentRoomId });
    }
    socket.disconnect();

    setTimeout(() => {
      process.exit(failed ? 1 : exitCode);
    }, 100);
  }

  socket.on("connect", () => {
    waitingLogged = false;
    log("transport connected");
    socket.emit("CONNECT", {
      nickname: fillConfig.hostNickname
    });
  });

  socket.on("CONNECTED", (payload) => {
    currentRoomId = payload.currentRoomId;
    log(`controller connected as ${payload.nickname} (${payload.playerId}) recovered=${payload.recovered}`);
  });

  socket.on("ROOM_LIST_UPDATE", (payload) => {
    const summary = payload.rooms.map((room) => `${room.name}:${room.status}:${room.playerCount}`).join(", ") || "none";
    log(`rooms => ${summary}`);

    if (fillStarted) {
      return;
    }

    const waitingRoom = payload.rooms.find((room) => room.name === fillConfig.roomName && room.status === "waiting") ?? null;

    if (fillConfig.create) {
      if (!createdRoom && !joinRequested) {
        if (waitingRoom) {
          fail(`waiting room ${fillConfig.roomName} already exists`);
          return;
        }

        joinRequested = true;
        socket.emit("CREATE_ROOM", {
          name: fillConfig.roomName,
          mode: "bot_race"
        });
        log(`creating bot race room ${fillConfig.roomName} (controller will be the host)`);
      }
      return;
    }

    if (!waitingRoom) {
      if (!waitingLogged) {
        waitingLogged = true;
        log(`waiting for existing room ${fillConfig.roomName} that you create from the UI`);
      }
      return;
    }

    startFill();
  });

  socket.on("ROOM_JOINED", (payload) => {
    currentRoomId = payload.roomId;
    createdRoom = true;
    joinRequested = false;
    log(`controller joined room ${payload.snapshot.room.name} (${payload.snapshot.room.mode})`);
    if (fillConfig.create) {
      startFill();
    }
  });

  socket.on("ROOM_LEFT", () => {
    currentRoomId = null;
    log("controller left room");
  });

  socket.on("ERROR", (payload) => {
    fail(`server error ${payload.code}: ${payload.message}`);
  });

  socket.on("disconnect", (reason) => {
    if (!shuttingDown) {
      log(`disconnect: ${reason}`);
    }
  });

  socket.on("connect_error", (error) => {
    if (!shuttingDown) {
      log(`connect_error: ${error.message}`);
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("line", (line) => {
    const input = line.trim();
    if (!input) {
      return;
    }

    if (input === "status") {
      log(`status => create=${fillConfig.create} room=${fillConfig.roomName} started=${fillStarted} bots=${fillConfig.nicknames.join(",")}`);
      return;
    }

    if (input === "start") {
      if (!currentRoomId) {
        log("cannot start: controller is not in a room");
        return;
      }

      socket.emit("START_GAME", { roomId: currentRoomId });
      log("start requested");
      return;
    }

    if (input.startsWith("chat ")) {
      if (!currentRoomId) {
        log("cannot chat: controller is not in a room");
        return;
      }

      const content = input.slice(5).trim();
      if (!content) {
        log("cannot chat: empty");
        return;
      }

      socket.emit("SEND_CHAT_MESSAGE", {
        roomId: currentRoomId,
        content
      });
      log(`chat => ${content}`);
      return;
    }

    if (input === "leave") {
      if (!currentRoomId) {
        log("cannot leave: controller is not in a room");
        return;
      }

      socket.emit("LEAVE_ROOM", { roomId: currentRoomId });
      log("leave requested");
      return;
    }

    if (input === "quit" || input === "exit") {
      shutdown(0);
      return;
    }

    log(`unknown command: ${input}`);
  });

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  timeoutId = setTimeout(() => {
    fail(`timed out waiting to fill ${fillConfig.roomName}`);
  }, fillConfig.waitTimeoutMs);

  log(`fill manager starting for ${fillConfig.url} room=${fillConfig.roomName} botKind=${fillConfig.botKind}`);
  if (fillConfig.create) {
    log("create mode is enabled; omit --create if you want to keep room start/reset control in the UI");
  } else {
    log("fill mode is enabled; create the room in the UI first, then this manager will only add bots");
  }
  socket.connect();
}
