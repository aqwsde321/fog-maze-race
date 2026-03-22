export type DisconnectRecord = {
  playerId: string;
  roomId: string;
  deadlineAt: number;
};

export class DisconnectGraceRegistry {
  private readonly records = new Map<string, DisconnectRecord>();

  markDisconnected(playerId: string, roomId: string, graceWindowMs = 30_000, now = Date.now()) {
    const record: DisconnectRecord = {
      playerId,
      roomId,
      deadlineAt: now + graceWindowMs
    };

    this.records.set(playerId, record);
    return record;
  }

  recover(playerId: string, now = Date.now()) {
    const record = this.records.get(playerId);
    if (!record || record.deadlineAt < now) {
      return null;
    }

    this.records.delete(playerId);
    return record;
  }

  get(playerId: string) {
    return this.records.get(playerId) ?? null;
  }

  delete(playerId: string) {
    this.records.delete(playerId);
  }

  expire(now = Date.now()) {
    const expired: DisconnectRecord[] = [];

    for (const [playerId, record] of this.records.entries()) {
      if (record.deadlineAt <= now) {
        this.records.delete(playerId);
        expired.push(record);
      }
    }

    return expired;
  }
}
