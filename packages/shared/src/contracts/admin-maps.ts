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
};

export type AdminMapListPayload = {
  maps: AdminMapRecord[];
};

export type UpsertAdminMapPayload = {
  mapId: string;
  name: string;
  mazeRows: string[];
};

export type AdminMapDetailPayload = {
  map: AdminMapRecord;
};
