import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AdminMapOrigin, AdminMapRecord, UpsertAdminMapPayload } from "@fog-maze-race/shared/contracts/admin-maps";
import type { RoomGameMode } from "@fog-maze-race/shared/domain/status";
import {
  DEFAULT_MAP_SOURCES,
  PLAYABLE_MAZE_SIZE,
  buildMapDefinition,
  getMazeRows,
  type EditableMapSource,
  type MapDefinition
} from "@fog-maze-race/shared/maps/map-definitions";

type PersistedMapRecord = EditableMapSource & {
  updatedAt: string;
};

type PersistedMapFile = {
  maps: PersistedMapRecord[];
};

type RegistryEntry = {
  map: MapDefinition;
  source: EditableMapSource;
  origin: AdminMapOrigin;
  updatedAt: string | null;
};

export class MapRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private readonly defaultSources = new Map(DEFAULT_MAP_SOURCES.map((source) => [source.mapId, source]));
  private readonly defaultIds = new Set(DEFAULT_MAP_SOURCES.map((source) => source.mapId));
  private readonly storePath: string | null;

  constructor(options?: { storePath?: string | null }) {
    this.storePath = options?.storePath ?? null;

    for (const source of DEFAULT_MAP_SOURCES) {
      this.entries.set(source.mapId, {
        map: buildMapDefinition(source),
        source,
        origin: "default",
        updatedAt: null
      });
    }
  }

  async load() {
    if (!this.storePath) {
      return;
    }

    try {
      const file = JSON.parse(await readFile(this.storePath, "utf8")) as PersistedMapFile;
      for (const record of file.maps ?? []) {
        const defaultSource = this.defaultSources.get(record.mapId);
        const mergedSource: EditableMapSource = {
          mapId: record.mapId,
          name: record.name,
          mazeRows: record.mazeRows,
          featureFlags: record.featureFlags ?? defaultSource?.featureFlags
        };
        this.entries.set(record.mapId, {
          map: buildMapDefinition(mergedSource),
          source: mergedSource,
          origin: this.defaultIds.has(record.mapId) ? "override" : "custom",
          updatedAt: record.updatedAt
        });
      }
    } catch (error) {
      const isMissing = error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
      if (!isMissing) {
        throw error;
      }
    }
  }

  list() {
    return [...this.entries.values()]
      .filter((entry) => this.isAdminVisible(entry))
      .map((entry) => this.toAdminRecord(entry))
      .sort((left, right) => left.name.localeCompare(right.name, "ko-KR"));
  }

  get(mapId: string) {
    return this.entries.get(mapId)?.map ?? null;
  }

  getAdminRecord(mapId: string) {
    const entry = this.entries.get(mapId);
    return entry ? this.toAdminRecord(entry) : null;
  }

  getRandomPlayable(seedIndex = Date.now()) {
    const playable = this.listPlayableByGameMode("normal")
      .map((entry) => entry.map);

    return playable[seedIndex % playable.length] ?? this.entries.get("training-lap")?.map ?? null;
  }

  getRandomPlayableByGameMode(gameMode: RoomGameMode, seedIndex = Date.now()) {
    const playable = this.listPlayableByGameMode(gameMode).map((entry) => entry.map);
    return playable[seedIndex % playable.length] ?? null;
  }

  async create(input: UpsertAdminMapPayload) {
    const existing = this.entries.get(input.mapId);
    if (existing && existing.origin !== "default") {
      throw new Error("MAP_ALREADY_EXISTS");
    }

    if (existing && existing.origin === "default") {
      throw new Error("MAP_ID_CONFLICT");
    }

    return this.upsert(input, "custom");
  }

  async update(mapId: string, input: Omit<UpsertAdminMapPayload, "mapId">) {
    const entry = this.entries.get(mapId);
    if (!entry || mapId === "training-lap") {
      throw new Error("MAP_NOT_EDITABLE");
    }

    return this.upsert(
      {
        mapId,
        name: input.name,
        mazeRows: input.mazeRows,
        featureFlags: input.featureFlags
      },
      this.defaultIds.has(mapId) ? "override" : "custom"
    );
  }

  async delete(mapId: string) {
    const entry = this.entries.get(mapId);
    if (!entry || mapId === "training-lap" || entry.origin === "default") {
      throw new Error("MAP_NOT_EDITABLE");
    }

    if (this.defaultIds.has(mapId)) {
      const defaultSource = this.defaultSources.get(mapId);
      if (!defaultSource) {
        throw new Error("MAP_NOT_FOUND");
      }

      this.entries.set(mapId, {
        map: buildMapDefinition(defaultSource),
        source: defaultSource,
        origin: "default",
        updatedAt: null
      });
    } else {
      this.entries.delete(mapId);
    }

    await this.persist();
  }

  private async upsert(input: UpsertAdminMapPayload, origin: AdminMapOrigin) {
    if (input.mapId === "training-lap") {
      throw new Error("MAP_NOT_EDITABLE");
    }

    if (input.mazeRows.length !== PLAYABLE_MAZE_SIZE || input.mazeRows.some((row) => row.length !== PLAYABLE_MAZE_SIZE)) {
      throw new Error("MAP_SIZE_INVALID");
    }

    const updatedAt = new Date().toISOString();
    const defaultSource = this.defaultSources.get(input.mapId);
    const source: EditableMapSource = {
      mapId: normalizeMapId(input.mapId),
      name: input.name.trim(),
      mazeRows: input.mazeRows.map((row) => row.trim()),
      featureFlags: input.featureFlags ?? defaultSource?.featureFlags
    };

    const entry: RegistryEntry = {
      map: buildMapDefinition(source),
      source,
      origin,
      updatedAt
    };

    this.entries.set(source.mapId, entry);
    await this.persist();
    return this.toAdminRecord(entry);
  }

  private async persist() {
    if (!this.storePath) {
      return;
    }

    const file: PersistedMapFile = {
      maps: [...this.entries.values()]
        .filter((entry) => entry.origin !== "default")
        .map((entry) => ({
          mapId: entry.source.mapId,
          name: entry.source.name,
          mazeRows: entry.source.mazeRows,
          featureFlags: entry.source.featureFlags,
          updatedAt: entry.updatedAt ?? new Date().toISOString()
        }))
    };

    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(file, null, 2), "utf8");
  }

  private toAdminRecord(entry: RegistryEntry): AdminMapRecord {
    return {
      mapId: entry.map.mapId,
      name: entry.map.name,
      mazeRows: getMazeRows(entry.map),
      width: entry.map.mazeZone.maxX - entry.map.mazeZone.minX + 1,
      height: entry.map.mazeZone.maxY - entry.map.mazeZone.minY + 1,
      origin: entry.origin,
      editable: entry.map.mapId !== "training-lap",
      updatedAt: entry.updatedAt,
      featureFlags: entry.source.featureFlags
    };
  }

  private isAdminVisible(entry: RegistryEntry) {
    return entry.map.mapId !== "training-lap" && entry.map.mazeZone.maxX - entry.map.mazeZone.minX + 1 === PLAYABLE_MAZE_SIZE;
  }

  private listPlayableByGameMode(gameMode: RoomGameMode) {
    return [...this.entries.values()].filter((entry) => {
      const isPlayable =
        entry.map.mapId !== "training-lap" &&
        entry.map.mazeZone.maxX - entry.map.mazeZone.minX + 1 === PLAYABLE_MAZE_SIZE;
      if (!isPlayable) {
        return false;
      }

      const supportsItems = Boolean(entry.map.featureFlags?.itemBoxes);
      return gameMode === "item" ? supportsItems : !supportsItems;
    });
  }
}

function normalizeMapId(mapId: string) {
  const normalized = mapId.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(normalized)) {
    throw new Error("MAP_ID_INVALID");
  }

  return normalized;
}
