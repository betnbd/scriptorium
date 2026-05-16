import { expect, test } from "@playwright/test";

test("renders the DraftAgent workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "File", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Paragraph", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Format", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "View", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Themes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "AI", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Help", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Files" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Outline" })).toBeVisible();
  await expect(page.getByLabel("No file open")).toBeVisible();
  await expect(page.getByLabel("AI conversation")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("OpenAI model")).toBeVisible();
  await expect(page.getByLabel("Claude effort")).toBeVisible();
});
