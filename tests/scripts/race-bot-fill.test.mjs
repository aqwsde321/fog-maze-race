import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FILL_BOT_KIND,
  DEFAULT_FILL_HOST_NICKNAME,
  DEFAULT_FILL_TIMEOUT_MS,
  resolveFillConfig,
  resolveFillNicknames
} from "../../apps/web/scripts/race-bot-fill-lib.mjs";

test("resolveFillConfig normalizes create/fill options and infers count from custom names", () => {
  const config = resolveFillConfig({
    argv: [
      "node",
      "race-bot-fill.mjs",
      "--room",
      "  Alpha  ",
      "--count",
      "2",
      "--names",
      "  red, blue, green  ",
      "--bot",
      "join",
      "--create",
      "--host-nickname",
      "  Admin  ",
      "--timeout",
      "45000",
      "--url",
      "https://example.com/play"
    ],
    env: {}
  });

  assert.equal(config.roomName, "Alpha");
  assert.equal(config.create, true);
  assert.equal(config.botKind, "join");
  assert.equal(config.hostNickname, "Admin");
  assert.equal(config.waitTimeoutMs, 45_000);
  assert.equal(config.count, 3);
  assert.deepEqual(config.nicknames, ["red", "blue", "green"]);
});

test("resolveFillConfig falls back to explorer fill mode and environment values", () => {
  const config = resolveFillConfig({
    argv: ["node", "race-bot-fill.mjs"],
    env: {
      RACE_BOT_ROOM: "Beta",
      RACE_BOT_COUNT: "2",
      RACE_BOT_NAMES: "봇A, 봇B"
    }
  });

  assert.equal(config.roomName, "Beta");
  assert.equal(config.count, 2);
  assert.equal(config.botKind, DEFAULT_FILL_BOT_KIND);
  assert.equal(config.create, false);
  assert.equal(config.hostNickname, DEFAULT_FILL_HOST_NICKNAME);
  assert.equal(config.waitTimeoutMs, DEFAULT_FILL_TIMEOUT_MS);
  assert.deepEqual(config.nicknames, ["봇A", "봇B"]);
});

test("resolveFillNicknames pads missing names with generated bot nicknames", () => {
  const nicknames = resolveFillNicknames({
    names: ["길잡이", "탐험가"],
    count: 4,
    baseNickname: "Codex"
  });

  assert.deepEqual(nicknames, ["길잡이", "탐험가", "bot1", "bot2"]);
});

test("resolveFillNicknames trims values and keeps generated names unique", () => {
  const nicknames = resolveFillNicknames({
    names: ["Alpha", "bot1", "  ", "Alpha"],
    count: 5,
    baseNickname: "Codex"
  });

  assert.deepEqual(nicknames, ["Alpha", "bot1", "Alph2", "bot2", "bot3"]);
});
