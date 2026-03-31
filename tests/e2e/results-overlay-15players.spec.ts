import { expect, test, type Page } from "@playwright/test";

import { createRoomFromLobby, enterLobby } from "./helpers/lobby.js";
import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test.describe.configure({ timeout: 120_000 });

test("15-player results overlay stays open, supports scroll, and resets only by button", async ({
  browser
}) => {
  const clients = await createRaceClients(browser, 15);
  const [host, ...guests] = clients;
  const roomName = `R${Date.now().toString().slice(-4)}`;

  try {
    await enterLobby(host.page, "P00");
    await createRoomFromLobby(host.page, roomName);

    for (const [index, guest] of guests.entries()) {
      await enterLobby(guest.page, `P${String(index + 1).padStart(2, "0")}`);
      await expect(guest.page.getByRole("button", { name: `입장 ${roomName}` })).toBeVisible({
        timeout: 6_000
      });
      await guest.page.getByRole("button", { name: `입장 ${roomName}` }).click();
    }

    await expect(host.page.locator("aside article")).toHaveCount(15, {
      timeout: 6_000
    });

    await host.page.getByRole("button", { name: "시작" }).click();
    await expect(host.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    await moveRight(host.page, 8);
    await host.page.getByRole("button", { name: "강제 종료" }).click();

    const overlay = host.page.getByTestId("results-overlay");
    const resultsList = host.page.getByTestId("results-list");

    await expect(overlay).toBeVisible({
      timeout: 6_000
    });
    await expect(overlay.getByRole("button", { name: "새 게임 준비" })).toBeVisible();
    await expect(resultsList.locator("article")).toHaveCount(15);
    await expect(overlay.getByText("1위")).toBeVisible();

    await host.page.waitForTimeout(2_000);

    await expect(overlay).toBeVisible();
    await expect(host.page.getByTestId("room-status")).toContainText("ended");

    const scrollState = await resultsList.evaluate((node) => {
      const element = node as HTMLDivElement;
      const before = element.scrollTop;
      element.scrollTop = element.scrollHeight;

      return {
        before,
        after: element.scrollTop,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      };
    });

    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
    expect(scrollState.after).toBeGreaterThan(scrollState.before);

    await expect(overlay.getByText("P14")).toBeVisible();

    await overlay.getByRole("button", { name: "새 게임 준비" }).click();
    await expect(host.page.getByTestId("room-status")).toContainText("waiting", {
      timeout: 6_000
    });
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
