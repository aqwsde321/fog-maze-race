import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { availableParallelism, freemem, totalmem } from "node:os";

import type { ServerHealthSnapshot } from "@fog-maze-race/shared/contracts/server-health";

type RuntimeCounts = {
  activeRooms: number;
  activePlayers: number;
  activeMatches: number;
  connectedSockets: number;
};

type EventLoopMetrics = {
  meanMs: number;
  maxMs: number;
};

type LoadSample = ServerHealthSnapshot["load"] & {
  checkedAt: string;
  uptimeSeconds: number;
  freeMemoryBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
  heapUsedBytes: number;
  rssBytes: number;
};

type ServerLoadMonitorOptions = {
  sampleIntervalMs?: number;
  historyLimit?: number;
  nowMs?: () => number;
  cpuUsage?: () => NodeJS.CpuUsage;
  memoryUsage?: () => NodeJS.MemoryUsage;
  totalMemoryBytes?: () => number;
  freeMemoryBytes?: () => number;
  cpuCores?: () => number;
  getEventLoopMetrics?: () => EventLoopMetrics;
};

const ZERO_LOAD: ServerHealthSnapshot["load"] = {
  cpuPercent: 0,
  eventLoopLagMs: 0,
  eventLoopLagMaxMs: 0,
  activeRooms: 0,
  activePlayers: 0,
  activeMatches: 0,
  connectedSockets: 0,
  movesPerSecond: 0,
  chatMessagesPerSecond: 0,
  roomStateUpdatesPerSecond: 0,
  broadcastsPerSecond: 0,
  fanoutPerSecond: 0
};

export class ServerLoadMonitor {
  private readonly sampleIntervalMs: number;
  private readonly historyLimit: number;
  private readonly nowMs: () => number;
  private readonly cpuUsage: () => NodeJS.CpuUsage;
  private readonly memoryUsage: () => NodeJS.MemoryUsage;
  private readonly totalMemoryBytes: () => number;
  private readonly freeMemoryBytes: () => number;
  private readonly cpuCores: () => number;
  private readonly getEventLoopMetrics: () => EventLoopMetrics;
  private readonly disposeEventLoopMetrics: () => void;
  private readonly samples: LoadSample[] = [];
  private readonly counters = {
    moveInputs: 0,
    chatMessages: 0,
    roomStateUpdates: 0,
    broadcasts: 0,
    fanout: 0
  };

  private previousCpuUsage: NodeJS.CpuUsage;
  private previousNowMs: number;
  private latestSample: LoadSample;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(options: ServerLoadMonitorOptions = {}) {
    const histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();

    this.sampleIntervalMs = options.sampleIntervalMs ?? 1_000;
    this.historyLimit = options.historyLimit ?? 60;
    this.nowMs = options.nowMs ?? (() => performance.now());
    this.cpuUsage = options.cpuUsage ?? (() => process.cpuUsage());
    this.memoryUsage = options.memoryUsage ?? (() => process.memoryUsage());
    this.totalMemoryBytes = options.totalMemoryBytes ?? totalmem;
    this.freeMemoryBytes = options.freeMemoryBytes ?? freemem;
    this.cpuCores = options.cpuCores ?? availableParallelism;
    this.getEventLoopMetrics =
      options.getEventLoopMetrics ??
      (() => {
        const meanMs = Number.isFinite(histogram.mean) ? histogram.mean / 1_000_000 : 0;
        const maxMs = Number.isFinite(histogram.max) ? histogram.max / 1_000_000 : 0;
        histogram.reset();
        return { meanMs, maxMs };
      });
    this.disposeEventLoopMetrics = options.getEventLoopMetrics ? () => undefined : () => histogram.disable();

    this.previousCpuUsage = this.cpuUsage();
    this.previousNowMs = this.nowMs();
    this.latestSample = this.createEmptySample();
  }

  start(readCounts: () => RuntimeCounts) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.collect(readCounts());

    this.intervalId = setInterval(() => {
      this.collect(readCounts());
    }, this.sampleIntervalMs);
    this.intervalId.unref?.();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.disposeEventLoopMetrics();
  }

  recordMoveInput() {
    this.counters.moveInputs += 1;
  }

  recordChatMessage() {
    this.counters.chatMessages += 1;
  }

  recordRoomStateUpdate(recipientCount: number) {
    this.counters.roomStateUpdates += 1;
    this.counters.broadcasts += 1;
    this.counters.fanout += recipientCount;
  }

  recordBroadcast(recipientCount: number) {
    this.counters.broadcasts += 1;
    this.counters.fanout += recipientCount;
  }

  collect(counts: RuntimeCounts) {
    const currentNowMs = this.nowMs();
    const elapsedMs = Math.max(currentNowMs - this.previousNowMs, 1);
    const currentCpuUsage = this.cpuUsage();
    const cpuDeltaMicros =
      currentCpuUsage.user -
      this.previousCpuUsage.user +
      currentCpuUsage.system -
      this.previousCpuUsage.system;
    const cpuPercent = (cpuDeltaMicros / 1_000 / elapsedMs / Math.max(this.cpuCores(), 1)) * 100;
    const loopMetrics = this.getEventLoopMetrics();
    const memory = this.memoryUsage();

    const sample: LoadSample = {
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      freeMemoryBytes: this.freeMemoryBytes(),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      activeRooms: counts.activeRooms,
      activePlayers: counts.activePlayers,
      activeMatches: counts.activeMatches,
      connectedSockets: counts.connectedSockets,
      cpuPercent: roundNumber(cpuPercent),
      eventLoopLagMs: roundNumber(loopMetrics.meanMs),
      eventLoopLagMaxMs: roundNumber(loopMetrics.maxMs),
      movesPerSecond: roundNumber(this.counters.moveInputs / (elapsedMs / 1_000)),
      chatMessagesPerSecond: roundNumber(this.counters.chatMessages / (elapsedMs / 1_000)),
      roomStateUpdatesPerSecond: roundNumber(this.counters.roomStateUpdates / (elapsedMs / 1_000)),
      broadcastsPerSecond: roundNumber(this.counters.broadcasts / (elapsedMs / 1_000)),
      fanoutPerSecond: roundNumber(this.counters.fanout / (elapsedMs / 1_000))
    };

    this.samples.push(sample);
    if (this.samples.length > this.historyLimit) {
      this.samples.shift();
    }

    this.latestSample = sample;
    this.previousNowMs = currentNowMs;
    this.previousCpuUsage = currentCpuUsage;
    this.resetCounters();
  }

  getSnapshot(): Omit<ServerHealthSnapshot, "ok" | "service" | "version" | "deployment"> {
    const current = this.latestSample;
    const recentSamples = this.samples.slice(-10);

    return {
      checkedAt: current.checkedAt,
      uptimeSeconds: current.uptimeSeconds,
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      system: {
        cpuCores: this.cpuCores(),
        totalMemoryBytes: this.totalMemoryBytes(),
        freeMemoryBytes: current.freeMemoryBytes
      },
      process: {
        rssBytes: current.rssBytes,
        heapUsedBytes: current.heapUsedBytes,
        heapTotalBytes: current.heapTotalBytes,
        externalBytes: current.externalBytes
      },
      load: {
        cpuPercent: current.cpuPercent,
        eventLoopLagMs: current.eventLoopLagMs,
        eventLoopLagMaxMs: current.eventLoopLagMaxMs,
        activeRooms: current.activeRooms,
        activePlayers: current.activePlayers,
        activeMatches: current.activeMatches,
        connectedSockets: current.connectedSockets,
        movesPerSecond: current.movesPerSecond,
        chatMessagesPerSecond: current.chatMessagesPerSecond,
        roomStateUpdatesPerSecond: current.roomStateUpdatesPerSecond,
        broadcastsPerSecond: current.broadcastsPerSecond,
        fanoutPerSecond: current.fanoutPerSecond
      },
      recent: {
        avgCpuPercent10s: averageOf(recentSamples, "cpuPercent"),
        avgEventLoopLagMs10s: averageOf(recentSamples, "eventLoopLagMs"),
        peakEventLoopLagMs10s: maxOf(recentSamples, "eventLoopLagMaxMs"),
        avgMovesPerSecond10s: averageOf(recentSamples, "movesPerSecond"),
        avgChatMessagesPerSecond10s: averageOf(recentSamples, "chatMessagesPerSecond"),
        avgRoomStateUpdatesPerSecond10s: averageOf(recentSamples, "roomStateUpdatesPerSecond"),
        avgBroadcastsPerSecond10s: averageOf(recentSamples, "broadcastsPerSecond"),
        avgFanoutPerSecond10s: averageOf(recentSamples, "fanoutPerSecond")
      }
    };
  }

  private createEmptySample(): LoadSample {
    return {
      checkedAt: new Date().toISOString(),
      uptimeSeconds: 0,
      freeMemoryBytes: this.freeMemoryBytes(),
      rssBytes: 0,
      heapUsedBytes: 0,
      heapTotalBytes: 0,
      externalBytes: 0,
      ...ZERO_LOAD
    };
  }

  private resetCounters() {
    this.counters.moveInputs = 0;
    this.counters.chatMessages = 0;
    this.counters.roomStateUpdates = 0;
    this.counters.broadcasts = 0;
    this.counters.fanout = 0;
  }
}

function averageOf(samples: LoadSample[], key: keyof ServerHealthSnapshot["load"]) {
  if (samples.length === 0) {
    return 0;
  }

  return roundNumber(samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length);
}

function maxOf(samples: LoadSample[], key: keyof ServerHealthSnapshot["load"]) {
  if (samples.length === 0) {
    return 0;
  }

  return roundNumber(Math.max(...samples.map((sample) => sample[key])));
}

function roundNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}
