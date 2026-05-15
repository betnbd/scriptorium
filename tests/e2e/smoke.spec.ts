import { expect, test } from "@playwright/test";

test("renders the DraftAgent workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("DraftAgent")).toBeVisible();
  await expect(page.getByText("No file open")).toBeVisible();
  await expect(page.getByText("Assistant")).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
});
