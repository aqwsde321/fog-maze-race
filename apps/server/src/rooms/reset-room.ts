import { RoomService } from "./room-service.js";

export function resetRoom(roomService: RoomService, roomId: string) {
  const runtime = roomService.requireRuntime(roomId);

  runtime.room.resetToWaiting();
  roomService.setMatch(roomId, null);
  roomService.setPreviewMap(roomId);
  const previewMap = roomService.getPreviewMap(roomId);
  if (previewMap) {
    runtime.room.seedMatchPositions(previewMap.startSlots);
  }
  roomService.syncRoomRevision(roomId);

  return roomService.getSnapshot(roomId);
}
