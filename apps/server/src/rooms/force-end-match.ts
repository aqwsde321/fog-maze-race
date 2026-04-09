import type { MatchAggregate } from "../core/match.js";
import type { RoomAggregate } from "../core/room.js";

export function forceEndMatch(room: RoomAggregate, match: MatchAggregate) {
  for (const member of room.listMembers()) {
    if (member.role !== "racer" || member.finishRank !== null || member.state === "left") {
      continue;
    }

    match.markLeft({
      playerId: member.playerId,
      nickname: member.nickname,
      color: member.color
    });
  }
}
