import type { ResultEntry } from "@fog-maze-race/shared/domain/result-entry";

export type GameResultLogResult = Pick<ResultEntry, "playerId" | "nickname" | "outcome" | "rank" | "elapsedMs">;

export type GameResultLogEntry = {
  id: string;
  roomId: string;
  roomName: string;
  hostNickname: string;
  endedAt: string;
  result: string;
  results: GameResultLogResult[];
};

export function summarizeGameResult(results: readonly ResultEntry[]): string {
  if (results.length === 0) {
    return "완주자 없음";
  }

  const rankedResults = sortRankedResults(results);

  return rankedResults
    .map((entry) => {
      if (entry.outcome === "finished" && entry.rank !== null) {
        const elapsed = entry.elapsedMs === null ? "-" : formatElapsedTime(entry.elapsedMs);
        return `${entry.rank}위 ${entry.nickname}(${elapsed})`;
      }

      return `나감 ${entry.nickname}`;
    })
    .join(" / ");
}

export function sortRankedResults<T extends { rank: number | null }>(results: readonly T[]): T[] {
  return [...results].sort((left, right) => {
    if (left.rank === null && right.rank === null) {
      return 0;
    }
    if (left.rank === null) {
      return 1;
    }
    if (right.rank === null) {
      return -1;
    }
    return left.rank - right.rank;
  });
}

export function formatElapsedTime(elapsedMs: number) {
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
  const milliseconds = elapsedMs % 1_000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export function formatLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}
