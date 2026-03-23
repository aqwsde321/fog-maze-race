import { expect, test } from "@playwright/test";

test("admin maps page can create a new playable map", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  await page.goto("/admin/maps");

  await expect(page.getByText("맵 관리")).toBeVisible();
  await page.getByRole("button", { name: "새 맵" }).click();

  const inputs = page.locator("input");
  await inputs.nth(0).fill(`maze-${suffix}`);
  await inputs.nth(1).fill(`Maze ${suffix}`);
  await page.locator("textarea").fill(createPlayableRows().join("\n"));
  await page.getByRole("button", { name: "맵 생성" }).click();

  await expect(page.getByText("맵을 생성했습니다.")).toBeVisible();
  await expect(page.getByText(`Maze ${suffix}`)).toBeVisible();
});

function createPlayableRows() {
  const size = 25;
  const rows = Array.from({ length: size }, () => "#".repeat(size).split(""));
  for (let x = 0; x < size - 1; x += 1) {
    rows[2]![x] = ".";
  }
  for (let y = 2; y < size - 1; y += 1) {
    rows[y]![size - 2] = ".";
  }
  rows[size - 2]![size - 2] = "G";
  return rows.map((row) => row.join(""));
}
