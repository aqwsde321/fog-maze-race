import { expect, test } from "@playwright/test";

import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("US3 hosts can rename rooms, hand off authority, and force-end the next round", async ({
  browser
}) => {
  const clients = await createRaceClients(browser, 3);
  const [host, guest, watcher] = clients;

  try {
    await host.page.goto("/");
    await host.page.getByLabel("닉네임").fill("호1");
    await host.page.getByRole("button", { name: "입장" }).click();
    await host.page.getByLabel("방 이름").fill("Alpha");
    await host.page.getByRole("button", { name: "방 만들기" }).click();

    await guest.page.goto("/");
    await guest.page.getByLabel("닉네임").fill("게2");
    await guest.page.getByRole("button", { name: "입장" }).click();
    await guest.page.getByRole("button", { name: "입장 Alpha" }).click();

    await watcher.page.goto("/");
    await watcher.page.getByLabel("닉네임").fill("관3");
    await watcher.page.getByRole("button", { name: "입장" }).click();

    await host.page.getByLabel("방 이름 수정").fill("Beta");
    await host.page.getByRole("button", { name: "이름 변경" }).click();

    await expect(watcher.page.getByRole("button", { name: "입장 Beta" })).toBeVisible({
      timeout: 6_000
    });

    await host.page.getByRole("button", { name: "나가기" }).click();
    await expect(host.page.getByText("방 목록")).toBeVisible({
      timeout: 6_000
    });

    await watcher.page.getByRole("button", { name: "입장 Beta" }).click();

    await guest.page.getByRole("button", { name: "시작" }).click();
    await expect(guest.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });
    await expect(guest.page.getByTestId("countdown-overlay")).toBeHidden({
      timeout: 6_000
    });

    await guest.page.getByRole("button", { name: "강제 종료" }).click();
    await expect(guest.page.getByTestId("results-overlay")).toBeVisible({
      timeout: 6_000
    });
    await expect(guest.page.getByTestId("results-overlay").getByText("나감").first()).toBeVisible();
    await expect(guest.page.getByTestId("room-status")).toContainText("waiting", {
      timeout: 6_000
    });
  } finally {
    await closeRaceClients(clients);
  }
});
