import { createBotNicknames, resolveBotConfig } from "./race-bot-lib.mjs";

export const DEFAULT_FILL_BOT_KIND = "explore";
export const DEFAULT_FILL_HOST_NICKNAME = "host";
export const DEFAULT_FILL_TIMEOUT_MS = 30_000;

export function resolveFillConfig({ argv = process.argv, env = process.env } = {}) {
  const botConfig = resolveBotConfig({ argv, env });
  const options = parseCliOptions(argv.slice(2));
  const roomName = normalizeOptional(options.room ?? env.RACE_BOT_ROOM) ?? "Alpha";
  const requestedNames = parseNames(options.names ?? env.RACE_BOT_NAMES);
  const count = Math.max(botConfig.count, requestedNames.length, 1);
  const create = options.create === true || env.RACE_FILL_CREATE === "true";
  const botKind = normalizeBotKind(options.bot ?? env.RACE_FILL_BOT_KIND) ?? DEFAULT_FILL_BOT_KIND;
  const hostNickname = (normalizeOptional(options.hostNickname ?? env.RACE_FILL_HOST_NICKNAME) ?? DEFAULT_FILL_HOST_NICKNAME).slice(0, 5);
  const waitTimeoutMs = normalizeTimeout(options.timeout ?? env.RACE_FILL_TIMEOUT_MS);
  const nicknames = resolveFillNicknames({
    names: requestedNames,
    count,
    baseNickname: botConfig.nickname
  });

  return {
    ...botConfig,
    roomName,
    count: nicknames.length,
    nicknames,
    create,
    botKind,
    hostNickname,
    waitTimeoutMs
  };
}

export function resolveFillNicknames({ names = [], count = 1, baseNickname = "Codex" } = {}) {
  const total = Math.max(normalizeCount(count), names.length, 1);
  const resolved = [];
  const used = new Set();

  for (const name of names) {
    const normalized = normalizeOptional(name);
    if (!normalized) {
      continue;
    }

    const unique = uniquifyNickname(normalized.slice(0, 5), used);
    resolved.push(unique);
    used.add(unique);
  }

  for (const candidate of createBotNicknames(baseNickname, total + resolved.length + 4)) {
    if (resolved.length >= total) {
      break;
    }

    if (used.has(candidate)) {
      continue;
    }

    resolved.push(candidate);
    used.add(candidate);
  }

  return resolved;
}

export function resolveFillBotScript(botKind) {
  return botKind === "join" ? "./race-bot.mjs" : "./race-bot-explorer.mjs";
}

function parseCliOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--create") {
      options.create = true;
      continue;
    }

    if (!token.startsWith("--")) {
      continue;
    }

    const name = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      continue;
    }

    options[toCamelCase(name)] = value;
    index += 1;
  }

  return options;
}

function normalizeOptional(value) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseNames(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((entry) => normalizeOptional(entry))
    .filter(Boolean);
}

function normalizeBotKind(value) {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return null;
  }

  return normalized === "join" ? "join" : "explore";
}

function normalizeCount(value) {
  const parsed = Number.parseInt(String(value ?? 1), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeTimeout(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_FILL_TIMEOUT_MS), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FILL_TIMEOUT_MS;
}

function uniquifyNickname(rawNickname, used) {
  const nickname = rawNickname.slice(0, 5);
  if (!used.has(nickname)) {
    return nickname;
  }

  for (let suffixNumber = 2; suffixNumber < 100; suffixNumber += 1) {
    const suffix = String(suffixNumber);
    const prefixLength = Math.max(0, 5 - suffix.length);
    const candidate = `${nickname.slice(0, prefixLength)}${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return nickname;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_full, letter) => letter.toUpperCase());
}
