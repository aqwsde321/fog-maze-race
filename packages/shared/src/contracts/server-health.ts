export type ServerHealthSnapshot = {
  ok: boolean;
  service: string;
  version: string;
  checkedAt: string;
  uptimeSeconds: number;
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  system: {
    cpuCores: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
  };
  process: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
  };
  load: {
    cpuPercent: number;
    eventLoopLagMs: number;
    eventLoopLagMaxMs: number;
    activeRooms: number;
    activePlayers: number;
    activeMatches: number;
    connectedSockets: number;
    movesPerSecond: number;
    chatMessagesPerSecond: number;
    roomStateUpdatesPerSecond: number;
    broadcastsPerSecond: number;
    fanoutPerSecond: number;
  };
  recent: {
    avgCpuPercent10s: number;
    avgEventLoopLagMs10s: number;
    peakEventLoopLagMs10s: number;
    avgMovesPerSecond10s: number;
    avgChatMessagesPerSecond10s: number;
    avgRoomStateUpdatesPerSecond10s: number;
    avgBroadcastsPerSecond10s: number;
    avgFanoutPerSecond10s: number;
  };
};
