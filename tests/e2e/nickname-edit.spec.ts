import { expect, test } from "@playwright/test";

import { createRoomFromLobby, enterLobby, updateNicknameFromLobby } from "./helpers/lobby.js";
import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("connected players can update their nickname from the lobby header", async ({ browser }) => {
  const clients = await createRaceClients(browser, 2);
  const [host, guest] = clients;
  const roomName = `N${Date.now().toString().slice(-4)}`;

  try {
    await enterLobby(host.page, "아르민");

    await updateNicknameFromLobby(host.page, "만두");
    await host.page.getByTestId("open-nickname-dialog-button").click();
    await expect(host.page.getByLabel("닉네임 수정")).toHaveValue("만두");
    await host.page.getByRole("button", { name: "닫기" }).click();

    await createRoomFromLobby(host.page, roomName);

    await enterLobby(guest.page, "게2");
    const joinButton = guest.page.getByRole("button", { name: `입장 ${roomName}` });
    const roomCard = guest.page.locator("article", { has: joinButton });

    await expect(roomCard).toContainText("방장 만두", {
      timeout: 6_000
    });
    await expect(joinButton).toBeVisible({
      timeout: 6_000
    });
  } finally {
    await closeRaceClients(clients);
  }
});
