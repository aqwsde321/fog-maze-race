import type { MapFeatureFlags } from "../domain/item.js";

export type AdminMapOrigin = "default" | "override" | "custom";

export type AdminMapRecord = {
  mapId: string;
  name: string;
  mazeRows: string[];
  width: number;
  height: number;
  origin: AdminMapOrigin;
  editable: boolean;
  updatedAt: string | null;
  featureFlags?: MapFeatureFlags;
};

export type AdminMapListPayload = {
  maps: AdminMapRecord[];
};

export type UpsertAdminMapPayload = {
  mapId: string;
  name: string;
  mazeRows: string[];
  featureFlags?: MapFeatureFlags;
};

export type AdminMapDetailPayload = {
  map: AdminMapRecord;
};
