import { spawn } from "node:child_process";
import readline from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { io } from "socket.io-client";

import {
  createBotNicknames,
  findPathToGoal,
  resolveBotConfig,
  selectTargetRoom,
  shouldAnnounceFinish
} from "./race-bot-lib.mjs";

const config = resolveBotConfig();
const isWorker = process.env.RACE_BOT_WORKER === "1";

if (config.count > 1 && !isWorker) {
  runBotManager(config);
} else {
  runSingleBot(config);
}

function runBotManager(managerConfig) {
  const nicknames = createBotNicknames(managerConfig.nickname, managerConfig.count);
  const scriptPath = fileURLToPath(import.meta.url);
  const children = [];
  let shuttingDown = false;

  logManager(`manager starting ${nicknames.length} bots for ${managerConfig.url}`);

  for (const nickname of nicknames) {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: buildWorkerEnv(process.env, managerConfig, nickname),
      stdio: ["pipe", "pipe", "pipe"]
    });

    children.push({
      nickname,
      process: child
    });
    attachChildLogging(child.stdout, nickname, false);
    attachChildLogging(child.stderr, nickname, true);
    child.on("exit", (code, signal) => {
      logManager(`worker ${nickname} exited code=${code ?? "null"} signal=${signal ?? "null"}`);
      if (children.every((entry) => entry.process.exitCode !== null)) {
        const hasFailure = children.some((entry) => (entry.process.exitCode ?? 0) !== 0);
        process.exit(hasFailure ? 1 : 0);
      }
    });
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("line", (line) => {
    for (const child of children) {
      if (child.process.exitCode !== null || child.process.stdin.destroyed) {
        continue;
      }
      child.process.stdin.write(`${line}\n`);
    }
  });

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    rl.close();
    for (const child of children) {
      if (child.process.exitCode !== null || child.process.stdin.destroyed) {
        continue;
      }
      child.process.stdin.write("quit\n");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function buildWorkerEnv(baseEnv, managerConfig, nickname) {
  const env = {
    ...baseEnv,
    RACE_BOT_WORKER: "1",
    RACE_BOT_COUNT: "1",
    RACE_BOT_URL: managerConfig.url,
    RACE_BOT_NICKNAME: nickname,
    RACE_BOT_AUTOPILOT: String(managerConfig.autoPilot)
  };

  if (managerConfig.roomName) {
    env.RACE_BOT_ROOM = managerConfig.roomName;
  } else {
    delete env.RACE_BOT_ROOM;
  }

  if (managerConfig.joinMessage) {
    env.RACE_BOT_JOIN_MESSAGE = managerConfig.joinMessage;
    env.RACE_BOT_GREETING = managerConfig.joinMessage;
  } else {
    delete env.RACE_BOT_GREETING;
    env.RACE_BOT_JOIN_MESSAGE = "false";
  }

  if (managerConfig.finishMessage) {
    env.RACE_BOT_FINISH_MESSAGE = managerConfig.finishMessage;
  } else {
    env.RACE_BOT_FINISH_MESSAGE = "false";
  }

  return env;
}

function attachChildLogging(stream, nickname, isError) {
  if (!stream) {
    return;
  }

  const rl = readline.createInterface({
    input: stream
  });

  rl.on("line", (line) => {
    const writer = isError ? console.error : console.log;
    writer(`[${nickname}] ${line}`);
  });
}

function logManager(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function runSingleBot(singleConfig) {
  let selfPlayerId = null;
  let currentRoomId = null;
  let snapshot = null;
  let activeDriveToken = 0;
  let inputSeq = 0;
  let autoPilot = singleConfig.autoPilot;
  let joinRequested = false;
  let lastAutoplayMatchId = null;
  let joinedMessageRoomId = null;
  let finishedMessageMatchId = null;
  let waitingForPreferredRoomLogged = false;

  const socket = io(singleConfig.url, {
    transports: ["websocket"],
    timeout: 10_000,
    autoConnect: false
  });

  function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  function summarizeRoom() {
    if (!snapshot) {
      return "no room";
    }

    const selfMember = getSelfMember();
    const position = selfMember?.position ? `${selfMember.position.x},${selfMember.position.y}` : "-";
    return `${snapshot.room.name} (${snapshot.room.status}) players=${snapshot.members.length} me=${selfMember?.nickname ?? "-"} pos=${position}`;
  }

  function getSelfMember() {
    return snapshot?.members.find((member) => member.playerId === selfPlayerId) ?? null;
  }

  function emitMove(direction) {
    if (!currentRoomId) {
      log("cannot move: not in room");
      return;
    }

    inputSeq += 1;
    socket.emit("MOVE", {
      roomId: currentRoomId,
      direction,
      inputSeq
    });
    log(`move ${direction} #${inputSeq}`);
  }

  async function drivePath(path, token) {
    for (const direction of path) {
      if (token !== activeDriveToken || snapshot?.room.status !== "playing") {
        return;
      }

      emitMove(direction);
      await sleep(120);
    }
  }

  function maybeAutoplay(reason) {
    if (!autoPilot || !snapshot?.match || snapshot.room.status !== "playing") {
      return;
    }

    if (lastAutoplayMatchId === snapshot.match.matchId) {
      return;
    }

    const selfMember = getSelfMember();
    if (!selfMember?.position) {
      return;
    }

    const path = findPathToGoal(snapshot.match.map, selfMember.position);
    if (!path) {
      log(`autoplay skipped (${reason}): no path`);
      return;
    }

    lastAutoplayMatchId = snapshot.match.matchId;
    activeDriveToken += 1;
    const token = activeDriveToken;
    log(`autoplay start (${reason}): ${path.length} steps`);
    void drivePath(path, token).then(() => {
      if (token === activeDriveToken) {
        log("autoplay path sent");
      }
    });
  }

  function maybeSendJoinMessage() {
    if (!singleConfig.joinMessage || !currentRoomId || joinedMessageRoomId === currentRoomId) {
      return;
    }

    socket.emit("SEND_CHAT_MESSAGE", {
      roomId: currentRoomId,
      content: singleConfig.joinMessage
    });
    joinedMessageRoomId = currentRoomId;
    log(`join message => ${singleConfig.joinMessage}`);
  }

  function maybeSendFinishMessage(finishedPlayerId) {
    const currentMatchId = snapshot?.match?.matchId ?? null;
    if (
      !shouldAnnounceFinish({
        selfPlayerId,
        finishedPlayerId,
        currentMatchId,
        announcedMatchId: finishedMessageMatchId,
        finishMessage: singleConfig.finishMessage
      })
    ) {
      return;
    }

    socket.emit("SEND_CHAT_MESSAGE", {
      roomId: currentRoomId,
      content: singleConfig.finishMessage
    });
    finishedMessageMatchId = currentMatchId;
    log(`finish message => ${singleConfig.finishMessage}`);
  }

  socket.on("connect", () => {
    waitingForPreferredRoomLogged = false;
    log("transport connected");
    socket.emit("CONNECT", {
      nickname: singleConfig.nickname,
      playerId: selfPlayerId ?? undefined
    });
  });

  socket.on("CONNECTED", (payload) => {
    selfPlayerId = payload.playerId;
    currentRoomId = payload.currentRoomId;
    log(`connected as ${payload.nickname} (${payload.playerId}) recovered=${payload.recovered}`);
  });

  socket.on("ROOM_LIST_UPDATE", (payload) => {
    const summary = payload.rooms.map((room) => `${room.name}:${room.status}:${room.playerCount}`).join(", ") || "none";
    log(`rooms => ${summary}`);

    if (currentRoomId || joinRequested) {
      return;
    }

    const targetRoom = selectTargetRoom(payload.rooms, singleConfig.roomName);
    if (!targetRoom) {
      if (singleConfig.roomName && !waitingForPreferredRoomLogged) {
        waitingForPreferredRoomLogged = true;
        log(`waiting for room ${singleConfig.roomName}`);
      }
      return;
    }

    joinRequested = true;
    socket.emit("JOIN_ROOM", { roomId: targetRoom.roomId, role: "racer" });
    log(`joining ${targetRoom.name}`);
  });

  socket.on("ROOM_JOINED", (payload) => {
    currentRoomId = payload.roomId;
    snapshot = payload.snapshot;
    joinRequested = false;
    waitingForPreferredRoomLogged = false;
    log(`joined room ${summarizeRoom()}`);
    maybeSendJoinMessage();
  });

  socket.on("ROOM_STATE_UPDATE", (payload) => {
    snapshot = payload.snapshot;
    currentRoomId = payload.roomId;

    if (snapshot.room.status !== "playing") {
      lastAutoplayMatchId = null;
    }

    log(`room update => ${summarizeRoom()}`);
    maybeAutoplay("room update");
  });

  socket.on("ROOM_LEFT", () => {
    currentRoomId = null;
    snapshot = null;
    joinRequested = false;
    joinedMessageRoomId = null;
    lastAutoplayMatchId = null;
    finishedMessageMatchId = null;
    log("left room");
  });

  socket.on("COUNTDOWN", (payload) => {
    log(`countdown ${payload.value}`);
  });

  socket.on("PLAYER_FINISHED", (payload) => {
    log(`player finished ${payload.playerId} rank=${payload.rank}`);
    maybeSendFinishMessage(payload.playerId);
  });

  socket.on("GAME_ENDED", (payload) => {
    const results = payload.results.map((entry) => `${entry.rank}:${entry.nickname}`).join(", ");
    log(`game ended => ${results}`);
  });

  socket.on("ERROR", (payload) => {
    if (!currentRoomId) {
      joinRequested = false;
    }
    log(`server error ${payload.code}: ${payload.message}`);
  });

  socket.on("disconnect", (reason) => {
    joinRequested = false;
    log(`disconnect: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    log(`connect_error: ${error.message}`);
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
      log(`status => connected=${socket.connected} ${summarizeRoom()} autopilot=${autoPilot}`);
      return;
    }

    if (input === "auto on") {
      autoPilot = true;
      log("autopilot enabled");
      maybeAutoplay("manual");
      return;
    }

    if (input === "auto off") {
      autoPilot = false;
      activeDriveToken += 1;
      log("autopilot disabled");
      return;
    }

    if (input.startsWith("chat ")) {
      if (!currentRoomId) {
        log("cannot chat: not in room");
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

    if (input === "start") {
      if (!currentRoomId) {
        log("cannot start: not in room");
        return;
      }

      socket.emit("START_GAME", {
        roomId: currentRoomId
      });
      log("start requested");
      return;
    }

    if (input === "leave") {
      if (!currentRoomId) {
        log("cannot leave: not in room");
        return;
      }

      socket.emit("LEAVE_ROOM", {
        roomId: currentRoomId
      });
      log("leave requested");
      return;
    }

    if (["up", "down", "left", "right"].includes(input)) {
      activeDriveToken += 1;
      emitMove(input);
      return;
    }

    if (input === "quit" || input === "exit") {
      rl.close();
      socket.disconnect();
      process.exit(0);
    }

    log(`unknown command: ${input}`);
  });

  process.on("SIGINT", () => {
    rl.close();
    socket.disconnect();
    process.exit(0);
  });

  log(`bot starting for ${singleConfig.url}`);
  socket.connect();
}
