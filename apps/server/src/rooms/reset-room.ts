import { RoomService } from "./room-service.js";

export function resetRoom(roomService: RoomService, roomId: string) {
  const runtime = roomService.requireRuntime(roomId);

  runtime.room.resetToWaiting();
  roomService.setMatch(roomId, null);
  roomService.syncRoomRevision(roomId);

  return roomService.getSnapshot(roomId);
}
