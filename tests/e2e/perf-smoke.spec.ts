import { expect, test, type Page } from "@playwright/test";

import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("15 players can join the same room and enter the playing state", async ({ browser }) => {
  test.setTimeout(60_000);

  const clients = await createRaceClients(browser, 15);
  const [host, ...guests] = clients;

  try {
    await enterLobby(host.page, "P00");
    await host.page.getByLabel("방 이름").fill("Full");
    await host.page.getByRole("button", { name: "방 만들기" }).click();

    for (const [index, guest] of guests.entries()) {
      await enterLobby(guest.page, `P${String(index + 1).padStart(2, "0")}`);
      await expect(guest.page.getByRole("button", { name: "입장 Full" })).toBeVisible({
        timeout: 6_000
      });
      await guest.page.getByRole("button", { name: "입장 Full" }).click();
    }

    await expect(host.page.locator("aside article")).toHaveCount(15, {
      timeout: 6_000
    });
    await expect(guests[0]!.page.locator("aside article")).toHaveCount(15, {
      timeout: 6_000
    });
    await expect(host.page.getByRole("button", { name: "시작" })).toBeVisible();
    await expect(guests[0]!.page.getByRole("button", { name: "시작" })).toHaveCount(0);

    await host.page.getByRole("button", { name: "시작" }).click();

    for (const client of [host, guests[0]!, guests[guests.length - 1]!]) {
      await expect(client.page.getByTestId("room-status")).toContainText("playing", {
        timeout: 6_000
      });
    }
  } finally {
    await closeRaceClients(clients);
  }
});

async function enterLobby(page: Page, nickname: string) {
  await page.goto("/");
  await page.getByLabel("닉네임").fill(nickname);
  await page.getByRole("button", { name: "입장" }).click();
}
