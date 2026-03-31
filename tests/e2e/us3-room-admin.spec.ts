import { expect, test } from "@playwright/test";

import { createRoomFromLobby, enterLobby } from "./helpers/lobby.js";
import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("US3 hosts can hand off authority and force-end the next round", async ({
  browser
}) => {
  const clients = await createRaceClients(browser, 3);
  const [host, guest, watcher] = clients;

  try {
    await enterLobby(host.page, "호1");
    await createRoomFromLobby(host.page, "Alpha");

    await enterLobby(guest.page, "게2");
    await guest.page.getByRole("button", { name: "입장 Alpha" }).click();

    await enterLobby(watcher.page, "관3");

    await expect(watcher.page.getByRole("button", { name: "입장 Alpha" })).toBeVisible({
      timeout: 6_000
    });

    await host.page.getByRole("button", { name: "나가기" }).click();
    await expect(host.page.getByTestId("room-list-card")).toBeVisible({
      timeout: 6_000
    });

    await watcher.page.getByRole("button", { name: "입장 Alpha" }).click();

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
    await guest.page.getByRole("button", { name: "새 게임 준비" }).click();
    await expect(guest.page.getByTestId("room-status")).toContainText("waiting", {
      timeout: 6_000
    });
  } finally {
    await closeRaceClients(clients);
  }
});
