export class RevisionSync {
  private readonly revisions = new Map<string, number>();

  peek(roomId: string) {
    return this.revisions.get(roomId) ?? 0;
  }

  next(roomId: string) {
    const nextRevision = this.peek(roomId) + 1;
    this.revisions.set(roomId, nextRevision);
    return nextRevision;
  }

  reset(roomId: string, revision = 0) {
    this.revisions.set(roomId, revision);
  }
}
