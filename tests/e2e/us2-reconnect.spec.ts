import { expect, test, type Page } from "@playwright/test";

import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("US2 reconnects a disconnected player into the active room", async ({ browser }) => {
  const clients = await createRaceClients(browser, 2);
  const [host, guest] = clients;
  const roomName = `B${Date.now().toString().slice(-4)}`;

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
    await expect(host.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    await moveRight(guest.page, 2);
    await guest.page.close();

    await expect(host.page.locator("aside article")).toHaveCount(2, {
      timeout: 4_000
    });
    await expect(host.page.locator("aside").getByText("게2")).toBeVisible({
      timeout: 4_000
    });

    const recoveredPage = await guest.context.newPage();
    guest.page = recoveredPage;
    await guest.page.goto("/");

    await expect(guest.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    await moveRight(host.page, 12);
    await moveRight(guest.page, 12);

    await expect(host.page.getByTestId("results-overlay")).toBeVisible({
      timeout: 6_000
    });
  } finally {
    await closeRaceClients(clients);
  }
});

test("US2 blocks recovery after the grace window expires", async ({ browser }) => {
  const clients = await createRaceClients(browser, 2);
  const [host, guest] = clients;
  const roomName = `C${Date.now().toString().slice(-4)}`;

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
    await expect(host.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    await guest.page.close();
    await expect(host.page.locator("aside article")).toHaveCount(2, {
      timeout: 4_000
    });
    await expect(host.page.locator("aside").getByText("게2")).toBeVisible({
      timeout: 4_000
    });
    await host.page.waitForTimeout(700);
    await expect(host.page.locator("aside article")).toHaveCount(1, {
      timeout: 4_000
    });

    const latePage = await guest.context.newPage();
    guest.page = latePage;
    await guest.page.goto("/");

    await expect(guest.page.getByText("방 목록")).toBeVisible({
      timeout: 6_000
    });

    await moveRight(host.page, 12);

    await expect(host.page.getByTestId("results-overlay")).toBeVisible({
      timeout: 6_000
    });
    await expect(host.page.getByTestId("results-overlay").locator("strong", { hasText: "나감" })).toBeVisible();
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
