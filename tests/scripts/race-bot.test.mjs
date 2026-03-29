import test from "node:test";
import assert from "node:assert/strict";

import {
  createBotNicknames,
  DEFAULT_BOT_NICKNAME,
  DEFAULT_FINISH_MESSAGE,
  DEFAULT_JOIN_MESSAGE,
  DEFAULT_BOT_URL,
  findPathToGoal,
  resolveBotConfig,
  selectTargetRoom,
  shouldAnnounceFinish
} from "../../apps/web/scripts/race-bot-lib.mjs";

test("resolveBotConfig prefers CLI arguments and normalizes values", () => {
  const config = resolveBotConfig({
    argv: [
      "node",
      "race-bot.mjs",
      "--url",
      "https://example.com/play  ",
      "--nickname",
      "CodexRunner",
      "--room",
      "  Alpha  ",
      "--join-message",
      "  같이 달려요  ",
      "--finish-message",
      "  도착  ",
      "--no-autopilot"
    ],
    env: {
      RACE_BOT_URL: "https://ignored.example.com",
      RACE_BOT_NICKNAME: "무시됨",
      RACE_BOT_ROOM: "Beta",
      RACE_BOT_GREETING: "안녕하세요",
      RACE_BOT_FINISH_MESSAGE: "무시"
    }
  });

  assert.deepEqual(config, {
    url: "https://example.com/play",
    nickname: "Codex",
    roomName: "Alpha",
    joinMessage: "같이 달려요",
    finishMessage: "도착",
    autoPilot: false,
    count: 1
  });
});

test("resolveBotConfig falls back to defaults and environment variables", () => {
  const config = resolveBotConfig({
    argv: ["node", "race-bot.mjs"],
    env: {
      RACE_BOT_ROOM: "Gamma",
      RACE_BOT_GREETING: "출발합니다"
    }
  });

  assert.equal(config.url, DEFAULT_BOT_URL);
  assert.equal(config.nickname, DEFAULT_BOT_NICKNAME);
  assert.equal(config.roomName, "Gamma");
  assert.equal(config.joinMessage, "출발합니다");
  assert.equal(config.finishMessage, DEFAULT_FINISH_MESSAGE);
  assert.equal(config.autoPilot, true);
  assert.equal(config.count, 1);
});

test("resolveBotConfig accepts a positive bot count from CLI and environment", () => {
  const fromCli = resolveBotConfig({
    argv: ["node", "race-bot.mjs", "--count", "3"],
    env: {
      RACE_BOT_COUNT: "2"
    }
  });
  const fromEnv = resolveBotConfig({
    argv: ["node", "race-bot.mjs"],
    env: {
      RACE_BOT_COUNT: "4"
    }
  });

  assert.equal(fromCli.count, 3);
  assert.equal(fromEnv.count, 4);
});

test("resolveBotConfig uses default chat messages and supports disabling them", () => {
  const defaults = resolveBotConfig({
    argv: ["node", "race-bot.mjs"],
    env: {}
  });
  const disabled = resolveBotConfig({
    argv: ["node", "race-bot.mjs", "--no-join-message", "--no-finish-message"],
    env: {}
  });

  assert.equal(defaults.joinMessage, DEFAULT_JOIN_MESSAGE);
  assert.equal(defaults.finishMessage, DEFAULT_FINISH_MESSAGE);
  assert.equal(disabled.joinMessage, null);
  assert.equal(disabled.finishMessage, null);
});

test("createBotNicknames keeps multi-bot names unique within the five-character server limit", () => {
  assert.deepEqual(createBotNicknames("Codex", 3), ["bot1", "bot2", "bot3"]);
  assert.deepEqual(createBotNicknames("Codex", 12).slice(0, 3), ["bot1", "bot2", "bot3"]);
  assert.deepEqual(createBotNicknames("AB", 2), ["AB1", "AB2"]);
  assert.deepEqual(createBotNicknames("Codex", 1), ["Codex"]);
});

test("selectTargetRoom joins the named waiting room when requested", () => {
  const room = selectTargetRoom(
    [
      { roomId: "1", name: "Alpha", status: "waiting" },
      { roomId: "2", name: "Beta", status: "playing" },
      { roomId: "3", name: "Gamma", status: "waiting" }
    ],
    "Gamma"
  );

  assert.deepEqual(room, { roomId: "3", name: "Gamma", status: "waiting" });
});

test("selectTargetRoom does not fall back to another room when the requested room is unavailable", () => {
  const room = selectTargetRoom(
    [
      { roomId: "1", name: "Alpha", status: "waiting" },
      { roomId: "2", name: "Beta", status: "waiting" }
    ],
    "Gamma"
  );

  assert.equal(room, null);
});

test("findPathToGoal returns the shortest route to the goal tile", () => {
  const path = findPathToGoal(
    {
      tiles: [
        "...",
        ".#.",
        "..G"
      ],
      goalZone: {
        minX: 2,
        maxX: 2,
        minY: 2,
        maxY: 2
      }
    },
    { x: 0, y: 0 }
  );

  assert.deepEqual(path, ["right", "right", "down", "down"]);
});

test("shouldAnnounceFinish only returns true for the bot's first finish message in a match", () => {
  assert.equal(
    shouldAnnounceFinish({
      selfPlayerId: "me",
      finishedPlayerId: "me",
      currentMatchId: "match-1",
      announcedMatchId: null,
      finishMessage: "도착했다."
    }),
    true
  );
  assert.equal(
    shouldAnnounceFinish({
      selfPlayerId: "me",
      finishedPlayerId: "other",
      currentMatchId: "match-1",
      announcedMatchId: null,
      finishMessage: "도착했다."
    }),
    false
  );
  assert.equal(
    shouldAnnounceFinish({
      selfPlayerId: "me",
      finishedPlayerId: "me",
      currentMatchId: "match-1",
      announcedMatchId: "match-1",
      finishMessage: "도착했다."
    }),
    false
  );
  assert.equal(
    shouldAnnounceFinish({
      selfPlayerId: "me",
      finishedPlayerId: "me",
      currentMatchId: null,
      announcedMatchId: null,
      finishMessage: "도착했다."
    }),
    false
  );
  assert.equal(
    shouldAnnounceFinish({
      selfPlayerId: "me",
      finishedPlayerId: "me",
      currentMatchId: "match-1",
      announcedMatchId: null,
      finishMessage: null
    }),
    false
  );
});
