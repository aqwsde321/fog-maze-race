import type { FastifyInstance } from "fastify";
import type { AdminMapDetailPayload, AdminMapListPayload, UpsertAdminMapPayload } from "@fog-maze-race/shared/contracts/admin-maps";

import { MapRegistry } from "../maps/map-registry.js";

export async function registerAdminMapRoutes(app: FastifyInstance, mapRegistry: MapRegistry) {
  app.get("/api/admin/maps", async (): Promise<AdminMapListPayload> => ({
    maps: mapRegistry.list()
  }));

  app.get<{ Params: { mapId: string } }>("/api/admin/maps/:mapId", async (request, reply): Promise<AdminMapDetailPayload> => {
    const map = mapRegistry.getAdminRecord(request.params.mapId);
    if (!map) {
      return reply.code(404).send({ message: "MAP_NOT_FOUND" } as never);
    }

    return { map };
  });

  app.post<{ Body: UpsertAdminMapPayload }>("/api/admin/maps", async (request, reply): Promise<AdminMapDetailPayload> => {
    try {
      const map = await mapRegistry.create(request.body);
      return reply.code(201).send({ map }) as never;
    } catch (error) {
      const message = error instanceof Error ? error.message : "MAP_CREATE_FAILED";
      return reply.code(message === "MAP_ALREADY_EXISTS" || message === "MAP_ID_CONFLICT" ? 409 : 400).send({ message } as never);
    }
  });

  app.put<{ Params: { mapId: string }; Body: Omit<UpsertAdminMapPayload, "mapId"> }>(
    "/api/admin/maps/:mapId",
    async (request, reply): Promise<AdminMapDetailPayload> => {
      try {
        const map = await mapRegistry.update(request.params.mapId, request.body);
        return { map };
      } catch (error) {
        const message = error instanceof Error ? error.message : "MAP_UPDATE_FAILED";
        return reply.code(message === "MAP_NOT_EDITABLE" ? 404 : 400).send({ message } as never);
      }
    }
  );

  app.delete<{ Params: { mapId: string } }>("/api/admin/maps/:mapId", async (request, reply) => {
    try {
      await mapRegistry.delete(request.params.mapId);
      return reply.code(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "MAP_DELETE_FAILED";
      return reply.code(message === "MAP_NOT_EDITABLE" || message === "MAP_NOT_FOUND" ? 404 : 400).send({ message } as never);
    }
  });
}
