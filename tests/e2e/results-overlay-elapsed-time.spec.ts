import { expect, test, type Page } from "@playwright/test";

import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("results overlay shows elapsed time for each finisher", async ({ browser }) => {
  const clients = await createRaceClients(browser, 2);
  const [host, guest] = clients;
  const roomName = `T${Date.now().toString().slice(-4)}`;

  try {
    await enterLobby(host.page, "호1");
    await host.page.getByLabel("방 이름").fill(roomName);
    await host.page.getByRole("button", { name: "방 만들기" }).click();

    await enterLobby(guest.page, "게2");
    await guest.page.getByRole("button", { name: `입장 ${roomName}` }).click();

    await host.page.getByRole("button", { name: "시작" }).click();
    await expect(host.page.getByTestId("countdown-overlay")).toBeHidden({
      timeout: 6_000
    });
    await expect(host.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });
    await expect(guest.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    await moveRight(host.page, 8);
    await moveRight(guest.page, 7);

    const overlay = host.page.getByTestId("results-overlay");
    await expect(overlay).toBeVisible({
      timeout: 6_000
    });

    await expect(overlay).toContainText("호1");
    await expect(overlay).toContainText("게2");
    await expect
      .poll(async () => {
        const text = await overlay.textContent();
        return text?.match(/소요시간 \d{2}:\d{2}\.\d{3}/g)?.length ?? 0;
      })
      .toBe(2);
  } finally {
    await closeRaceClients(clients);
  }
});

async function enterLobby(page: Page, nickname: string) {
  await page.goto("/");
  await page.getByLabel("닉네임").fill(nickname);
  await page.getByRole("button", { name: "입장" }).click();
}

async function moveRight(page: Page, steps: number) {
  await page.getByTestId("game-shell").focus();

  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(35);
  }
}
