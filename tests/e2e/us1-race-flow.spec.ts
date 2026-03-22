import { expect, test, type Page } from "@playwright/test";

import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("US1 players can finish a race and return to waiting", async ({ browser }) => {
  const clients = await createRaceClients(browser, 2);
  const [host, guest] = clients;
  const roomName = `A${Date.now().toString().slice(-4)}`;

  try {
    await host.page.goto("/");
    await host.page.getByLabel("닉네임").fill("호1");
    await host.page.getByRole("button", { name: "입장" }).click();
    await host.page.getByLabel("방 이름").fill(roomName);
    await host.page.getByRole("button", { name: "방 만들기" }).click();

    await guest.page.goto("/");
    await guest.page.getByLabel("닉네임").fill("게2");
    await guest.page.getByRole("button", { name: "입장" }).click();
    await guest.page.getByRole("button", { name: `입장 ${roomName}` }).click();

    await host.page.getByRole("button", { name: "시작" }).click();
    await expect(host.page.getByTestId("room-status")).toContainText("countdown");
    await expect(host.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });
    await expect(guest.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    await moveRight(host.page, 12);
    await moveRight(guest.page, 12);

    await expect(host.page.getByTestId("results-overlay")).toBeVisible({
      timeout: 6_000
    });
    await expect(host.page.getByTestId("results-overlay").getByText("1위")).toBeVisible();
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
