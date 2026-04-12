import { expect, test, type Locator, type Page } from "@playwright/test";

import { createRoomFromLobby, enterLobby } from "./helpers/lobby.js";
import { closeRaceClients, createRaceClients } from "./helpers/multi-client.js";

test("host can switch to item mode, pick up an item, and consume it during the round", async ({ browser }) => {
  const clients = await createRaceClients(browser, 1);
  const [host] = clients;
  const roomName = `Item-${Date.now().toString().slice(-4)}`;

  try {
    await host.page.setViewportSize({ width: 1600, height: 1100 });

    await enterLobby(host.page, "호1");
    await createRoomFromLobby(host.page, roomName);

    await host.page.getByLabel("경기").selectOption({ label: "아이템전" });
    await expect(host.page.getByLabel("경기")).toHaveValue("item");

    await host.page.getByRole("button", { name: "시작" }).click();
    await expect(host.page.getByTestId("countdown-overlay")).toBeHidden({
      timeout: 6_000
    });
    await expect(host.page.getByTestId("room-status")).toContainText("playing", {
      timeout: 6_000
    });

    const heldItemCard = host.page.getByTestId("held-item-card");
    const acquiredItemLabel = await pickUpAnyItem(host.page, heldItemCard);
    expect(acquiredItemLabel).toBeTruthy();

    await host.page.keyboard.press("Space");
    await expect(heldItemCard).toBeHidden({ timeout: 1_500 });

    if (acquiredItemLabel === "플레어") {
      await expect(host.page.getByTestId("flare-status-card")).toBeVisible();
    }

    if (acquiredItemLabel === "부스트") {
      await expect(host.page.getByTestId("boost-status-card")).toBeVisible();
    }
  } finally {
    await closeRaceClients(clients);
  }
});

async function pickUpAnyItem(page: Page, heldItemCard: Locator) {
  const route: Array<"ArrowDown" | "ArrowRight" | "ArrowLeft" | "ArrowUp"> = [
    "ArrowDown",
    "ArrowDown",
    "ArrowDown",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowUp",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowUp",
    "ArrowUp",
    "ArrowUp"
  ];

  for (const direction of route) {
    await page.keyboard.press(direction);
    await page.waitForTimeout(80);

    if (await heldItemCard.isVisible()) {
      return extractHeldItemLabel(await heldItemCard.textContent());
    }
  }

  throw new Error("expected to pick up an item before the route finished");
}

function extractHeldItemLabel(text: string | null) {
  if (!text) {
    return null;
  }

  for (const label of ["얼음 함정", "복귀 함정", "플레어", "부스트", "스캐너"]) {
    if (text.includes(label)) {
      return label;
    }
  }

  return null;
}
