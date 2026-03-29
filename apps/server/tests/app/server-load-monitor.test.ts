import { describe, expect, it } from "vitest";

import { ServerLoadMonitor } from "../../src/app/server-load-monitor.js";

describe("ServerLoadMonitor", () => {
  it("tracks sampled rates and 10-second averages from server activity", () => {
    let nowMs = 0;
    const cpuUsageValues = [
      { user: 0, system: 0 },
      { user: 200_000, system: 0 },
      { user: 500_000, system: 0 }
    ];
    let cpuUsageIndex = 0;
    const eventLoopValues = [
      { meanMs: 4, maxMs: 7 },
      { meanMs: 6, maxMs: 12 }
    ];
    let eventLoopIndex = 0;

    const monitor = new ServerLoadMonitor({
      nowMs: () => nowMs,
      cpuUsage: () => cpuUsageValues[Math.min(cpuUsageIndex++, cpuUsageValues.length - 1)]!,
      memoryUsage: () => ({
        rss: 96 * 1024 * 1024,
        heapUsed: 32 * 1024 * 1024,
        heapTotal: 64 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0
      }),
      totalMemoryBytes: () => 16 * 1024 * 1024 * 1024,
      freeMemoryBytes: () => 12 * 1024 * 1024 * 1024,
      cpuCores: () => 4,
      getEventLoopMetrics: () => eventLoopValues[Math.min(eventLoopIndex++, eventLoopValues.length - 1)]!
    });

    monitor.recordMoveInput();
    monitor.recordMoveInput();
    monitor.recordChatMessage();
    monitor.recordRoomStateUpdate(12);

    nowMs = 1_000;
    monitor.collect({
      activeRooms: 1,
      activePlayers: 15,
      activeMatches: 1,
      connectedSockets: 15
    });

    monitor.recordMoveInput();
    monitor.recordBroadcast(30);

    nowMs = 2_000;
    monitor.collect({
      activeRooms: 1,
      activePlayers: 15,
      activeMatches: 1,
      connectedSockets: 15
    });

    const snapshot = monitor.getSnapshot();

    expect(snapshot.load.cpuPercent).toBe(7.5);
    expect(snapshot.load.eventLoopLagMs).toBe(6);
    expect(snapshot.load.eventLoopLagMaxMs).toBe(12);
    expect(snapshot.load.activeRooms).toBe(1);
    expect(snapshot.load.activePlayers).toBe(15);
    expect(snapshot.load.activeMatches).toBe(1);
    expect(snapshot.load.connectedSockets).toBe(15);
    expect(snapshot.load.movesPerSecond).toBe(1);
    expect(snapshot.load.chatMessagesPerSecond).toBe(0);
    expect(snapshot.load.roomStateUpdatesPerSecond).toBe(0);
    expect(snapshot.load.broadcastsPerSecond).toBe(1);
    expect(snapshot.load.fanoutPerSecond).toBe(30);

    expect(snapshot.recent.avgCpuPercent10s).toBe(6.3);
    expect(snapshot.recent.avgEventLoopLagMs10s).toBe(5);
    expect(snapshot.recent.peakEventLoopLagMs10s).toBe(12);
    expect(snapshot.recent.avgMovesPerSecond10s).toBe(1.5);
    expect(snapshot.recent.avgChatMessagesPerSecond10s).toBe(0.5);
    expect(snapshot.recent.avgRoomStateUpdatesPerSecond10s).toBe(0.5);
    expect(snapshot.recent.avgBroadcastsPerSecond10s).toBe(1);
    expect(snapshot.recent.avgFanoutPerSecond10s).toBe(21);
    expect(snapshot.process.heapTotalBytes).toBe(64 * 1024 * 1024);
    expect(snapshot.process.externalBytes).toBe(4 * 1024 * 1024);
    expect(snapshot.system.freeMemoryBytes).toBe(12 * 1024 * 1024 * 1024);
  });
});
