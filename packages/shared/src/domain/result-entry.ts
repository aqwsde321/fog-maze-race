export type ResultOutcome = "finished" | "left";

export type ResultEntry = {
  playerId: string;
  nickname: string;
  color: string;
  outcome: ResultOutcome;
  rank: number | null;
};
