import { expect, test, type Page } from "@playwright/test";

import { createRoomFromLobby, enterLobby } from "./helpers/lobby.js";
import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("last remaining racer gets a 10-second countdown and the round ends automatically", async ({ browser }) => {
  const clients = await createRaceClients(browser, 2);
  const [host, guest] = clients;
  const roomName = `L${Date.now().toString().slice(-4)}`;

  try {
    await enterLobby(host.page, "호1");
    await createRoomFromLobby(host.page, roomName);

    await enterLobby(guest.page, "게2");
    await guest.page.getByRole("button", { name: `입장 ${roomName}` }).click();

    await host.page.getByRole("button", { name: "시작" }).click();
    await expect(host.page.getByTestId("countdown-overlay")).toBeHidden({
      timeout: 6_000
    });
    await expect(guest.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    await moveRight(host.page, 12);

    const lastRacerOverlay = guest.page.getByTestId("last-racer-overlay");
    await expect(lastRacerOverlay).toBeVisible({
      timeout: 2_000
    });
    await expect(lastRacerOverlay).toContainText("마지막 주자");
    await expect(lastRacerOverlay).toContainText("10초 후 종료");

    await expect(guest.page.getByTestId("room-status")).toContainText("ended", {
      timeout: 16_000
    });
    await expect(host.page.getByTestId("results-overlay")).toBeVisible({
      timeout: 2_000
    });
    await expect(guest.page.getByTestId("results-overlay")).toBeVisible({
      timeout: 2_000
    });
    await expect(guest.page.getByTestId("results-overlay")).toContainText("나감");
    await expect(guest.page.getByTestId("results-overlay")).toContainText("게2");
  } finally {
    await closeRaceClients(clients);
  }
});

async function moveRight(page: Page, steps: number) {
  await page.getByTestId("game-shell").focus();

  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(35);
  }
}
