import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomListPanel } from "../../src/features/rooms/RoomListPanel.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RoomListPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("submits a nickname update from the header dialog", async () => {
    const onUpdateNickname = vi.fn();

    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={onUpdateNickname}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-nickname-dialog-button"]')?.click();
    });

    const nicknameInput = container.querySelector<HTMLInputElement>('#lobby-nickname');
    expect(nicknameInput).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(nicknameInput, "만두");
      nicknameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="nickname-submit-button"]')?.click();
    });

    expect(onUpdateNickname).toHaveBeenCalledWith("만두");
  });

  it("renders compact header actions and keeps dialogs closed by default", async () => {
    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={vi.fn()}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    const lobbyHeader = container.querySelector<HTMLElement>('[data-testid="lobby-header"]');
    expect(lobbyHeader).not.toBeNull();
    expect(container.textContent).not.toContain("참가할 레이스를 선택하거나 바로 새 방을 열 수 있습니다.");
    expect(lobbyHeader?.textContent).not.toContain("방 목록");
    expect(lobbyHeader?.textContent).not.toContain("개의 대기실");
    expect(container.querySelector('[data-testid="open-nickname-dialog-button"]')?.textContent).toContain("닉네임 변경");
    expect(container.querySelector('[data-testid="open-create-room-dialog-button"]')?.textContent).toContain("방 만들기");
    expect(container.querySelector('[data-testid="nickname-dialog"]')).toBeNull();
    expect(container.querySelector('[data-testid="create-room-dialog"]')).toBeNull();
  });

  it("opens the room creation dialog from the header and keeps the room list centered", async () => {
    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[
            {
              roomId: "room-1",
              name: "Alpha",
              hostNickname: "호스트",
              playerCount: 1,
              status: "waiting",
              mode: "normal"
            }
          ]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={vi.fn()}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    const lobbyHeader = container.querySelector<HTMLElement>('[data-testid="lobby-header"]');
    const roomListCard = container.querySelector<HTMLElement>('[data-testid="room-list-card"]');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-create-room-dialog-button"]')?.click();
    });

    expect(lobbyHeader).not.toBeNull();
    expect(roomListCard).not.toBeNull();
    expect(container.querySelector('[data-testid="create-room-dialog"]')).not.toBeNull();
    expect(lobbyHeader?.nextElementSibling).toBe(roomListCard);
    expect(roomListCard?.style.margin).toBe("0px auto");
  });

  it("renders the room mode selector with the same shell chrome used in the game room", async () => {
    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={vi.fn()}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-create-room-dialog-button"]')?.click();
    });

    const selectShell = container.querySelector<HTMLElement>('[data-testid="room-mode-select-shell"]');
    const selectChevron = container.querySelector<HTMLElement>('[data-testid="room-mode-select-chevron"]');
    const select = container.querySelector<HTMLSelectElement>('#room-mode');

    expect(selectShell).not.toBeNull();
    expect(selectChevron).not.toBeNull();
    expect(select?.style.appearance).toBe("none");
  });

  it("does not render a map selector in the create room dialog", async () => {
    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={vi.fn()}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-create-room-dialog-button"]')?.click();
    });

    expect(container.querySelector("#room-map")).toBeNull();
    expect(container.textContent).not.toContain("아이템");
  });

  it("filters rooms between all, joinable, and active states", async () => {
    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[
            {
              roomId: "room-waiting",
              name: "Waiting",
              hostNickname: "호스트1",
              playerCount: 1,
              status: "waiting",
              mode: "normal"
            },
            {
              roomId: "room-countdown",
              name: "Countdown",
              hostNickname: "호스트2",
              playerCount: 2,
              status: "countdown",
              mode: "normal"
            },
            {
              roomId: "room-playing",
              name: "Playing",
              hostNickname: "호스트3",
              playerCount: 3,
              status: "playing",
              mode: "bot_race"
            },
            {
              roomId: "room-ended",
              name: "Ended",
              hostNickname: "호스트4",
              playerCount: 4,
              status: "ended",
              mode: "normal"
            }
          ]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={vi.fn()}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    expect(container.querySelectorAll('[data-testid^="room-card-"]')).toHaveLength(4);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="room-filter-joinable"]')?.click();
    });

    expect(container.querySelectorAll('[data-testid^="room-card-"]')).toHaveLength(1);
    expect(container.textContent).toContain("Waiting");
    expect(container.textContent).not.toContain("Countdown");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="room-filter-active"]')?.click();
    });

    expect(container.querySelectorAll('[data-testid^="room-card-"]')).toHaveLength(2);
    expect(container.textContent).toContain("Countdown");
    expect(container.textContent).toContain("Playing");
    expect(container.textContent).not.toContain("Ended");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="room-filter-all"]')?.click();
    });

    expect(container.querySelectorAll('[data-testid^="room-card-"]')).toHaveLength(4);
  });

  it("applies distinct badges and card tones for waiting, countdown, and playing rooms", async () => {
    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={[
            {
              roomId: "room-waiting",
              name: "Waiting",
              hostNickname: "호스트1",
              playerCount: 1,
              status: "waiting",
              mode: "normal"
            },
            {
              roomId: "room-countdown",
              name: "Countdown",
              hostNickname: "호스트2",
              playerCount: 2,
              status: "countdown",
              mode: "normal"
            },
            {
              roomId: "room-playing",
              name: "Playing",
              hostNickname: "호스트3",
              playerCount: 3,
              status: "playing",
              mode: "bot_race"
            }
          ]}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={vi.fn()}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    const waitingBadge = container.querySelector<HTMLElement>('[data-testid="room-status-badge-room-waiting"]');
    const countdownBadge = container.querySelector<HTMLElement>('[data-testid="room-status-badge-room-countdown"]');
    const playingBadge = container.querySelector<HTMLElement>('[data-testid="room-status-badge-room-playing"]');
    const waitingCard = container.querySelector<HTMLElement>('[data-testid="room-card-room-waiting"]');
    const countdownCard = container.querySelector<HTMLElement>('[data-testid="room-card-room-countdown"]');
    const playingCard = container.querySelector<HTMLElement>('[data-testid="room-card-room-playing"]');

    expect(waitingBadge?.textContent).toBe("입장 가능");
    expect(countdownBadge?.textContent).toBe("시작 중");
    expect(playingBadge?.textContent).toBe("진행 중");
    expect(waitingCard?.style.borderColor).toBe("rgba(45, 212, 191, 0.28)");
    expect(countdownCard?.style.borderColor).toBe("rgba(251, 191, 36, 0.3)");
    expect(playingCard?.style.borderColor).toBe("rgba(251, 113, 133, 0.28)");
  });

  it("keeps long room lists scrollable inside the room list card", async () => {
    await act(async () => {
      root.render(
        <RoomListPanel
          rooms={Array.from({ length: 12 }, (_, index) => ({
            roomId: `room-${index}`,
            name: `Room ${index}`,
            hostNickname: `호스트${index}`,
            playerCount: index + 1,
            status: "waiting" as const,
            mode: "normal" as const
          }))}
          roomName="Alpha"
          roomMode="normal"
          nickname="아르민"
          connectionState="connected"
          onNicknameSubmit={vi.fn()}
          onRoomNameChange={vi.fn()}
          onRoomModeChange={vi.fn()}
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
        />
      );
    });

    const listBody = container.querySelector<HTMLElement>('[data-testid="room-list-body"]');
    expect(listBody).not.toBeNull();
    expect(listBody?.style.overflowY).toBe("auto");
    expect(listBody?.style.maxHeight).toBe("min(54vh, 580px)");
  });
});
