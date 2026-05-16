import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("edge 1: default shell shows file, editor, and AI panes without page overflow", async ({
  page,
}) => {
  await expect(page.locator(".file-pane")).toBeVisible();
  await expect(page.getByLabel("No file open")).toBeVisible();
  await expect(page.getByLabel("AI conversation")).toBeVisible();

  await expect(async () => {
    const overflowing = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflowing).toBe(false);
  }).toPass();
});

test("edge 2: narrow desktop width keeps the three-pane workflow usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 980, height: 760 });

  await expect(page.locator(".file-pane")).toBeVisible();
  await expect(page.getByLabel("No file open")).toBeVisible();
  await expect(page.getByLabel("AI conversation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open a file to send" })).toBeVisible();
});

test("edge 3: top menu remains reachable on a compact window", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 700 });

  await expect(page.getByRole("button", { name: "File", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI", exact: true })).toBeVisible();
  await expect(page.locator(".file-pane")).toBeInViewport({ ratio: 0.95 });
  await expect(page.getByLabel("No file open")).toBeInViewport({ ratio: 0.95 });
  await expect(page.getByLabel("AI conversation")).toBeInViewport({ ratio: 0.95 });
  await expect(async () => {
    const overflowing = await page.evaluate(() => {
      const workspace = document.querySelector(".workspace-grid");

      return Boolean(workspace && workspace.scrollWidth > workspace.clientWidth);
    });
    expect(overflowing).toBe(false);
  }).toPass();
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Conversation" })).toBeVisible();
});

test("edge 4: AI pane can be hidden and restored before a project is open", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByLabel("AI conversation")).toHaveCount(0);

  await page.getByRole("button", { name: "AI", exact: true }).click();
  await page.getByRole("button", { name: "New Conversation" }).click();

  await expect(page.getByLabel("AI conversation")).toBeVisible();
});

test("edge 5: file pane resizer changes the sidebar width", async ({ page }) => {
  const filePane = page.locator(".file-pane");
  const before = await filePane.boundingBox();
  const resizer = page.getByRole("separator", { name: "Resize file pane" });
  const box = await resizer.boundingBox();

  if (!before || !box) {
    throw new Error("Expected file pane and file resizer to be visible.");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 160, box.y + box.height / 2);
  await page.mouse.up();

  const after = await filePane.boundingBox();
  expect(after?.width).toBeLessThan(before.width - 8);
});

test("edge 6: AI pane resizer changes the assistant width", async ({ page }) => {
  const assistantPane = page.getByLabel("AI conversation");
  const before = await assistantPane.boundingBox();
  const resizer = page.getByRole("separator", { name: "Resize AI pane" });
  const box = await resizer.boundingBox();

  if (!before || !box) {
    throw new Error("Expected AI pane and AI resizer to be visible.");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + box.height / 2);
  await page.mouse.up();

  const after = await assistantPane.boundingBox();
  expect(after?.width).toBeLessThan(before.width - 8);
});

test("edge 7: AI controls expose provider, model, effort, mode, and message", async ({
  page,
}) => {
  await expect(page.getByLabel("Provider", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Model", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Effort", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Chat" })).toBeChecked();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
});

test("edge 8: LM Studio switches to a model text input and no effort selector", async ({
  page,
}) => {
  await page.getByLabel("Provider", { exact: true }).selectOption("lm-studio");

  await expect(page.getByLabel("Model", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Effort", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open a file to send" })).toBeVisible();
});

test("edge 9: manual import expands inside the AI pane without hiding controls", async ({
  page,
}) => {
  await page.getByText("Manual import").click();

  await expect(page.getByLabel("Import response", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
});

test("edge 10: settings dialog fits model and effort controls on a shorter window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 980, height: 680 });
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Settings" }).click();

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("OpenAI model")).toBeVisible();
  await expect(page.getByLabel("Claude effort")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
});
