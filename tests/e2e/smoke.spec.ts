import { expect, test } from "@playwright/test";

test("renders the Scriptorium workspace", async ({ page }) => {
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
  await expect(page.getByLabel("AI conversation")).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize file pane" })).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize AI pane" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.locator(".menu-popover")).toBeInViewport({ ratio: 0.95 });
  await expect(page.getByRole("button", { name: "Open Folder" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Themes", exact: true }).click();
  await page.getByRole("button", { name: "Catppuccin Mocha" }).click();
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-theme",
    "catppuccin-mocha",
  );
  await expect(page.getByLabel("Provider")).toHaveCSS(
    "background-color",
    "rgb(49, 50, 68)",
  );
  await expect(page.getByLabel("Model")).toHaveCSS(
    "background-color",
    "rgb(49, 50, 68)",
  );
  await expect(page.getByLabel("Effort")).toHaveCSS(
    "background-color",
    "rgb(49, 50, 68)",
  );
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("OpenAI model")).toBeVisible();
  await expect(page.getByLabel("Claude effort")).toBeVisible();
});
