import { expect, test } from "@playwright/test";

test("renders the DraftAgent workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("DraftAgent")).toBeVisible();
  await expect(page.getByText("No file open")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assistant" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "File" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assistant" })).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize file pane" })).toBeVisible();
  await expect(
    page.getByRole("separator", { name: "Resize assistant pane" }),
  ).toBeVisible();
  await expect(page.getByText(/OpenAI uses Codex CLI/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  const filePane = page.locator(".file-pane");
  const before = await filePane.boundingBox();
  const fileResizer = page.getByRole("separator", { name: "Resize file pane" });
  const box = await fileResizer.boundingBox();

  if (!before || !box) {
    throw new Error("Expected file pane and resize handle to be visible.");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.up();

  const after = await filePane.boundingBox();
  expect(after?.width).toBeGreaterThan(before.width + 20);
});
