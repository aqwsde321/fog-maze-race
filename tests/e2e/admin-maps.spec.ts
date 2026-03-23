import { expect, test } from "@playwright/test";

test("admin maps page can create a new playable map", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  await page.goto("/admin/maps");

  await expect(page.getByText("맵 관리")).toBeVisible();
  await page.getByRole("button", { name: "새 맵" }).click();

  const inputs = page.locator("input");
  await inputs.nth(0).fill(`maze-${suffix}`);
  await inputs.nth(1).fill(`Maze ${suffix}`);
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.getByRole("button", { name: "통로 도구" }).click();
  await page.getByTestId("maze-cell-1-1").click();
  await page.getByRole("button", { name: "맵 생성" }).click();

  await expect(page.getByText("맵을 생성했습니다.")).toBeVisible();
  await expect(page.getByText(`Maze ${suffix}`)).toBeVisible();
});
