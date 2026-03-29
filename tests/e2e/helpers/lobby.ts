import type { Page } from "@playwright/test";

export async function enterLobby(page: Page, nickname: string) {
  await page.goto("/");
  await page.getByLabel("닉네임").fill(nickname);
  await page.getByRole("button", { name: "입장" }).click();
}

export async function updateNicknameFromLobby(page: Page, nickname: string) {
  await page.getByTestId("open-nickname-dialog-button").click();
  await page.getByLabel("닉네임 수정").fill(nickname);
  await page.getByTestId("nickname-submit-button").click();
}

export async function createRoomFromLobby(page: Page, roomName: string, roomMode?: "일반 방" | "봇 전용 방") {
  await page.getByTestId("open-create-room-dialog-button").click();
  await page.getByLabel("방 이름").fill(roomName);

  if (roomMode) {
    await page.getByLabel("방 모드").selectOption({ label: roomMode });
  }

  await page.getByTestId("create-room-submit-button").click();
}
