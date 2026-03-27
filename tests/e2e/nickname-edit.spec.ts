import { expect, test } from "@playwright/test";

import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("connected players can update their nickname from the lobby card", async ({ browser }) => {
  const clients = await createRaceClients(browser, 2);
  const [host, guest] = clients;
  const roomName = `N${Date.now().toString().slice(-4)}`;

  try {
    await host.page.goto("/");
    await host.page.getByLabel("닉네임").fill("아르민");
    await host.page.getByRole("button", { name: "입장" }).click();

    await host.page.getByLabel("닉네임 수정").fill("만두");
    await host.page.getByRole("button", { name: "닉네임 변경" }).click();
    await expect(host.page.getByLabel("닉네임 수정")).toHaveValue("만두");

    await host.page.getByLabel("방 이름").fill(roomName);
    await host.page.getByRole("button", { name: "방 만들기" }).click();

    await guest.page.goto("/");
    await guest.page.getByLabel("닉네임").fill("게2");
    await guest.page.getByRole("button", { name: "입장" }).click();
    await expect(guest.page.getByText(`방장 만두 · 1명 · waiting`)).toBeVisible({
      timeout: 6_000
    });
  } finally {
    await closeRaceClients(clients);
  }
});
