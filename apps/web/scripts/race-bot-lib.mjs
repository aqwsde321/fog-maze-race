export const DEFAULT_BOT_URL = "http://127.0.0.1:3000";
export const DEFAULT_BOT_NICKNAME = "Codex";
export const DEFAULT_BOT_COUNT = 1;
export const DEFAULT_JOIN_MESSAGE = "들어왔다.";
export const DEFAULT_FINISH_MESSAGE = "도착했다.";

export function resolveBotConfig({ argv = process.argv, env = process.env } = {}) {
  const options = parseCliOptions(argv.slice(2));
  const url = normalizeOptional(options.url ?? env.RACE_BOT_URL) ?? DEFAULT_BOT_URL;
  const nickname = (normalizeOptional(options.nickname ?? env.RACE_BOT_NICKNAME) ?? DEFAULT_BOT_NICKNAME).slice(0, 5);
  const roomName = normalizeOptional(options.room ?? env.RACE_BOT_ROOM);
  const joinMessage = resolveMessageOption({
    disabled: options.noJoinMessage,
    directValue: options.joinMessage ?? env.RACE_BOT_JOIN_MESSAGE,
    legacyValue: options.greeting ?? env.RACE_BOT_GREETING,
    fallback: DEFAULT_JOIN_MESSAGE
  });
  const finishMessage = resolveMessageOption({
    disabled: options.noFinishMessage,
    directValue: options.finishMessage ?? env.RACE_BOT_FINISH_MESSAGE,
    fallback: DEFAULT_FINISH_MESSAGE
  });
  const autoPilot = options.noAutopilot ? false : env.RACE_BOT_AUTOPILOT !== "false";
  const count = normalizeCount(options.count ?? env.RACE_BOT_COUNT);

  return {
    url,
    nickname,
    roomName,
    joinMessage,
    finishMessage,
    autoPilot,
    count
  };
}

export function createBotNicknames(baseNickname, count) {
  const total = normalizeCount(count);
  const nickname = (normalizeOptional(baseNickname) ?? DEFAULT_BOT_NICKNAME).slice(0, 5);

  if (total === 1) {
    return [nickname];
  }

  const indexedBase = nickname === DEFAULT_BOT_NICKNAME ? "bot" : nickname;

  return Array.from({ length: total }, (_value, index) => {
    const suffix = String(index + 1);
    const prefixLength = Math.max(0, 5 - suffix.length);
    const prefix = indexedBase.slice(0, prefixLength);
    return `${prefix}${suffix}`;
  });
}

export function selectTargetRoom(rooms, preferredRoomName = null) {
  if (preferredRoomName) {
    return rooms.find((room) => room.name === preferredRoomName && room.status === "waiting") ?? null;
  }

  return rooms.find((room) => room.status === "waiting") ?? null;
}

export function findPathToGoal(map, start) {
  if (!map || !start) {
    return null;
  }

  const queue = [{ x: start.x, y: start.y, path: [] }];
  const seen = new Set([`${start.x},${start.y}`]);
  const steps = [
    { x: 1, y: 0, direction: "right" },
    { x: -1, y: 0, direction: "left" },
    { x: 0, y: 1, direction: "down" },
    { x: 0, y: -1, direction: "up" }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (isGoalTile(map, current.x, current.y)) {
      return current.path;
    }

    for (const step of steps) {
      const nextX = current.x + step.x;
      const nextY = current.y + step.y;
      const key = `${nextX},${nextY}`;

      if (seen.has(key) || !isPassableTile(map, nextX, nextY)) {
        continue;
      }

      seen.add(key);
      queue.push({
        x: nextX,
        y: nextY,
        path: [...current.path, step.direction]
      });
    }
  }

  return null;
}

export function shouldAnnounceFinish({
  selfPlayerId,
  finishedPlayerId,
  currentMatchId,
  announcedMatchId,
  finishMessage
}) {
  return Boolean(
    finishMessage &&
      selfPlayerId &&
      finishedPlayerId === selfPlayerId &&
      currentMatchId &&
      announcedMatchId !== currentMatchId
  );
}

function parseCliOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--no-autopilot") {
      options.noAutopilot = true;
      continue;
    }
    if (token === "--no-join-message") {
      options.noJoinMessage = true;
      continue;
    }
    if (token === "--no-finish-message") {
      options.noFinishMessage = true;
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

function resolveMessageOption({ disabled, directValue, legacyValue, fallback }) {
  if (disabled) {
    return null;
  }

  const normalized = normalizeOptional(directValue ?? legacyValue);
  if (normalized === "false" || normalized === "off" || normalized === "none") {
    return null;
  }
  return normalized ?? fallback;
}

function normalizeCount(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_BOT_COUNT), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BOT_COUNT;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_full, letter) => letter.toUpperCase());
}

function tileAt(map, x, y) {
  const row = map?.tiles?.[y];
  if (!row || x < 0 || x >= row.length) {
    return "#";
  }

  return row[x] ?? "#";
}

function isPassableTile(map, x, y) {
  return tileAt(map, x, y) !== "#";
}

function isGoalTile(map, x, y) {
  if (!map) {
    return false;
  }

  if (tileAt(map, x, y) === "G") {
    return true;
  }

  const zone = map.goalZone;
  return x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY && isPassableTile(map, x, y);
}
